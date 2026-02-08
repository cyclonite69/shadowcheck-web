#!/bin/bash
# scs_rebuild - Pull, rebuild, and redeploy ShadowCheck on EC2
# Install alias: echo 'alias scs_rebuild="bash ~/shadowcheck/deploy/aws/scripts/scs_rebuild.sh"' >> ~/.bashrc
set -e

APP_DIR="${SCS_DIR:-$HOME/shadowcheck}"
cd "$APP_DIR"

echo "=== scs_rebuild ==="

# 1. Pull latest
echo "[1/4] Pulling latest..."
git pull origin master

# 2. Build images
echo "[2/4] Building backend..."
docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
echo "[2/4] Building frontend..."
docker build -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# 3. Capture env from running backend (if it exists) before stopping
ENV_FILE=$(mktemp)
if docker inspect shadowcheck_backend >/dev/null 2>&1; then
  docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' shadowcheck_backend > "$ENV_FILE"
  echo "[3/4] Captured env from running backend"
else
  # Fallback: build env from scratch
  DB_PASSWORD=$(docker exec shadowcheck_postgres printenv POSTGRES_PASSWORD 2>/dev/null || echo "")
  PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
  cat > "$ENV_FILE" <<EOF
NODE_ENV=development
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=shadowcheck_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=shadowcheck_db
CORS_ORIGINS=http://${PUBLIC_IP},http://localhost
EOF
  echo "[3/4] Built env from defaults (no running backend found)"
fi

# 4. Stop, remove, restart
echo "[4/4] Restarting containers..."
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

sleep 3

echo ""
echo "=== Done ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep shadowcheck
echo ""
