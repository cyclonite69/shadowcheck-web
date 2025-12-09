#!/bin/bash
# Start ShadowCheck server with password from keyring

export DB_PASSWORD=$(python3 get-keyring-password.py)
export DB_NAME=shadowcheck_db
export PORT=3001

echo "🚀 Starting ShadowCheck server..."
echo "📊 Database: $DB_NAME"
echo "🔒 Password: From keyring"
echo "🌐 Port: $PORT"
echo ""

npm start
