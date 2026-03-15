#!/bin/bash
# Setup PostgreSQL aliases for EC2 instance
# Adds passwordless psql access using AWS Secrets Manager

BASHRC="/home/ssm-user/.bashrc"

echo "🔍 Updating PostgreSQL aliases in $BASHRC..."

# 1. Clean up old versions if they exist to ensure a clean update
# This removes both the old scdb/scdb-admin and any partial new installs
sed -i '/# ShadowCheck PostgreSQL Functions/,/}/d' "$BASHRC"
sed -i '/scdb() {/,/}/d' "$BASHRC"
sed -i '/scdb-admin() {/,/}/d' "$BASHRC"
sed -i '/scdba() {/,/}/d' "$BASHRC"

# 2. Append the correct, modern functions
cat >> "$BASHRC" << 'EOF'

# ShadowCheck PostgreSQL Functions (passwordless via Secrets Manager)
scdb() {
    local SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region us-east-1 --query SecretString --output text 2>/dev/null)
    local PASS=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_password',''))" 2>/dev/null)
    if [ -n "$PASS" ]; then
        PGPASSWORD="$PASS" docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db "$@"
    else
        echo "ERROR: Could not retrieve db_password from Secrets Manager (shadowcheck/config)"
    fi
}

scdba() {
    local SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config --region us-east-1 --query SecretString --output text 2>/dev/null)
    local PASS=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_admin_password',''))" 2>/dev/null)
    if [ -n "$PASS" ]; then
        PGPASSWORD="$PASS" docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db "$@"
    else
        echo "ERROR: Could not retrieve db_admin_password from Secrets Manager (shadowcheck/config)"
    fi
}
EOF

echo "✅ PostgreSQL functions 'scdb' and 'scdba' updated in $BASHRC"
echo "💡 To activate now, run: source ~/.bashrc"
