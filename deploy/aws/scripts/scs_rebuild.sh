#!/bin/bash
# scs_rebuild - Pull, rebuild, and redeploy ShadowCheck on EC2
# Install: echo 'alias scs_rebuild="bash ~/shadowcheck/deploy/aws/scripts/scs_rebuild.sh"' >> ~/.bashrc
#
# Secrets: Copy your local keyring to EC2 once:
#   scp ~/.local/share/shadowcheck/keyring.enc  ec2-user@HOST:~/.local/share/shadowcheck/keyring.enc
# Then set KEYRING_MACHINE_ID in ~/.shadowcheck-env to your local machine's hostname+username.
set -e

APP_DIR="${SCS_DIR:-$HOME/shadowcheck}"
cd "$APP_DIR"

# Config file for persistent settings (KEYRING_MACHINE_ID, MAPBOX_TOKEN overrides, etc.)
SCS_ENV="$HOME/.shadowcheck-env"

echo "=== scs_rebuild ==="

# 1. Pull latest
echo "[1/4] Pulling latest..."
git pull origin master

# 2. Build images
echo "[2/4] Building images..."
docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
docker build -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# 3. Build env
echo "[3/4] Preparing environment..."
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

# Overlay with persistent config (KEYRING_MACHINE_ID, etc.)
if [ -f "$SCS_ENV" ]; then
  # Append — later values override earlier ones in --env-file
  cat "$SCS_ENV" >> "$ENV_FILE"
  echo "  Loaded overrides from $SCS_ENV"
fi

# Keyring volume mount — share the host keyring with the container
KEYRING_DIR="$HOME/.local/share/shadowcheck"
KEYRING_MOUNT=""
if [ -f "$KEYRING_DIR/keyring.enc" ]; then
  KEYRING_MOUNT="-v $KEYRING_DIR:/data/shadowcheck:ro"
  # Tell the app where to find keyring inside the container
  echo "XDG_DATA_HOME=/data" >> "$ENV_FILE"
  echo "  Mounting keyring from $KEYRING_DIR"
fi

# 4. Stop, remove, restart
echo "[4/4] Restarting containers..."
docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true
docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true

docker run -d --name shadowcheck_backend \
  --network host \
  --env-file "$ENV_FILE" \
  $KEYRING_MOUNT \
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
