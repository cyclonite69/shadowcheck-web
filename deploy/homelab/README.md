# Home Lab Deployment for ShadowCheck

Deploy ShadowCheck on your own hardware for development, experimentation, and learning.

## Why Home Lab?

- **Full control** - Your hardware, your rules
- **No cloud costs** - One-time hardware investment
- **Learning** - Hands-on infrastructure experience
- **Privacy** - Data never leaves your network
- **Experimentation** - Break things without AWS bills

## Hardware Requirements

### Minimum (Development)

- **CPU**: 2 cores (x86_64 or ARM64)
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 1Gbps Ethernet

### Recommended (Production-like)

- **CPU**: 4+ cores (x86_64 or ARM64)
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD (NVMe preferred)
- **Network**: 1Gbps Ethernet

### Tested Platforms

- Raspberry Pi 4/5 (4GB+ RAM)
- Intel NUC
- Old desktop/laptop
- Proxmox VM
- Unraid Docker
- TrueNAS Scale

## Quick Start

### 1. Install Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Reboot or log out/in
```

### 2. Clone Repository

```bash
git clone https://github.com/cyclonite69/shadowcheck-web.git
cd shadowcheck-web
```

### 3. Configure Environment

```bash
# Secrets policy: do not create local .env files with credentials; inject runtime env vars or load from AWS Secrets Manager
export DB_PASSWORD="<runtime secret value>"
```

### 4. Set Up Secrets

```bash
export DB_PASSWORD="<runtime secret value>"
export MAPBOX_TOKEN="your_mapbox_token"
```

### 5. Start Infrastructure

```bash
# Start PostgreSQL + PostGIS
docker-compose -f docker/infrastructure/docker-compose.postgres.yml up -d

# Wait for database to be ready
sleep 10

# Run migrations
./scripts/shell/run-migration.sh sql/migrations/001_initial_schema.sql
```

### 6. Start Application

```bash
docker-compose up -d
```

### 7. Access Application

```
http://localhost:3001
```

## Architecture Options

### Option 1: All-in-One (Simplest)

Everything on one machine using Docker Compose.

**Pros**: Easy setup, minimal hardware  
**Cons**: Single point of failure

```yaml
# docker-compose.yml (already configured)
services:
  postgres: # Database
  api: # Backend
  redis: # Cache (optional)
```

### Option 2: Separate Database Server

PostgreSQL on dedicated hardware, app on another.

**Pros**: Better performance, easier backups  
**Cons**: Requires 2 machines

```bash
# Database server
docker-compose -f docker/infrastructure/docker-compose.postgres.yml up -d

# App server (set runtime DB_* environment variables to point to DB server)
DB_HOST=192.168.1.100
docker-compose up -d
```

### Option 3: Proxmox/VM Setup

Run in VMs for isolation and snapshots.

**Pros**: Snapshots, resource limits, isolation  
**Cons**: More complex setup

See `docs/PROXMOX_SETUP.md` for details.

## Storage Configuration

### PostgreSQL Data Volume

```bash
# Create dedicated volume
docker volume create shadowcheck_postgres_data

# Or mount host directory
volumes:
  - /mnt/ssd/shadowcheck/postgres:/var/lib/postgresql/data
```

### Backup Storage

```bash
# Local backups
mkdir -p /mnt/backups/shadowcheck
./scripts/backup-shadowcheck.sh

# NAS backups (NFS/SMB)
mount -t nfs nas.local:/backups /mnt/backups
```

## Performance Tuning

### For 4GB RAM

```bash
# Edit docker/infrastructure/docker-compose.postgres.yml
environment:
  POSTGRES_SHARED_BUFFERS: 1GB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 3GB
```

### For 8GB+ RAM

```bash
# Use optimized config
cp deploy/homelab/configs/postgresql-8gb.conf /path/to/postgres/config
```

### For Raspberry Pi

```bash
# ARM64-optimized settings
cp deploy/homelab/configs/postgresql-arm64.conf /path/to/postgres/config
```

## Network Configuration

### Local Network Only

```yaml
# docker-compose.yml
ports:
  - '127.0.0.1:3001:3001' # Localhost only
```

### LAN Access

```yaml
ports:
  - '3001:3001' # Accessible from LAN
```

### Reverse Proxy (Recommended)

```bash
# Nginx example
server {
  listen 80;
  server_name shadowcheck.local;
  location / {
    proxy_pass http://localhost:3001;
  }
}
```

### HTTPS with Let's Encrypt

```bash
# Using Caddy (easiest)
caddy reverse-proxy --from shadowcheck.yourdomain.com --to localhost:3001
```

## Security Hardening

### Firewall Rules

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Block PostgreSQL from external access
sudo ufw deny 5432/tcp
```

### Database Security

```bash
# Strong passwords
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32); export DB_PASSWORD

# Rotate every 90 days
./scripts/rotate-db-password.sh
```

### Container Security

```yaml
# docker-compose.yml
services:
  api:
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

## Monitoring

### Resource Usage

```bash
# Docker stats
docker stats shadowcheck_postgres shadowcheck_web_api

# System resources
htop
```

### Database Performance

```bash
# Connect to database
./scripts/db-connect.sh

# Check query performance
SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

### Logs

```bash
# Application logs
docker logs -f shadowcheck_web_api

# Database logs
docker logs -f shadowcheck_postgres
```

## Backup Strategy

### Automated Daily Backups

```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /path/to/shadowcheck-web/scripts/backup-shadowcheck.sh
```

### Backup to NAS

```bash
# Edit backup script to copy to NAS
BACKUP_DIR="/mnt/nas/shadowcheck-backups"
```

### Restore from Backup

```bash
# Stop application
docker-compose down

# Restore database
gunzip -c backup-20260205.sql.gz | docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db

# Start application
docker-compose up -d
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs shadowcheck_postgres
docker logs shadowcheck_web_api

# Check disk space
df -h

# Check memory
free -h
```

### Database Connection Failed

```bash
# Test connection
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c "SELECT version();"

# Check secrets
aws secretsmanager get-secret-value --secret-id shadowcheck/config --query SecretString --output text | jq -r '.db_password'
```

### Slow Performance

```bash
# Check resource usage
docker stats

# Tune PostgreSQL (see configs/)
# Increase shared_buffers and effective_cache_size
```

## Upgrading

### Application Updates

```bash
git pull origin master
npm install
docker-compose build
docker-compose up -d
```

### Database Migrations

```bash
# Run new migrations
./scripts/shell/run-migration.sh sql/migrations/NEW_MIGRATION.sql
```

### PostgreSQL Version Upgrade

```bash
# Backup first!
./scripts/backup-shadowcheck.sh

# Update docker-compose.yml
image: postgis/postgis:19-3.7  # New version

# Restart
docker-compose -f docker/infrastructure/docker-compose.postgres.yml up -d
```

## Cost Comparison

| Component    | Home Lab            | AWS        |
| ------------ | ------------------- | ---------- |
| Hardware     | $200-500 (one-time) | $0         |
| Monthly Cost | ~$5 (electricity)   | ~$27       |
| Year 1       | ~$260               | ~$324      |
| Year 2+      | ~$60/year           | ~$324/year |

**Break-even**: ~14 months

## Community Contributions

We welcome home lab deployments! Share your setup:

1. Document your hardware
2. Share performance benchmarks
3. Contribute optimization tips
4. Help others troubleshoot

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Example Setups

### Raspberry Pi 5 (8GB)

```
Hardware: RPi 5, 8GB RAM, 256GB NVMe SSD
Performance: ~200ms query response
Cost: $150 total
Power: ~5W
```

### Intel NUC (16GB)

```
Hardware: NUC11, 16GB RAM, 512GB NVMe
Performance: ~80ms query response
Cost: $400 total
Power: ~15W
```

### Proxmox VM

```
Hardware: 4 vCPU, 8GB RAM, 100GB SSD
Performance: ~100ms query response
Cost: Shared with other VMs
```

## Resources

- **Docker Documentation**: https://docs.docker.com/
- **PostgreSQL Tuning**: https://pgtune.leopard.in.ua/
- **Home Lab Subreddit**: r/homelab
- **Self-Hosted Awesome List**: https://github.com/awesome-selfhosted/awesome-selfhosted

## Support

- **Issues**: https://github.com/cyclonite69/shadowcheck-web/issues
- **Discussions**: https://github.com/cyclonite69/shadowcheck-web/discussions
- **Discord**: [Coming soon]

---

**Happy home labbing!** 🏠🔬
