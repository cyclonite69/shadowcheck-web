#!/bin/bash
# Initialize database with admin user
# Generates a random password at deploy time — never hardcoded
# Works on any platform (no AWS dependency)

set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres}"
# Admin user creation requires write access to app.users; default to admin DB role.
DB_USER="${DB_USER:-shadowcheck_admin}"
DB_NAME="${DB_NAME:-shadowcheck_db}"
SECRET_NAME="${SECRET_NAME:-shadowcheck/config}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ADMIN_SECRET_KEY="${ADMIN_SECRET_KEY:-admin_app_password}"

SECRET_JSON="{}"
if command -v aws &>/dev/null; then
    SECRET_JSON=$(aws secretsmanager get-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text 2>/dev/null || echo "{}")
fi

generate_password() {
    if command -v openssl &>/dev/null; then
        openssl rand -base64 18 | tr -d '/+=' | head -c 20
        return 0
    fi
    if [ -f /dev/urandom ]; then
        head -c 24 /dev/urandom | base64 | tr -d '/+=' | head -c 20
        return 0
    fi
    return 1
}

persist_admin_password() {
    local password="$1"
    if ! command -v aws &>/dev/null; then
        echo "WARN: aws CLI not available; could not persist $ADMIN_SECRET_KEY to AWS Secrets Manager."
        return 1
    fi
    local updated
    updated=$(printf '%s' "$SECRET_JSON" | python3 - "$ADMIN_SECRET_KEY" "$password" <<'PY'
import json, sys
raw = sys.stdin.read().strip() or "{}"
data = json.loads(raw)
data[sys.argv[1]] = sys.argv[2]
print(json.dumps(data))
PY
)
    aws secretsmanager put-secret-value \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" \
        --secret-string "$updated" >/dev/null
    SECRET_JSON="$updated"
    return 0
}

ADMIN_PASS="${ADMIN_APP_PASSWORD:-}"
if [ -z "$ADMIN_PASS" ]; then
    ADMIN_PASS=$(echo "$SECRET_JSON" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('$ADMIN_SECRET_KEY',''))" 2>/dev/null || echo "")
fi
GENERATED_ADMIN_PASS=0
if [ -z "$ADMIN_PASS" ]; then
    if ! ADMIN_PASS=$(generate_password); then
        echo "ERROR: Cannot generate admin password (no openssl or /dev/urandom)"
        exit 1
    fi
    GENERATED_ADMIN_PASS=1
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
    DB_USER_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('$SECRET_DB_KEY',''))" 2>/dev/null || echo "")
fi

if [ -z "$DB_USER_PASSWORD" ]; then
    echo "ERROR: Could not resolve DB password."
    echo "Set DB_PASSWORD env var or ensure $SECRET_NAME has key '$SECRET_DB_KEY'."
    exit 1
fi

if [ "$GENERATED_ADMIN_PASS" = "1" ]; then
    if persist_admin_password "$ADMIN_PASS"; then
        echo "Persisted $ADMIN_SECRET_KEY to AWS Secrets Manager ($SECRET_NAME)"
    else
        echo "WARN: Generated admin password was not persisted to AWS Secrets Manager."
    fi
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
echo "Password source key: $ADMIN_SECRET_KEY"
echo "Secret store: $SECRET_NAME"
echo "You will be required to change it on first login."
