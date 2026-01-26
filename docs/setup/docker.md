# Docker Setup Guide

## ✅ Current Status

Your Dockerized PostgreSQL infrastructure is **fully configured** with automatic restart on system reboot.

### Running Services

| Service                         | Container Name         | Status      | Port | Restart Policy   |
| ------------------------------- | ---------------------- | ----------- | ---- | ---------------- |
| **PostgreSQL 18 + PostGIS 3.6** | `shadowcheck_postgres` | ✅ Running  | 5432 | `unless-stopped` |
| **Redis 7**                     | `shadowcheck_redis`    | ✅ Running  | 6379 | `unless-stopped` |
| **PgAdmin 4**                   | `shadowcheck_pgadmin`  | ⚠️ Optional | 5050 | `unless-stopped` |

### What "unless-stopped" Means

- ✅ **Automatic start on boot**: Container starts when Docker daemon starts
- ✅ **Restart on crash**: Container automatically restarts if it crashes
- ✅ **Survives reboot**: Container will start after system reboot
- ⏸️ **Manual stop respected**: Won't restart if you manually stop it with `docker stop`

### Docker Service Status

Docker daemon is **enabled** and will start on system boot:

```bash
systemctl is-enabled docker  # Shows: enabled
```

## Quick Commands

### Using the Management Script

The `scripts/docker-manage.sh` script provides easy control:

```bash
# Start everything
./scripts/docker-manage.sh start-all

# Stop everything
./scripts/docker-manage.sh stop-all

# Restart everything
./scripts/docker-manage.sh restart-all

# Check status
./scripts/docker-manage.sh status

# View logs
./scripts/docker-manage.sh logs-db    # PostgreSQL logs
./scripts/docker-manage.sh logs-app   # Application logs

# Backup database
./scripts/docker-manage.sh backup-db
```

### Manual Docker Commands

```bash
# Check running containers
docker ps

# Check all containers (including stopped)
docker ps -a

# View PostgreSQL logs
docker logs shadowcheck_postgres

# Access PostgreSQL CLI
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db

# Stop a service
docker stop shadowcheck_postgres

# Start a service
docker start shadowcheck_postgres

# Restart a service
docker restart shadowcheck_postgres
```

## Database Connection

### From Host Machine

```bash
# psql
psql -h localhost -p 5432 -U shadowcheck_user -d shadowcheck_db

# Connection string
postgresql://shadowcheck_user:PASSWORD@localhost:5432/shadowcheck_db
```

### From Application (Docker Network)

```bash
# Use container name as hostname
DB_HOST=shadowcheck_postgres
DB_PORT=5432
DB_USER=shadowcheck_user
DB_NAME=shadowcheck_db
```

### Environment Variables

Set these in `.env`:

```bash
# PostgreSQL
DB_USER=shadowcheck_user
DB_PASSWORD=your_secure_password
DB_NAME=shadowcheck_db
DB_HOST=shadowcheck_postgres  # When running in Docker
# DB_HOST=localhost           # When running locally
DB_PORT=5432

# PgAdmin (optional)
PGADMIN_EMAIL=admin@shadowcheck.local
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050

# Redis
REDIS_PORT=6379
```

## Testing the Setup

### 1. Check PostgreSQL is Running

```bash
docker exec shadowcheck_postgres pg_isready -U shadowcheck_user -d shadowcheck_db
# Expected: /var/run/postgresql:5432 - accepting connections
```

### 2. Check PostgreSQL Version

```bash
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c "SELECT version();"
# Expected: PostgreSQL 18.1 (Debian 18.1-1.pgdg13+2)
```

### 3. Check PostGIS Extension

```bash
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c "SELECT PostGIS_Version();"
# Expected: 3.6.x
```

### 4. Test from Application

```bash
npm run dev  # Start the API server
# Check: http://localhost:3001/health
```

## Reboot Testing

To verify automatic restart works:

```bash
# 1. Check containers are running
docker ps

# 2. Reboot system
sudo reboot

# 3. After reboot, check containers started automatically
docker ps --filter "name=shadowcheck"

# Expected: shadowcheck_postgres and shadowcheck_redis running
```

## Backup and Restore

### Backup Database

```bash
# Using management script
./docker-manage.sh backup-db

# Admin UI backup (writes to /app/backups/db in the api container)
# Ensure docker-compose mounts ./backups:/app/backups
# Then run "Run Full Backup" in /admin

# Manual backup
docker exec shadowcheck_postgres pg_dump -U shadowcheck_user shadowcheck_db > backup.sql

# Or with docker-compose
docker-compose -f docker-compose.postgres.yml exec -T postgres pg_dump -U shadowcheck_user shadowcheck_db > backup.sql
```

### Restore Database

```bash
# From SQL file
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db < backup.sql

# From container volume
docker run --rm -v shadowcheck_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Troubleshooting

### PostgreSQL Won't Start

```bash
# Check logs
docker logs shadowcheck_postgres

# Common issues:
# - Port 5432 already in use (local PostgreSQL running)
# - Permission issues with volumes
# - Corrupted data volume

# Solution: Stop local PostgreSQL
sudo systemctl stop postgresql

# Or use different port in docker-compose.postgres.yml
ports:
  - "5433:5432"  # Change 5432 to 5433
```

### Container Doesn't Restart After Reboot

```bash
# Verify Docker is enabled
systemctl is-enabled docker  # Should show: enabled

# If not enabled:
sudo systemctl enable docker

# Check restart policy
docker inspect shadowcheck_postgres --format '{{.HostConfig.RestartPolicy.Name}}'
# Should show: unless-stopped

# If incorrect, update docker-compose.postgres.yml and recreate:
docker-compose -f docker-compose.postgres.yml up -d --force-recreate
```

### Database Connection Refused

```bash
# 1. Check container is running
docker ps | grep shadowcheck_postgres

# 2. Check container is healthy
docker inspect shadowcheck_postgres --format '{{.State.Health.Status}}'
# Should show: healthy

# 3. Check port is exposed
docker port shadowcheck_postgres
# Should show: 5432/tcp -> 0.0.0.0:5432

# 4. Test connection
docker exec shadowcheck_postgres pg_isready
```

### Can't Connect from Application

```bash
# If running locally (outside Docker):
DB_HOST=localhost  # or 127.0.0.1

# If running in Docker:
DB_HOST=shadowcheck_postgres  # Use container name
# And ensure application is on same network:
networks:
  - shadowcheck_net
```

## Advanced Configuration

### Performance Tuning

Edit `docker-compose.postgres.yml` environment variables:

```yaml
environment:
  POSTGRES_SHARED_BUFFERS: '512MB' # 25% of RAM
  POSTGRES_EFFECTIVE_CACHE_SIZE: '2GB' # 50% of RAM
  POSTGRES_MAX_CONNECTIONS: '200'
```

### Resource Limits

Uncomment the deploy section in `docker-compose.postgres.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

### Custom PostgreSQL Configuration

Mount a custom `postgresql.conf`:

```yaml
volumes:
  - ./postgres.conf:/etc/postgresql/postgresql.conf
  - postgres_data:/var/lib/postgresql/data
```

## Files Created

- **`docker-compose.postgres.yml`** - PostgreSQL infrastructure definition
- **`docker-manage.sh`** - Management script for all services
- **`DOCKER_SETUP.md`** - This guide

## Next Steps

1. ✅ PostgreSQL is running with auto-restart
2. ✅ Docker is enabled to start on boot
3. ⏭️ Start your application: `./docker-manage.sh start-app`
4. ⏭️ Test the full stack: `http://localhost:3001`
5. ⏭️ Run a backup: `./docker-manage.sh backup-db`

---

**Need Help?**

- Check container status: `./docker-manage.sh status`
- View logs: `./docker-manage.sh logs-db`
- Full command list: `./docker-manage.sh help`
