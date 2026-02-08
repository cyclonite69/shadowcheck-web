#!/bin/bash
set -euo pipefail

# AWS EC2 Deployment Script - Update and Deploy Separated Containers
# Usage: ./deploy-separated.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/deploy/aws/docker-compose-aws.yml"

echo "==> ShadowCheck AWS Deployment - Separated Containers"
echo "==> Repository: $REPO_ROOT"

# Stop existing monolithic container if running
echo "==> Stopping existing containers..."
docker stop shadowcheck_static_api 2>/dev/null || true
docker stop shadowcheck_static_redis 2>/dev/null || true
docker stop shadowcheck_backend 2>/dev/null || true
docker stop shadowcheck_frontend 2>/dev/null || true
docker stop shadowcheck_redis 2>/dev/null || true

# Remove old containers to avoid name conflicts
docker rm shadowcheck_static_api 2>/dev/null || true
docker rm shadowcheck_static_redis 2>/dev/null || true
docker rm shadowcheck_backend 2>/dev/null || true
docker rm shadowcheck_frontend 2>/dev/null || true
docker rm shadowcheck_redis 2>/dev/null || true

# Pull latest code
echo "==> Pulling latest code from GitHub..."
cd "$REPO_ROOT"
git pull origin master

# Build new images
echo "==> Building frontend and backend images..."
docker-compose -f "$COMPOSE_FILE" build --no-cache

# Start services
echo "==> Starting separated containers..."
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for health checks
echo "==> Waiting for services to be healthy..."
sleep 10

# Check status
echo "==> Container status:"
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "==> Deployment complete!"
echo "    Frontend: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo "    Backend:  http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3001"
echo ""
echo "==> View logs:"
echo "    docker-compose -f $COMPOSE_FILE logs -f"
