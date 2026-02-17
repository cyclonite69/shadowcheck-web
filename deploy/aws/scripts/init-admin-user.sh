#!/bin/bash
# Initialize database with admin user
# Generates a random password at deploy time — never hardcoded
# Works on any platform (no AWS dependency)

set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres}"
DB_USER="${DB_USER:-shadowcheck_user}"
DB_NAME="${DB_NAME:-shadowcheck_db}"

# Generate random password (works on Linux/macOS)
if command -v openssl &>/dev/null; then
    ADMIN_PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
elif [ -f /dev/urandom ]; then
    ADMIN_PASS=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
else
    echo "ERROR: Cannot generate random password (no openssl or /dev/urandom)"
    exit 1
fi

# Hash with bcrypt via node (always available in this project)
HASH=$(node -e "const bcrypt = require('bcrypt'); bcrypt.hash(process.argv[1], 10).then(h => console.log(h))" "$ADMIN_PASS")

if [ -z "$HASH" ]; then
    echo "ERROR: Failed to generate bcrypt hash (is bcrypt installed?)"
    exit 1
fi

echo "Creating admin user..."

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
INSERT INTO app.users (username, password_hash, email, role, force_password_change, created_at)
VALUES ('admin', '$HASH', 'admin@shadowcheck.local', 'admin', true, NOW())
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    force_password_change = true,
    updated_at = NOW();
"

echo ""
echo "Admin user created successfully"
echo "==============================="
echo "  Username: admin"
echo "  Password: $ADMIN_PASS"
echo "==============================="
echo ""
echo "SAVE THIS PASSWORD — it will not be shown again."
echo "You will be required to change it on first login."
