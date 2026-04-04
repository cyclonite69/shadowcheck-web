#!/usr/bin/env bash
set -euo pipefail

BACKEND_CONTAINER="${BACKEND_CONTAINER:-shadowcheck_backend}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres}"
PGADMIN_CONTAINER="${PGADMIN_CONTAINER:-shadowcheck_pgadmin}"
DB_NAME="${DB_NAME:-shadowcheck_db}"
DB_OWNER="${DB_OWNER:-shadowcheck_user}"
DB_ADMIN_USER="${DB_ADMIN_USER:-shadowcheck_admin}"
BACKUP_DIR_IN_CONTAINER="${BACKUP_DIR_IN_CONTAINER:-/app/backups/db}"
LOCAL_TMP_DIR="${LOCAL_TMP_DIR:-/tmp}"
START_STOPPED_SERVICES=1
BACKUP_FILE=""

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --latest
  $(basename "$0") --backup-file /app/backups/db/file.dump
  $(basename "$0") --backup-file /tmp/file.dump

Options:
  --latest              Restore the newest .dump from ${BACKUP_DIR_IN_CONTAINER} in ${BACKEND_CONTAINER}
  --backup-file PATH    Restore a specific dump path. Paths inside ${BACKEND_CONTAINER} are copied locally first.
  --no-restart          Leave ${BACKEND_CONTAINER} and ${PGADMIN_CONTAINER} stopped after restore
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

need_container() {
  local name="$1"
  docker ps -a --format '{{.Names}}' | grep -qx "$name" || die "Container not found: $name"
}

is_running() {
  local name="$1"
  docker ps --format '{{.Names}}' | grep -qx "$name"
}

fetch_admin_password() {
  docker exec "$BACKEND_CONTAINER" sh -lc \
    'node -e "const mod=require(\"/app/dist/server/server/src/services/secretsManager.js\"); const sm=mod.default || mod; Promise.resolve(sm.load?.()).then(()=>{const pw=sm.get(\"db_admin_password\")||\"\"; if(!pw){process.exit(2)}; process.stdout.write(pw)}).catch(e=>{console.error(e);process.exit(1)})"'
}

latest_backup_path() {
  docker exec "$BACKEND_CONTAINER" sh -lc \
    "ls -1t ${BACKUP_DIR_IN_CONTAINER}/*.dump 2>/dev/null | head -1"
}

copy_backup_to_host() {
  local source_path="$1"
  local dest_path="$LOCAL_TMP_DIR/$(basename "$source_path")"
  docker cp "${BACKEND_CONTAINER}:${source_path}" "$dest_path" >/dev/null
  echo "$dest_path"
}

terminate_db_sessions() {
  local password="$1"
  docker exec -e PGPASSWORD="$password" "$POSTGRES_CONTAINER" \
    psql -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();"
}

drop_database() {
  local password="$1"
  docker exec -e PGPASSWORD="$password" "$POSTGRES_CONTAINER" \
    psql -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
}

create_database() {
  local password="$1"
  docker exec -e PGPASSWORD="$password" "$POSTGRES_CONTAINER" \
    psql -U "$DB_ADMIN_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_OWNER}\" TEMPLATE template0;"
}

restore_database() {
  local password="$1"
  local dump_path="$2"
  cat "$dump_path" | docker exec -e PGPASSWORD="$password" -i "$POSTGRES_CONTAINER" \
    pg_restore -U "$DB_ADMIN_USER" -d "$DB_NAME" --no-owner --no-privileges --verbose
}

verify_restore() {
  local password="$1"
  docker exec -e PGPASSWORD="$password" "$POSTGRES_CONTAINER" \
    psql -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "SELECT COUNT(*) AS networks FROM app.networks;"
  docker exec -e PGPASSWORD="$password" "$POSTGRES_CONTAINER" \
    psql -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "SELECT COUNT(*) AS observations FROM app.observations;"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --latest)
      BACKUP_FILE="__LATEST__"
      shift
      ;;
    --backup-file)
      [[ $# -ge 2 ]] || die "--backup-file requires a path"
      BACKUP_FILE="$2"
      shift 2
      ;;
    --no-restart)
      START_STOPPED_SERVICES=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$BACKUP_FILE" ]] || die "Specify --latest or --backup-file PATH"

need_container "$POSTGRES_CONTAINER"
need_container "$BACKEND_CONTAINER"
need_container "$PGADMIN_CONTAINER"

BACKEND_WAS_RUNNING=0
PGADMIN_WAS_RUNNING=0
if is_running "$BACKEND_CONTAINER"; then
  BACKEND_WAS_RUNNING=1
fi
if is_running "$PGADMIN_CONTAINER"; then
  PGADMIN_WAS_RUNNING=1
fi

if [[ "$BACKUP_FILE" == "__LATEST__" ]]; then
  BACKUP_FILE="$(latest_backup_path)"
  [[ -n "$BACKUP_FILE" ]] || die "No .dump files found in ${BACKUP_DIR_IN_CONTAINER}"
fi

if [[ "$BACKUP_FILE" == /app/* ]]; then
  HOST_BACKUP_PATH="$(copy_backup_to_host "$BACKUP_FILE")"
elif [[ -f "$BACKUP_FILE" ]]; then
  HOST_BACKUP_PATH="$BACKUP_FILE"
else
  die "Backup file not found: $BACKUP_FILE"
fi

DB_ADMIN_PASSWORD="$(fetch_admin_password)"
[[ -n "$DB_ADMIN_PASSWORD" ]] || die "Could not load db_admin_password from backend secrets"

echo "Using backup: $HOST_BACKUP_PATH"

if [[ "$BACKEND_WAS_RUNNING" -eq 1 ]]; then
  echo "Stopping ${BACKEND_CONTAINER}..."
  docker stop "$BACKEND_CONTAINER" >/dev/null
fi
if [[ "$PGADMIN_WAS_RUNNING" -eq 1 ]]; then
  echo "Stopping ${PGADMIN_CONTAINER}..."
  docker stop "$PGADMIN_CONTAINER" >/dev/null
fi

echo "Terminating active DB sessions..."
terminate_db_sessions "$DB_ADMIN_PASSWORD" || true

echo "Dropping ${DB_NAME}..."
drop_database "$DB_ADMIN_PASSWORD"

echo "Creating ${DB_NAME} from template0..."
create_database "$DB_ADMIN_PASSWORD"

echo "Restoring dump..."
restore_database "$DB_ADMIN_PASSWORD" "$HOST_BACKUP_PATH"

echo "Verifying restore..."
verify_restore "$DB_ADMIN_PASSWORD"

if [[ "$START_STOPPED_SERVICES" -eq 1 ]]; then
  if [[ "$BACKEND_WAS_RUNNING" -eq 1 ]]; then
    echo "Starting ${BACKEND_CONTAINER}..."
    docker start "$BACKEND_CONTAINER" >/dev/null
  fi
  if [[ "$PGADMIN_WAS_RUNNING" -eq 1 ]]; then
    echo "Starting ${PGADMIN_CONTAINER}..."
    docker start "$PGADMIN_CONTAINER" >/dev/null
  fi
fi

echo "Restore complete."
