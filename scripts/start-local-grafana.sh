#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

SECRET_NAME="${SECRET_NAME:-${SHADOWCHECK_AWS_SECRET:-shadowcheck/config}}"
AWS_REGION="${AWS_REGION:-us-east-1}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres_local}"
GRAFANA_CONTAINER="${GRAFANA_CONTAINER:-shadowcheck_grafana}"
GRAFANA_ADMIN_USER="${GRAFANA_ADMIN_USER:-grafanaadmin}"
GF_SERVER_HTTP_PORT="${GF_SERVER_HTTP_PORT:-3002}"
GF_SERVER_ROOT_URL="${GF_SERVER_ROOT_URL:-http://127.0.0.1:${GF_SERVER_HTTP_PORT}/}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

compose_cmd() {
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return 0
  fi
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return 0
  fi
  echo "ERROR: Neither docker-compose nor docker compose is available" >&2
  exit 1
}

require_command aws
require_command jq
require_command docker

if ! docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
  echo "ERROR: Local Postgres container is not running: $POSTGRES_CONTAINER" >&2
  echo "Start the local stack first with: docker compose up -d postgres redis api frontend" >&2
  exit 1
fi

SECRET_JSON="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)"

GRAFANA_ADMIN_PASSWORD="$(jq -r '.grafana_admin_password // empty' <<<"$SECRET_JSON")"
GRAFANA_READER_PASSWORD="$(jq -r '.grafana_reader_password // empty' <<<"$SECRET_JSON")"

if [[ -z "$GRAFANA_ADMIN_PASSWORD" || -z "$GRAFANA_READER_PASSWORD" ]]; then
  echo "ERROR: grafana_admin_password or grafana_reader_password missing in $SECRET_NAME" >&2
  exit 1
fi

export GRAFANA_ADMIN_USER
export GRAFANA_ADMIN_PASSWORD
export GRAFANA_READER_PASSWORD
export GF_SERVER_HTTP_PORT
export GF_SERVER_ROOT_URL

docker exec \
  -e GRAFANA_READER_PASSWORD="$GRAFANA_READER_PASSWORD" \
  "$POSTGRES_CONTAINER" \
  psql -U shadowcheck_user -d shadowcheck_db -v ON_ERROR_STOP=1 \
  -v grafana_reader_password="$GRAFANA_READER_PASSWORD" <<'SQL'
DO $$
DECLARE
    reader_pass text := :'grafana_reader_password';
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_reader') THEN
        EXECUTE format('CREATE USER grafana_reader WITH PASSWORD %L', reader_pass);
    ELSE
        EXECUTE format('ALTER USER grafana_reader PASSWORD %L', reader_pass);
    END IF;
END
$$;

ALTER ROLE grafana_reader SET search_path TO app, public, topology, tiger;

GRANT CONNECT ON DATABASE shadowcheck_db TO grafana_reader;
GRANT USAGE ON SCHEMA app TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO grafana_reader;
GRANT SELECT ON ALL MATERIALIZED VIEWS IN SCHEMA app TO grafana_reader;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grafana_reader;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT SELECT ON TABLES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT SELECT ON MATERIALIZED VIEWS TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT EXECUTE ON FUNCTIONS TO grafana_reader;
SQL

COMPOSE_BIN="$(compose_cmd)"
docker rm -f "$GRAFANA_CONTAINER" 2>/dev/null || true
$COMPOSE_BIN -f docker-compose.monitoring.yml up -d --force-recreate "$GRAFANA_CONTAINER"

echo "Local Grafana started."
echo "  URL: $GF_SERVER_ROOT_URL"
echo "  Login: $GRAFANA_ADMIN_USER"
echo "  Password source: $SECRET_NAME:grafana_admin_password"
echo
echo "Note: if an existing Grafana data volume was initialized with a different admin username,"
echo "the password will still reset but the username may remain unchanged until the local Grafana volume is recreated."
