# AWS Deployment for ShadowCheck

This directory contains AWS-specific deployment configurations, scripts, and documentation.

## 🚀 Quick Start

**New to AWS deployment? Start here:** [QUICKSTART.md](QUICKSTART.md)

Complete deployment in 5 minutes with automated scripts.

## Directory Structure

```
deploy/aws/
├── scripts/          # AWS deployment scripts
│   ├── setup-instance.sh           # System utilities and Docker setup
│   ├── deploy-complete.sh          # Complete deployment orchestrator
│   ├── deploy-postgres.sh          # PostgreSQL deployment
│   ├── scs_rebuild.sh       # Application deployment
│   ├── launch-shadowcheck-spot.sh  # EC2 instance launcher
│   └── ...
├── configs/          # PostgreSQL and infrastructure configs
│   ├── postgresql-optimized.conf
│   └── postgresql-security.conf
├── docs/             # AWS-specific documentation
│   ├── AWS_INFRASTRUCTURE.md
│   ├── POSTGRESQL_TUNING.md
│   └── PASSWORD_ROTATION.md
├── QUICKSTART.md     # 5-minute deployment guide
├── WORKFLOW.md       # Development workflow
└── README.md         # This file
```

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Complete deployment from scratch (recommended)
- **[WORKFLOW.md](WORKFLOW.md)** - Development and update workflow
- **[DEPLOYMENT_COMPLETE.md](DEPLOYMENT_COMPLETE.md)** - Detailed deployment notes
- **[ARM_SPOT_ASG_CUTOVER.md](docs/ARM_SPOT_ASG_CUTOVER.md)** - staged migration plan for mixed-instance ARM Spot ASG

## Quick Commands

### Launch Spot Instance

```bash
./scripts/launch-shadowcheck-spot.sh
```

### Stage Mixed ARM Spot ASG

```bash
SCS_SUBNET_ID=subnet-xxxxxxxx ./scripts/create-shadowcheck-asg.sh
```

This stages the new single-AZ mixed-instance ARM Spot ASG design. It does not
replace the current instance unless you deliberately scale the ASG up and cut
over.

## Local Docker vs EC2

- Local Docker uses the root [docker-compose.yml](../../docker-compose.yml) and the
  local `postgres` service name for `DB_HOST`
- Production EC2 defaults to `DB_HOST=postgres` when running the backend inside the Docker network (standard for `scs_rebuild.sh`). Use `DB_HOST=127.0.0.1` only for host-mode development or legacy standalone setups.
- Passwords remain sourced from AWS Secrets Manager in both cases; local Docker can
  pass through real AWS credentials or provide `DB_PASSWORD` / `DB_ADMIN_PASSWORD`
  as shell environment overrides
- The AWS region is no longer read from Secrets Manager; on EC2 it resolves from
  `app.settings.aws_region`, then `AWS_REGION`, then `AWS_DEFAULT_REGION`, and finally
  EC2 instance metadata (IMDS)
- `S3_BACKUP_BUCKET` is runtime configuration, not a secret; the EC2 rebuild flow can
  source it from `.env` or AWS SSM Parameter Store

### Connect to Instance

```bash
aws ssm start-session --target i-INSTANCE_ID --region us-east-1
```

### Enable Embedded SSM (Admin UI)

Attach the inline IAM policy in
`deploy/aws/iam/ssm-embedded-session-policy.json`
to the EC2 role (for example `EC2-SSM-Role`) so the app can call
`ssm:StartSession` from the Admin page.

```bash
aws iam put-role-policy \
  --role-name EC2-SSM-Role \
  --policy-name shadowcheck-ssm-embedded-session \
  --policy-document file://deploy/aws/iam/ssm-embedded-session-policy.json
```

### Complete Setup (on EC2)

```bash
# One-time system setup
curl -fsSL https://raw.githubusercontent.com/cyclonite69/shadowcheck-web/master/deploy/aws/scripts/setup-instance.sh | sudo bash

# Clone and deploy
cd /home/ssm-user
git clone https://github.com/cyclonite69/shadowcheck-web.git shadowcheck
cd shadowcheck
./deploy/aws/scripts/deploy-complete.sh
```

### Update Application (on EC2)

```bash
cd /home/ssm-user/shadowcheck
./deploy/aws/scripts/scs_rebuild.sh
```

## Infrastructure

- **Instance Type**: t4g.large (ARM64, 2 vCPU, 8GB RAM)
- **Pricing**: ~$22/month Spot + $4.80/month storage
- **Database**: PostgreSQL 18 + PostGIS 3.6 (port 5432, IP-restricted via SG)
- **API**: Node.js backend (port 3001, IP-restricted)
- **Storage**: 30GB GP3 EBS (persistent, optimized XFS)
- **Security**: Network isolation, container hardening, SCRAM-SHA-256, SSL/TLS

## Security Architecture

### Network Isolation

- **PostgreSQL**: Exposed on `0.0.0.0:5432` (secured by security group IP whitelist + SSL/SCRAM)
- **API**: Exposed on port `3001` (IP-restricted via security group)
- **Internal Network**: Docker bridge for container-to-container communication
- **External DB Access**: Allowed for pgAdmin/DBeaver via security group (your IP only)

### Container Security

- **Capability Restrictions**: `cap_drop: ALL`, minimal `cap_add`
- **No Privilege Escalation**: `security_opt: no-new-privileges`
- **Read-Only Filesystem**: API runs with read-only root filesystem
- **Temporary Storage**: `tmpfs` for logs and temp files (memory-only)

See [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md) for complete security details.

## Documentation

- **[AWS_INFRASTRUCTURE.md](docs/AWS_INFRASTRUCTURE.md)** - Complete infrastructure guide
- **[SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md)** - Network isolation and container security
- **[POSTGRESQL_TUNING.md](docs/POSTGRESQL_TUNING.md)** - Performance optimization
- **[PASSWORD_ROTATION.md](docs/PASSWORD_ROTATION.md)** - Security procedures
- **[ARM_SPOT_ASG_CUTOVER.md](docs/ARM_SPOT_ASG_CUTOVER.md)** - staged single-AZ ARM Spot ASG cutover

## Configuration Files

### PostgreSQL Configs

- **postgresql-optimized.conf** - Performance-tuned for 8GB RAM + PostGIS
- **postgresql-security.conf** - Security settings (no password logging)

These configs are embedded in the launch template and applied automatically.

## Launch Template

**Name**: `shadowcheck-spot-template`  
**Current Version**: 5  
**Region**: us-east-1

**Features:**

- Automated PostgreSQL setup with optimized XFS filesystem
- SSL/TLS certificates (self-signed, 10-year validity)
- Docker Compose with persistent data volume
- Performance tuning for PostGIS workloads
- Secure logging (no password exposure)

## Cost Breakdown

| Component           | Monthly Cost |
| ------------------- | ------------ |
| t4g.large Spot      | ~$22         |
| 30GB GP3 Storage    | $4.80        |
| S3 Backups          | ~$0.25       |
| **Total (running)** | **~$27**     |
| **Total (stopped)** | **$4.80**    |

## Security

- **Network**: Security group restricts PostgreSQL to single IP (68.41.168.87/32)
- **Access**: SSM only (no SSH)
- **Authentication**: SCRAM-SHA-256 with SSL/TLS required
- **Logging**: Password-safe configuration

## Maintenance

### Start Instance

```bash
aws ec2 start-instances --instance-ids i-INSTANCE_ID --region us-east-1
```

### Stop Instance

```bash
aws ec2 stop-instances --instance-ids i-INSTANCE_ID --region us-east-1
```

### Backup Database

```bash
# Via SSM session
cd /home/ssm-user/shadowcheck

# Preferred: use the app backup path (uses admin creds and schema scoping)
curl -sS -X POST http://localhost:3001/api/admin/backup \
  -H 'Content-Type: application/json' \
  -d '{"uploadToS3":false}' | jq

# Manual fallback (schema-scoped)
docker exec shadowcheck_postgres pg_dump -U shadowcheck_user -n app -n public shadowcheck_db \
  | gzip > backup-$(date +%Y%m%d).sql.gz
```

## Monitoring

### Check Instance Status

```bash
aws ec2 describe-instances --instance-ids i-INSTANCE_ID --region us-east-1 --query 'Reservations[0].Instances[0].State.Name'
```

### Check Spot Price

```bash
aws ec2 describe-spot-price-history --instance-types t4g.large --region us-east-1 --start-time $(date -u +%Y-%m-%dT%H:%M:%S) --product-descriptions "Linux/UNIX" --query 'SpotPriceHistory[0].SpotPrice'
```

## Troubleshooting

See individual documentation files for detailed troubleshooting:

- Infrastructure issues → `docs/AWS_INFRASTRUCTURE.md`
- Performance problems → `docs/POSTGRESQL_TUNING.md`
- Password/auth issues → `docs/PASSWORD_ROTATION.md`
