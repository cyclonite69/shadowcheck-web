#!/bin/bash
# Helper script to ensure SSO credentials are active
# Source this in your shell or add to ~/.bashrc

sso_login() {
    local PROFILE="${1:-shadowcheck-sso}"
    
    # Check if credentials are still valid
    if aws sts get-caller-identity --profile "$PROFILE" &>/dev/null; then
        echo "✅ SSO credentials still valid"
        export AWS_PROFILE="$PROFILE"
        return 0
    fi
    
    # Credentials expired, re-login
    echo "🔑 SSO credentials expired, logging in..."
    aws sso login --profile "$PROFILE"
    export AWS_PROFILE="$PROFILE"
    echo "✅ Logged in as: $(aws sts get-caller-identity --query Arn --output text)"
}

# Auto-login on shell start (optional)
# Uncomment to automatically check/refresh SSO on new terminal
# sso_login shadowcheck-sso

echo "SSO helper loaded. Run: sso_login [profile-name]"
