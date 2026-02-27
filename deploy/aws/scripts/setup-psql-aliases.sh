#!/bin/bash
# Setup PostgreSQL aliases for EC2 instance
# Adds passwordless psql access using AWS Secrets Manager

BASHRC="/home/ssm-user/.bashrc"

# Check if aliases already exist
if grep -q "alias scdb=" "$BASHRC" 2>/dev/null; then
    echo "✅ Aliases already configured in $BASHRC"
    exit 0
fi

cat >> "$BASHRC" << 'EOF'

# ShadowCheck PostgreSQL Aliases
alias scdb='docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db'
alias scdb-admin='docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db'

# Helper to get password from Secrets Manager
_sc_get_db_pass() {
    aws secretsmanager get-secret-value \
        --secret-id shadowcheck/db/password \
        --region us-east-1 \
        --query SecretString \
        --output text 2>/dev/null
}

# Export password for psql (used by docker exec)
export PGPASSWORD=$(_sc_get_db_pass)
EOF

echo "✅ PostgreSQL aliases added to $BASHRC"
echo ""
echo "Run: source ~/.bashrc"
echo "Then use: scdb or scdb-admin"
