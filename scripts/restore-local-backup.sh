#!/usr/bin/env bash
set -euo pipefail

BACKUP_PATH="${1:-}"
CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres_local}"
DB_NAME="${DB_NAME:-shadowcheck_db}"
DB_USER="${DB_USER:-shadowcheck_user}"
DB_ADMIN_USER="${DB_ADMIN_USER:-shadowcheck_admin}"

if [[ -z "$BACKUP_PATH" ]]; then
  echo "Usage: $0 /path/to/backup.dump" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_PATH" ]]; then
  echo "Backup file not found: $BACKUP_PATH" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Postgres container is not running: $CONTAINER" >&2
  echo "Start the local stack first with: docker compose up -d postgres" >&2
  exit 1
fi

echo "Restoring $BACKUP_PATH into $CONTAINER ($DB_NAME)"

echo "Stopping active connections to $DB_NAME"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"

docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"

echo "Installing required extensions"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION \"$DB_USER\";"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA app;"

cat "$BACKUP_PATH" | docker exec -i "$CONTAINER" pg_restore \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --verbose

echo "Re-applying local admin grants"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f /docker-entrypoint-initdb.d/01-shadowcheck-local.sql

echo "Restore complete."
echo "Database: $DB_NAME"
echo "Container: $CONTAINER"
