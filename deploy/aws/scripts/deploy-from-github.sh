#!/bin/bash
# Deploy from GitHub - Complete workflow
# This script pulls latest code from GitHub and deploys

set -e

echo "🚀 ShadowCheck Deployment from GitHub"
echo "======================================"
echo ""

# Bootstrap secrets if needed
if [ ! -f "$HOME/.shadowcheck-machine-id" ]; then
  echo "🔐 Bootstrapping secrets..."
  npx tsx scripts/bootstrap-secrets.ts
fi

# Load secrets from keyring
echo "🔑 Loading secrets from keyring..."
source scripts/load-secrets.sh

echo "📥 Pulling latest code from GitHub..."
git pull origin master

echo ""
echo "🔨 Rebuilding containers..."
docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .
docker build -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

echo ""
echo "🛑 Stopping old containers..."
docker stop shadowcheck_backend shadowcheck_frontend 2>/dev/null || true
docker rm shadowcheck_backend shadowcheck_frontend 2>/dev/null || true

echo ""
echo "🚢 Starting new containers..."

# Get DB password if not set
if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "<get_from_postgres_container>" ]; then
  DB_PASSWORD=$(docker exec shadowcheck_postgres printenv POSTGRES_PASSWORD)
fi

# Get public IP for CORS if needed
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
if [[ "$CORS_ORIGINS" == *"13.216.239.240"* ]]; then
  CORS_ORIGINS="http://${PUBLIC_IP},http://localhost"
fi

# Start backend
docker run -d --name shadowcheck_backend \
  --network host \
  -e NODE_ENV=$NODE_ENV \
  -e PORT=$PORT \
  -e DB_HOST=$DB_HOST \
  -e DB_PORT=$DB_PORT \
  -e DB_USER=$DB_USER \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e DB_NAME=$DB_NAME \
  -e MAPBOX_TOKEN=$MAPBOX_TOKEN \
  -e CORS_ORIGINS=$CORS_ORIGINS \
  --restart unless-stopped \
  shadowcheck/backend:latest

# Start frontend
docker run -d --name shadowcheck_frontend \
  --network host \
  --restart unless-stopped \
  shadowcheck/frontend:latest

sleep 5

echo ""
echo "✅ Deployment complete!"
echo ""
docker ps | grep shadowcheck
echo ""
echo "Access your application:"
echo "  Frontend: http://${PUBLIC_IP}"
echo "  Backend:  http://${PUBLIC_IP}:3001"
echo ""
if [ "$NODE_ENV" = "development" ]; then
  echo "⚠️  Running in development mode (HTTP). Set up HTTPS for production!"
fi
