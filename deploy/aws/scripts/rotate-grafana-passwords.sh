#!/usr/bin/env bash
set -euo pipefail

SECRET_NAME="${SECRET_NAME:-shadowcheck/config}"
AWS_REGION="${AWS_REGION:-us-east-1}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres}"
GRAFANA_CONTAINER="${GRAFANA_CONTAINER:-shadowcheck_grafana}"
GRAFANA_ADMIN_SECRET_KEY="${GRAFANA_ADMIN_SECRET_KEY:-grafana_admin_password}"
GRAFANA_READER_SECRET_KEY="${GRAFANA_READER_SECRET_KEY:-grafana_reader_password}"
GRAFANA_ROOT_URL="${GF_SERVER_ROOT_URL:-${GRAFANA_ROOT_URL:-}}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1" >&2
    exit 1
  fi
}

generate_password() {
  openssl rand -base64 32 | tr -d '=+/' | cut -c1-32
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
require_command openssl

SECRET_JSON="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" \
  --query SecretString \
  --output text)"

DB_ADMIN_PASSWORD="$(jq -r '.db_admin_password // empty' <<<"$SECRET_JSON")"
DB_USER_PASSWORD="$(jq -r '.db_password // empty' <<<"$SECRET_JSON")"

if [[ -z "$DB_ADMIN_PASSWORD" && -z "$DB_USER_PASSWORD" ]]; then
  echo "ERROR: Neither db_admin_password nor db_password exists in $SECRET_NAME" >&2
  exit 1
fi

GRAFANA_ADMIN_PASSWORD="${GRAFANA_ADMIN_PASSWORD:-$(generate_password)}"
GRAFANA_READER_PASSWORD="${GRAFANA_READER_PASSWORD:-$(generate_password)}"

UPDATED_SECRET_JSON="$(jq \
  --arg admin_key "$GRAFANA_ADMIN_SECRET_KEY" \
  --arg admin_pass "$GRAFANA_ADMIN_PASSWORD" \
  --arg reader_key "$GRAFANA_READER_SECRET_KEY" \
  --arg reader_pass "$GRAFANA_READER_PASSWORD" \
  '. + {
    ($admin_key): $admin_pass,
    ($reader_key): $reader_pass
  }' <<<"$SECRET_JSON")"

aws secretsmanager put-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" \
  --secret-string "$UPDATED_SECRET_JSON" >/dev/null

export PGPASSWORD="${DB_ADMIN_PASSWORD:-$DB_USER_PASSWORD}"
export GRAFANA_READER_PASSWORD

docker exec \
  -e PGPASSWORD="$PGPASSWORD" \
  -e GRAFANA_READER_PASSWORD="$GRAFANA_READER_PASSWORD" \
  "$POSTGRES_CONTAINER" \
  psql -h 127.0.0.1 -U shadowcheck_admin -d shadowcheck_db -v ON_ERROR_STOP=1 \
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
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_reader;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO grafana_reader;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grafana_reader;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT SELECT ON TABLES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT SELECT ON TABLES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT EXECUTE ON FUNCTIONS TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO grafana_reader;
SQL

if [[ -z "$GRAFANA_ROOT_URL" ]]; then
  echo "WARN: GF_SERVER_ROOT_URL not set; skipping Grafana recreate." >&2
  echo "INFO: Secrets Manager and database role were updated successfully." >&2
  exit 0
fi

export GRAFANA_ADMIN_PASSWORD
export GF_SERVER_ROOT_URL="$GRAFANA_ROOT_URL"

COMPOSE_BIN="$(compose_cmd)"

$COMPOSE_BIN -f docker-compose.monitoring.yml up -d --force-recreate "$GRAFANA_CONTAINER"

echo "Grafana credentials rotated successfully."
echo "  Secret store: $SECRET_NAME"
echo "  Grafana admin key: $GRAFANA_ADMIN_SECRET_KEY"
echo "  Grafana reader key: $GRAFANA_READER_SECRET_KEY"
echo "  Container: $GRAFANA_CONTAINER"
