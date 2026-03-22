#!/bin/bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3001}"
COOKIE_JAR="${2:-/tmp/sc.cookies}"
SECRET_NAME="${SECRET_NAME:-shadowcheck/config}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_SECRET_KEY="${ADMIN_SECRET_KEY:-admin_app_password}"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI is required" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --region "$AWS_REGION" \
  --query 'SecretString' \
  --output text)

ADMIN_PASSWORD=$(printf '%s' "$SECRET_JSON" | jq -r --arg key "$ADMIN_SECRET_KEY" '.[$key] // empty')

if [ -z "$ADMIN_PASSWORD" ]; then
  echo "ERROR: Secret key '$ADMIN_SECRET_KEY' not found in $SECRET_NAME" >&2
  exit 1
fi

curl -sS -c "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
  "$BASE_URL/api/auth/login" | jq

echo ""
echo "Cookie jar written to: $COOKIE_JAR"
