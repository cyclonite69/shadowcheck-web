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
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
SECRET_NAME="${SHADOWCHECK_AWS_SECRET:-shadowcheck/config}"

echo ""
echo "==> Persisting generated values to AWS Secrets Manager (${SECRET_NAME})..."
SECRET_JSON=$(printf '{"db_password":"%s","db_admin_password":"%s"}' "$DB_USER_PASSWORD" "$DB_ADMIN_PASSWORD")

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_NAME" \
    --secret-string "$SECRET_JSON" \
    --region "$AWS_REGION" >/dev/null
else
  aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "ShadowCheck runtime secrets" \
    --secret-string "$SECRET_JSON" \
    --region "$AWS_REGION" >/dev/null
fi

echo ""
echo "==> Setup complete!"
echo ""
echo "==> Next steps:"
echo "    1. Ensure runtime reads DB credentials from AWS Secrets Manager (${SECRET_NAME})"
echo "    2. Run: ./deploy/aws/scripts/deploy-separated.sh"
echo ""
