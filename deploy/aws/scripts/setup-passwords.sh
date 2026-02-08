#!/bin/bash
set -euo pipefail

# AWS EC2 Initial Setup - Generate passwords and store in keyring
# Run this ONCE before first deployment

echo "==> ShadowCheck AWS Initial Setup"
echo ""

# Check if running on EC2
if [ ! -f /home/ssm-user/.ssh/authorized_keys ]; then
  echo "Warning: This script is designed for EC2 instances"
fi

REPO_DIR="/home/ssm-user/shadowcheck"
cd "$REPO_DIR"

# Generate secure random passwords
generate_password() {
  openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

echo "==> Generating secure passwords..."
DB_USER_PASSWORD=$(generate_password)
DB_ADMIN_PASSWORD=$(generate_password)

echo "==> Storing passwords in system keyring..."

# Store in keyring using the set-secret script
npx tsx scripts/set-secret.ts db_password "$DB_USER_PASSWORD"
npx tsx scripts/set-secret.ts db_admin_password "$DB_ADMIN_PASSWORD"

echo ""
echo "==> Creating .env file for Docker Compose..."
cat > .env << EOF
# Database passwords (also stored in keyring)
DB_PASSWORD=${DB_USER_PASSWORD}

# AWS credentials (optional - set if needed)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=dbcoopers-briefcase-161020170158
EOF

echo ""
echo "==> Passwords generated and stored:"
echo "    - db_password (shadowcheck_user): stored in keyring + .env"
echo "    - db_admin_password (shadowcheck_admin): stored in keyring"
echo ""
echo "==> Creating PostgreSQL password files for Docker secrets..."
mkdir -p /home/ssm-user/secrets
echo "$DB_USER_PASSWORD" > /home/ssm-user/secrets/db_password.txt
echo "$DB_ADMIN_PASSWORD" > /home/ssm-user/secrets/db_admin_password.txt
chmod 600 /home/ssm-user/secrets/*.txt

echo ""
echo "==> Setup complete! Passwords stored in:"
echo "    1. System keyring (persistent)"
echo "    2. .env file (for Docker Compose)"
echo "    3. /home/ssm-user/secrets/ (for Docker secrets)"
echo ""
echo "==> Next steps:"
echo "    1. Update PostgreSQL to use these passwords (if needed)"
echo "    2. Run: ./deploy/aws/scripts/deploy-separated.sh"
echo ""
echo "==> IMPORTANT: Save these passwords securely:"
echo "    DB User Password: ${DB_USER_PASSWORD}"
echo "    DB Admin Password: ${DB_ADMIN_PASSWORD}"
