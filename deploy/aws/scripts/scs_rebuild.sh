#!/bin/bash
# scs_rebuild - Pull, rebuild, and redeploy ShadowCheck on EC2
# Install: sudo ln -sf /home/ssm-user/shadowcheck/deploy/aws/scripts/scs_rebuild.sh /usr/local/bin/scs_rebuild
#
# Secrets are loaded from AWS Secrets Manager at startup.
set -e

APP_DIR="${SCS_DIR:-$HOME/shadowcheck}"
cd "$APP_DIR"

# Config file for persistent settings (custom env overrides, etc.)
SCS_ENV="$HOME/.shadowcheck-env"

echo "=== scs_rebuild ==="

# 0. Clean up old Docker artifacts to prevent disk fill
echo "[0/7] Cleaning up old Docker artifacts..."
docker system prune -f 2>/dev/null || true
docker image prune -a -f --filter "until=24h" 2>/dev/null || true
echo "  Disk usage: $(df -h / | awk 'NR==2{print $5, "used,", $4, "free"}')"

# 1. Pull latest
echo "[1/7] Pulling latest..."
git pull origin master

# 2. Build images (--no-cache ensures code changes are picked up)
echo "[2/7] Building images..."
docker build --no-cache -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
docker build --no-cache -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# 3. Ensure infrastructure is running
echo "[3/7] Ensuring infrastructure is running..."
if ! docker ps | grep -q shadowcheck_postgres; then
  echo "  Starting PostgreSQL and Redis..."
  sudo "$APP_DIR/deploy/aws/scripts/deploy-postgres.sh"
else
  echo "  ✅ Infrastructure already running"
fi

# 4. Build env
echo "[4/7] Preparing environment..."
ENV_FILE=$(mktemp)

# Build env — secrets come from AWS Secrets Manager at runtime, not env vars
IMDS_TOKEN=$(curl -s --connect-timeout 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || echo "")
if [ -n "$IMDS_TOKEN" ]; then
  PUBLIC_IP=$(curl -s --connect-timeout 2 -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
else
  PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
fi
cat > "$ENV_FILE" <<ENVEOF
NODE_ENV=development
PORT=3001
DB_HOST=shadowcheck_postgres
DB_PORT=5432
DB_USER=shadowcheck_user
DB_NAME=shadowcheck_db
CORS_ORIGINS=http://${PUBLIC_IP},http://localhost
ENVEOF
echo "  Built env (passwords loaded from AWS SM at startup)"

# Overlay with persistent config (non-secret overrides only)
if [ -f "$SCS_ENV" ]; then
  cat "$SCS_ENV" >> "$ENV_FILE"
  echo "  Loaded overrides from $SCS_ENV"
fi

# 4. Stop, remove, restart
echo "[5/7] Restarting containers..."
docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true
docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true

docker run -d --name shadowcheck_backend \
  --network host \
  --env-file "$ENV_FILE" \
  -e DB_HOST=localhost \
  --restart unless-stopped \
  shadowcheck/backend:latest

docker run -d --name shadowcheck_frontend \
  --network host \
  --restart unless-stopped \
  shadowcheck/frontend:latest

rm -f "$ENV_FILE"

# 5. Run database bootstrap + migrations
echo "[6/7] Running database bootstrap & migrations..."

# Create /sql/ in postgres container and copy files (clean first to remove stale files)
docker exec shadowcheck_postgres rm -rf /sql/migrations
docker exec shadowcheck_postgres mkdir -p /sql
docker cp sql/init/00_bootstrap.sql shadowcheck_postgres:/sql/00_bootstrap.sql
docker cp sql/migrations shadowcheck_postgres:/sql/migrations
docker cp sql/run-migrations.sh shadowcheck_postgres:/sql/run-migrations.sh
docker cp sql/seed-migrations-tracker.sql shadowcheck_postgres:/sql/seed-migrations-tracker.sql

# Run bootstrap (idempotent — safe on existing DBs)
# Pull admin password from AWS Secrets Manager (sole secret store)
DB_ADMIN_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id shadowcheck/config --region us-east-1 \
  --query 'SecretString' --output text 2>/dev/null \
  | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_admin_password',''))" 2>/dev/null || echo "")
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db \
  -v admin_password="$DB_ADMIN_PASSWORD" \
  -f /sql/00_bootstrap.sql 2>&1 | tail -5

# Seed migration tracker (marks pre-existing migrations as applied)
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db \
  -f /sql/seed-migrations-tracker.sql -q 2>&1 | tail -3

# Run migrations (only applies new/untracked ones)
docker exec shadowcheck_postgres bash /sql/run-migrations.sh 2>&1 | tail -10

# 6. Health check
echo "[7/7] Verifying deployment..."
sleep 3

# Check containers are running
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep shadowcheck

# Quick API health check
echo ""
if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
  echo "API health check: OK"
else
  echo "API health check: WAITING (may need a few more seconds to start)"
fi

echo ""
echo "=== Done ==="
echo "Disk: $(df -h / | awk 'NR==2{print $5, "used,", $4, "free"}')"
echo ""
