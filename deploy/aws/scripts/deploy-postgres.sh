#!/bin/bash
# Deploy PostgreSQL 18 + PostGIS on AWS (ARM64 / m6g.large)
#
# Handles two cases:
#   FRESH  — blank EBS volume, no PG data → pull creds from Secrets Manager, initdb
#   REATTACH — existing PG data on EBS → skip initdb, just start the container
#
# Secrets NEVER touch disk. Credentials live in AWS Secrets Manager (shadowcheck/config).
# PostgreSQL runs with --network host so the backend (also --network host) connects
# via true localhost — no Docker bridge IP mismatch in pg_hba.
#
# Usage: sudo ./deploy/aws/scripts/deploy-postgres.sh

set -euo pipefail

echo "=== ShadowCheck PostgreSQL Deployment ==="
echo ""

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Run with sudo"
  exit 1
fi

# ============================================================================
# 1. Mount EBS data volume
# ============================================================================
echo "[1/7] Setting up persistent EBS volume..."

if ! mountpoint -q /var/lib/postgresql; then
  # Auto-detect: find the unpartitioned disk that is NOT the root device
  ROOT_DISK=$(lsblk -ndo PKNAME "$(findmnt -n -o SOURCE /)" 2>/dev/null | head -1 || true)
  DATA_VOL=""

  for disk in $(lsblk -ndo NAME,TYPE | awk '$2=="disk"{print $1}'); do
    # Skip the root device
    if [ "$disk" = "$ROOT_DISK" ]; then
      continue
    fi
    # Must have no child partitions (raw EBS volume)
    if ! lsblk -n "/dev/$disk" | grep -q 'part'; then
      DATA_VOL="$disk"
      break
    fi
  done

  if [ -z "$DATA_VOL" ]; then
    echo "ERROR: No unpartitioned data disk found (root disk: ${ROOT_DISK:-unknown})"
    echo ""
    lsblk -o NAME,SIZE,TYPE,MOUNTPOINT
    exit 1
  fi

  DATA_DEV="/dev/$DATA_VOL"
  echo "  Found data volume: $DATA_DEV"

  # Format only if no filesystem exists at all
  if ! blkid "$DATA_DEV" | grep -q 'TYPE='; then
    echo "  Formatting with XFS (PostgreSQL-optimized)..."
    mkfs.xfs -f \
      -d agcount=4,su=256k,sw=1 \
      -i size=512 \
      -n size=8192 \
      -l size=128m,su=256k \
      "$DATA_DEV"
  else
    echo "  Filesystem already exists: $(blkid -s TYPE -o value "$DATA_DEV")"
  fi

  mkdir -p /var/lib/postgresql
  mount -o noatime,nodiratime,logbufs=8,logbsize=256k,allocsize=16m \
    "$DATA_DEV" /var/lib/postgresql

  # Persist in fstab using UUID (stable across device-name changes)
  VOL_UUID=$(blkid -s UUID -o value "$DATA_DEV")
  sed -i '\|/var/lib/postgresql|d' /etc/fstab
  echo "UUID=$VOL_UUID /var/lib/postgresql xfs noatime,nodiratime,logbufs=8,logbsize=256k,allocsize=16m,nofail 0 2" >> /etc/fstab

  chmod 700 /var/lib/postgresql
  echo "  Mounted at /var/lib/postgresql"
else
  echo "  Already mounted"
fi

# ============================================================================
# 2. Detect fresh vs reattached volume
# ============================================================================
echo ""
echo "[2/7] Detecting volume state..."

PGDATA="/var/lib/postgresql/data"

if [ -f "$PGDATA/PG_VERSION" ]; then
  VOLUME_STATE="reattach"
  echo "  REATTACH: Found existing PG data (PG_VERSION=$(cat "$PGDATA/PG_VERSION"))"
else
  VOLUME_STATE="fresh"
  echo "  FRESH: No existing PostgreSQL data — will initialize"
fi

# ============================================================================
# 3. SSL certificates
# ============================================================================
echo ""
echo "[3/7] SSL certificates..."

CERT_DIR="/var/lib/postgresql/certs"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/server.crt" ]; then
  openssl req -new -x509 -days 3650 -nodes -text \
    -out "$CERT_DIR/server.crt" -keyout "$CERT_DIR/server.key" \
    -subj "/CN=shadowcheck-postgres"
  chmod 600 "$CERT_DIR/server.key"
  chmod 644 "$CERT_DIR/server.crt"
  echo "  Created"
else
  echo "  Already exist"
fi

# Ensure postgres user (uid 999) owns certs
chown 999:999 "$CERT_DIR/server.key" "$CERT_DIR/server.crt"

# ============================================================================
# 4. PostgreSQL configuration (tuned for m6g.large: 2 vCPU, 8 GB RAM)
# ============================================================================
echo ""
echo "[4/7] PostgreSQL configuration..."

cat > /var/lib/postgresql/postgresql.conf << 'PGCONF'
# === ShadowCheck PostgreSQL 18 — m6g.large (2 vCPU, 8 GB) ===

# Networking: --network host mode, bind to localhost only
listen_addresses = 'localhost'
port = 5432

# Memory
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

# Parallel Processing (2 vCPU)
max_worker_processes = 2
max_parallel_workers = 2
max_parallel_workers_per_gather = 1
max_parallel_maintenance_workers = 1

# Storage (NVMe EBS gp3)
random_page_cost = 1.1
effective_io_concurrency = 200
seq_page_cost = 1.0

# Query Planner
default_statistics_target = 100
constraint_exclusion = partition
enable_partitionwise_join = on
enable_partitionwise_aggregate = on

# PostGIS / JIT
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

# Logging (no credentials in logs)
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
chown 999:999 /var/lib/postgresql/postgresql.conf
echo "  Written"

# ============================================================================
# 5. pg_hba.conf — host-network mode: only localhost connections allowed
# ============================================================================
echo ""
echo "[5/7] pg_hba.conf..."

cat > /var/lib/postgresql/pg_hba.conf << 'PGHBA'
# pg_hba.conf — host-network mode
# PostgreSQL listens on localhost only (listen_addresses = 'localhost')
# All connections are local — no Docker bridge IPs to worry about
#
# TYPE    DATABASE  USER  ADDRESS        METHOD
local     all       all                  scram-sha-256
host      all       all   127.0.0.1/32   scram-sha-256
host      all       all   ::1/128        scram-sha-256
PGHBA

chmod 600 /var/lib/postgresql/pg_hba.conf
chown 999:999 /var/lib/postgresql/pg_hba.conf
echo "  Written"

# ============================================================================
# 6. Build PostgreSQL Docker image
# ============================================================================
echo ""
echo "[6/7] Building Docker image..."

# Find the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [ ! -f "$PROJECT_ROOT/deploy/aws/docker/Dockerfile.postgis" ]; then
  PROJECT_ROOT="/home/ssm-user/shadowcheck"
fi

docker build -f "$PROJECT_ROOT/deploy/aws/docker/Dockerfile.postgis" \
  -t shadowcheck/postgres:18-postgis "$PROJECT_ROOT/deploy/aws/docker"
echo "  Built shadowcheck/postgres:18-postgis"

# ============================================================================
# 7. Start PostgreSQL container
# ============================================================================
echo ""
echo "[7/7] Starting PostgreSQL..."

# Stop existing container if present
docker stop shadowcheck_postgres 2>/dev/null || true
docker rm shadowcheck_postgres 2>/dev/null || true

if [ "$VOLUME_STATE" = "fresh" ]; then
  echo "  FRESH INIT: Fetching credentials from AWS Secrets Manager..."

  SM_JSON=$(aws secretsmanager get-secret-value \
    --secret-id shadowcheck/config --region us-east-1 \
    --query 'SecretString' --output text 2>/dev/null || echo "")

  if [ -z "$SM_JSON" ]; then
    echo "ERROR: Cannot read shadowcheck/config from Secrets Manager"
    echo "Ensure the instance IAM role has secretsmanager:GetSecretValue"
    exit 1
  fi

  DB_PASSWORD=$(echo "$SM_JSON" | python3 -c \
    "import json,sys; s=json.load(sys.stdin); print(s['db_password'])" 2>/dev/null || echo "")

  if [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: db_password not found in shadowcheck/config secret"
    exit 1
  fi

  # Start with POSTGRES_PASSWORD to trigger initdb on empty PGDATA
  docker run -d \
    --name shadowcheck_postgres \
    --network host \
    --restart unless-stopped \
    --shm-size 512m \
    -e POSTGRES_USER=shadowcheck_user \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB=shadowcheck_db \
    -e PGDATA=/var/lib/postgresql/data \
    -v /var/lib/postgresql:/var/lib/postgresql \
    --log-driver json-file \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    shadowcheck/postgres:18-postgis \
    postgres \
      -c config_file=/var/lib/postgresql/postgresql.conf \
      -c hba_file=/var/lib/postgresql/pg_hba.conf

  # Credentials were passed as env vars to the container process (never on disk).
  # Clear from the shell environment immediately.
  unset DB_PASSWORD SM_JSON

else
  echo "  REATTACH: Starting with existing data directory..."

  # No POSTGRES_PASSWORD — the entrypoint detects existing PGDATA and skips initdb
  docker run -d \
    --name shadowcheck_postgres \
    --network host \
    --restart unless-stopped \
    --shm-size 512m \
    -e PGDATA=/var/lib/postgresql/data \
    -v /var/lib/postgresql:/var/lib/postgresql \
    --log-driver json-file \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    shadowcheck/postgres:18-postgis \
    postgres \
      -c config_file=/var/lib/postgresql/postgresql.conf \
      -c hba_file=/var/lib/postgresql/pg_hba.conf
fi

# Wait for PostgreSQL to be ready (up to 60s)
echo "  Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec shadowcheck_postgres pg_isready -h 127.0.0.1 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if ! docker exec shadowcheck_postgres pg_isready -h 127.0.0.1 >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL failed to start within 60s"
  echo ""
  docker logs --tail 30 shadowcheck_postgres
  exit 1
fi

echo "  PostgreSQL is ready"

# Suppress collation version mismatch (harmless after OS/glibc upgrade on reattach)
echo "  Refreshing collation version..."
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db \
  -c "ALTER DATABASE shadowcheck_db REFRESH COLLATION VERSION;" 2>/dev/null || true

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "=== PostgreSQL deployed successfully ($VOLUME_STATE) ==="
echo ""
echo "  Container:   shadowcheck_postgres (--network host)"
echo "  Listening:   127.0.0.1:5432"
echo "  Data:        $PGDATA"
echo "  Credentials: AWS Secrets Manager (shadowcheck/config)"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E 'NAMES|shadowcheck_postgres'
echo ""
df -h /var/lib/postgresql | tail -1
