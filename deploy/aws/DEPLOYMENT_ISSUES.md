# ShadowCheck AWS Deployment Script Issues

**Date:** 2026-02-17  
**Testing Context:** Spot instance recovery after termination

---

## CRITICAL ISSUES

### 1. Volume Attachment Fails Across Availability Zones

**File:** `deploy/aws/scripts/launch-shadowcheck-spot.sh`  
**Issue:** Script tries to attach volume `vol-0f38f7789ac264d59` but fails if instance launches in different AZ  
**Error:** `InvalidVolume.ZoneMismatch: The volume 'vol-0f38f7789ac264d59' is not in the same availability zone`

**Impact:** Data volume cannot be attached, deployment starts with empty database

**Fix Needed:**

- Check volume AZ before launching instance
- Either: Launch instance in same AZ as volume
- Or: Create snapshot and restore to new AZ
- Or: Remove volume attachment for fresh deployments

**Recommendation:** Add AZ detection and snapshot-based recovery

---

### 2. pip3 Not Installed

**File:** `deploy/aws/scripts/setup-instance.sh` (line 132)  
**Issue:** Script tries to install pgcli with `pip3` but pip3 is not installed  
**Error:** `pip3: command not found`

**Impact:** pgcli installation fails (non-critical, but script should handle it)

**Fix Needed:**

```bash
# Install pip3 first
sudo dnf install -y python3-pip

# Or skip pgcli if pip3 unavailable
if command -v pip3 &> /dev/null; then
    pip3 install --user pgcli
else
    echo "⚠️  pip3 not available, skipping pgcli installation"
fi
```

---

### 3. Docker Permission Issues

**File:** `deploy/aws/scripts/scs_rebuild.sh`  
**Issue:** ssm-user not in docker group by default  
**Error:** `permission denied while trying to connect to the Docker daemon socket`

**Impact:** Cannot run docker commands without sudo

**Fix Needed:**

```bash
# In setup-instance.sh, add:
sudo usermod -aG docker ssm-user
sudo systemctl restart docker
```

**Note:** User must logout/login or use `newgrp docker` for group to take effect

---

### 4. PostgreSQL and Redis Not Started

**File:** `deploy/aws/scripts/scs_rebuild.sh`  
**Issue:** Script assumes PostgreSQL and Redis containers already exist  
**Error:** `Error response from daemon: No such container: shadowcheck_postgres`

**Impact:** Backend cannot connect to database, deployment incomplete

**Fix Needed:**
Add to `scs_rebuild.sh` before migrations:

```bash
# Start PostgreSQL if not running
if ! docker ps | grep -q shadowcheck_postgres; then
    echo "Starting PostgreSQL..."
    docker run -d --name shadowcheck_postgres \
        --network host --restart unless-stopped \
        -e POSTGRES_USER=shadowcheck_user \
        -e POSTGRES_PASSWORD=${DB_PASSWORD} \
        -e POSTGRES_DB=shadowcheck_db \
        -v /data/postgresql:/var/lib/postgresql/data \
        postgres:18-alpine
fi

# Start Redis if not running
if ! docker ps | grep -q shadowcheck_redis; then
    echo "Starting Redis..."
    docker run -d --name shadowcheck_redis \
        --network host --restart unless-stopped \
        redis:alpine
fi
```

---

### 5. Security Group Missing Port 80

**Issue:** Security group `sg-0c3b2c64455ee8571` only has ports 3001, 5432, 5050  
**Impact:** Frontend not accessible on port 80

**Fix Needed:**
Add to launch template or setup script:

```bash
aws ec2 authorize-security-group-ingress \
    --group-id sg-0c3b2c64455ee8571 \
    --ip-permissions IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0,Description="HTTP"}]' \
    --region us-east-1
```

---

### 6. Elastic IP Not Auto-Reassociated

**File:** `deploy/aws/scripts/launch-shadowcheck-spot.sh`  
**Issue:** Script doesn't reassociate Elastic IP after launch  
**Impact:** Instance gets random public IP, DNS/bookmarks break

**Fix Needed:**
Add to launch script:

```bash
EIP_ALLOC_ID="eipalloc-0a85ace4f0c10d738"

echo "📌 Associating Elastic IP..."
aws ec2 associate-address \
    --allocation-id $EIP_ALLOC_ID \
    --instance-id $INSTANCE_ID \
    --region $REGION > /dev/null

echo "✅ Elastic IP associated: $(aws ec2 describe-addresses --allocation-ids $EIP_ALLOC_ID --region $REGION --query 'Addresses[0].PublicIp' --output text)"
```

---

### 7. No Database Initialization

**Issue:** Fresh instance has no database schema or admin user  
**Impact:** Cannot login, no tables exist

**Fix Needed:**
Add to deployment script:

```bash
# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until docker exec shadowcheck_postgres pg_isready -U shadowcheck_user; do
    sleep 2
done

# Run migrations
echo "📊 Running database migrations..."
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -f /sql/migrations/...

# Create admin user
echo "👤 Creating admin user..."
./deploy/aws/scripts/init-admin-user.sh
```

---

### 8. PostGIS Image Not ARM64 Compatible

**File:** `deploy/aws/configs/docker-compose.yml`  
**Issue:** Uses `postgis/postgis:18-3.6` which doesn't support ARM64  
**Error:** `no matching manifest for linux/arm64/v8`

**Impact:** Cannot use AWS docker-compose on t4g (ARM) instances

**Fix Needed:**
Use `postgres:18-alpine` and install PostGIS manually, or use multi-arch image

---

## MINOR ISSUES

### 9. Verbose Output During Setup

**Issue:** Package installation shows too much output  
**Recommendation:** Redirect to log file, show summary only

### 10. No Health Checks

**Issue:** Scripts don't verify services are actually working  
**Recommendation:** Add curl checks for frontend/backend health endpoints

### 11. No Rollback on Failure

**Issue:** If deployment fails midway, system is in broken state  
**Recommendation:** Add cleanup/rollback logic

---

## DEPLOYMENT SCRIPT EXECUTION ORDER ISSUES

**Current Flow:**

1. `launch-shadowcheck-spot.sh` - Launches instance
2. `setup-instance.sh` - Installs system packages
3. `deploy-complete.sh` - Calls setup + rebuild
4. `scs_rebuild.sh` - Builds containers

**Problems:**

- `scs_rebuild.sh` assumes infrastructure exists (PostgreSQL, Redis)
- No separation between "first-time setup" and "update deployment"
- Volume attachment happens too early (before checking AZ)

**Recommended Flow:**

1. `launch-shadowcheck-spot.sh` - Launch + EIP + Security Group
2. `setup-instance.sh` - System packages + Docker setup
3. `init-infrastructure.sh` - **NEW** - Start PostgreSQL, Redis, run migrations
4. `deploy-application.sh` - Build and start backend/frontend containers
5. `verify-deployment.sh` - **NEW** - Health checks

---

## TESTING CHECKLIST

- [ ] Fresh instance deployment (no existing data)
- [ ] Update deployment (existing containers)
- [ ] Cross-AZ recovery (snapshot restore)
- [ ] Spot termination recovery (automated)
- [ ] Security group configuration
- [ ] Elastic IP reassociation
- [ ] Database initialization
- [ ] Admin user creation
- [ ] Frontend accessibility
- [ ] Backend API health
- [ ] PostgreSQL connectivity
- [ ] Redis connectivity

---

## PRIORITY FIXES

**P0 (Blocking):**

1. Fix PostgreSQL/Redis startup in scs_rebuild.sh
2. Add Elastic IP reassociation to launch script
3. Fix security group port 80

**P1 (Important):** 4. Fix pip3 installation 5. Fix docker permissions 6. Add database initialization

**P2 (Nice to have):** 7. Add health checks 8. Add rollback logic 9. Improve logging
