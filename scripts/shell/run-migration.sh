#!/bin/bash
export DB_PASSWORD=$(python3 get-keyring-password.py)
export DB_NAME=shadowcheck_db
export PORT=3001

echo "🔄 Running database migration..."
node scripts/run-migration.js
