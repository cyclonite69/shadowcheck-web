#!/bin/bash
set -euo pipefail
set -e

echo "Building ShadowCheck containers on AWS instance..."

# Navigate to project directory
cd /home/ssm-user/shadowcheck

# Build backend
echo "Building backend container..."
docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .

# Build frontend
echo "Building frontend container..."
docker build -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

echo "✅ Containers built successfully!"
echo ""
echo "Backend image: shadowcheck/backend:latest"
echo "Frontend image: shadowcheck/frontend:latest"
echo ""
echo "To run backend:"
echo "  docker run -d --name shadowcheck_backend \\"
echo "    --network shadowcheck_net \\"
echo "    -e DB_HOST=shadowcheck_postgres \\"
echo "    -e DB_USER=shadowcheck_user \\"
echo "    -e DB_PASSWORD=\$DB_PASSWORD \\"
echo "    -e DB_NAME=shadowcheck_db \\"
echo "    -e PORT=3001 \\"
echo "    -p 3001:3001 \\"
echo "    shadowcheck/backend:latest"
echo ""
echo "To run frontend:"
echo "  docker run -d --name shadowcheck_frontend \\"
echo "    --network shadowcheck_net \\"
echo "    -p 80:80 \\"
echo "    shadowcheck/frontend:latest"
