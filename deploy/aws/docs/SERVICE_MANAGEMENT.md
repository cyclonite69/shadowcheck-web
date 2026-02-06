# AWS Service Management Guide

## Service Architecture

### Always Running (Core)

- **PostgreSQL** - Database (localhost:5432)
  - Data: Persistent 30GB XFS-formatted EBS volume (vol-0f38f7789ac264d59)
  - Mount: /var/lib/postgresql
  - Survives: Instance stop/start, termination
- **Redis** - Cache (localhost:6379)
  - Data: Docker volume (ephemeral, recreated on instance restart)

### On-Demand (Profiles)

- **API** - Backend application (public:3001)
- **PgAdmin** - Database management (public:5050)

## Starting Services

### Core Services Only (Default)

```bash
docker-compose up -d
# Starts: postgres + redis
```

### With API

```bash
docker-compose --profile api up -d
# Starts: postgres + redis + api
```

### With PgAdmin

```bash
docker-compose --profile pgadmin up -d pgadmin
# Starts: pgadmin (postgres already running)
```

### All Services

```bash
docker-compose --profile api --profile pgadmin up -d
# Starts: postgres + redis + api + pgadmin
```

## Stopping Services

### Stop API Only

```bash
docker-compose stop api
```

### Stop PgAdmin Only

```bash
docker-compose stop pgadmin
```

### Stop Everything

```bash
docker-compose down
# Keeps volumes (data persists)
```

## Service Status

### Check Running Services

```bash
docker-compose ps
```

### Check Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f api
docker-compose logs -f pgadmin
```

## Network Isolation

### Port Binding

- **PostgreSQL**: `127.0.0.1:5432` (localhost only)
- **Redis**: `127.0.0.1:6379` (localhost only)
- **API**: `0.0.0.0:3001` (public, security group restricted)
- **PgAdmin**: `0.0.0.0:5050` (public, security group restricted)

### Container Communication

All containers on `shadowcheck_internal` bridge network:

- API → postgres (internal)
- API → redis (internal)
- PgAdmin → postgres (internal)

### External Access

Only API and PgAdmin are accessible from outside:

- Restricted by AWS security group to your IP (68.41.168.87/32)
- PostgreSQL and Redis are localhost-only

## Security Features

### Container Hardening

- `cap_drop: ALL` - No Linux capabilities
- `cap_add: [minimal]` - Only required capabilities
- `security_opt: no-new-privileges` - No escalation
- `read_only: true` - API filesystem read-only (where applicable)

### Secrets Management

```bash
# Create secrets directory
mkdir -p /home/ssm-user/secrets
chmod 700 /home/ssm-user/secrets

# Set passwords
echo "your-db-password" > /home/ssm-user/secrets/db_password.txt
echo "your-mapbox-token" > /home/ssm-user/secrets/mapbox_token.txt
echo "your-pgadmin-password" > /home/ssm-user/secrets/pgadmin_password.txt

# Secure permissions
chmod 600 /home/ssm-user/secrets/*.txt
```

### Logging

- All services: 10MB × 3 files max (30MB per service)
- PostgreSQL: No password logging (`log_statement = 'none'`)
- Automatic rotation

## Typical Workflows

### Daily Operations (Database Only)

```bash
# Start core services
docker-compose up -d
# postgres + redis running
# Cost: Minimal CPU/memory
```

### Development Work (With API)

```bash
# Start with API
docker-compose --profile api up -d
# postgres + redis + api running
# Access API at: http://INSTANCE_IP:3001
```

### Database Administration

```bash
# Start PgAdmin temporarily
docker-compose --profile pgadmin up -d pgadmin

# Use PgAdmin
# Access at: http://INSTANCE_IP:5050

# Stop when done
docker-compose stop pgadmin
```

### Maintenance Window

```bash
# Stop API (keep database running)
docker-compose stop api

# Run maintenance
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c "VACUUM ANALYZE;"

# Restart API
docker-compose --profile api up -d api
```

## Resource Usage

### Core Services (postgres + redis)

- CPU: ~10-15% idle, ~50% under load
- Memory: ~500MB (postgres) + ~50MB (redis)
- Disk I/O: Minimal when idle

### With API

- CPU: +20-30% under load
- Memory: +200-300MB
- Network: Depends on traffic

### With PgAdmin

- CPU: +5-10%
- Memory: +100-150MB
- Only when actively using

## Cost Optimization

### Minimize Costs

```bash
# Run only what you need
docker-compose up -d  # Core only

# Start API when needed
docker-compose --profile api up -d api

# Stop API when done
docker-compose stop api
```

### Stop Instance When Not in Use

```bash
# Stop instance (keeps EBS volume)
aws ec2 stop-instances --instance-ids i-INSTANCE_ID --region us-east-1

# Cost when stopped: $4.80/month (storage only)
```

## Troubleshooting

### Data Persistence Verification

```bash
# Check EBS volume is mounted
df -h | grep postgresql
# Expected: /dev/nvme1n1 mounted at /var/lib/postgresql

# Check filesystem type
mount | grep postgresql
# Expected: xfs with noatime,nodiratime,logbufs=8

# Check PostgreSQL data directory
ls -la /var/lib/postgresql/data/pgdata/
# Should show database files

# Verify volume survives restart
docker-compose restart postgres
# Data should persist
```

### Service Won't Start

```bash
# Check logs
docker-compose logs service_name

# Check health
docker-compose ps

# Restart service
docker-compose restart service_name
```

### Can't Connect to API

```bash
# Check API is running
docker-compose ps api

# Check API logs
docker-compose logs -f api

# Check security group allows your IP
aws ec2 describe-security-groups --group-ids sg-0c3b2c64455ee8571 --region us-east-1
```

### Database Connection Issues

```bash
# Check postgres is running
docker-compose ps postgres

# Test connection
docker exec shadowcheck_postgres pg_isready -U shadowcheck_user

# Check password
cat /home/ssm-user/secrets/db_password.txt
```

## Quick Reference

| Task            | Command                                          |
| --------------- | ------------------------------------------------ |
| Start core      | `docker-compose up -d`                           |
| Start with API  | `docker-compose --profile api up -d`             |
| Start PgAdmin   | `docker-compose --profile pgadmin up -d pgadmin` |
| Stop API        | `docker-compose stop api`                        |
| Stop PgAdmin    | `docker-compose stop pgadmin`                    |
| View logs       | `docker-compose logs -f [service]`               |
| Check status    | `docker-compose ps`                              |
| Restart service | `docker-compose restart [service]`               |
| Stop all        | `docker-compose down`                            |
