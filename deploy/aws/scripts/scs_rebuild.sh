#!/bin/bash
# scs_rebuild - Pull, rebuild, and redeploy ShadowCheck on EC2
#
# Secrets are loaded from AWS Secrets Manager at startup.
set -euo pipefail

# Self-install: create /usr/local/bin/scs_rebuild symlink on first run
SCRIPT_PATH="$(realpath "$0")"
if [ ! -L /usr/local/bin/scs_rebuild ] || [ "$(readlink -f /usr/local/bin/scs_rebuild 2>/dev/null)" != "$SCRIPT_PATH" ]; then
  if sudo ln -sf "$SCRIPT_PATH" /usr/local/bin/scs_rebuild 2>/dev/null; then
    echo "  Installed: 'scs_rebuild' is now available system-wide"
  fi
fi

APP_DIR="${SCS_DIR:-$HOME/shadowcheck}"
cd "$APP_DIR"

# Config file for persistent settings (custom env overrides, etc.)
SCS_ENV="$HOME/.shadowcheck-env"
PGADMIN_READY=0
ENABLE_GRAFANA_MONITORING="${ENABLE_GRAFANA_MONITORING:-true}"
SCS_SKIP_CLEANUP="${SCS_SKIP_CLEANUP:-false}"

wait_for_container_health() {
  local container="$1"
  local timeout="${2:-60}"
  local elapsed=0

  while [ "$elapsed" -lt "$timeout" ]; do
    local status
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || echo "missing")"

    case "$status" in
      healthy|running)
        echo "  ✅ $container is $status"
        return 0
        ;;
      unhealthy|exited|dead)
        echo "  ❌ $container is $status"
        docker logs --tail 50 "$container" 2>/dev/null || true
        return 1
        ;;
    esac

    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "  ❌ Timed out waiting for $container health"
  docker inspect --format 'status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || true
  docker logs --tail 50 "$container" 2>/dev/null || true
  return 1
}

cleanup_docker_artifacts() {
  if [ "$SCS_SKIP_CLEANUP" = "true" ]; then
    echo "  ⚠️ Skipping Docker cleanup (SCS_SKIP_CLEANUP=true)"
    return 0
  fi
  echo "  Cleaning up old Docker artifacts..."
  docker system prune -f 2>/dev/null || true
  docker image prune -a -f --filter "until=24h" 2>/dev/null || true
}

print_disk_usage() {
  df -h / | awk 'NR==2{print $5, "used,", $4, "free"}'
}

log_cert_state() {
  local cert_root="$1"
  local cert_file="$cert_root/server.crt"
  local key_file="$cert_root/server.key"

  if sudo [ -f "$cert_file" ]; then
    local fingerprint
    local not_after
    fingerprint="$(sudo openssl x509 -noout -fingerprint -sha256 -in "$cert_file" 2>/dev/null | cut -d= -f2 || echo "unknown")"
    not_after="$(sudo openssl x509 -noout -enddate -in "$cert_file" 2>/dev/null | cut -d= -f2 || echo "unknown")"
    echo "  🔐 Cert found: $cert_file"
    echo "     SHA256: $fingerprint"
    echo "     Expires: $not_after"
  else
    echo "  ⚠️ Cert missing at $cert_file"
  fi

  if sudo [ -L "$key_file" ]; then
    echo "  🔎 Key is symlink: $key_file -> $(sudo readlink "$key_file" 2>/dev/null || echo "unknown")"
  elif sudo [ -f "$key_file" ]; then
    echo "  🔐 Key found: $key_file"
  else
    echo "  ⚠️ Key missing at $key_file"
  fi
}

echo "=== scs_rebuild ==="

# 1. Pull latest first
echo "[1/8] Pulling latest..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "  Detected branch: $CURRENT_BRANCH"
git pull origin "$CURRENT_BRANCH"

# 2. Prepare certificates and persistent volumes (CRITICAL: must happen before infra/containers start)
echo "[2/8] Preparing persistent volumes and certificates..."
CERTS_DIR_BASE=/var/lib/postgresql
CERTS_DIR_WEB=$CERTS_DIR_BASE/web_certs

sudo mkdir -p "$CERTS_DIR_WEB" /var/lib/pgadmin /var/lib/redis
sudo chmod 711 "$CERTS_DIR_BASE" 2>/dev/null || true

# Repair/Migrate
echo "  Auditing certificate state..."
log_cert_state "$CERTS_DIR_WEB"

# Migration: Move certs from old location if they exist and new location is empty
OLD_PATHS="/var/lib/postgresql/certs/web /var/lib/postgresql/web /var/lib/postgresql/certs"
for OLD_PATH in $OLD_PATHS; do
  if sudo [ -f "$OLD_PATH/server.crt" ] && ! sudo [ -f "$CERTS_DIR_WEB/server.crt" ]; then
    echo "  🚚 Migrating certificates from $OLD_PATH..."
    sudo mv "$OLD_PATH/"* "$CERTS_DIR_WEB/" 2>/dev/null || true
    break
  fi
done

# Repair broken symlinks from previous regressions
if sudo [ -L "$CERTS_DIR_WEB/server.key" ]; then
  KEY_TARGET="$(sudo readlink "$CERTS_DIR_WEB/server.key" 2>/dev/null || true)"
  if [ "$KEY_TARGET" = "server.key" ]; then
    echo "  🛠️ Repairing broken self-referential server.key symlink..."
    sudo rm -f "$CERTS_DIR_WEB/server.key"
  fi
fi

# Ensure pgAdmin compatible symlink exists (it expects .cert, we generate .crt)
if sudo [ -f "$CERTS_DIR_WEB/server.crt" ] && ! sudo [ -L "$CERTS_DIR_WEB/server.cert" ]; then
  sudo ln -sf server.crt "$CERTS_DIR_WEB/server.cert"
fi

# Set permissions
sudo chmod 755 "$CERTS_DIR_WEB"
sudo chown -R 101:101 "$CERTS_DIR_WEB" # nginx user
sudo chown -R 5050:5050 /var/lib/pgadmin # pgadmin user
sudo chown -R 999:999 /var/lib/redis    # redis user

echo "  Final cert state for this run:"
log_cert_state "$CERTS_DIR_WEB"

# 3. Clean up old Docker artifacts
echo "[3/8] Cleaning up old Docker artifacts..."
cleanup_docker_artifacts
echo "  Disk usage: $(print_disk_usage)"

# 4. Build images
echo "[4/8] Building images..."
docker build --no-cache -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
docker build --no-cache -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# 5. Ensure infrastructure is running
echo "[5/8] Ensuring infrastructure is running..."
if ! docker ps | grep -q shadowcheck_postgres || ! docker ps | grep -q shadowcheck_redis || ! docker ps | grep -q shadowcheck_pgadmin; then
  echo "  Starting/Updating Infrastructure (PostgreSQL, Redis, PgAdmin)..."
  sudo "$APP_DIR/deploy/aws/scripts/deploy-postgres.sh"
  sudo "$APP_DIR/deploy/aws/scripts/deploy-redis.sh"
  
  PGADMIN_COMPOSE="$APP_DIR/docker/infrastructure/docker-compose.postgres.yml"
  if [ -f "$PGADMIN_COMPOSE" ]; then
    echo "  Applying pgAdmin configuration from $PGADMIN_COMPOSE"
    SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region us-east-1 --query 'SecretString' --output text 2>/dev/null || echo "{}")
    DB_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_password',''))" 2>/dev/null || echo "")
    
    export DB_PASSWORD REPO_ROOT="$APP_DIR"
    if docker-compose -f "$PGADMIN_COMPOSE" up -d --no-deps pgadmin; then
      PGADMIN_READY=1
    else
      echo "  ⚠️ pgAdmin update failed"
    fi
    unset DB_PASSWORD
  fi
else
  echo "  ✅ Infrastructure already running"
  if docker ps | grep -q shadowcheck_pgadmin; then
    PGADMIN_READY=1
  fi
fi

wait_for_container_health shadowcheck_postgres 90
wait_for_container_health shadowcheck_redis 30
if [ "$PGADMIN_READY" -eq 1 ]; then
  wait_for_container_health shadowcheck_pgadmin 60 || true
fi

# 6. Prepare environment and restart application
echo "[6/8] Restarting application containers..."
ENV_FILE=$(mktemp)
IMDS_TOKEN=$(curl -s --connect-timeout 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || echo "")
if [ -n "$IMDS_TOKEN" ]; then
  PUBLIC_IP=$(curl -s --connect-timeout 2 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
else
  PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
fi

SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region us-east-1 --query 'SecretString' --output text 2>/dev/null || echo "{}")
DB_ADMIN_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_admin_password',''))" 2>/dev/null || echo "")
DB_USER_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_password',''))" 2>/dev/null || echo "")

cat > "$ENV_FILE" <<ENVEOF
NODE_ENV=development
PORT=3001
API_GATE_ENABLED=true
ADMIN_ALLOW_DOCKER=true
PGADMIN_COMPOSE_FILE=/app/docker/infrastructure/docker-compose.postgres.yml
DB_HOST=shadowcheck_postgres
DB_PORT=5432
DB_USER=shadowcheck_user
DB_NAME=shadowcheck_db
REDIS_HOST=localhost
REDIS_PORT=6379
CORS_ORIGINS=http://${PUBLIC_IP},https://${PUBLIC_IP},http://localhost,https://localhost
ENVEOF

if [ -f "$SCS_ENV" ]; then
  cat "$SCS_ENV" >> "$ENV_FILE"
fi

docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true
docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true

# Detect socket
PODMAN_SOCK=""
for path in "/run/user/$(id -u)/podman/podman.sock" "/run/podman/podman.sock" "/var/run/docker.sock"; do
  if [ -S "$path" ]; then
    PODMAN_SOCK="$path"
    break
  fi
done

DOCKER_OPTS=""
if [ -S "$PODMAN_SOCK" ]; then
  DOCKER_OPTS="-v $PODMAN_SOCK:/var/run/docker.sock --group-add $(stat -c '%g' "$PODMAN_SOCK") -e DOCKER_HOST=unix:///var/run/docker.sock"
fi

docker run -d --name shadowcheck_backend \
  --network host \
  --env-file "$ENV_FILE" \
  -e DB_HOST=localhost \
  -e DB_PASSWORD="$DB_USER_PASSWORD" \
  -e DB_ADMIN_PASSWORD="$DB_ADMIN_PASSWORD" \
  $DOCKER_OPTS \
  --restart unless-stopped \
  shadowcheck/backend:latest

docker run -d --name shadowcheck_frontend \
  --network host \
  -v "$CERTS_DIR_WEB":/etc/nginx/certs \
  -e CERT_DIR=/etc/nginx/certs \
  --restart unless-stopped \
  shadowcheck/frontend:latest

rm -f "$ENV_FILE"
wait_for_container_health shadowcheck_backend 90
wait_for_container_health shadowcheck_frontend 60

# 7. Database migrations
echo "[7/8] Running database bootstrap & migrations..."
docker exec shadowcheck_postgres rm -rf /sql/migrations
docker exec shadowcheck_postgres mkdir -p /sql
docker cp sql/init/00_bootstrap.sql shadowcheck_postgres:/sql/00_bootstrap.sql
docker cp sql/migrations shadowcheck_postgres:/sql/migrations
docker cp sql/run-migrations.sh shadowcheck_postgres:/sql/run-migrations.sh
docker cp sql/seed-migrations-tracker.sql shadowcheck_postgres:/sql/seed-migrations-tracker.sql

docker exec shadowcheck_postgres bash -c "PGPASSWORD='$DB_ADMIN_PASSWORD' psql -U shadowcheck_admin -d shadowcheck_db -v admin_password='$DB_ADMIN_PASSWORD' -f /sql/00_bootstrap.sql" 2>&1 | tail -5
docker exec shadowcheck_postgres bash -c "export PGPASSWORD='$DB_ADMIN_PASSWORD' MIGRATION_DB_USER=shadowcheck_admin DB_NAME=shadowcheck_db && bash /sql/run-migrations.sh" 2>&1 | tail -10
unset DB_ADMIN_PASSWORD DB_USER_PASSWORD SECRET_JSON

# 8. Monitoring
echo "[8/8] Syncing monitoring..."
if [ "$ENABLE_GRAFANA_MONITORING" = "true" ]; then
  SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region us-east-1 --query 'SecretString' --output text 2>/dev/null || echo "{}")
  GRAFANA_ADMIN_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('grafana_admin_password',''))" 2>/dev/null || echo "")
  GRAFANA_READER_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('grafana_reader_password',''))" 2>/dev/null || echo "")

  GF_SERVER_ROOT_URL="https://${PUBLIC_IP}/grafana/" "$APP_DIR/deploy/aws/scripts/rotate-grafana-passwords.sh"
  wait_for_container_health shadowcheck_grafana 60 || true
  unset GRAFANA_ADMIN_PASSWORD GRAFANA_READER_PASSWORD SECRET_JSON
fi

# Final
echo "[final] Verifying deployment..."
sleep 3
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep shadowcheck
echo "API health: $(curl -sf http://localhost:3001/api/health >/dev/null && echo "OK" || echo "WAITING")"
echo "HTTPS frontend: $(curl -sfk https://localhost/health >/dev/null && echo "OK" || echo "WAITING")"
echo "=== Done ==="
echo "Disk: $(print_disk_usage)"
echo ""
