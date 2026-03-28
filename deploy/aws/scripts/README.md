# ShadowCheck AWS Deployment Scripts

**Last Updated:** 2026-02-17  
**Total Scripts:** 20 (down from 25)

---

## Core Deployment Scripts (The Essential 6)

### 🚀 launch-shadowcheck-arm-spot.sh (RECOMMENDED)

**Run from:** Local machine  
**Purpose:** Recommended single-node ARM Spot replacement launcher  
**Does:**

- Uses one-time Spot instead of a persistent Spot request (more cost-effective)
- Tries multiple ARM instance types in order (`m7g.large`, `m6g.large`, `c7g.large`, `c6g.large`)
- Keeps the instance in the same AZ as the PostgreSQL EBS volume
- Stops and detaches the old volume owner before reattaching to the new instance
- Reassociates the Elastic IP automatically
- Optionally terminates the displaced instance after handoff
- Waits briefly for SSM registration

**Usage:**

```bash
./deploy/aws/scripts/launch-shadowcheck-arm-spot.sh
```

**Override candidate types:**

```bash
./deploy/aws/scripts/launch-shadowcheck-arm-spot.sh m7g.large m6g.large
```

---

### 🔄 scs_rebuild.sh (CANONICAL)

**Run from:** EC2 instance (as ssm-user)  
**Purpose:** Canonical daily rebuild, update, and migration orchestrator. This is the primary entry point for all application updates.  
**Does:**

1. **Self-Installation**: Symlinks itself to `/usr/local/bin/scs_rebuild` for global access.
2. **Environment Loading**: Reads persistent settings from `~/.shadowcheck-env`.
3. **Branch Awareness**: Automatically detects the current git branch and pulls the latest code.
4. **Certificate Management**:
   - Generates or reuses a 10-year self-signed TLS certificate for the instance's public IP.
   - Backs up certificates to S3 (if `S3_BUCKET` is configured via SSM).
   - Enforces correct permissions (999:999) for PostgreSQL and pgAdmin access.
5. **Infrastructure Sync**: Ensures `shadowcheck_postgres` and `shadowcheck_redis` are running and healthy.
6. **Container Rebuild**: Performs a `--no-cache` build of both backend and frontend images.
7. **Database Migrations**:
   - Bootstraps the `shadowcheck_admin` role.
   - Runs `sql/run-migrations.sh` to apply all pending schema updates.
8. **Monitoring**: Syncs Grafana passwords and ensures the monitoring stack is healthy.

**Parameters (via Environment):**

- `ENABLE_GRAFANA_MONITORING`: Toggle Grafana sync (default: `true`).
- `SCS_SKIP_CLEANUP`: Skip Docker system prune (default: `false`).
- `SCS_RESTORE_CERT`: Manual path to a certificate to restore.

**Usage:**

```bash
scs_rebuild  # (symlinked to /usr/local/bin)
# or
./deploy/aws/scripts/scs_rebuild.sh
```

**Run this for every code update. It replaces legacy manual SQL migration steps.**

---

### 🚀 launch-shadowcheck-spot.sh (LEGACY)

**Run from:** Local machine  
**Purpose:** Legacy EC2 spot instance launcher (uses persistent requests)  
**Usage:** `./deploy/aws/scripts/launch-shadowcheck-spot.sh`

---

### 🗄️ deploy-postgres.sh

**Run from:** EC2 instance (requires sudo)  
**Purpose:** Complete PostgreSQL infrastructure setup  
**Does:**

- Formats and mounts XFS volume (/var/lib/postgresql)
- Creates SSL certificates
- Creates optimized PostgreSQL config (8GB RAM tuning)
- Creates pg_hba.conf (security rules)
- Pulls postgis/postgis:18-3.6 image
- Starts PostgreSQL container with PostGIS
- Enables PostGIS extensions
- Creates database users (shadowcheck_user, shadowcheck_admin)

**Usage:**

```bash
sudo ./deploy/aws/scripts/deploy-postgres.sh
```

**Called automatically by deploy-complete.sh and scs_rebuild.sh.**

---

### 🧠 deploy-redis.sh

**Run from:** EC2 instance (requires sudo)  
**Purpose:** Restore Redis 7 cache for the AWS host-network stack  
**Does:**

- Creates persistent Redis data at `/var/lib/redis`
- Starts `shadowcheck_redis` from `redis:7-alpine`
- Binds Redis to `127.0.0.1:6379`
- Enables AOF persistence and the existing LRU cache policy
- Verifies startup with `redis-cli ping`

**Usage:**

```bash
sudo ./deploy/aws/scripts/deploy-redis.sh
```

**Called automatically by deploy-complete.sh and scs_rebuild.sh.**

---

## Utility Scripts

### 🔐 init-admin-user.sh

**Purpose:** Create admin user with random password  
**Usage:** `./deploy/aws/scripts/init-admin-user.sh`

### 📊 apply-new-migrations.sh

**Purpose:** Manually apply specific migrations  
**Usage:** `./deploy/aws/scripts/apply-new-migrations.sh`

### 🌐 add-ip-access.sh

**Purpose:** Add IP to security group whitelist  
**Usage:** `./deploy/aws/scripts/add-ip-access.sh <ip_address>`

### 📋 list-authorized-ips.sh

**Purpose:** Show all IPs with access  
**Usage:** `./deploy/aws/scripts/list-authorized-ips.sh`

### 🔓 open-public-access.sh

**Purpose:** Open security group to 0.0.0.0/0 (use with caution)  
**Usage:** `./deploy/aws/scripts/open-public-access.sh`

### 🔍 show-actual-tables.sh

**Purpose:** Database diagnostic - show current tables  
**Usage:** `./deploy/aws/scripts/show-actual-tables.sh`

### 🐛 debug-errors.sh

**Purpose:** Check server logs for errors  
**Usage:** `./deploy/aws/scripts/debug-errors.sh`

### 🔧 setup-git-on-ec2.sh

**Purpose:** Configure git credentials via SSM  
**Usage:** `./deploy/aws/scripts/setup-git-on-ec2.sh <username> <token>`

### 🔐 scs-ssm.sh

**Run from:** Local machine  
**Purpose:** Start an EC2 SSM session with automatic AWS SSO recovery  
**Does:**

- Verifies the AWS CLI and Session Manager plugin are installed
- Checks `AWS_PROFILE` if set, otherwise falls back to `shadowcheck-sso` and then `shadowcheck`
- Runs `aws sso login` if the resolved session is expired, which opens the browser login flow
- Resolves the latest EC2 instance tagged `Name=scs-ssm` if no instance id is passed
- Starts the SSM session and retries once after re-login if needed

**Usage:**

```bash
./deploy/aws/scripts/scs-ssm.sh
# or
./deploy/aws/scripts/scs-ssm.sh i-0123456789abcdef0
```

**Suggested alias:**

```bash
alias scs-ssm='$PWD/deploy/aws/scripts/scs-ssm.sh'
```

---

### 🧭 create-shadowcheck-asg.sh

**Run from:** Local machine  
**Purpose:** Stage or update the single-AZ mixed-instance ARM Spot ASG  
**Does:**

- Creates or updates a mixed-instance Spot ASG definition
- Defaults desired capacity to `0` so you can inspect it before cutover
- Restricts the instance pool to ARM types under the `m7g.large` price cap

**Usage:**

```bash
SCS_SUBNET_ID=subnet-xxxxxxxx ./deploy/aws/scripts/create-shadowcheck-asg.sh
```

**Review all placeholders before running.**

---

### 🧹 cancel-shadowcheck-persistent-spot.sh

**Run from:** Local machine  
**Purpose:** Audit or cancel the legacy persistent Spot request  
**Does:**

- Lists the Spot request(s) from the old launcher flow
- Cancels them only when invoked with `--cancel`

**Usage:**

```bash
./deploy/aws/scripts/cancel-shadowcheck-persistent-spot.sh
./deploy/aws/scripts/cancel-shadowcheck-persistent-spot.sh --cancel
```

---

## Specialized Scripts

### ☁️ setup-cloudformation.sh

**Purpose:** Deploy CloudFormation stack for infrastructure  
**Usage:** `./deploy/aws/scripts/setup-cloudformation.sh`

### 🔒 setup-passwords.sh

**Purpose:** Generate initial passwords (first-time setup)  
**Usage:** `./deploy/aws/scripts/setup-passwords.sh`

### 🐳 build-containers.sh

**Purpose:** Build Docker images only (no deployment)  
**Usage:** `./deploy/aws/scripts/build-containers.sh`

### 📤 upload-project.sh

**Purpose:** Upload project files to instance (alternative to git)  
**Usage:** `./deploy/aws/scripts/upload-project.sh`

---

## Archived Scripts

The following scripts have been moved to `archive/` as they are redundant or obsolete:

- **deploy-separated.sh** - Old docker-compose approach
- **deploy-full-stack.sh** - Redundant orchestrator
- **quick-deploy.sh** - Pre-built images (not used)

---

## Deleted Scripts

The following scripts have been removed:

- **init-infrastructure.sh** - Redundant (deploy-postgres.sh does this)
- **force-rebuild.sh** - Redundant (scs_rebuild.sh does this)
- **deploy-all-fixes.sh** - One-time historical script

---

## Common Workflows

### First-Time Deployment

```bash
# 1. Launch instance (local machine)
./deploy/aws/scripts/launch-shadowcheck-spot.sh

# 2. Connect via SSM
aws ssm start-session --target INSTANCE_ID --region us-east-1

# 3. Run complete deployment
bash
cd /home/ssm-user
git clone https://github.com/cyclonite69/shadowcheck-web.git shadowcheck
cd shadowcheck
sudo ./deploy/aws/scripts/setup-instance.sh
./deploy/aws/scripts/deploy-complete.sh
```

### Daily Updates

```bash
# Connect to instance
aws ssm start-session --target INSTANCE_ID --region us-east-1

# Rebuild
bash
scs_rebuild
```

### Add Your IP for Access

```bash
# Local machine
./deploy/aws/scripts/add-ip-access.sh $(curl -s ifconfig.me)
```

### Database Diagnostics

```bash
# On instance
./deploy/aws/scripts/show-actual-tables.sh
./deploy/aws/scripts/debug-errors.sh
```

---

## Script Dependencies

```
launch-shadowcheck-spot.sh (local)
    ↓
setup-instance.sh (sudo, first-time)
    ↓
deploy-complete.sh
    ├── deploy-postgres.sh (sudo)
    │   ├── PostgreSQL container
    │   └── Redis container
    └── scs_rebuild.sh
        ├── git pull
        ├── docker build
        ├── deploy-postgres.sh (if needed)
        └── migrations
```

---

## Environment Variables

Scripts use these environment variables:

- `SCS_DIR` - ShadowCheck directory (default: $HOME/shadowcheck)
- `DB_PASSWORD` - PostgreSQL password (from AWS Secrets Manager)
- `MAPBOX_TOKEN` - Mapbox API token (from .env.aws)
- `WIGLE_API_KEY` - WiGLE API key (optional, from .env.aws)

---

## Troubleshooting

### "permission denied" Docker errors

```bash
sudo usermod -aG docker ssm-user
sudo systemctl restart docker
# Then logout/login or run: newgrp docker
```

### PostgreSQL not starting

```bash
sudo ./deploy/aws/scripts/deploy-postgres.sh
docker logs shadowcheck_postgres
```

### Volume attachment fails

Check AZ mismatch - launch-shadowcheck-spot.sh will skip volume if AZs don't match.

### Elastic IP not associated

Manually associate:

```bash
aws ec2 associate-address \
  --instance-id INSTANCE_ID \
  --allocation-id eipalloc-0a85ace4f0c10d738 \
  --region us-east-1
```

---

## Notes

- All scripts use `set -e` for fail-fast behavior
- PostgreSQL uses postgis/postgis:18-3.6 (multi-arch, ARM64 compatible)
- Redis uses redis:alpine
- Spot instances may terminate - use launch script to recover
- Elastic IP (34.204.161.164) automatically reassociates on launch
