#!/bin/bash
# PostgreSQL query aliases for ShadowCheck
# Automatically fetches password from AWS Secrets Manager

# Get DB secret from Secrets Manager
get_db_secret() {
    aws secretsmanager get-secret-value \
        --secret-id shadowcheck/config \
        --region us-east-1 \
        --query 'SecretString' \
        --output text 2>/dev/null
}

# Alias: scdb - Run psql as shadowcheck_user
scdb() {
    local SECRET_JSON=$(get_db_secret)
    local password=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_password',''))" 2>/dev/null)
    if [ -n "$password" ]; then
        PGPASSWORD="$password" docker exec -it shadowcheck_postgres \
            psql -U shadowcheck_user -d shadowcheck_db "$@"
    else
        echo "ERROR: Could not retrieve db_password from Secrets Manager (shadowcheck/config)"
    fi
}

# Alias: scdba - Run psql as shadowcheck_admin
scdba() {
    local SECRET_JSON=$(get_db_secret)
    local password=$(echo "$SECRET_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_admin_password',''))" 2>/dev/null)
    if [ -n "$password" ]; then
        PGPASSWORD="$password" docker exec -it shadowcheck_postgres \
            psql -U shadowcheck_admin -d shadowcheck_db "$@"
    else
        echo "ERROR: Could not retrieve db_admin_password from Secrets Manager (shadowcheck/config)"
    fi
}

# Alias: sc-query - Quick query without interactive mode
sc-query() {
    scdb -c "$1"
}

# Export functions
export -f scdb
export -f scdba
export -f sc-query

echo "PostgreSQL aliases loaded:"
echo "  scdb              - Connect as shadowcheck_user"
echo "  scdba             - Connect as shadowcheck_admin"
echo "  sc-query 'SQL'    - Run quick query"
