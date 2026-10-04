#!/usr/bin/env bash
# Clone the local shadowcheck_db into an empty local shadowcheck_test database.
# This script never drops a destination database and never connects to a remote
# Docker context.
set -Eeuo pipefail

readonly POSTGRES_CONTAINER="shadowcheck_postgres_local"
readonly DB_ADMIN_USER="shadowcheck_admin"
readonly SOURCE_DB="shadowcheck_db"
readonly DESTINATION_DB="shadowcheck_test"
readonly POLL_INTERVAL_SECONDS="0.5"
readonly POLL_TIMEOUT_SECONDS="15"

source_may_need_reopen=0

usage() {
  cat >&2 <<'USAGE'
Usage:
  ./scripts/clone-local-test-db.sh shadowcheck_db shadowcheck_test \
    --confirm-local-source=shadowcheck_db

The command operates only through the local shadowcheck_postgres_local Docker
container. shadowcheck_test must not already exist. The confirmation flag is
required because shadowcheck_db is a production-looking source name.
USAGE
}

if [[ "${1:-}" != "$SOURCE_DB" || "${2:-}" != "$DESTINATION_DB" || \
      "${3:-}" != "--confirm-local-source=$SOURCE_DB" || "$#" -ne 3 ]]; then
  usage
  exit 2
fi

printf '%s\n' \
  "Local test clone requested:" \
  "  container:    $POSTGRES_CONTAINER" \
  "  source:       $SOURCE_DB (explicitly confirmed local source)" \
  "  destination:  $DESTINATION_DB (must not already exist)" \
  "  maintenance:  postgres"

if [[ -n "${DOCKER_CONTEXT:-}" ]]; then
  docker_endpoint="$(docker context inspect "$DOCKER_CONTEXT" \
    --format '{{.Endpoints.docker.Host}}')" || {
    printf 'Could not inspect selected Docker context; refusing to continue.\n' >&2
    exit 1
  }
elif [[ -n "${DOCKER_HOST:-}" ]]; then
  docker_endpoint="$DOCKER_HOST"
else
  docker_endpoint="$(docker context inspect \
    --format '{{.Endpoints.docker.Host}}')" || {
    printf 'Could not inspect Docker context; refusing to continue.\n' >&2
    exit 1
  }
fi
if [[ "$docker_endpoint" != unix://* && "$docker_endpoint" != npipe://* ]]; then
  printf 'Docker endpoint is not local (%s); refusing to clone.\n' "$docker_endpoint" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -Fxq "$POSTGRES_CONTAINER"; then
  printf 'Local PostgreSQL container is not running: %s\n' "$POSTGRES_CONTAINER" >&2
  exit 1
fi

psql_maintenance() {
  docker exec -i -e 'PGOPTIONS=-c lock_timeout=10s' "$POSTGRES_CONTAINER" \
    psql -X -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 "$@"
}

psql_destination() {
  docker exec -i -e 'PGOPTIONS=-c lock_timeout=10s' "$POSTGRES_CONTAINER" \
    psql -X -U "$DB_ADMIN_USER" -d "$DESTINATION_DB" -v ON_ERROR_STOP=1 "$@"
}

report_database_state() {
  if ! docker ps --format '{{.Names}}' | grep -Fxq "$POSTGRES_CONTAINER"; then
    printf 'Final database state unavailable: container is not running.\n' >&2
    return 1
  fi

  psql_maintenance -P pager=off -c \
    "SELECT datname, datallowconn, pg_get_userbyid(datdba) AS owner
     FROM pg_database
     WHERE datname IN ('$SOURCE_DB', '$DESTINATION_DB')
     ORDER BY datname;"
}

cleanup() {
  local status=$?
  trap - EXIT ERR INT TERM

  if (( source_may_need_reopen )); then
    if psql_maintenance -c \
      "ALTER DATABASE $SOURCE_DB WITH ALLOW_CONNECTIONS true;"; then
      printf 'Restored ALLOW_CONNECTIONS=true on %s.\n' "$SOURCE_DB" >&2
    else
      printf 'ERROR: could not restore connections on %s.\n' "$SOURCE_DB" >&2
      status=1
    fi
  fi

  if (( status != 0 )); then
    if psql_maintenance -At -c \
      "SELECT 1 FROM pg_database WHERE datname = '$DESTINATION_DB';" 2>/dev/null |
      grep -Fxq 1; then
      printf 'Destination database remains after failure; leaving it untouched for inspection: %s\n' \
        "$DESTINATION_DB" >&2
    fi
  fi

  printf '\nFinal database state:\n' >&2
  if ! report_database_state >&2; then
    status=1
  fi
  exit "$status"
}

on_error() {
  local status="$1"
  printf 'Clone command failed (exit %s); attempting safe cleanup.\n' "$status" >&2
  exit "$status"
}

trap cleanup EXIT
trap 'on_error $?' ERR
trap 'exit 130' INT
trap 'exit 143' TERM

maintenance_db="$(psql_maintenance -At -c 'SELECT current_database();')"
if [[ "$maintenance_db" != postgres ]]; then
  printf 'Maintenance connection reached %s, expected postgres; refusing.\n' \
    "$maintenance_db" >&2
  exit 1
fi

source_state="$(psql_maintenance -At -F '|' -c \
  "SELECT datallowconn, datistemplate
   FROM pg_database
   WHERE datname = '$SOURCE_DB';")"
if [[ "$source_state" != 't|f' ]]; then
  printf 'Source %s is missing, disallows connections, or is a template (%s); refusing.\n' \
    "$SOURCE_DB" "${source_state:-not found}" >&2
  exit 1
fi

destination_exists="$(psql_maintenance -At -c \
  "SELECT EXISTS (
     SELECT 1 FROM pg_database WHERE datname = '$DESTINATION_DB'
   );")"
if [[ "$destination_exists" != f ]]; then
  printf 'Destination %s already exists; this script never drops it.\n' \
    "$DESTINATION_DB" >&2
  exit 1
fi

if ! psql_maintenance -At -c \
  "SELECT 1 FROM pg_roles WHERE rolname = '$DB_ADMIN_USER';" | grep -Fxq 1; then
  printf 'Required owner role is missing: %s\n' "$DB_ADMIN_USER" >&2
  exit 1
fi

# App/client sessions other than pgAdmin are unexpected: stop before changing
# the source. pgAdmin sessions may remain for now but are terminated below,
# because PostgreSQL requires zero source connections during template cloning.
unexpected_sessions_sql="
  SELECT pid, application_name, usename, state, backend_start, query_start,
         left(query, 100) AS query
  FROM pg_stat_activity
  WHERE datname = '$SOURCE_DB'
    AND backend_type = 'client backend'
    AND COALESCE(application_name, '') NOT LIKE 'pgAdmin 4%'
    AND pid <> pg_backend_pid()
  ORDER BY backend_start, pid;"
unexpected_sessions="$(psql_maintenance -At -F ' | ' -c "$unexpected_sessions_sql")"
if [[ -n "$unexpected_sessions" ]]; then
  printf 'Unexpected source sessions remain. Stop the application and retry:\n%s\n' \
    "$unexpected_sessions" >&2
  exit 1
fi

# Set the recovery flag before the ALTER: if the client loses its connection
# after PostgreSQL applies the command, EXIT cleanup still reopens the source.
source_may_need_reopen=1
psql_maintenance -c "ALTER DATABASE $SOURCE_DB WITH ALLOW_CONNECTIONS false;"

psql_maintenance -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = '$SOURCE_DB'
     AND backend_type = 'client backend'
     AND pid <> pg_backend_pid();"

deadline=$((SECONDS + POLL_TIMEOUT_SECONDS))
while true; do
  active_source_clients="$(psql_maintenance -At -c \
    "SELECT count(*)
     FROM pg_stat_activity
     WHERE datname = '$SOURCE_DB'
       AND backend_type = 'client backend'
       AND pid <> pg_backend_pid();")"

  if [[ "$active_source_clients" == 0 ]]; then
    break
  fi

  if (( SECONDS >= deadline )); then
    printf 'Timed out waiting for source client sessions to reach zero (%s remain).\n' \
      "$active_source_clients" >&2
    exit 1
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done

# psql_maintenance always connects to postgres. CREATE DATABASE is a separate
# psql command because it cannot run inside a transaction block.
psql_maintenance -c \
  "CREATE DATABASE $DESTINATION_DB WITH TEMPLATE $SOURCE_DB OWNER $DB_ADMIN_USER;"

psql_maintenance -c "ALTER DATABASE $SOURCE_DB WITH ALLOW_CONNECTIONS true;"
source_may_need_reopen=0

cloned_database="$(psql_destination -At -c 'SELECT current_database();')"
if [[ "$cloned_database" != "$DESTINATION_DB" ]]; then
  printf 'Clone verification connected to unexpected database: %s\n' \
    "$cloned_database" >&2
  exit 1
fi

destination_owner="$(psql_maintenance -At -c \
  "SELECT pg_get_userbyid(datdba)
   FROM pg_database
   WHERE datname = '$DESTINATION_DB';")"
if [[ "$destination_owner" != "$DB_ADMIN_USER" ]]; then
  printf 'Clone owner mismatch: expected %s, got %s.\n' \
    "$DB_ADMIN_USER" "$destination_owner" >&2
  exit 1
fi

printf 'Clone completed and verified: %s -> %s.\n' "$SOURCE_DB" "$DESTINATION_DB"
