# Cloud-Agnostic Deployment Lessons Learned

## Session Summary: AWS PostgreSQL + PostGIS ARM64 Deployment

### What We Actually Did (Step-by-Step)

1. **Discovered ARM64 Image Issues**
   - postgis/postgis:18-3.6 doesn't exist for ARM64
   - Alpine-based images lack proper PostGIS ARM64 packages
   - kartoza/postgis had permission issues with security restrictions

2. **Built Custom ARM64 Image**
   - Started with `postgres:18` (Debian/Ubuntu base)
   - Installed PostGIS via apt: `postgresql-18-postgis-3`
   - Created Dockerfile with init script
   - Built directly on ARM64 instance (faster than cross-compile)

3. **Configured Persistent Storage**
   - Formatted 30GB EBS volume with XFS
   - Optimized mount options for PostgreSQL
   - Used `/var/lib/postgresql` mount (PostgreSQL 18+ best practice)
   - Survived container restarts and instance stops

4. **Set Up User Permissions**
   - Added ssm-user to docker group: `usermod -aG docker ssm-user`
   - Required SSM session reconnect to apply
   - Created bash alias: `pgcli` for easy database access

5. **Deployed and Verified**
   - Container running: shadowcheck/postgis:18-3.6-arm64
   - PostgreSQL 18.1 on aarch64
   - PostGIS 3.6 with GEOS, PROJ, STATS
   - Localhost-only binding (127.0.0.1:5432)

6. **Restored Production Database**
   - Attached S3ReadOnlyAccess policy to EC2 instance role
   - Downloaded 109MB backup from S3 (shadowcheck_db_20260205-232407.dump)
   - Copied dump into container: `docker cp backup.dump container:/tmp/`
   - Restored with pg_restore: `--verbose --no-owner --no-acl`
   - Verified: 179,844 networks, 570,609 observations, 172,575 access points

7. **Built and Deployed Application Containers**
   - Built backend (Node.js + TypeScript): 397MB
   - Built frontend (React + Vite + Nginx): 72MB
   - Fixed husky install issues with `--ignore-scripts`
   - Fixed file paths (client/ subdirectory structure)
   - Fixed server.js path: `dist/server/server/server.js`
   - Created logs directory with proper permissions for nodejs user
   - Configured environment variables (DB connection, Mapbox token)
   - Used host networking for backend to access localhost PostgreSQL
   - Configured nginx to proxy API requests to localhost:3001

### Commands That Worked

```bash
# Build custom image on ARM64 instance
docker build -t shadowcheck/postgis:18-3.6-arm64 -f Dockerfile.postgis .

# Deploy with correct volume mount
docker run -d --name shadowcheck_postgres \
  -e POSTGRES_USER=shadowcheck_user \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=shadowcheck_db \
  -p 127.0.0.1:5432:5432 \
  -v /var/lib/postgresql:/var/lib/postgresql \
  --shm-size=512m \
  shadowcheck/postgis:18-3.6-arm64

# Add user to docker group
usermod -aG docker ssm-user

# Create psql alias
echo 'alias pgcli="docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db"' >> ~/.bashrc

# Build backend container
docker build -f deploy/aws/docker/Dockerfile.backend -t shadowcheck/backend:latest .

# Build frontend container
docker build -f deploy/aws/docker/Dockerfile.frontend -t shadowcheck/frontend:latest .

# Run backend (host network for localhost DB access)
docker run -d --name shadowcheck_backend \
  --network host \
  -e NODE_ENV=development \
  -e PORT=3001 \
  -e DB_HOST=127.0.0.1 \
  -e DB_USER=shadowcheck_user \
  -e DB_PASSWORD=$DB_PASSWORD \
  -e DB_NAME=shadowcheck_db \
  -e MAPBOX_TOKEN=$MAPBOX_TOKEN \
  -e CORS_ORIGINS=http://13.216.239.240,http://localhost \
  --restart unless-stopped \
  shadowcheck/backend:latest

# Run frontend (host network for localhost API access)
docker run -d --name shadowcheck_frontend \
  --network host \
  --restart unless-stopped \
  shadowcheck/frontend:latest
```

### Key Discoveries

1. **ARM64 Image Compatibility**
   - Alpine-based images often lack ARM64 PostGIS support
   - Ubuntu/Debian base images (postgres:18) work perfectly on ARM64
   - Official postgis/postgis images may not support all ARM64 versions

2. **PostgreSQL 18 + PostGIS 3.6 on ARM64**
   - Use `postgres:18` base image (Debian-based)
   - Install via apt: `postgresql-18-postgis-3` and `postgresql-18-postgis-3-scripts`
   - Works on AWS Graviton (ARM64), Raspberry Pi, Apple Silicon

3. **Volume Mounting Best Practices**
   - PostgreSQL 18+ prefers single mount at `/var/lib/postgresql`
   - Creates subdirectory structure automatically
   - Enables `pg_upgrade --link` without mount boundary issues
   - Use XFS filesystem for optimal PostgreSQL performance

4. **XFS Optimization for PostgreSQL**

   ```bash
   mkfs.xfs -f \
     -d agcount=4,su=256k,sw=1 \
     -i size=512 \
     -n size=8192 \
     -l size=128m,su=256k

   mount -o noatime,nodiratime,logbufs=8,logbsize=256k,allocsize=16m
   ```

5. **Security Hardening**
   - Bind PostgreSQL to localhost only: `127.0.0.1:5432`
   - Use SCRAM-SHA-256 authentication
   - Disable password logging: `log_statement = 'none'`
   - Docker log limits: 10MB × 3 files
   - Bash history exclusions for sensitive commands

6. **Performance Tuning (8GB RAM)**
   ```
   shared_buffers = 2GB
   effective_cache_size = 6GB
   work_mem = 16MB (increased for PostGIS)
   jit = on (for PostGIS queries)
   autovacuum tuning for frequent updates
   ```

## Cloud-Agnostic Architecture

### Container Strategy

**Build once, deploy anywhere:**

- Custom Docker images for each service
- Multi-architecture support (amd64 + arm64)
- Environment-based configuration
- Persistent volume abstractions

### Service Separation

```
┌─────────────────────────────────────────┐
│           Load Balancer (Optional)       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              API Container               │
│  - Node.js Backend                       │
│  - Port 3001                             │
│  - Read-only filesystem                  │
│  - Connects to DB via internal network   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         PostgreSQL Container             │
│  - PostgreSQL 18 + PostGIS 3.6          │
│  - Localhost only (127.0.0.1:5432)      │
│  - Persistent volume                     │
│  - SCRAM-SHA-256 + SSL                   │
└──────────────────────────────────────────┘
```

## Dockerfile Templates

### 1. PostgreSQL + PostGIS (Multi-Arch)

```dockerfile
FROM postgres:18

# Install PostGIS
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-18-postgis-3 \
        postgresql-18-postgis-3-scripts \
    && rm -rf /var/lib/apt/lists/*

# Initialize PostGIS
COPY init-postgis.sh /docker-entrypoint-initdb.d/

EXPOSE 5432
CMD ["postgres"]
```

**Build command:**

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-registry/postgis:18-3.6 \
  --push .
```

### 2. Node.js API (Multi-Arch)

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY . .

# Build TypeScript
RUN npm run build

# Security
USER node
EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### 3. Redis Cache (Official Multi-Arch)

```dockerfile
FROM redis:7-alpine

# Custom config
COPY redis.conf /usr/local/etc/redis/redis.conf

CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
```

## Cloud Provider Mappings

### Compute

| Feature           | AWS            | Azure               | GCP             | DigitalOcean |
| ----------------- | -------------- | ------------------- | --------------- | ------------ |
| ARM64 Instance    | Graviton (t4g) | Dpsv5               | T2A             | N/A          |
| Spot/Preemptible  | Spot Instances | Spot VMs            | Preemptible VMs | N/A          |
| Container Service | ECS/Fargate    | Container Instances | Cloud Run       | App Platform |

### Storage

| Feature       | AWS           | Azure          | GCP             | DigitalOcean     |
| ------------- | ------------- | -------------- | --------------- | ---------------- |
| Block Storage | EBS           | Managed Disks  | Persistent Disk | Volumes          |
| Filesystem    | XFS/ext4      | ext4           | ext4            | ext4             |
| Backup        | EBS Snapshots | Disk Snapshots | Snapshots       | Volume Snapshots |

### Networking

| Feature         | AWS             | Azure         | GCP                  | DigitalOcean  |
| --------------- | --------------- | ------------- | -------------------- | ------------- |
| Firewall        | Security Groups | NSG           | Firewall Rules       | Firewall      |
| Load Balancer   | ALB/NLB         | Load Balancer | Cloud Load Balancing | Load Balancer |
| Private Network | VPC             | VNet          | VPC                  | VPC           |

## Infrastructure as Code Options

### 1. Docker Compose (Simplest)

**Pros:** Works everywhere, simple syntax  
**Cons:** Not cloud-native, manual scaling

```yaml
version: '3.8'
services:
  postgres:
    image: your-registry/postgis:18-3.6
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql
```

### 2. Terraform (Cloud-Agnostic)

**Pros:** Multi-cloud, state management  
**Cons:** Learning curve, verbose

```hcl
resource "aws_instance" "postgres" {
  ami           = data.aws_ami.arm64.id
  instance_type = "t4g.large"

  user_data = templatefile("bootstrap.sh", {
    db_password = var.db_password
  })
}
```

### 3. Pulumi (Recommended)

**Pros:** Real programming languages, type safety  
**Cons:** Newer, smaller community

```typescript
const instance = new aws.ec2.Instance('postgres', {
  instanceType: 't4g.large',
  ami: arm64Ami.id,
  userData: bootstrapScript,
});
```

### 4. Kubernetes (Enterprise)

**Pros:** Portable, auto-scaling, self-healing  
**Cons:** Complex, overkill for small deployments

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  template:
    spec:
      containers:
        - name: postgres
          image: your-registry/postgis:18-3.6
```

## Migration Path

### Phase 1: Containerize (Current)

- Build custom Docker images
- Test locally with docker-compose
- Document environment variables

### Phase 2: Cloud Deploy (AWS)

- Deploy to single cloud provider
- Learn cloud-specific features
- Establish backup/monitoring

### Phase 3: Abstract (Terraform/Pulumi)

- Convert to IaC
- Parameterize cloud-specific resources
- Test on second cloud provider

### Phase 4: Orchestrate (Kubernetes)

- Deploy to managed K8s (EKS, AKS, GKE)
- Implement auto-scaling
- Multi-region deployment

## Next Steps

### Immediate (This Session)

1. ✅ PostgreSQL 18 + PostGIS 3.6 ARM64 image
2. ⏳ Build API container image
3. ⏳ Build frontend container image
4. ⏳ Create docker-compose for full stack

### Short Term (Next Session)

1. Push images to Docker Hub
2. Create Terraform modules
3. Test on Azure/GCP
4. Document deployment procedures

### Long Term

1. Kubernetes manifests
2. Helm charts
3. CI/CD pipelines
4. Multi-region deployment

## Lessons Applied to Other Services

### API Container

- Use Node 20 Alpine for small size
- Multi-stage build (build → production)
- Read-only filesystem
- Health checks
- Secrets via environment variables

### Frontend Container

- Nginx Alpine for serving static files
- Brotli compression
- Security headers
- Cache optimization
- Multi-arch support

### Redis Container

- Official Redis Alpine image
- Custom config for memory limits
- Persistence configuration
- Health checks

## Cost Optimization Across Clouds

### AWS

- Spot instances (55% savings)
- Graviton ARM64 (20% cheaper)
- Reserved instances (40% savings)

### Azure

- Spot VMs (up to 90% savings)
- Reserved instances (40% savings)
- Dpsv5 ARM64 (cheaper than x86)

### GCP

- Preemptible VMs (80% savings)
- Committed use discounts (57% savings)
- T2A ARM64 (cheaper than x86)

### DigitalOcean

- No spot pricing
- Flat pricing model
- Cheaper for small workloads

## Troubleshooting We Encountered

### Issue 1: "no matching manifest for linux/arm64"

**Problem:** postgis/postgis:18-3.6 doesn't support ARM64  
**Solution:** Build custom image from postgres:18 base with apt-installed PostGIS

### Issue 2: "exec format error"

**Problem:** Pulled x86_64 image on ARM64 instance  
**Solution:** Verify image architecture before deploying

### Issue 3: "Permission denied" on docker.sock

**Problem:** ssm-user not in docker group  
**Solution:** `usermod -aG docker ssm-user` and reconnect session

### Issue 4: "PostgreSQL data in /var/lib/postgresql/data"

**Problem:** Wrong mount point for PostgreSQL 18+  
**Solution:** Mount `/var/lib/postgresql` instead of `/var/lib/postgresql/data`

### Issue 5: PostGIS extension not available

**Problem:** Alpine PostGIS packages for PostgreSQL 18, not 16  
**Solution:** Use Debian-based postgres:18 image with matching PostGIS version

### Issue 6: Container keeps restarting

**Problem:** kartoza/postgis chmod errors with cap_drop security restrictions  
**Solution:** Use simpler official postgres base without excessive hardening

### Issue 7: Database restore "relation does not exist"

**Problem:** Restoring dump without schema created first  
**Solution:** Use `pg_restore` instead of `psql` - it handles schema creation automatically

**Commands that worked:**

```bash
# Copy dump into container
docker cp backup.dump shadowcheck_postgres:/tmp/

# Restore with pg_restore (handles schema + data)
docker exec shadowcheck_postgres pg_restore \
  -U shadowcheck_user \
  -d shadowcheck_db \
  --verbose \
  --no-owner \
  --no-acl \
  /tmp/backup.dump
```

**Key learnings:**

- `pg_restore` is for custom format dumps (`.dump` files)
- `psql` is for plain SQL dumps (`.sql` files)
- `--no-owner` prevents ownership conflicts
- `--no-acl` skips privilege restoration
- Duplicate constraint warnings are normal when restoring into existing schema
- Verify with: `SELECT COUNT(*) FROM app.networks;`

### Issue 8: S3 access from EC2 instance

**Problem:** Instance couldn't download backup from S3  
**Solution:** Attach IAM policy to instance role

```bash
# Attach S3 read policy to instance role
aws iam attach-role-policy \
  --role-name EC2-SSM-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
  --region us-east-1

# Download backup
aws s3 cp s3://bucket-name/backups/backup.dump . --region us-east-1
```

**Restored data:**

- 179,844 networks
- 570,609 observations
- 172,575 access points
- All materialized views and indexes

## Security Checklist (Cloud-Agnostic)

- [ ] Database bound to localhost only
- [ ] Firewall rules restrict access to specific IPs
- [ ] SCRAM-SHA-256 authentication
- [ ] SSL/TLS for all connections
- [ ] No password logging
- [ ] Docker log rotation
- [ ] Bash history exclusions
- [ ] Regular password rotation (60-90 days)
- [ ] Encrypted volumes
- [ ] Backup encryption
- [ ] Secrets management (not in images)
- [ ] Container capability restrictions
- [ ] Read-only filesystems where possible

## Performance Checklist (Cloud-Agnostic)

- [ ] XFS filesystem for PostgreSQL
- [ ] Optimized mount options (noatime, nodiratime)
- [ ] PostgreSQL tuning for available RAM
- [ ] JIT enabled for PostGIS queries
- [ ] Autovacuum tuning
- [ ] Connection pooling
- [ ] Redis caching layer
- [ ] CDN for static assets
- [ ] Gzip/Brotli compression
- [ ] Database indexes optimized

## Monitoring (Cloud-Agnostic)

### Metrics to Track

- CPU usage
- Memory usage
- Disk I/O
- Network traffic
- Database connections
- Query performance
- Cache hit rate
- API response times

### Tools

- **Prometheus + Grafana** (self-hosted)
- **Datadog** (SaaS, multi-cloud)
- **New Relic** (SaaS, multi-cloud)
- **Cloud-native** (CloudWatch, Azure Monitor, Cloud Monitoring)

## Backup Strategy (Cloud-Agnostic)

### Database Backups

- Daily automated backups
- 30-day retention
- Point-in-time recovery
- Encrypted at rest
- Tested restore procedures

### Volume Snapshots

- Daily snapshots
- 7-day retention
- Cross-region replication
- Automated via cron/cloud scheduler

### Application Backups

- Configuration files
- Secrets (encrypted)
- Docker images (registry)
- IaC state files

## Disaster Recovery

### RTO/RPO Targets

- **RTO** (Recovery Time Objective): 4 hours
- **RPO** (Recovery Point Objective): 24 hours

### Recovery Procedures

1. Launch new instance from snapshot
2. Restore database from backup
3. Update DNS/load balancer
4. Verify application functionality
5. Monitor for issues

## Documentation Requirements

For each deployment:

- [ ] Architecture diagram
- [ ] Environment variables list
- [ ] Secrets management procedure
- [ ] Backup/restore procedures
- [ ] Monitoring setup
- [ ] Troubleshooting guide
- [ ] Cost breakdown
- [ ] Security configuration
- [ ] Performance tuning applied

## Success Metrics

- **Deployment time**: < 30 minutes
- **Downtime during updates**: < 5 minutes
- **Cost per month**: < $50
- **Query response time**: < 200ms (p95)
- **Uptime**: > 99.5%
- **Backup success rate**: 100%
- **Security scan**: 0 critical vulnerabilities

---

**This document captures the complete journey from bare metal to cloud-agnostic deployment, ready for iteration across all services and cloud providers.**

### Issue 9: Husky install failing in Docker production build

**Problem:** `npm ci --only=production` tries to run husky install script  
**Solution:** Use `--ignore-scripts` flag

```dockerfile
RUN npm ci --only=production --ignore-scripts
```

### Issue 10: Frontend build can't find vite.config.ts

**Problem:** Vite config and index.html in `client/` subdirectory  
**Solution:** Use the npm script that knows the correct paths

```dockerfile
# Copy client source
COPY client ./client

# Use build:frontend script (knows about client/vite.config.ts)
RUN npm run build:frontend
```

### Issue 11: Backend server.js not found at /app/dist/server.js

**Problem:** TypeScript compiles to nested path `dist/server/server/server.js`  
**Solution:** Use correct path in CMD

```dockerfile
CMD ["node", "dist/server/server/server.js"]
```

### Issue 12: Permission denied creating logs directory

**Problem:** nodejs user can't write to /app/dist/server/server/data/logs  
**Solution:** Create directory and chown before switching users

```dockerfile
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p /app/dist/server/server/data/logs && \
    chown -R nodejs:nodejs /app

USER nodejs
```

### Issue 13: Backend requires mapbox_token secret

**Problem:** Server won't start without required MAPBOX_TOKEN environment variable  
**Solution:** Pass as environment variable in docker run

```bash
docker run -d --name shadowcheck_backend \
  -e MAPBOX_TOKEN=$MAPBOX_TOKEN \
  ...
```

### Issue 14: Nginx can't resolve shadowcheck_backend hostname

**Problem:** Frontend container can't reach backend via container name  
**Solution:** Use host network and proxy to localhost:3001

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
}
```

```bash
docker run -d --name shadowcheck_frontend --network host ...
```

### Issue 15: CORS blocking frontend requests

**Problem:** Frontend on port 80 can't access backend API on port 3001  
**Solution:** Set CORS_ORIGINS environment variable

```bash
docker run -d --name shadowcheck_backend \
  -e CORS_ORIGINS=http://13.216.239.240,http://localhost \
  ...
```

**Default origins:** `http://localhost:3001, http://127.0.0.1:3001`

### Issue 16: Secure cookies don't work over HTTP

**Problem:** Backend sets `secure: true` on cookies in production, requires HTTPS  
**Solution:** Use NODE_ENV=development for HTTP testing, or set up HTTPS

```bash
# For HTTP testing
docker run -d --name shadowcheck_backend \
  -e NODE_ENV=development \
  ...

# For production with HTTPS
docker run -d --name shadowcheck_backend \
  -e NODE_ENV=production \
  ...
```

**Note:** Secure cookies are required for production. Set up SSL/TLS with Let's Encrypt.

### Issue 17: Invalid Mapbox token

**Problem:** Mapbox API returns 401 - Invalid Token  
**Solution:** Generate new token at https://account.mapbox.com/access-tokens/

```bash
# Update token
docker stop shadowcheck_backend && docker rm shadowcheck_backend
docker run -d --name shadowcheck_backend \
  -e MAPBOX_TOKEN=pk.your_new_token_here \
  ...
```

### Issue 18: Security group blocks all traffic by default

**Problem:** No inbound rules on security group, can't access application  
**Solution:** Add rules for your IP address

```bash
# Add your IP
aws ec2 authorize-security-group-ingress \
  --group-id sg-076801a316243fa70 \
  --ip-permissions \
    IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges="[{CidrIp=68.41.168.87/32}]" \
    IpProtocol=tcp,FromPort=3001,ToPort=3001,IpRanges="[{CidrIp=68.41.168.87/32}]" \
  --region us-east-1
```

**Scripts created:**

- `deploy/aws/scripts/add-ip-access.sh <ip>` - Add specific IP
- `deploy/aws/scripts/list-authorized-ips.sh` - List authorized IPs
- `deploy/aws/scripts/open-public-access.sh` - Open to everyone (use with caution)

### Issue 19: Admin user password not set correctly

**Problem:** Admin user not initialized or password unknown  
**Solution:** Run init script to create admin user with random password

```bash
# Run initialization script
./deploy/aws/scripts/init-admin-user.sh

# Script will:
# - Generate random password
# - Create admin user with force_password_change flag
# - Display password (save it securely)
# - Require password change on first login
```
