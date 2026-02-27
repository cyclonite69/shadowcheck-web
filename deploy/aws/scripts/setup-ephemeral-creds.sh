#!/bin/bash
# Setup Ephemeral AWS Credentials via SSO
# Replaces long-lived IAM user keys with temporary session tokens

set -e

REGION="us-east-1"
ACCOUNT_ID="161020170158"
SSO_INSTANCE="ssoins-7223c2a3e90e5776"

echo "🔐 Setting Up Ephemeral AWS Credentials"
echo ""
echo "This will configure AWS SSO for temporary credentials that auto-expire."
echo ""

# Check if SSO plugin is installed
if ! command -v session-manager-plugin &> /dev/null; then
    echo "⚠️  AWS Session Manager plugin not found"
    echo "Install it first:"
    echo "  Linux: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html"
    echo "  macOS: brew install --cask session-manager-plugin"
    echo ""
fi

# Get SSO start URL
echo "🔍 Detecting SSO configuration..."
SSO_START_URL="https://${SSO_INSTANCE}.awsapps.com/start"

echo "Your SSO Start URL: $SSO_START_URL"
echo ""

# Configure SSO profile
echo "📝 Configuring AWS SSO profile..."
echo ""
echo "Run this command and follow the prompts:"
echo ""
echo "  aws configure sso"
echo ""
echo "When prompted, use these values:"
echo "  SSO start URL: $SSO_START_URL"
echo "  SSO Region: $REGION"
echo "  Account: $ACCOUNT_ID"
echo "  Role: AdministratorAccess (or your assigned role)"
echo "  Profile name: shadowcheck-sso"
echo "  Region: $REGION"
echo "  Output format: json"
echo ""
read -p "Press Enter when you've completed 'aws configure sso'..."

# Test SSO login
echo ""
echo "🔑 Testing SSO login..."
if aws sso login --profile shadowcheck-sso; then
    echo "✅ SSO login successful!"
else
    echo "❌ SSO login failed. Check your configuration."
    exit 1
fi

# Verify credentials
echo ""
echo "🔍 Verifying credentials..."
IDENTITY=$(aws sts get-caller-identity --profile shadowcheck-sso)
echo "$IDENTITY"

ACCESS_KEY=$(echo "$IDENTITY" | jq -r .UserId | cut -d: -f1)
if [[ $ACCESS_KEY == ASIA* ]]; then
    echo "✅ Using temporary credentials (starts with ASIA)"
else
    echo "⚠️  Still using long-lived credentials (starts with AKIA)"
fi

echo ""
echo "✅ Ephemeral Credentials Setup Complete!"
echo ""
echo "Next Steps:"
echo ""
echo "1. Test SSM connection with new credentials:"
echo "   aws ssm start-session --target i-0021a7c116aeb2e9e --region us-east-1 --profile shadowcheck-sso"
echo ""
echo "2. Update your scripts to use the new profile:"
echo "   export AWS_PROFILE=shadowcheck-sso"
echo "   ./launch-shadowcheck-spot.sh"
echo ""
echo "3. After confirming everything works, deactivate old keys:"
echo "   aws iam list-access-keys --user-name dbcooper"
echo "   aws iam delete-access-key --user-name dbcooper --access-key-id AKIA..."
echo ""
echo "4. Remove keys from ~/.aws/credentials:"
echo "   vim ~/.aws/credentials  # Delete [default] section"
echo ""
