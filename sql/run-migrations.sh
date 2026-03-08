#!/bin/bash
# ============================================================================
# ShadowCheck Migration Runner
# ============================================================================
# Applies unapplied SQL migrations from sql/migrations/ in sorted order.
# Tracks applied migrations in app.schema_migrations table.
#
# Usage:
#   ./sql/run-migrations.sh                          # Local (psql must be available)
#   docker exec -i shadowcheck_postgres bash < sql/run-migrations.sh  # Via Docker
#
# Or via scs_rebuild.sh which copies files into the container.
# ============================================================================

set -euo pipefail

MIGRATION_DB_USER="${MIGRATION_DB_USER:-shadowcheck_admin}"
DB_NAME="${DB_NAME:-shadowcheck_db}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/sql/migrations}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "=== ShadowCheck Migration Runner ==="
echo "Database: $DB_NAME | Migration user: $MIGRATION_DB_USER"
echo "Migrations: $MIGRATIONS_DIR"
echo ""

if [ "$MIGRATION_DB_USER" = "shadowcheck_user" ]; then
  echo -e "${YELLOW}Warning:${NC} migrations are running as shadowcheck_user (not recommended)."
  echo -e "${YELLOW}Set MIGRATION_DB_USER=shadowcheck_admin for least-privilege runtime user separation.${NC}"
fi

# Ensure tracking table exists
psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS app.schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

# Count available migrations
TOTAL=$(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)
if [ "$TOTAL" -eq 0 ]; then
    echo "No migration files found in $MIGRATIONS_DIR"
    exit 0
fi

echo "Found $TOTAL migration files"
echo ""

APPLIED=0
SKIPPED=0
FAILED=0

# Process migrations in sorted order
for migration_file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    filename=$(basename "$migration_file")

    # Check if already applied
    already_applied=$(psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -tAc \
        "SELECT 1 FROM app.schema_migrations WHERE filename = '$filename'" 2>/dev/null || echo "")

    if [ "$already_applied" = "1" ]; then
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    echo -n "  Applying: $filename ... "

    # Run migration in a transaction
    if psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q \
        -c "BEGIN;" \
        -f "$migration_file" \
        -c "INSERT INTO app.schema_migrations (filename) VALUES ('$filename');" \
        -c "COMMIT;" 2>/tmp/migration_error; then
        echo -e "${GREEN}OK${NC}"
        APPLIED=$((APPLIED + 1))
    else
        echo -e "${RED}FAILED${NC}"
        echo -e "${RED}    Error: $(cat /tmp/migration_error)${NC}"
        FAILED=$((FAILED + 1))
        echo -e "${RED}Aborting on first failure to avoid partial migration state.${NC}"
        exit 1
    fi
done

echo ""
echo "=== Migration Summary ==="
echo -e "  Applied: ${GREEN}$APPLIED${NC}"
echo -e "  Skipped: ${YELLOW}$SKIPPED${NC} (already applied)"
if [ "$FAILED" -gt 0 ]; then
    echo -e "  Failed:  ${RED}$FAILED${NC}"
fi
echo "  Total:   $TOTAL"

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
