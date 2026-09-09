# AWS SSM Session Manager Access

**Quick Reference for EC2 Access — Read This First**

## Connect to EC2 Instance

```bash
# Using SSO ephemeral role (preferred)
aws ssm start-session --target i-06380d0c9c99f6124 --region us-east-1 --profile shadowcheck-sso

# OR using named profile
aws ssm start-session --target i-06380d0c9c99f6124 --region us-east-1 --profile shadowcheck
```

### Key Details

- **Instance ID**: `i-06380d0c9c99f6124`
- **Region**: `us-east-1`
- **Profile**: `shadowcheck-sso` (ephemeral SSO) or `shadowcheck` (static)
- **Access Method**: AWS Systems Manager Session Manager ONLY (no SSH)
- **Note**: EC2 has NO public ingress ports — SSM is the ONLY access method

## Once Connected

You'll have an interactive shell on the EC2 instance:

```bash
# Check running containers
docker ps

# Rebuild backend (ONLY approved method — protects SSL certs, EBS, and permissions)
export HOME=/home/ssm-user && cd /home/ssm-user/shadowcheck && bash deploy/aws/scripts/scs_rebuild.sh

# Access database with secrets from AWS Secrets Manager
DB_PASS=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config \
  --region us-east-1 --query SecretString --output text | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['db_admin_password'])")

docker exec -e PGPASSWORD=$DB_PASS shadowcheck_postgres psql \
  -U shadowcheck_admin -d shadowcheck_db -v ON_ERROR_STOP=1 -c "SELECT 1;"

# View logs
docker logs shadowcheck_api --tail 100 -f
```

## Important

- ✅ Use SSM for all EC2 access
- ❌ Never attempt SSH (port 22 is closed)
- ❌ Never open inbound security group rules to 0.0.0.0/0
- ✅ Secrets are injected at runtime from AWS Secrets Manager only
- ❌ Never write credentials to disk

## Troubleshooting

**"Unable to locate credentials"**: Ensure AWS SSO is logged in

```bash
aws sso login --profile shadowcheck-sso
```

**"Session Manager plugin not found"**: Install the Session Manager plugin

```bash
# macOS
brew install session-manager-plugin

# Linux
# Download from: https://s3.amazonaws.com/session-manager-downloads/plugin/latest/linux_64bit/session-manager-plugin.zip
```

**Connection timeout**: Verify instance is running

```bash
aws ec2 describe-instances --instance-ids i-06380d0c9c99f6124 --region us-east-1
```

**Unit tests fail with TS2451 redeclaration after `git pull` on EC2**: Clear stale TypeScript build artifacts and re-run typecheck

```bash
rm -rf dist/ && npx tsc --noEmit
```

## Related

- See `CLAUDE.md` for full EC2 guidelines
- See `GEMINI.md` for detailed constraints
- See `docs/SECURITY_POLICY.md` for security rules
