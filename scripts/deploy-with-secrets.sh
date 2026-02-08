#!/bin/bash
# Deploy with secrets - Load secrets and start containers in same shell
# Usage: ./scripts/deploy-with-secrets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Bootstrap if needed
if [ ! -f "$HOME/.shadowcheck-machine-id" ]; then
  echo "🔐 Bootstrapping secrets..."
  npx tsx scripts/bootstrap-secrets.ts
fi

# Load secrets
echo "🔑 Loading secrets from keyring..."
source "$SCRIPT_DIR/load-secrets.sh"

# Start containers with secrets
echo "🚀 Starting containers..."
docker-compose -f deploy/aws/docker-compose-aws.yml up -d --force-recreate backend

echo "✅ Deployment complete"
docker ps --filter name=backend
