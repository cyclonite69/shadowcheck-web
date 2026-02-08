#!/bin/bash
# Load secrets from keyring and export as environment variables
# Usage: source scripts/load-secrets.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if bootstrap is needed
if [ ! -f "$HOME/.shadowcheck-machine-id" ]; then
  echo "🔐 Machine ID not found. Running bootstrap..."
  cd "$PROJECT_ROOT"
  npx tsx scripts/bootstrap-secrets.ts
fi

# Load required secrets
echo "🔑 Loading secrets from keyring..."

export DB_PASSWORD=$(node "$PROJECT_ROOT/scripts/get-secret.js" db_password 2>/dev/null || echo "")
export SESSION_SECRET=$(node "$PROJECT_ROOT/scripts/get-secret.js" session_secret 2>/dev/null || echo "")

# Load optional secrets (don't fail if missing)
export MAPBOX_TOKEN=$(node "$PROJECT_ROOT/scripts/get-secret.js" mapbox_token 2>/dev/null || echo "")
export WIGLE_API_KEY=$(node "$PROJECT_ROOT/scripts/get-secret.js" wigle_api_key 2>/dev/null || echo "")
export WIGLE_API_TOKEN=$(node "$PROJECT_ROOT/scripts/get-secret.js" wigle_api_token 2>/dev/null || echo "")

# Load machine ID for container
export KEYRING_MACHINE_ID=$(cat "$HOME/.shadowcheck-machine-id" 2>/dev/null || echo "")

# Verify required secrets
if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Required secret 'db_password' not found"
  exit 1
fi

if [ -z "$SESSION_SECRET" ]; then
  echo "❌ Required secret 'session_secret' not found"
  exit 1
fi

echo "✅ Secrets loaded successfully"
