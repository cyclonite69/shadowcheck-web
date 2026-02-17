#!/bin/bash
# Deploy PostgreSQL with persistent XFS volume to AWS instance
# Run this on the AWS instance via SSM

set -e

echo "🚀 ShadowCheck PostgreSQL Deployment"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo "Please run with sudo"
   exit 1
fi

# 1. Format and mount persistent volume
echo "📦 Setting up persistent XFS volume..."
if ! mountpoint -q /var/lib/postgresql; then
  # Auto-detect data volume (disk with no partitions, not mounted)
  DATA_VOL=$(lsblk -ndo NAME,TYPE | grep 'disk$' | while read name type; do
    if ! lsblk -n /dev/$name | grep -q 'part'; then
      echo $name
      break
    fi
  done)
  
  if [ -z "$DATA_VOL" ]; then
    echo "❌ Data volume not found (looking for unpartitioned disk)"
    lsblk
    exit 1
  fi
  
  DATA_DEV="/dev/$DATA_VOL"
  echo "Found data volume: $DATA_DEV"
  
  if ! blkid $DATA_DEV | grep -q xfs; then
    echo "Formatting $DATA_DEV with XFS (PostgreSQL-optimized)..."
    mkfs.xfs -f \
      -d agcount=4,su=256k,sw=1 \
      -i size=512 \
      -n size=8192 \
      -l size=128m,su=256k \
      $DATA_DEV
    echo "✅ XFS filesystem created"
  fi
  
  mkdir -p /var/lib/postgresql
  
  echo "Mounting with PostgreSQL-optimized options..."
  mount -o noatime,nodiratime,logbufs=8,logbsize=256k,allocsize=16m \
    $DATA_DEV /var/lib/postgresql
  
  # Add to fstab for persistence
  if ! grep -q "$DATA_DEV" /etc/fstab; then
    echo "$DATA_DEV /var/lib/postgresql xfs noatime,nodiratime,logbufs=8,logbsize=256k,allocsize=16m,nofail 0 2" >> /etc/fstab
  fi
  
  chmod 700 /var/lib/postgresql
  echo "✅ Volume mounted at /var/lib/postgresql"
else
  echo "✅ Volume already mounted"
fi

# 2. Create SSL certificates
echo ""
echo "🔐 Creating SSL certificates..."
mkdir -p /var/lib/postgresql/certs
cd /var/lib/postgresql/certs
if [ ! -f server.crt ]; then
  openssl req -new -x509 -days 3650 -nodes -text \
    -out server.crt -keyout server.key \
    -subj "/CN=shadowcheck-postgres"
  chmod 600 server.key
  chmod 644 server.crt
  echo "✅ SSL certificates created"
else
  echo "✅ SSL certificates already exist"
fi

# 3. Create PostgreSQL config
echo ""
echo "⚙️  Creating PostgreSQL configuration..."
cat > /var/lib/postgresql/postgresql.conf << 'PGCONF'
# Memory (8GB RAM)
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 16MB
temp_buffers = 16MB
max_connections = 100

# WAL & Checkpoints
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# Parallel Processing
max_worker_processes = 2
max_parallel_workers = 2
max_parallel_workers_per_gather = 1
max_parallel_maintenance_workers = 1

# Storage (NVMe SSD)
random_page_cost = 1.1
effective_io_concurrency = 200
seq_page_cost = 1.0

# Query Planner
default_statistics_target = 100
constraint_exclusion = partition
enable_partitionwise_join = on
enable_partitionwise_aggregate = on

# PostGIS Optimization
jit = on
jit_above_cost = 100000
jit_inline_above_cost = 500000
jit_optimize_above_cost = 500000

# Autovacuum
autovacuum = on
autovacuum_max_workers = 2
autovacuum_naptime = 30s
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05

# Monitoring
track_activities = on
track_counts = on
track_io_timing = on
track_functions = pl

# Security
password_encryption = scram-sha-256
ssl = on
ssl_cert_file = '/var/lib/postgresql/certs/server.crt'
ssl_key_file = '/var/lib/postgresql/certs/server.key'

# Logging (no passwords)
log_statement = 'none'
log_connections = off
log_disconnections = off
log_duration = off
log_min_duration_statement = -1
log_checkpoints = on
log_autovacuum_min_duration = 0

# PostGIS
shared_preload_libraries = 'postgis-3'
PGCONF

chmod 600 /var/lib/postgresql/postgresql.conf
echo "✅ PostgreSQL config created"

# 4. Create pg_hba.conf
echo ""
echo "🔒 Creating pg_hba.conf (SSL required)..."
cat > /var/lib/postgresql/pg_hba.conf << 'PGHBA'
local   all  all                scram-sha-256
hostssl all  all  0.0.0.0/0     scram-sha-256
host    all  all  0.0.0.0/0     reject
hostssl all  all  ::0/0         scram-sha-256
host    all  all  ::0/0         reject
PGHBA

chmod 600 /var/lib/postgresql/pg_hba.conf
echo "✅ pg_hba.conf created"

# 5. Fetch or generate DB password via AWS Secrets Manager (sole secret store)
echo ""
echo "🔑 Setting up secrets from AWS Secrets Manager..."
mkdir -p /home/ssm-user/secrets
chmod 700 /home/ssm-user/secrets

# Try to read db_password from AWS SM
SM_JSON=$(aws secretsmanager get-secret-value \
  --secret-id shadowcheck/config --region us-east-1 \
  --query 'SecretString' --output text 2>/dev/null || echo "{}")
DB_PASSWORD=$(echo "$SM_JSON" | python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('db_password',''))" 2>/dev/null || echo "")

if [ -z "$DB_PASSWORD" ]; then
  # Auto-generate and persist to AWS SM
  DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
  DB_ADMIN_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

  # Merge into existing SM blob (or create new)
  NEW_JSON=$(echo "$SM_JSON" | python3 -c "
import sys, json
raw = sys.stdin.read().strip()
blob = json.loads(raw) if raw and raw != '{}' else {}
blob['db_password'] = '$DB_PASSWORD'
blob['db_admin_password'] = '$DB_ADMIN_PASSWORD'
print(json.dumps(blob))
" 2>/dev/null || echo "{\"db_password\":\"$DB_PASSWORD\",\"db_admin_password\":\"$DB_ADMIN_PASSWORD\"}")

  aws secretsmanager put-secret-value \
    --secret-id shadowcheck/config --region us-east-1 \
    --secret-string "$NEW_JSON" 2>/dev/null \
    && echo "✅ Auto-generated passwords and stored in AWS SM" \
    || echo "⚠️  Could not persist to AWS SM — passwords are ephemeral!"
else
  echo "✅ Loaded db_password from AWS Secrets Manager"
fi

# 6. Create docker-compose.yml
echo ""
echo "🐳 Creating docker-compose.yml..."
cat > /home/ssm-user/docker-compose.yml << COMPOSE
services:
  postgres:
    image: shadowcheck/postgres:18-postgis-3.6
    container_name: shadowcheck_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: shadowcheck_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: shadowcheck_db
      PGDATA: /var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - /var/lib/postgresql:/var/lib/postgresql
    shm_size: 512mb
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shadowcheck_user -d shadowcheck_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
COMPOSE

chown ssm-user:ssm-user /home/ssm-user/docker-compose.yml
echo "✅ docker-compose.yml created"

# 7. Pull PostgreSQL image
echo ""
echo "🔨 Building custom PostgreSQL image..."
cd /home/ssm-user/shadowcheck
docker build -f deploy/aws/docker/Dockerfile.postgis -t shadowcheck/postgres:18-postgis-3.6 .
echo "✅ Image built"

# 8. Start PostgreSQL
echo ""
echo "🚀 Starting PostgreSQL..."
cd /home/ssm-user
sudo -u ssm-user docker compose up -d

echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# 9. Verify
if docker exec shadowcheck_postgres pg_isready -U shadowcheck_user &>/dev/null; then
  echo ""
  echo "✅ PostgreSQL is running!"
  echo ""
  echo "📊 Status:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "💾 Data volume:"
  df -h /var/lib/postgresql
  echo ""
  echo "🔑 Database password stored in AWS Secrets Manager"
  echo ""
  echo "🔗 Connection string:"
  echo "   postgresql://shadowcheck_user:PASSWORD@localhost:5432/shadowcheck_db?sslmode=require"
else
  echo ""
  echo "❌ PostgreSQL failed to start"
  echo "Check logs: docker logs shadowcheck_postgres"
  exit 1
fi
