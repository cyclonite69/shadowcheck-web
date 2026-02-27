# Ephemeral AWS Credentials Setup

Replace long-lived IAM user access keys with temporary, auto-expiring credentials.

## Problem

Long-lived AWS access keys stored in `~/.aws/credentials` are a security risk:

- If stolen, attacker has persistent access
- No automatic expiration
- Hard to rotate across multiple machines

## Solution: AWS SSO (IAM Identity Center)

Provides temporary credentials that expire automatically (1-12 hours).

### Setup (One-Time)

```bash
aws configure sso
```

You'll be prompted for:

- **SSO start URL**: Get from your AWS admin or IAM Identity Center console
- **Region**: `us-east-1`
- **Account**: Select your AWS account
- **Role**: Select your role (e.g., `AdministratorAccess` or `PowerUserAccess`)
- **Profile name**: `shadowcheck` (or whatever you prefer)

This creates `~/.aws/config`:

```ini
[profile shadowcheck]
sso_start_url = https://YOUR-ORG.awsapps.com/start
sso_region = us-east-1
sso_account_id = 161020170158
sso_role_name = AdministratorAccess
region = us-east-1
```

### Daily Usage

```bash
# Login (opens browser, expires after hours)
aws sso login --profile shadowcheck

# Use any AWS command
aws ssm start-session --target i-0021a7c116aeb2e9e --region us-east-1 --profile shadowcheck
aws ec2 describe-instances --region us-east-1 --profile shadowcheck

# Or set as default for session
export AWS_PROFILE=shadowcheck
aws ssm start-session --target i-0021a7c116aeb2e9e --region us-east-1
```

### Update Your Scripts

Add `--profile shadowcheck` to all AWS CLI calls, or set `AWS_PROFILE` env var:

```bash
# Option 1: Add to each command
aws ec2 run-instances --profile shadowcheck ...

# Option 2: Set for entire script
export AWS_PROFILE=shadowcheck
# Now all aws commands use SSO creds
```

## Alternative: STS Assume Role (If No SSO)

If your org doesn't use IAM Identity Center, use temporary credentials via STS:

```bash
# Get 1-hour temporary credentials
aws sts get-session-token --duration-seconds 3600 > /tmp/creds.json

# Extract and export
export AWS_ACCESS_KEY_ID=$(jq -r .Credentials.AccessKeyId /tmp/creds.json)
export AWS_SECRET_ACCESS_KEY=$(jq -r .Credentials.SecretAccessKey /tmp/creds.json)
export AWS_SESSION_TOKEN=$(jq -r .Credentials.SessionToken /tmp/creds.json)

# Now use AWS CLI (creds expire in 1 hour)
aws ssm start-session --target i-0021a7c116aeb2e9e --region us-east-1
```

Create a helper script:

```bash
#!/bin/bash
# get-temp-creds.sh
aws sts get-session-token --duration-seconds 3600 | \
  jq -r '"export AWS_ACCESS_KEY_ID=\(.Credentials.AccessKeyId)\nexport AWS_SECRET_ACCESS_KEY=\(.Credentials.SecretAccessKey)\nexport AWS_SESSION_TOKEN=\(.Credentials.SessionToken)"'

# Usage:
# eval $(./get-temp-creds.sh)
```

## What to Delete

Once SSO is working:

1. **Remove from `~/.aws/credentials`:**

   ```bash
   # Backup first
   cp ~/.aws/credentials ~/.aws/credentials.backup

   # Remove [default] section with long-lived keys
   # Keep only [profile shadowcheck] in ~/.aws/config
   ```

2. **Deactivate IAM user keys:**
   ```bash
   aws iam list-access-keys --user-name YOUR_USERNAME
   aws iam delete-access-key --user-name YOUR_USERNAME --access-key-id AKIA...
   ```

## Verification

```bash
# Check current credentials
aws sts get-caller-identity

# Should show temporary credentials (starts with ASIA not AKIA)
# AccessKeyId starting with ASIA = temporary
# AccessKeyId starting with AKIA = long-lived (bad)
```

## Benefits

- ✅ Credentials expire automatically (1-12 hours)
- ✅ Nothing to steal long-term
- ✅ Audit trail in CloudTrail
- ✅ Can enforce MFA at SSO level
- ✅ Centralized access management
