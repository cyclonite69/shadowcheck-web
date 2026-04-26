# AWS → pgAdmin Connection Fix Guide

## The Problem

Your local pgAdmin can't connect because:

1. **Secrets are in AWS Secrets Manager** (not `.env`)
2. **EC2 uses IAM role** for ephemeral credentials
3. **pgAdmin runs locally** without AWS access

## Quick Fix (5 minutes)

### Step 1: Run Audit Script

```bash
cd <your-repo-path>
./scripts/audit-aws-connection.sh
```

This will:

- ✅ Verify AWS credentials
- ✅ Check Secrets Manager access
- ✅ Find EC2 instance
- ✅ Verify security group
- ✅ Test PostgreSQL connectivity
- ✅ Generate connection details

### Step 2: Copy Connection Details

The script outputs:

```
Host:     <EC2_PUBLIC_IP>
Port:     5432
Database: shadowcheck_db
Username: shadowcheck_user
Password: <from_secrets_manager>
SSL Mode: require
```

### Step 3: Configure pgAdmin

Open pgAdmin → Right-click "Servers" → Create → Server

**General Tab:**

- Name: `ShadowCheck AWS`

**Connection Tab:**

- Paste values from Step 2
- Check "Save password"

**SSL Tab:**

- SSL mode: `Require`

Click "Save" → Should connect immediately.

## Common Issues & Fixes

### Issue 1: "Could not connect to server"

**Cause:** Security group doesn't allow your IP

**Fix:**

```bash
# Check your current IP
curl -s https://checkip.amazonaws.com

# Add it to security group
cd deploy/aws/scripts
./add-ip-access.sh
```

### Issue 2: "FATAL: password authentication failed"

**Cause:** Password in Secrets Manager doesn't match PostgreSQL

**Fix on EC2:**

```bash
# Connect to EC2
aws ssm start-session --target <INSTANCE_ID> --region us-east-1 --profile shadowcheck-sso

# Get password from Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id shadowcheck/config \
  --region us-east-1 \
  --query SecretString \
  --output text)
DB_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.db_password')

# Reset PostgreSQL password to match
docker exec -it shadowcheck_postgres psql -U postgres -d shadowcheck_db -c \
  "ALTER USER shadowcheck_user WITH PASSWORD '$DB_PASSWORD';"
```

### Issue 3: "SSL connection required"

**Cause:** PostgreSQL requires SSL but pgAdmin isn't using it

**Fix:**

- In pgAdmin SSL tab, set SSL mode to `Require` or `Prefer`
- Or download certificate: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

### Issue 4: AWS credentials expired

**Cause:** SSO session expired (typically 8-12 hours)

**Fix:**

```bash
aws sso login --profile shadowcheck-sso
```

### Issue 5: EC2 IAM role missing

**Cause:** EC2 instance can't access Secrets Manager

**Check:**

```bash
aws ec2 describe-instances \
  --instance-ids <INSTANCE_ID> \
  --region us-east-1 \
  --profile shadowcheck-sso \
  --query 'Reservations[0].Instances[0].IamInstanceProfile'
```

**Fix:** Attach IAM role with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:shadowcheck/*"
    }
  ]
}
```

## Architecture Overview

```
┌─────────────────┐
│  Your Laptop    │
│                 │
│  ┌──────────┐   │      AWS SSO          ┌─────────────────┐
│  │ pgAdmin  │───┼──────Ephemeral────────▶│ Secrets Manager │
│  │ (Docker) │   │      Credentials       │  shadowcheck/   │
│  └──────────┘   │                        │    config       │
│       │         │                        └─────────────────┘
│       │ SSL     │
│       │ 5432    │
└───────┼─────────┘
        │
        │ Security Group
        │ (Your IP only)
        ▼
┌─────────────────────────────────────────┐
│  EC2 Instance (us-east-1)               │
│                                         │
│  ┌──────────────┐    IAM Role          │
│  │ PostgreSQL   │◀───(Ephemeral)       │
│  │ (Docker)     │                      │
│  │ Port 5432    │                      │
│  └──────────────┘                      │
│                                         │
│  ┌──────────────┐                      │
│  │ ShadowCheck  │                      │
│  │ API (Docker) │                      │
│  │ Port 3001    │                      │
│  └──────────────┘                      │
└─────────────────────────────────────────┘
```

## Key Points

1. **EC2 backend uses IAM role** → No credentials needed in container
2. **Your laptop uses SSO profile** → Temporary credentials via `aws sso login`
3. **pgAdmin doesn't need AWS** → Just use the password directly
4. **Security group restricts access** → Only your IP can connect to port 5432

## Testing Checklist

- [ ] AWS SSO credentials valid (`aws sts get-caller-identity --profile shadowcheck-sso`)
- [ ] Secrets Manager accessible (`aws secretsmanager get-secret-value --secret-id shadowcheck/config`)
- [ ] EC2 instance running (`aws ec2 describe-instances`)
- [ ] Your IP in security group (`./scripts/audit-aws-connection.sh`)
- [ ] Port 5432 reachable (`nc -zv <EC2_IP> 5432`)
- [ ] PostgreSQL container running on EC2 (`docker ps | grep postgres`)
- [ ] Password matches between SM and PostgreSQL
- [ ] pgAdmin configured with correct connection details

## Additional Resources

- Full audit: `./scripts/audit-aws-connection.sh`
- Add IP to SG: `./deploy/aws/scripts/add-ip-access.sh`
- pgAdmin setup: `deploy/pgadmin/README.md`
- AWS deployment: `deploy/aws/QUICKSTART.md`
