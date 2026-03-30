#!/bin/bash
set -euo pipefail
# ShadowCheck Database Setup Script

echo "ShadowCheck Database Setup"
echo "=========================="
echo ""
echo "This will create the database user and database."
echo ""
read -p "Enter password for shadowcheck_user: " DB_PASS
echo ""

sudo -u postgres psql << SQL
-- Create user if not exists
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_user WHERE usename = 'shadowcheck_user') THEN
    CREATE USER shadowcheck_user WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE shadowcheck_db OWNER shadowcheck_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'shadowcheck_db')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE shadowcheck_db TO shadowcheck_user;

-- Show result
\du shadowcheck_user
\l shadowcheck_db
SQL

echo ""
echo "✓ Database setup complete!"
echo ""
echo "Now update .env with:"
echo "DB_PASSWORD=$DB_PASS"
