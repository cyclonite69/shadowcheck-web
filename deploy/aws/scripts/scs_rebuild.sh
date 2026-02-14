#!/bin/bash
# scs_rebuild - Pull, rebuild, and redeploy ShadowCheck on EC2
# Install: echo 'alias scs_rebuild="bash ~/shadowcheck/deploy/aws/scripts/scs_rebuild.sh"' >> ~/.bashrc
#
# Secrets are loaded from AWS Secrets Manager at startup.
set -e

APP_DIR="${SCS_DIR:-$HOME/shadowcheck}"
cd "$APP_DIR"

# Config file for persistent settings (custom env overrides, etc.)
SCS_ENV="$HOME/.shadowcheck-env"

echo "=== scs_rebuild ==="

# 0. Clean up old Docker artifacts to prevent disk fill
echo "[0/6] Cleaning up old Docker artifacts..."
docker system prune -f 2>/dev/null || true
docker image prune -a -f --filter "until=24h" 2>/dev/null || true
echo "  Disk usage: $(df -h / | awk 'NR==2{print $5, "used,", $4, "free"}')"

# 1. Pull latest
echo "[1/6] Pulling latest..."
git pull origin master

# 2. Build images (--no-cache ensures code changes are picked up)
echo "[2/6] Building images..."
docker build --no-cache -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
docker build --no-cache -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# 3. Build env
echo "[3/6] Preparing environment..."
ENV_FILE=$(mktemp)

# Start with captured env from running backend, or build from scratch
if docker inspect shadowcheck_backend >/dev/null 2>&1; then
  docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' shadowcheck_backend > "$ENV_FILE"
  echo "  Captured env from running backend"
else
  DB_PASSWORD=$(docker exec shadowcheck_postgres printenv POSTGRES_PASSWORD 2>/dev/null || echo "")
  PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
  cat > "$ENV_FILE" <<ENVEOF
NODE_ENV=development
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=shadowcheck_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=shadowcheck_db
CORS_ORIGINS=http://${PUBLIC_IP},http://localhost
ENVEOF
  echo "  Built env from defaults"
fi

# Overlay with persistent config
if [ -f "$SCS_ENV" ]; then
  # Append — later values override earlier ones in --env-file
  cat "$SCS_ENV" >> "$ENV_FILE"
  echo "  Loaded overrides from $SCS_ENV"
fi

# 4. Stop, remove, restart
echo "[4/6] Restarting containers..."
docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true
docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true

docker run -d --name shadowcheck_backend \
  --network host \
  --env-file "$ENV_FILE" \
  --restart unless-stopped \
  shadowcheck/backend:latest

docker run -d --name shadowcheck_frontend \
  --network host \
  --restart unless-stopped \
  shadowcheck/frontend:latest

rm -f "$ENV_FILE"

# 5. Run database bootstrap + migrations
echo "[5/6] Running database bootstrap & migrations..."

# Run bootstrap (idempotent — safe on existing DBs)
DB_ADMIN_PASSWORD=$(docker exec shadowcheck_postgres printenv DB_ADMIN_PASSWORD 2>/dev/null || echo "")
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db \
  -v "bootstrap.admin_password=$DB_ADMIN_PASSWORD" \
  < sql/init/00_bootstrap.sql 2>&1 | tail -5

# Copy migrations into postgres container and run
docker cp sql/migrations shadowcheck_postgres:/sql/migrations
docker cp sql/run-migrations.sh shadowcheck_postgres:/sql/run-migrations.sh
docker exec shadowcheck_postgres bash /sql/run-migrations.sh 2>&1 | tail -10

# 6. Health check
echo "[6/6] Verifying deployment..."
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
