#!/bin/bash
set -euo pipefail

# AWS EC2 Initial Setup - Generate passwords
# Run this ONCE before first deployment

echo "==> ShadowCheck AWS Initial Setup"
echo ""

REPO_DIR="/home/ssm-user/shadowcheck"
cd "$REPO_DIR"

# Generate secure random passwords
generate_password() {
  openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

echo "==> Generating secure passwords..."
DB_USER_PASSWORD=$(generate_password)
DB_ADMIN_PASSWORD=$(generate_password)

echo ""
echo "==> Creating .env file for Docker Compose..."
cat > .env << EOF
# Database passwords
DB_PASSWORD=${DB_USER_PASSWORD}

# AWS credentials (optional - set if needed)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=dbcoopers-briefcase-161020170158
EOF

echo ""
echo "==> Setup complete!"
echo ""
echo "==> IMPORTANT: Save these passwords securely:"
echo "    DB User Password (shadowcheck_user): ${DB_USER_PASSWORD}"
echo "    DB Admin Password (shadowcheck_admin): ${DB_ADMIN_PASSWORD}"
echo ""
echo "==> Next steps:"
echo "    1. Update PostgreSQL to use DB_PASSWORD: ${DB_USER_PASSWORD}"
echo "    2. Run: ./deploy/aws/scripts/deploy-separated.sh"
echo ""
