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

# Config file for persistent settings
SCS_ENV="$HOME/.shadowcheck-env"
ENABLE_GRAFANA_MONITORING="${ENABLE_GRAFANA_MONITORING:-true}"
SCS_SKIP_CLEANUP="${SCS_SKIP_CLEANUP:-false}"
SCS_RESTORE_CERT="${SCS_RESTORE_CERT:-}"

if [ -f "$SCS_ENV" ]; then
  # shellcheck disable=SC1090
  . "$SCS_ENV"
fi

AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
AWS_PROFILE="${AWS_PROFILE:-}"
SHADOWCHECK_ENV="${SHADOWCHECK_ENV:-prod}"
S3_BUCKET_PARAM="${S3_BUCKET_PARAM:-/shadowcheck/${SHADOWCHECK_ENV}/s3_bucket}"

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
        ;;
    esac

    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "  ❌ Timed out waiting for $container health"
  echo "  --- $container logs (last 20 lines) ---"
  docker logs --tail 20 "$container" 2>/dev/null || true
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
  local cert_file="$1"
  local label="$2"
  if sudo [ -f "$cert_file" ]; then
    local fingerprint
    local not_after
    fingerprint="$(sudo openssl x509 -noout -fingerprint -sha256 -in "$cert_file" 2>/dev/null | cut -d= -f2 || echo "unknown")"
    not_after="$(sudo openssl x509 -noout -enddate -in "$cert_file" 2>/dev/null | cut -d= -f2 || echo "unknown")"
    echo "  🔐 $label: $cert_file"
    echo "     SHA256: $fingerprint"
    echo "     Expires: $not_after"
  fi
}

get_public_ip() {
  local imds_token
  local public_ip

  imds_token="$(curl -s --connect-timeout 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || echo "")"

  if [ -n "$imds_token" ]; then
    public_ip="$(curl -s --connect-timeout 2 -H "X-aws-ec2-metadata-token: $imds_token" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")"
  else
    public_ip="$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")"
  fi

  echo "${public_ip:-127.0.0.1}"
}

get_imds_document() {
  local imds_token
  local identity_document

  imds_token="$(curl -s --connect-timeout 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || echo "")"

  if [ -n "$imds_token" ]; then
    identity_document="$(curl -s --connect-timeout 2 -H "X-aws-ec2-metadata-token: $imds_token" http://169.254.169.254/latest/dynamic/instance-identity/document 2>/dev/null || true)"
  else
    identity_document="$(curl -s --connect-timeout 2 http://169.254.169.254/latest/dynamic/instance-identity/document 2>/dev/null || true)"
  fi

  echo "$identity_document"
}

resolve_aws_region() {
  local identity_document
  local profile_region

  if [ -n "$AWS_REGION" ]; then
    echo "$AWS_REGION"
    return 0
  fi

  if [ -n "${AWS_DEFAULT_REGION:-}" ]; then
    echo "$AWS_DEFAULT_REGION"
    return 0
  fi

  if [ -n "$AWS_PROFILE" ]; then
    profile_region="$(aws configure get region --profile "$AWS_PROFILE" 2>/dev/null || true)"
    if [ -n "$profile_region" ]; then
      echo "$profile_region"
      return 0
    fi
  fi

  identity_document="$(get_imds_document)"
  if [ -n "$identity_document" ]; then
    echo "$identity_document" | sed -n 's/.*"region"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
    return 0
  fi

  return 1
}

resolve_s3_bucket() {
  local parameter_bucket

  if [ -n "${S3_BUCKET:-}" ]; then
    return 0
  fi

  if [ -z "${AWS_REGION:-}" ]; then
    return 0
  fi

  if [ -n "$AWS_PROFILE" ]; then
    parameter_bucket="$(aws ssm get-parameter --name "$S3_BUCKET_PARAM" --region "$AWS_REGION" --profile "$AWS_PROFILE" --query 'Parameter.Value' --output text 2>/dev/null || true)"
  else
    parameter_bucket="$(aws ssm get-parameter --name "$S3_BUCKET_PARAM" --region "$AWS_REGION" --query 'Parameter.Value' --output text 2>/dev/null || true)"
  fi

  if [ -n "$parameter_bucket" ] && [ "$parameter_bucket" != "None" ]; then
    S3_BUCKET="$parameter_bucket"
  fi
}

backup_file_to_s3_if_missing() {
  local local_path="$1"
  local s3_uri="$2"

  if [ -z "${S3_BUCKET:-}" ]; then
    echo "  ℹ️ S3_BUCKET is not set; skipping certificate backup"
    return 0
  fi

  if aws s3 ls "$s3_uri" >/dev/null 2>&1; then
    echo "  ☁️ Backup already present: $s3_uri"
    return 0
  fi

  if aws s3 cp "$local_path" "$s3_uri" >/dev/null 2>&1; then
    echo "  ☁️ Backed up: $s3_uri"
  else
    echo "  ⚠️ Failed to back up $local_path to $s3_uri"
  fi
}

ensure_canonical_cert_pair() {
  local cert_path="$1"
  local key_path="$2"
  local public_ip="$3"
  local openssl_config
  local temp_cert
  local temp_key

  if sudo [ -f "$cert_path" ] && sudo [ -f "$key_path" ]; then
    echo "  Using canonical certificate already present on EBS"
    log_cert_state "$cert_path" "Canonical certificate"
    return 0
  fi

  if sudo [ -f "$cert_path" ] || sudo [ -f "$key_path" ]; then
    echo "  ⚠️ Incomplete canonical cert pair detected; regenerating a clean pair"
    sudo rm -f "$cert_path" "$key_path"
  fi

  echo "  Generating new 10-year self-signed certificate for IP $public_ip"
  openssl_config="$(mktemp)"
  temp_cert="$(mktemp)"
  temp_key="$(mktemp)"

  cat > "$openssl_config" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = $public_ip

[v3_req]
subjectAltName = IP:$public_ip,IP:127.0.0.1,DNS:localhost
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

  openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$temp_key" \
    -out "$temp_cert" \
    -days 3650 \
    -config "$openssl_config" >/dev/null 2>&1

  sudo install -o root -g 999 -m 644 "$temp_cert" "$cert_path"
  sudo install -o root -g 999 -m 640 "$temp_key" "$key_path"
  rm -f "$openssl_config" "$temp_cert" "$temp_key"

  log_cert_state "$cert_path" "Canonical certificate"
}

echo "=== scs_rebuild ==="

if AWS_REGION="$(resolve_aws_region)"; then
  export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"
fi

resolve_s3_bucket

# 1. Pull latest
echo "[1/8] Pulling latest..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "  Detected branch: $CURRENT_BRANCH"
git pull origin "$CURRENT_BRANCH"

# 2. Prepare certificates and persistent volumes
echo "[2/8] Preparing persistent volumes and certificates..."
CERTS_DIR_BASE=/var/lib/postgresql
CANONICAL_CERT_DIR=$CERTS_DIR_BASE/certs
CANONICAL_CERT=$CANONICAL_CERT_DIR/shadowcheck.crt
CANONICAL_KEY=$CANONICAL_CERT_DIR/shadowcheck.key
POSTGRES_CONFIG=/var/lib/postgresql/postgresql.conf

sudo mkdir -p "$CANONICAL_CERT_DIR" /var/lib/pgadmin /var/lib/redis
sudo chmod 711 "$CERTS_DIR_BASE" 2>/dev/null || true

echo "  Auditing canonical certificate path..."
if sudo [ -f "$CANONICAL_CERT" ]; then
  log_cert_state "$CANONICAL_CERT" "Canonical certificate"
else
  echo "  ℹ️ No canonical certificate found yet at $CANONICAL_CERT"
fi

# Manual restore override takes precedence over generation.
if [ -n "$SCS_RESTORE_CERT" ]; then
  if sudo [ -f "$SCS_RESTORE_CERT" ]; then
    echo "  🚨 MANUAL RESTORE: Restoring $SCS_RESTORE_CERT"
    sudo install -o root -g 999 -m 644 "$SCS_RESTORE_CERT" "$CANONICAL_CERT"
    RESTORE_DIR=$(dirname "$SCS_RESTORE_CERT")
    if sudo [ -f "$RESTORE_DIR/server.key" ]; then
      sudo install -o root -g 999 -m 640 "$RESTORE_DIR/server.key" "$CANONICAL_KEY"
    elif sudo [ -f "$RESTORE_DIR/shadowcheck.key" ]; then
      sudo install -o root -g 999 -m 640 "$RESTORE_DIR/shadowcheck.key" "$CANONICAL_KEY"
    fi
  else
    echo "  ❌ ERROR: Manual restore path $SCS_RESTORE_CERT not found!"
  fi
fi

PUBLIC_IP="$(get_public_ip)"
ensure_canonical_cert_pair "$CANONICAL_CERT" "$CANONICAL_KEY" "$PUBLIC_IP"
backup_file_to_s3_if_missing "$CANONICAL_CERT" "s3://${S3_BUCKET:-}/certs/shadowcheck.crt"
backup_file_to_s3_if_missing "$CANONICAL_KEY" "s3://${S3_BUCKET:-}/certs/shadowcheck.key"

echo "  Removing stale certificate locations..."
sudo rm -rf /var/lib/postgresql/certs/web
sudo rm -rf /var/lib/postgresql/web_certs
sudo rm -f /var/lib/postgresql/data/server.crt

# Canonical permissions: PostgreSQL runs as 999:999 and needs direct access to
# the canonical pair before deploy-postgres.sh starts the container.
echo "  Enforcing canonical certificate permissions..."
sudo chown 999:999 "$CANONICAL_CERT_DIR" 2>/dev/null || true
sudo chown 999:999 "$CANONICAL_CERT" "$CANONICAL_KEY" 2>/dev/null || true
sudo chmod 700 "$CANONICAL_CERT_DIR"
sudo chmod 640 "$CANONICAL_KEY" 2>/dev/null || true
sudo chmod 644 "$CANONICAL_CERT" 2>/dev/null || true

sudo chown -R 5050:5050 /var/lib/pgadmin 2>/dev/null || true
sudo chown -R 999:999 /var/lib/redis 2>/dev/null || true

# 3. Clean up
echo "[3/8] Cleaning up old Docker artifacts..."
cleanup_docker_artifacts
echo "  Disk usage: $(print_disk_usage)"

# 4. Build images
echo "[4/8] Building images..."
docker build --no-cache -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
docker build --no-cache -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# 5. Infrastructure
echo "[5/8] Ensuring core infrastructure is running..."
sudo "$APP_DIR/deploy/aws/scripts/deploy-postgres.sh"
sudo "$APP_DIR/deploy/aws/scripts/deploy-redis.sh"
wait_for_container_health shadowcheck_postgres 90
wait_for_container_health shadowcheck_redis 30

if sudo [ -f "$POSTGRES_CONFIG" ]; then
  echo "  Ensuring PostgreSQL uses the canonical SSL certificate paths..."
  POSTGRES_SSL_CERT_BEFORE="$(sudo grep -E "^ssl_cert_file = " "$POSTGRES_CONFIG" | sed "s/^ssl_cert_file = //")"
  POSTGRES_SSL_KEY_BEFORE="$(sudo grep -E "^ssl_key_file = " "$POSTGRES_CONFIG" | sed "s/^ssl_key_file = //")"

  sudo sed -i \
    -e "s#^ssl_cert_file = '.*'#ssl_cert_file = '/var/lib/postgresql/certs/shadowcheck.crt'#" \
    -e "s#^ssl_key_file = '.*'#ssl_key_file = '/var/lib/postgresql/certs/shadowcheck.key'#" \
    "$POSTGRES_CONFIG"

  POSTGRES_SSL_CERT_AFTER="$(sudo grep -E "^ssl_cert_file = " "$POSTGRES_CONFIG" | sed "s/^ssl_cert_file = //")"
  POSTGRES_SSL_KEY_AFTER="$(sudo grep -E "^ssl_key_file = " "$POSTGRES_CONFIG" | sed "s/^ssl_key_file = //")"
  POSTGRES_RESTART_REQUIRED=false

  if [ "$POSTGRES_SSL_CERT_BEFORE" != "$POSTGRES_SSL_CERT_AFTER" ] || [ "$POSTGRES_SSL_KEY_BEFORE" != "$POSTGRES_SSL_KEY_AFTER" ]; then
    POSTGRES_RESTART_REQUIRED=true
  fi
else
  echo "  Ensuring PostgreSQL uses the canonical SSL certificate paths..."
  sudo sed -i \
    -e "s#^ssl_cert_file = '.*'#ssl_cert_file = '/var/lib/postgresql/certs/shadowcheck.crt'#" \
    -e "s#^ssl_key_file = '.*'#ssl_key_file = '/var/lib/postgresql/certs/shadowcheck.key'#" \
    "$POSTGRES_CONFIG"
  POSTGRES_RESTART_REQUIRED=true
fi

sudo chown 999:999 "$POSTGRES_CONFIG" 2>/dev/null || true
sudo chmod 600 "$POSTGRES_CONFIG"

if [ "$POSTGRES_RESTART_REQUIRED" = true ]; then
  docker restart shadowcheck_postgres >/dev/null
  wait_for_container_health shadowcheck_postgres 90
fi

# 6. Restart Application and pgAdmin
echo "[6/8] Restarting application containers and pgAdmin..."
ENV_FILE=$(mktemp)
if [ -n "$AWS_PROFILE" ]; then
  SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region "$AWS_REGION" --profile "$AWS_PROFILE" --query 'SecretString' --output text 2>/dev/null || echo "{}")
else
  SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region "$AWS_REGION" --query 'SecretString' --output text 2>/dev/null || echo "{}")
fi
DB_USER_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_password',''))" 2>/dev/null || echo "")
DB_ADMIN_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_admin_password',''))" 2>/dev/null || echo "")

IMDS_TOKEN=$(curl -s --connect-timeout 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || echo "")
PUBLIC_IP=$(curl -s --connect-timeout 2 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

cat > "$ENV_FILE" <<ENVEOF
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_USER=shadowcheck_user
DB_NAME=shadowcheck_db
REDIS_HOST=localhost
CORS_ORIGINS=http://${PUBLIC_IP},https://${PUBLIC_IP},http://localhost,https://localhost
ENVEOF

docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true
docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true

docker stop shadowcheck_pgadmin 2>/dev/null || true
docker rm shadowcheck_pgadmin 2>/dev/null || true

echo "  Starting pgAdmin with the canonical TLS certificate..."
docker run -d \
  --name shadowcheck_pgadmin \
  --network host \
  --restart unless-stopped \
  --group-add 999 \
  --health-cmd "python3 -c \"import ssl, urllib.request; urllib.request.urlopen('https://127.0.0.1:5050/misc/ping', context=ssl._create_unverified_context(), timeout=5).read()\"" \
  --health-interval 30s \
  --health-timeout 10s \
  --health-retries 3 \
  --health-start-period 30s \
  -e PGADMIN_DEFAULT_EMAIL="${PGADMIN_EMAIL:-admin@example.com}" \
  -e PGADMIN_DEFAULT_PASSWORD="${PGADMIN_PASSWORD:-admin}" \
  -e PGADMIN_CONFIG_SERVER_MODE=False \
  -e PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED=False \
  -e PGADMIN_LISTEN_ADDRESS=0.0.0.0 \
  -e PGADMIN_LISTEN_PORT="${PGADMIN_PORT:-5050}" \
  -e PGADMIN_ENABLE_TLS="${PGADMIN_ENABLE_TLS:-True}" \
  -e PGADMIN_SERVER_CERT=/certs/shadowcheck.crt \
  -e PGADMIN_SERVER_KEY=/certs/shadowcheck.key \
  -e PGADMIN_DEFAULT_SERVER_HOST=127.0.0.1 \
  -v /var/lib/pgadmin:/var/lib/pgadmin \
  -v "$APP_DIR/docker/infrastructure/pgadmin-config/servers.json:/pgadmin4/servers.json:ro" \
  -v "$CANONICAL_CERT:/certs/shadowcheck.crt:ro" \
  -v "$CANONICAL_KEY:/certs/shadowcheck.key:ro" \
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  dpage/pgadmin4:latest

if docker exec shadowcheck_pgadmin sh -c 'test -f /certs/shadowcheck.crt && test -f /certs/shadowcheck.key' >/dev/null 2>&1; then
  echo "  ✅ pgAdmin sees the canonical TLS files at container start"
else
  echo "  ❌ pgAdmin TLS files are missing inside the container"
fi

# Detect socket
PODMAN_SOCK=""
for path in "/run/user/$(id -u)/podman/podman.sock" "/run/podman/podman.sock" "/var/run/docker.sock"; do
  if [ -S "$path" ]; then PODMAN_SOCK="$path"; break; fi
done
DOCKER_OPTS=""
if [ -S "$PODMAN_SOCK" ]; then
  DOCKER_OPTS="-v $PODMAN_SOCK:/var/run/docker.sock --group-add $(stat -c '%g' "$PODMAN_SOCK") -e DOCKER_HOST=unix:///var/run/docker.sock"
fi

docker run -d --name shadowcheck_backend --network host --env-file "$ENV_FILE" -e DB_PASSWORD="$DB_USER_PASSWORD" -e DB_ADMIN_PASSWORD="$DB_ADMIN_PASSWORD" $DOCKER_OPTS --restart unless-stopped shadowcheck/backend:latest
docker run -d --name shadowcheck_frontend --network host --group-add 999 \
  -v "$CANONICAL_CERT:/etc/nginx/certs/server.crt:ro" \
  -v "$CANONICAL_KEY:/etc/nginx/certs/server.key:ro" \
  -e CERT_DIR=/etc/nginx/certs \
  --restart unless-stopped shadowcheck/frontend:latest

rm -f "$ENV_FILE"
wait_for_container_health shadowcheck_backend 90
wait_for_container_health shadowcheck_frontend 60
wait_for_container_health shadowcheck_pgadmin 60 || true

# 7. Migrations
echo "[7/8] Running migrations..."
docker exec shadowcheck_postgres mkdir -p /sql
docker cp sql/init/00_bootstrap.sql shadowcheck_postgres:/sql/00_bootstrap.sql
docker cp sql/migrations shadowcheck_postgres:/sql/migrations
docker cp sql/run-migrations.sh shadowcheck_postgres:/sql/run-migrations.sh
docker exec shadowcheck_postgres bash -c "PGPASSWORD='$DB_ADMIN_PASSWORD' psql -U shadowcheck_admin -d shadowcheck_db -v admin_password='$DB_ADMIN_PASSWORD' -f /sql/00_bootstrap.sql" 2>&1 | tail -5
docker exec shadowcheck_postgres bash -c "export PGPASSWORD='$DB_ADMIN_PASSWORD' MIGRATION_DB_USER=shadowcheck_admin DB_NAME=shadowcheck_db && bash /sql/run-migrations.sh" 2>&1 | tail -10

# 8. Monitoring
echo "[8/8] Syncing monitoring..."
if [ "$ENABLE_GRAFANA_MONITORING" = "true" ]; then
  "$APP_DIR/deploy/aws/scripts/rotate-grafana-passwords.sh" || true
  wait_for_container_health shadowcheck_grafana 60 || true
fi

# Final
echo "[final] Verifying deployment..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep shadowcheck
echo "API: $(curl -sf http://localhost:3001/api/health >/dev/null && echo "OK" || echo "WAITING")"
echo "HTTPS: $(curl -sfk https://localhost/health >/dev/null && echo "OK" || echo "WAITING")"
echo "=== Done ==="
echo "Disk: $(print_disk_usage)"
