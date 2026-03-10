#!/bin/bash
# Initialize database with admin user
# Generates a random password at deploy time — never hardcoded
# Works on any platform (no AWS dependency)

set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres}"
DB_USER="${DB_USER:-shadowcheck_user}"
DB_NAME="${DB_NAME:-shadowcheck_db}"
SECRET_NAME="${SECRET_NAME:-shadowcheck/config}"
AWS_REGION="${AWS_REGION:-us-east-1}"

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

# Resolve DB password (env override first, then AWS Secrets Manager)
# Mapping:
#   shadowcheck_user  -> db_password
#   shadowcheck_admin -> db_admin_password
if [ "$DB_USER" = "shadowcheck_admin" ]; then
    SECRET_DB_KEY="db_admin_password"
else
    SECRET_DB_KEY="db_password"
fi

DB_USER_PASSWORD="${DB_PASSWORD:-}"
if [ -z "$DB_USER_PASSWORD" ]; then
    SECRET_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text 2>/dev/null || echo "{}")
    DB_USER_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('$SECRET_DB_KEY',''))" 2>/dev/null || echo "")
fi

if [ -z "$DB_USER_PASSWORD" ]; then
    echo "ERROR: Could not resolve DB password."
    echo "Set DB_PASSWORD env var or ensure $SECRET_NAME has key '$SECRET_DB_KEY'."
    exit 1
fi

echo "Creating admin user..."

docker exec -e PGPASSWORD="$DB_USER_PASSWORD" "$CONTAINER" bash -lc "psql -U '$DB_USER' -d '$DB_NAME' -c \"
INSERT INTO app.users (username, password_hash, email, role, created_at)
VALUES ('admin', '$HASH', 'admin@shadowcheck.local', 'admin', NOW())
ON CONFLICT (username) DO UPDATE
SET password_hash = EXCLUDED.password_hash;
\""

# Compatibility updates for newer schemas (run only if columns exist)
docker exec -e PGPASSWORD="$DB_USER_PASSWORD" "$CONTAINER" bash -lc "psql -U '$DB_USER' -d '$DB_NAME' -c \"
DO \\\$\\\$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='app' AND table_name='users' AND column_name='force_password_change'
  ) THEN
    EXECUTE 'UPDATE app.users SET force_password_change = true WHERE username = ''admin''';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='app' AND table_name='users' AND column_name='updated_at'
  ) THEN
    EXECUTE 'UPDATE app.users SET updated_at = NOW() WHERE username = ''admin''';
  END IF;
END
\\\$\\\$;
\""

echo ""
echo "Admin user created successfully"
echo "==============================="
echo "  Username: admin"
echo "  Password: $ADMIN_PASS"
echo "==============================="
echo ""
echo "SAVE THIS PASSWORD — it will not be shown again."
echo "You will be required to change it on first login."
