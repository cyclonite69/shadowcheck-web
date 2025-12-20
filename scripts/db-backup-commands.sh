#!/bin/bash
# ============================================================================
# ShadowCheck Database Backup - FORENSIC CLEANUP SAFETY PROTOCOL
# Generated: 2025-12-20
# Purpose: Create recovery points before ANY cleanup operations
# ============================================================================
#
# CRITICAL: Run these commands BEFORE proceeding with Phase 2-6
# DO NOT proceed unless ALL backups complete successfully
#
# ============================================================================

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/db_forensic_${TIMESTAMP}"
DB_NAME="shadowcheck_db"
DB_USER="shadowcheck_user"
DB_HOST="shadowcheck_postgres"  # Docker container name

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo "============================================================================"
echo "BACKUP PROTOCOL: ShadowCheck Database Forensic Cleanup"
echo "Timestamp: ${TIMESTAMP}"
echo "Target: ${DB_NAME}"
echo "============================================================================"

# ============================================================================
# Backup 1: FULL LOGICAL BACKUP (schema + data + sequences)
# ============================================================================
echo "[1/4] Creating full logical backup (compressed)..."
docker exec shadowcheck_postgres pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-acl \
  --verbose \
  2>&1 | gzip -9 > "${BACKUP_DIR}/shadowcheck_full_${TIMESTAMP}.sql.gz"

echo "✓ Full backup: ${BACKUP_DIR}/shadowcheck_full_${TIMESTAMP}.sql.gz"

# ============================================================================
# Backup 2: SCHEMA-ONLY BACKUP (structure, no data)
# ============================================================================
echo "[2/4] Creating schema-only backup..."
docker exec shadowcheck_postgres pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --schema-only \
  --format=plain \
  --no-owner \
  --no-acl \
  --verbose \
  2>&1 > "${BACKUP_DIR}/shadowcheck_schema_${TIMESTAMP}.sql"

echo "✓ Schema backup: ${BACKUP_DIR}/shadowcheck_schema_${TIMESTAMP}.sql"

# ============================================================================
# Backup 3: ROLES AND PRIVILEGES
# ============================================================================
echo "[3/4] Creating roles/privileges backup..."
docker exec shadowcheck_postgres pg_dumpall \
  -U "${DB_USER}" \
  --roles-only \
  --verbose \
  2>&1 > "${BACKUP_DIR}/shadowcheck_roles_${TIMESTAMP}.sql"

echo "✓ Roles backup: ${BACKUP_DIR}/shadowcheck_roles_${TIMESTAMP}.sql"

# ============================================================================
# Backup 4: DATABASE STATISTICS (pg_stat snapshots)
# ============================================================================
echo "[4/4] Creating database statistics snapshot..."
docker exec shadowcheck_postgres psql -U "${DB_USER}" -d "${DB_NAME}" <<'SQL' > "${BACKUP_DIR}/shadowcheck_stats_${TIMESTAMP}.sql"
-- Snapshot of database statistics for forensic analysis

-- Table access statistics
\echo '-- TABLE ACCESS STATISTICS'
SELECT
  schemaname,
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

-- View access statistics
\echo '-- VIEW ACCESS STATISTICS'
SELECT
  schemaname,
  viewname,
  schemaname || '.' || viewname AS full_name
FROM pg_views
WHERE schemaname IN ('public', 'app')
ORDER BY schemaname, viewname;

-- Index usage statistics
\echo '-- INDEX USAGE STATISTICS'
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY schemaname, tablename, indexname;

-- Function call statistics
\echo '-- FUNCTION CALL STATISTICS'
SELECT
  schemaname,
  funcname,
  calls,
  total_time,
  self_time
FROM pg_stat_user_functions
ORDER BY schemaname, funcname;
SQL

echo "✓ Stats snapshot: ${BACKUP_DIR}/shadowcheck_stats_${TIMESTAMP}.sql"

# ============================================================================
# Verification
# ============================================================================
echo ""
echo "============================================================================"
echo "BACKUP VERIFICATION"
echo "============================================================================"

# Check file sizes
echo "Full backup size:   $(du -h "${BACKUP_DIR}/shadowcheck_full_${TIMESTAMP}.sql.gz" | cut -f1)"
echo "Schema backup size: $(du -h "${BACKUP_DIR}/shadowcheck_schema_${TIMESTAMP}.sql" | cut -f1)"
echo "Roles backup size:  $(du -h "${BACKUP_DIR}/shadowcheck_roles_${TIMESTAMP}.sql" | cut -f1)"
echo "Stats backup size:  $(du -h "${BACKUP_DIR}/shadowcheck_stats_${TIMESTAMP}.sql" | cut -f1)"

# Verify compressed backup can be decompressed
echo ""
echo "Verifying compressed backup integrity..."
if gunzip -t "${BACKUP_DIR}/shadowcheck_full_${TIMESTAMP}.sql.gz" 2>/dev/null; then
  echo "✓ Compressed backup integrity verified"
else
  echo "✗ ERROR: Compressed backup is corrupt!"
  exit 1
fi

# ============================================================================
# Success
# ============================================================================
echo ""
echo "============================================================================"
echo "✓ ALL BACKUPS COMPLETE"
echo "============================================================================"
echo "Backup directory: ${BACKUP_DIR}"
echo ""
echo "NEXT STEPS:"
echo "1. Verify backup files exist and are readable"
echo "2. Store backups in secure off-site location"
echo "3. Proceed with Phase 2 (API → DB Dependency Trace)"
echo ""
echo "RESTORATION COMMANDS (if needed):"
echo "  # Full restore:"
echo "  gunzip -c ${BACKUP_DIR}/shadowcheck_full_${TIMESTAMP}.sql.gz | \\"
echo "    docker exec -i shadowcheck_postgres psql -U ${DB_USER} -d ${DB_NAME}"
echo ""
echo "  # Schema-only restore:"
echo "  docker exec -i shadowcheck_postgres psql -U ${DB_USER} -d ${DB_NAME} \\"
echo "    < ${BACKUP_DIR}/shadowcheck_schema_${TIMESTAMP}.sql"
echo "============================================================================"
