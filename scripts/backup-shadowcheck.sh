#!/usr/bin/env bash
set -euo pipefail

# ShadowCheck forensic backup (Docker-native, reproducible)
# WHY: single-command, non-interactive backup of DB + config + docker + repo.

APP_NAME="shadowcheck_backup"
DB_NAME="${DB_NAME:-shadowcheck_db}"
DB_USER="${DB_USER:-shadowcheck_user}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"
REPO_ROOT="${REPO_ROOT:-/home/cyclonite01/ShadowCheckStatic}"
BACKUP_ROOT="${BACKUP_ROOT:-${REPO_ROOT}/backups}"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_ROOT}/${TS}"

# WHY: verify required tools early to fail loudly.
for tool in docker tar sha256sum; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Missing required tool: ${tool}" >&2
    exit 1
  fi
done

# WHY: auto-detect postgres container name to avoid hardcoding.
PG_CONTAINER="$(docker ps --format '{{.Names}}' | grep -i postgres | head -n 1 || true)"
if [ -z "${PG_CONTAINER}" ]; then
  echo "No running postgres container found (name contains 'postgres')." >&2
  exit 1
fi

# WHY: create backup directories deterministically.
mkdir -p "${OUT}/postgres" "${OUT}/postgres_config" "${OUT}/docker" "${OUT}/repo"

# WHY: globals must be restored before data.
docker exec -e PGOPTIONS="--application_name=${APP_NAME}" "${PG_CONTAINER}" \
  pg_dumpall --globals-only -U "${PG_SUPERUSER}" \
  > "${OUT}/postgres/globals.sql"

# WHY: custom-format dump is restorable with pg_restore and handles large DBs.
docker exec -e PGOPTIONS="--application_name=${APP_NAME}" "${PG_CONTAINER}" \
  pg_dump --format=custom --blobs --verbose -U "${DB_USER}" -d "${DB_NAME}" \
  > "${OUT}/postgres/${DB_NAME}.dump"

# WHY: schema-only dump is useful for diffing and audits.
docker exec -e PGOPTIONS="--application_name=${APP_NAME}" "${PG_CONTAINER}" \
  pg_dump --schema-only --verbose -U "${DB_USER}" -d "${DB_NAME}" \
  > "${OUT}/postgres/${DB_NAME}.schema.sql"

# WHY: extensions must be restorable explicitly.
docker exec -e PGOPTIONS="--application_name=${APP_NAME}" "${PG_CONTAINER}" \
  psql -U "${DB_USER}" -d "${DB_NAME}" -Atc \
  "SELECT 'CREATE EXTENSION IF NOT EXISTS ' || quote_ident(extname) || ';' FROM pg_extension ORDER BY extname;" \
  > "${OUT}/postgres/extensions.sql"

# WHY: capture runtime config for exact reproducibility.
PGDATA_DIR="${PGDATA:-/var/lib/postgresql/data}"
if ! docker exec "${PG_CONTAINER}" test -f "${PGDATA_DIR}/postgresql.conf"; then
  PGDATA_DIR="$(docker exec -e PGOPTIONS="--application_name=${APP_NAME}" "${PG_CONTAINER}" \
    psql -U "${DB_USER}" -d "${DB_NAME}" -Atc "SHOW data_directory;")"
fi
docker exec "${PG_CONTAINER}" cat "${PGDATA_DIR}/postgresql.conf" \
  > "${OUT}/postgres_config/postgresql.conf"
docker exec "${PG_CONTAINER}" cat "${PGDATA_DIR}/pg_hba.conf" \
  > "${OUT}/postgres_config/pg_hba.conf"
docker exec "${PG_CONTAINER}" cat "${PGDATA_DIR}/pg_ident.conf" \
  > "${OUT}/postgres_config/pg_ident.conf"

# WHY: capture Docker context and environment used for Postgres.
if [ -f "${REPO_ROOT}/docker-compose.yml" ]; then
  cp "${REPO_ROOT}/docker-compose.yml" "${OUT}/docker/docker-compose.yml"
fi
env | sort > "${OUT}/docker/env_snapshot.txt"
docker volume ls --format '{{.Name}}' | sort > "${OUT}/docker/volumes.txt"

# WHY: snapshot full repo (including .git) for exact code state.
tar -C "${REPO_ROOT}" -cf "${OUT}/repo/shadowcheck_repo.tar" \
  --exclude=backups \
  --exclude=backups/** \
  --exclude=./backups \
  .

# WHY: record backup metadata for auditability.
cat > "${OUT}/manifest.txt" <<MANIFEST
timestamp=${TS}
pg_container=${PG_CONTAINER}
db_name=${DB_NAME}
db_user=${DB_USER}
repo_root=${REPO_ROOT}
MANIFEST

# WHY: explicit restore steps keep recovery deterministic.
cat > "${OUT}/restore_instructions.md" <<'RESTORE'
# ShadowCheck Restore Instructions

## 1) Restore roles and globals
psql -U postgres -f postgres/globals.sql

## 2) Create database
createdb -U postgres shadowcheck_db

## 3) Restore data (custom format)
pg_restore -U postgres --dbname shadowcheck_db --verbose postgres/shadowcheck_db.dump

## 4) Restore extensions
psql -U postgres -d shadowcheck_db -f postgres/extensions.sql

## 5) Restore configuration
- Replace postgresql.conf, pg_hba.conf, pg_ident.conf with postgres_config copies.
- Restart PostgreSQL after applying config.

## 6) Refresh materialized views
psql -U postgres -d shadowcheck_db -c "REFRESH MATERIALIZED VIEW CONCURRENTLY public.api_network_explorer_mv;"
RESTORE

# WHY: integrity verification for all artifacts.
(
  cd "${OUT}"
  find . -type f ! -name checksums.sha256 -print0 | sort -z | xargs -0 sha256sum > checksums.sha256
)

echo "Backup complete: ${OUT}"
