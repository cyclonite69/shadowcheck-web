#!/usr/bin/env bash
set -euo pipefail

# Helper to seed test DB and run verification SELECTs.
# Usage: ./tests/fixtures/run_seed_and_checks.sh

CONTAINER=shadowcheck_postgres
DB_USER=shadowcheck_user
DB_NAME=shadowcheck_test
SEED_FILE=tests/fixtures/seed_sorting_test_data_v2.sql

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "Using docker exec ${CONTAINER}"
  cat "${SEED_FILE}" | docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1 -q -f -
  docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT bssid, observations, threat_score FROM app.api_network_explorer_mv WHERE bssid LIKE '02:SC:SORT:TE:ST:%' ORDER BY observations;"
  docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT bssid, threat_score, observations FROM app.api_network_explorer_mv WHERE bssid LIKE '02:SC:SORT:TE:ST:%' ORDER BY threat_score DESC, observations DESC;"
else
  if command -v psql >/dev/null 2>&1; then
    echo "Docker container ${CONTAINER} not found; using local psql"
    psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1 -f "${SEED_FILE}"
    psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT bssid, observations, threat_score FROM app.api_network_explorer_mv WHERE bssid LIKE '02:SC:SORT:TE:ST:%' ORDER BY observations;"
    psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT bssid, threat_score, observations FROM app.api_network_explorer_mv WHERE bssid LIKE '02:SC:SORT:TE:ST:%' ORDER BY threat_score DESC, observations DESC;"
  else
    echo "ERROR: neither docker container '${CONTAINER}' found nor local psql available" >&2
    exit 2
  fi
fi

# Optional: show trigger function definition
echo
echo "Trigger function (network_threat_scores_update_trigger):"
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  docker exec -i ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT pg_get_functiondef('app.network_threat_scores_update_trigger'::regproc);"
else
  if command -v psql >/dev/null 2>&1; then
    psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT pg_get_functiondef('app.network_threat_scores_update_trigger'::regproc);"
  fi
fi
