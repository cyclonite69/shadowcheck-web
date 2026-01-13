#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

set -a
# shellcheck source=/dev/null
source "$ROOT_DIR/.env"
set +a

if [[ -z "${DB_USER:-}" || -z "${DB_NAME:-}" || -z "${DB_PASSWORD:-}" ]]; then
  echo "Missing DB_USER/DB_NAME/DB_PASSWORD in .env" >&2
  exit 1
fi

SQL_PATH="$ROOT_DIR/docs/phase10_full_history.sql"

docker cp "$SQL_PATH" shadowcheck_postgres:/tmp/phase10_full_history.sql

docker exec -e PGPASSWORD="$DB_PASSWORD" shadowcheck_postgres \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -f /tmp/phase10_full_history.sql
