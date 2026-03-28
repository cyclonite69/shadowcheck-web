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
FRONTEND_PUBLIC_URL="${FRONTEND_PUBLIC_URL:-http://localhost:8080}"
GF_SERVER_ROOT_URL="${GF_SERVER_ROOT_URL:-${FRONTEND_PUBLIC_URL%/}/grafana/}"

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

sync_grafana_playlist() {
  local api_url playlist_uid existing_status payload

  api_url="http://127.0.0.1:${GF_SERVER_HTTP_PORT}"
  playlist_uid="${GRAFANA_PLAYLIST_UID:-shadowcheck-rotation}"

  payload="$(cat <<JSON
{
  "kind": "Playlist",
  "apiVersion": "playlist.grafana.app/v1",
  "metadata": {
    "name": "${playlist_uid}"
  },
  "spec": {
    "title": "ShadowCheck Rotation",
    "interval": "5m",
    "items": [
      { "type": "dashboard_by_uid", "value": "shadowcheck-overview" },
      { "type": "dashboard_by_uid", "value": "shadowcheck-national" },
      { "type": "dashboard_by_uid", "value": "shadowcheck-michigan" },
      { "type": "dashboard_by_uid", "value": "shadowcheck-oui-fleet" }
    ]
  }
}
JSON
)"

  existing_status="$(curl -s -o /dev/null -w '%{http_code}' -u "${GRAFANA_ADMIN_USER}:${GRAFANA_ADMIN_PASSWORD}" \
    "${api_url}/apis/playlist.grafana.app/v1/namespaces/default/playlists/${playlist_uid}" || true)"

  if [[ "$existing_status" == "200" ]]; then
    curl -fsS -u "${GRAFANA_ADMIN_USER}:${GRAFANA_ADMIN_PASSWORD}" \
      -H 'Content-Type: application/json' \
      -X PUT \
      -d "$payload" \
      "${api_url}/apis/playlist.grafana.app/v1/namespaces/default/playlists/${playlist_uid}" >/dev/null
  else
    curl -fsS -u "${GRAFANA_ADMIN_USER}:${GRAFANA_ADMIN_PASSWORD}" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d "$payload" \
      "${api_url}/apis/playlist.grafana.app/v1/namespaces/default/playlists" >/dev/null
  fi

  echo "Grafana playlist synced: ${playlist_uid}"
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
export FRONTEND_PUBLIC_URL

docker exec \
  -e GRAFANA_READER_PASSWORD="$GRAFANA_READER_PASSWORD" \
  "$POSTGRES_CONTAINER" \
  psql -U shadowcheck_user -d shadowcheck_db -v ON_ERROR_STOP=1 \
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
GRANT USAGE ON SCHEMA public TO grafana_reader;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO grafana_reader;
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

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT SELECT ON TABLES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO grafana_reader;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT EXECUTE ON FUNCTIONS TO grafana_reader;
SQL

COMPOSE_BIN="$(compose_cmd)"
docker rm -f "$GRAFANA_CONTAINER" 2>/dev/null || true
$COMPOSE_BIN -f docker-compose.monitoring.yml up -d --force-recreate "$GRAFANA_CONTAINER"

# GF_SECURITY_ADMIN_PASSWORD is only honoured on first run (empty DB).
# If the grafana_data volume already exists the env var is ignored, so we
# force-sync the password into the SQLite DB via the CLI after startup.
echo "Waiting for Grafana to become healthy..."
for i in $(seq 1 30); do
  HEALTH_STATUS=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$GRAFANA_CONTAINER" 2>/dev/null || echo "missing")
  if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "running" ]; then
    if docker exec "$GRAFANA_CONTAINER" wget -q -O- "http://127.0.0.1:${GF_SERVER_HTTP_PORT}/api/health" >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 2
done

sync_grafana_admin_user "$GRAFANA_ADMIN_USER"

docker exec "$GRAFANA_CONTAINER" \
  grafana cli --homepath /usr/share/grafana admin reset-admin-password "$GRAFANA_ADMIN_PASSWORD" >/dev/null

sync_grafana_playlist

echo "Local Grafana started."
echo "  URL: $GF_SERVER_ROOT_URL"
echo "  Upstream: http://127.0.0.1:${GF_SERVER_HTTP_PORT}/"
echo "  Login: $GRAFANA_ADMIN_USER"
echo "  Password source: $SECRET_NAME:grafana_admin_password"
echo
echo "Note: the admin password is now force-synced into Grafana on startup."
echo "The admin username is also reconciled against the persisted Grafana data volume."
