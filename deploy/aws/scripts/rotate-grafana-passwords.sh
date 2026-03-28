#!/usr/bin/env bash
set -euo pipefail

# Ensure we run from the repo root so docker-compose.monitoring.yml
# relative volume paths resolve correctly regardless of call site.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT"

SECRET_NAME="${SECRET_NAME:-shadowcheck/config}"
AWS_REGION="${AWS_REGION:-us-east-1}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres}"
GRAFANA_CONTAINER="${GRAFANA_CONTAINER:-shadowcheck_grafana}"
GRAFANA_ADMIN_USER="${GRAFANA_ADMIN_USER:-grafanaadmin}"
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

sync_grafana_admin_user() {
  local mountpoint db_path current_login desired_login escaped_login

  desired_login="$1"

  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "WARN: sqlite3 not installed; skipping Grafana admin username sync." >&2
    return 0
  fi

  mountpoint="$(docker inspect "$GRAFANA_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/grafana"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || true)"
  if [[ -z "$mountpoint" ]]; then
    echo "WARN: Could not resolve Grafana data mount; skipping admin username sync." >&2
    return 0
  fi

  db_path="$mountpoint/grafana.db"
  if [[ ! -f "$db_path" ]]; then
    echo "WARN: Grafana DB not found at $db_path; skipping admin username sync." >&2
    return 0
  fi

  current_login="$(sqlite3 "$db_path" "SELECT login FROM user WHERE is_admin = 1 ORDER BY id LIMIT 1;" 2>/dev/null || true)"
  if [[ -z "$current_login" || "$current_login" == "$desired_login" ]]; then
    return 0
  fi

  escaped_login="${desired_login//\'/\'\'}"
  if [[ "$(sqlite3 "$db_path" "SELECT COUNT(*) FROM user WHERE login = '$escaped_login';" 2>/dev/null || echo 0)" != "0" ]]; then
    echo "WARN: Grafana user '$desired_login' already exists; leaving legacy admin login '$current_login' unchanged." >&2
    return 0
  fi

  sqlite3 "$db_path" <<SQL
UPDATE user
SET login = '$escaped_login',
    updated = datetime('now')
WHERE id = (
  SELECT id
  FROM user
  WHERE is_admin = 1
  ORDER BY id
  LIMIT 1
);
SQL

  echo "Admin username synced to Grafana DB ($current_login -> $desired_login)."
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
\if :{?grafana_reader_password}
  SET app.grafana_reader_password = :'grafana_reader_password';
\else
  \getenv grafana_reader_password GRAFANA_READER_PASSWORD
  \if :{?grafana_reader_password}
    SET app.grafana_reader_password = :'grafana_reader_password';
  \else
    SET app.grafana_reader_password = '';
  \endif
\endif

DO $$
DECLARE
    reader_pass text;
BEGIN
    BEGIN
        reader_pass := current_setting('app.grafana_reader_password');
    EXCEPTION WHEN OTHERS THEN
        reader_pass := NULL;
    END;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_reader') THEN
        IF reader_pass IS NULL OR reader_pass = '' THEN
            RAISE WARNING 'grafana_reader password not provided - skipping role creation';
            RETURN;
        END IF;
        EXECUTE format('CREATE USER grafana_reader WITH PASSWORD %L', reader_pass);
    ELSE
        IF reader_pass IS NOT NULL AND reader_pass != '' THEN
            EXECUTE format('ALTER USER grafana_reader PASSWORD %L', reader_pass);
        END IF;
    END IF;
END
$$;

ALTER ROLE grafana_reader SET search_path TO app, public, topology, tiger;

GRANT CONNECT ON DATABASE shadowcheck_db TO grafana_reader;
GRANT USAGE ON SCHEMA app TO grafana_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO grafana_reader;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO grafana_reader;
DO $$
DECLARE
    mv RECORD;
BEGIN
    FOR mv IN
        SELECT schemaname, matviewname
        FROM pg_matviews
        WHERE schemaname = 'app'
    LOOP
        EXECUTE format(
            'GRANT SELECT ON TABLE %I.%I TO grafana_reader',
            mv.schemaname,
            mv.matviewname
        );
    END LOOP;
END
$$;

-- Minimal public access for PostGIS functions
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grafana_reader;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT SELECT ON TABLES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT EXECUTE ON FUNCTIONS TO grafana_reader;
SQL

if [[ -z "$GRAFANA_ROOT_URL" ]]; then
  echo "WARN: GF_SERVER_ROOT_URL not set; skipping Grafana recreate." >&2
  echo "INFO: Secrets Manager and database role were updated successfully." >&2
  exit 0
fi

export GRAFANA_ADMIN_PASSWORD
export GRAFANA_ADMIN_USER
export GF_SERVER_ROOT_URL="$GRAFANA_ROOT_URL"

COMPOSE_BIN="$(compose_cmd)"

# Explicitly remove existing container to prevent naming conflicts if it exists
# but is not managed by the current compose project context.
docker rm -f "$GRAFANA_CONTAINER" 2>/dev/null || true

$COMPOSE_BIN -f docker-compose.monitoring.yml up -d --force-recreate "$GRAFANA_CONTAINER"

# GF_SECURITY_ADMIN_PASSWORD is only honoured on first run (empty DB).
# If the grafana_data volume already exists the env var is ignored, so we
# force-sync the password into the SQLite DB via the CLI after startup.
echo "Waiting for Grafana to become healthy..."
for i in $(seq 1 30); do
  HEALTH_STATUS=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$GRAFANA_CONTAINER" 2>/dev/null || echo "missing")
  if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "running" ]; then
    # Double check API is actually responding if we only got "running"
    if docker exec "$GRAFANA_CONTAINER" wget -q -O- http://127.0.0.1:3002/api/health >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 2
done

sync_grafana_admin_user "$GRAFANA_ADMIN_USER"

docker exec "$GRAFANA_CONTAINER" \
  grafana cli --homepath /usr/share/grafana admin reset-admin-password "$GRAFANA_ADMIN_PASSWORD" >/dev/null
echo "Admin password synced to Grafana DB."

echo "Grafana credentials rotated successfully."
echo "  Secret store: $SECRET_NAME"
echo "  Grafana admin key: $GRAFANA_ADMIN_SECRET_KEY"
echo "  Grafana reader key: $GRAFANA_READER_SECRET_KEY"
echo "  Container: $GRAFANA_CONTAINER"
