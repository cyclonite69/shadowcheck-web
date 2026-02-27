#!/bin/bash
# Setup PostgreSQL aliases for EC2 instance
# Adds passwordless psql access using AWS Secrets Manager

BASHRC="/home/ssm-user/.bashrc"

# Check if functions already exist
if grep -q "scdb()" "$BASHRC" 2>/dev/null; then
    echo "✅ Functions already configured in $BASHRC"
    exit 0
fi

cat >> "$BASHRC" << 'EOF'

# ShadowCheck PostgreSQL Functions (passwordless via Secrets Manager)
scdb() {
    local PASS=$(aws secretsmanager get-secret-value --secret-id shadowcheck/db/password --region us-east-1 --query SecretString --output text 2>/dev/null)
    PGPASSWORD="$PASS" docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db
}

scdb-admin() {
    local PASS=$(aws secretsmanager get-secret-value --secret-id shadowcheck/db/password --region us-east-1 --query SecretString --output text 2>/dev/null)
    PGPASSWORD="$PASS" docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db
}
EOF

echo "✅ PostgreSQL functions added to $BASHRC"
echo ""
echo "Run: source ~/.bashrc"
echo "Then use: scdb or scdb-admin"
