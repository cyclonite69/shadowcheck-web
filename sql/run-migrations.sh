#!/bin/bash
# ============================================================================
# ShadowCheck Migration Runner
# ============================================================================
# Applies unapplied SQL migrations from sql/migrations/ in sorted order.
# Tracks applied migrations in app.schema_migrations table.
#
# Usage:
#   ./sql/run-migrations.sh                          # Local Docker container
#   MIGRATION_EXEC=direct ./sql/run-migrations.sh    # In-container execution
#
# Or via scs_rebuild.sh which copies files into the container.
# ============================================================================

set -euo pipefail

MIGRATION_DB_USER="${MIGRATION_DB_USER:-shadowcheck_admin}"
DB_NAME="${DB_NAME:-shadowcheck_db}"
MIGRATION_EXEC="${MIGRATION_EXEC:-container}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if [ "$MIGRATION_EXEC" = "direct" ]; then
  MIGRATIONS_DIR="${MIGRATIONS_DIR:-/sql/migrations}"
else
  MIGRATIONS_DIR="${MIGRATIONS_DIR:-$SCRIPT_DIR/migrations}"
fi

require_container() {
  local container="${MIGRATION_CONTAINER:-shadowcheck_postgres_local}"
  if ! docker container inspect "$container" --format '{{.State.Running}}' 2>/dev/null | grep -q '^true$'; then
    echo "Error: PostgreSQL container '$container' is not running; start it or set MIGRATION_CONTAINER." >&2
    return 1
  fi
}

run_psql() {
  if [ "$MIGRATION_EXEC" = "direct" ]; then
    psql "$@"
    return
  fi

  require_container || return 1
  local container="${MIGRATION_CONTAINER:-shadowcheck_postgres_local}"
  docker exec -i "$container" psql "$@"
}

if [ "$MIGRATION_EXEC" != "direct" ]; then
  require_container || exit 1
fi

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

# Count available migrations
shopt -s nullglob
migration_files=("$MIGRATIONS_DIR"/*.sql)
shopt -u nullglob
TOTAL=${#migration_files[@]}
if [ "$TOTAL" -eq 0 ]; then
    echo "No migration files found in $MIGRATIONS_DIR"
    exit 0
fi

mapfile -t migration_files < <(printf '%s\n' "${migration_files[@]}" | sort)
echo "Found $TOTAL migration files"
echo ""

APPLIED=0
SKIPPED=0
FAILED=0
PENDING=()

# Process migrations in sorted order
for migration_file in "${migration_files[@]}"; do
    filename=$(basename "$migration_file")

    # Check if already applied
    already_applied=$(run_psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -tAc \
        "SELECT 1 FROM app.schema_migrations WHERE filename = '$filename'" 2>/dev/null || echo "")

    if [ "$already_applied" = "1" ]; then
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    PENDING+=("$migration_file")
done

if [ "${MIGRATION_DRY_RUN:-0}" = "1" ]; then
    echo "Dry run: pending migrations"
    for migration_file in "${PENDING[@]}"; do
        echo "  $(basename "$migration_file")"
    done
    echo ""
    echo "=== Migration Summary ==="
    echo -e "  Applied: ${GREEN}0${NC}"
    echo -e "  Skipped: ${YELLOW}$SKIPPED${NC} (already applied)"
    echo "  Pending: ${#PENDING[@]}"
    echo "  Total:   $TOTAL"
    exit 0
fi

# Ensure tracking table exists only when applying migrations.
run_psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q <<'SQL'
CREATE TABLE IF NOT EXISTS app.schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

for migration_file in "${PENDING[@]}"; do
    filename=$(basename "$migration_file")
    echo -n "  Applying: $filename ... "

    # Check if migration contains CREATE INDEX CONCURRENTLY (which cannot run in a transaction)
    if grep -q "CREATE INDEX CONCURRENTLY" "$migration_file"; then
        # Run CONCURRENTLY migrations outside any transaction
        if run_psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q \
            < "$migration_file" 2>/tmp/migration_error; then
            # Record success
            if run_psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q \
                -c "INSERT INTO app.schema_migrations (filename) VALUES ('$filename');" 2>/tmp/migration_error; then
                echo -e "${GREEN}OK${NC}"
                APPLIED=$((APPLIED + 1))
            else
                echo -e "${RED}FAILED${NC}"
                echo -e "${RED}    Error: $(cat /tmp/migration_error)${NC}"
                FAILED=$((FAILED + 1))
                echo -e "${RED}Aborting on first failure to avoid partial migration state.${NC}"
                exit 1
            fi
        else
            echo -e "${RED}FAILED${NC}"
            echo -e "${RED}    Error: $(cat /tmp/migration_error)${NC}"
            FAILED=$((FAILED + 1))
            echo -e "${RED}Aborting on first failure to avoid partial migration state.${NC}"
            exit 1
        fi
    else
        # Run normal migrations in a transaction for ACID compliance
        if {
            echo 'BEGIN;'
            cat "$migration_file"
            printf "\nINSERT INTO app.schema_migrations (filename) VALUES ('%s');\nCOMMIT;\n" "$filename"
        } | run_psql -U "$MIGRATION_DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q 2>/tmp/migration_error; then
            echo -e "${GREEN}OK${NC}"
            APPLIED=$((APPLIED + 1))
        else
            echo -e "${RED}FAILED${NC}"
            echo -e "${RED}    Error: $(cat /tmp/migration_error)${NC}"
            FAILED=$((FAILED + 1))
            echo -e "${RED}Aborting on first failure to avoid partial migration state.${NC}"
            exit 1
        fi
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
