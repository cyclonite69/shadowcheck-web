#!/usr/bin/env bash
set -euo pipefail

BACKEND_CONTAINER="${BACKEND_CONTAINER:-shadowcheck_backend}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-shadowcheck_postgres}"
DB_NAME="${DB_NAME:-shadowcheck_db}"
DB_ADMIN_USER="${DB_ADMIN_USER:-shadowcheck_admin}"
UPLOAD_TO_S3=1
RUN_BACKUP=1
REFRESH_MVS=1
SQLITE_FILE=""
SOURCE_TAG=""

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --sqlite-file /path/to/file.sqlite --source-tag s22_backup [options]

Options:
  --sqlite-file PATH   Local path to SQLite/Kismet file
  --source-tag TAG     Import source tag
  --no-backup          Skip pre-import backup
  --no-s3             Do not upload the backup to S3
  --no-refresh        Skip materialized view refresh after import
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

need_container() {
  local name="$1"
  docker ps -a --format '{{.Names}}' | grep -qx "$name" || die "Container not found: $name"
}

fetch_secret_from_backend() {
  local secret_name="$1"
  docker exec "$BACKEND_CONTAINER" sh -lc \
    "node -e 'const mod=require(\"/app/dist/server/server/src/services/secretsManager.js\"); const sm=mod.default || mod; Promise.resolve(sm.load?.()).then(()=>{const value=sm.get(\"${secret_name}\")||\"\"; if(!value){process.exit(2)}; process.stdout.write(value)}).catch(e=>{console.error(e);process.exit(1)})'"
}

capture_metrics() {
  local password="$1"
  docker exec -e PGPASSWORD="$password" "$POSTGRES_CONTAINER" \
    psql -U "$DB_ADMIN_USER" -d "$DB_NAME" -At -F $'\t' -c "
      SELECT
        (SELECT COUNT(*) FROM app.networks),
        (SELECT COUNT(*) FROM app.observations),
        (SELECT COUNT(*) FROM app.api_network_explorer_mv),
        (SELECT COUNT(*) FROM app.kml_files),
        (SELECT COUNT(*) FROM app.kml_points),
        (SELECT COUNT(*) FROM app.kismet_devices),
        (SELECT COUNT(*) FROM app.kismet_packets),
        (SELECT COUNT(*) FROM app.kismet_alerts)
    "
}

print_metrics() {
  local label="$1"
  local raw="$2"
  IFS=$'\t' read -r networks observations explorer_mv kml_files kml_points kismet_devices kismet_packets kismet_alerts <<<"$raw"
  echo "${label}:"
  echo "  networks=${networks}"
  echo "  observations=${observations}"
  echo "  explorer_mv=${explorer_mv}"
  echo "  kml_files=${kml_files}"
  echo "  kml_points=${kml_points}"
  echo "  kismet_devices=${kismet_devices}"
  echo "  kismet_packets=${kismet_packets}"
  echo "  kismet_alerts=${kismet_alerts}"
}

find_import_script() {
  docker exec "$BACKEND_CONTAINER" sh -lc '
    for p in \
      /app/dist/server/etl/load/sqlite-import.js \
      /app/etl/load/sqlite-import.js \
      /app/etl/load/sqlite-import.ts
    do
      if [ -f "$p" ]; then
        printf "%s" "$p"
        exit 0
      fi
    done
    exit 1
  '
}

run_backup() {
  local upload_flag="$1"
  docker exec "$BACKEND_CONTAINER" sh -lc \
    "node -e 'const mod=require(\"/app/dist/server/server/src/services/backupService.js\"); const svc=mod.default || mod; Promise.resolve(svc.runPostgresBackup({ uploadToS3: ${upload_flag} })).then((result)=>{console.log(JSON.stringify(result,null,2))}).catch(e=>{console.error(e);process.exit(1)})'"
}

refresh_mvs() {
  local password="$1"
  docker exec -e PGPASSWORD="$password" "$POSTGRES_CONTAINER" \
    psql -U "$DB_ADMIN_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "SELECT * FROM app.refresh_all_materialized_views();"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sqlite-file)
      [[ $# -ge 2 ]] || die "--sqlite-file requires a path"
      SQLITE_FILE="$2"
      shift 2
      ;;
    --source-tag)
      [[ $# -ge 2 ]] || die "--source-tag requires a value"
      SOURCE_TAG="$2"
      shift 2
      ;;
    --no-backup)
      RUN_BACKUP=0
      shift
      ;;
    --no-s3)
      UPLOAD_TO_S3=0
      shift
      ;;
    --no-refresh)
      REFRESH_MVS=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

[[ -n "$SQLITE_FILE" ]] || die "Specify --sqlite-file PATH"
[[ -f "$SQLITE_FILE" ]] || die "SQLite file not found: $SQLITE_FILE"
[[ -n "$SOURCE_TAG" ]] || die "Specify --source-tag TAG"

need_container "$BACKEND_CONTAINER"
need_container "$POSTGRES_CONTAINER"

DB_ADMIN_PASSWORD="$(fetch_secret_from_backend db_admin_password)"
[[ -n "$DB_ADMIN_PASSWORD" ]] || die "Could not load db_admin_password from backend secrets"

IMPORT_SCRIPT="$(find_import_script)" || die "Could not locate sqlite-import script in ${BACKEND_CONTAINER}"
TMP_SQLITE_PATH="/tmp/$(basename "$SQLITE_FILE")"

echo "Copying SQLite file into ${BACKEND_CONTAINER}..."
docker cp "$SQLITE_FILE" "${BACKEND_CONTAINER}:${TMP_SQLITE_PATH}"

BEFORE_METRICS="$(capture_metrics "$DB_ADMIN_PASSWORD")"
print_metrics "Before import" "$BEFORE_METRICS"

if [[ "$RUN_BACKUP" -eq 1 ]]; then
  echo "Running pre-import backup..."
  if [[ "$UPLOAD_TO_S3" -eq 1 ]]; then
    run_backup true
  else
    run_backup false
  fi
fi

echo "Running sqlite import..."
docker exec -e DB_ADMIN_PASSWORD="$DB_ADMIN_PASSWORD" "$BACKEND_CONTAINER" \
  node "$IMPORT_SCRIPT" "$TMP_SQLITE_PATH" "$SOURCE_TAG"

docker exec "$BACKEND_CONTAINER" rm -f "$TMP_SQLITE_PATH" >/dev/null 2>&1 || true

if [[ "$REFRESH_MVS" -eq 1 ]]; then
  echo "Refreshing materialized views..."
  refresh_mvs "$DB_ADMIN_PASSWORD"
fi

AFTER_METRICS="$(capture_metrics "$DB_ADMIN_PASSWORD")"
print_metrics "After import" "$AFTER_METRICS"

echo "Import complete."
