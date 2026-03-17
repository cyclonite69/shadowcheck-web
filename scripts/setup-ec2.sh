#!/bin/bash
# ShadowCheck EC2 Infrastructure Setup
# Idempotent bootstrap script for PostgreSQL & pgAdmin

set -e

REPO_ROOT="${REPO_ROOT:-/home/ssm-user/shadowcheck}"
PG_CERT_DIR="/var/lib/postgresql/certs/web"
PGADMIN_DATA_DIR="/var/lib/pgadmin"
PGADMIN_CONFIG_DIR="$REPO_ROOT/docker/infrastructure/pgadmin-config"

echo "🔍 Starting ShadowCheck EC2 Setup..."

# 1. Environment Warning (Optional)
if [ ! -f "$REPO_ROOT/.env" ]; then
    echo "ℹ️  Note: No local .env file found. Ensure secrets are provided via AWS Secrets Manager or environment variables at runtime."
fi

# 2. Certificate Symlink (Fixes pgAdmin gunicorn crash)
if sudo [ -d "$PG_CERT_DIR" ]; then
    if sudo [ ! -L "$PG_CERT_DIR/server.cert" ]; then
        echo "🔗 Creating certificate symlink..."
        sudo ln -sf server.crt "$PG_CERT_DIR/server.cert"
    else
        echo "✅ Certificate symlink already exists."
    fi
else
    echo "⚠️  Warning: Postgres cert directory $PG_CERT_DIR not found. Skipping symlink."
fi

# 3. Pre-create servers.json (Prevents Docker directory auto-creation)
mkdir -p "$PGADMIN_CONFIG_DIR"
if [ ! -f "$PGADMIN_CONFIG_DIR/servers.json" ]; then
    echo "📄 Creating servers.json template..."
    cat <<EOF > "$PGADMIN_CONFIG_DIR/servers.json"
{
    "Servers": {
        "1": {
            "Name": "ShadowCheck PostgreSQL",
            "Group": "ShadowCheck",
            "Host": "127.0.0.1",
            "Port": 5432,
            "MaintenanceDB": "shadowcheck_db",
            "Username": "shadowcheck_admin",
            "SSLMode": "prefer"
        }
    }
}
EOF
else
    echo "✅ servers.json already exists."
fi

# 4. Permissions for pgAdmin
echo "🔑 Setting permissions for pgAdmin data directory..."
sudo mkdir -p "$PGADMIN_DATA_DIR"
sudo chown -R 5050:5050 "$PGADMIN_DATA_DIR"

echo ""
echo "🚀 Setup Complete!"
echo "Next step: Run the following command to start infrastructure:"
echo "cd $REPO_ROOT/docker/infrastructure && docker-compose -f docker-compose.postgres.yml up -d"
