# ShadowCheck AWS Deployment Scripts

**Last Updated:** 2026-02-17  
**Total Scripts:** 20 (down from 25)

---

## Core Deployment Scripts (The Essential 6)

### 🚀 launch-shadowcheck-spot.sh

**Run from:** Local machine  
**Purpose:** Launch new EC2 spot instance  
**Does:**

- Launches t4g.medium spot instance from template
- Checks volume AZ compatibility before attaching
- Associates Elastic IP automatically
- Waits for SSM agent to be ready

**Usage:**

```bash
./deploy/aws/scripts/launch-shadowcheck-spot.sh
```

---

### ⚙️ setup-instance.sh

**Run from:** EC2 instance (via SSM, requires sudo)  
**Purpose:** First-time system configuration  
**Does:**

- Installs system packages (ripgrep, ncdu, jq, etc.)
- Installs Docker and adds ssm-user to docker group
- Installs Docker Compose
- Installs Node.js 20
- Installs AWS CLI v2
- Installs pip3 and pgcli
- Creates directories (/home/ssm-user/shadowcheck, secrets, backups)
- Symlinks scs_rebuild to /usr/local/bin

**Usage:**

```bash
sudo ./deploy/aws/scripts/setup-instance.sh
```

**Run once per instance.**

---

### 🎯 deploy-complete.sh

**Run from:** EC2 instance (as ssm-user)  
**Purpose:** Complete deployment orchestrator  
**Does:**

1. Runs setup-instance.sh (if needed)
2. Clones/updates repository
3. Runs deploy-postgres.sh and deploy-redis.sh
4. Configures environment (.env.aws)
5. Runs scs_rebuild.sh
6. Optionally initializes admin user

**Usage:**

```bash
./deploy/aws/scripts/deploy-complete.sh
```

**Run once for fresh deployments.**

---

### 🔄 scs_rebuild.sh

**Run from:** EC2 instance (as ssm-user)  
**Purpose:** Daily rebuild and update script  
**Does:**

1. Cleans old Docker artifacts
2. Pulls latest code from GitHub
3. Builds backend and frontend images
4. Ensures PostgreSQL and Redis are running
5. Restarts backend and frontend containers
6. Runs database migrations
7. Health checks

**Usage:**

```bash
scs_rebuild  # (symlinked to /usr/local/bin)
# or
./deploy/aws/scripts/scs_rebuild.sh
```

**Run this for every code update.**

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
