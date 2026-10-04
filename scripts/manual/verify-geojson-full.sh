#!/usr/bin/env bash
set -euo pipefail

# verify-geojson-full.sh
# Verifies streaming all-records GeoJSON export against database truth and monitors server RSS.
# Usage: export SC_SESSION_TOKEN=<cookie>; bash scripts/manual/verify-geojson-full.sh

if [ -z "${SC_SESSION_TOKEN:-}" ]; then
  echo "ERROR: SC_SESSION_TOKEN environment variable is not set." >&2
  echo "Usage: export SC_SESSION_TOKEN=<devtools cookie>; [BASE_URL=http://localhost:3001] bash $0" >&2
  exit 1
fi

BASE_URL="${BASE_URL:-http://localhost:3001}"

get_node_rss_kb() {
  docker exec shadowcheck_web_api_dev sh -c '
    pid=$(ps -o pid,args -A | grep "node dist/server/server/server.js" | grep -v grep | head -n 1 | awk "{print \$1}")
    if [ -n "$pid" ] && [ -f "/proc/$pid/status" ]; then
      awk "/VmRSS/{print \$2}" "/proc/$pid/status"
    else
      echo 0
    fi
  ' 2>/dev/null || echo 0
}

baseline_rss=$(get_node_rss_kb)
echo "=== Baseline Server RSS ==="
echo "Node process VmRSS: ${baseline_rss} kB"

SAMPLE_FILE=$(mktemp)
echo "$baseline_rss" > "$SAMPLE_FILE"

# Start background RSS sampler (1s interval)
(
  while true; do
    rss=$(get_node_rss_kb)
    if [ "$rss" -gt 0 ]; then
      echo "$rss" >> "$SAMPLE_FILE"
    fi
    sleep 1
  done
) &
SAMPLER_PID=$!

# shellcheck disable=SC2317
cleanup() {
  if kill -0 "$SAMPLER_PID" 2>/dev/null; then
    kill "$SAMPLER_PID" 2>/dev/null || true
    wait "$SAMPLER_PID" 2>/dev/null || true
  fi
  rm -f "$SAMPLE_FILE"
}
trap cleanup EXIT INT TERM

echo ""
echo "=== Starting Full GeoJSON Download Stream ==="
echo "Fetching from $BASE_URL/api/geojson/full ..."
curl -sS -b "session_token=$SC_SESSION_TOKEN" -D /tmp/geojson.hdr -o /tmp/geojson.json "$BASE_URL/api/geojson/full"

# Terminate RSS sampler
kill "$SAMPLER_PID" 2>/dev/null || true
wait "$SAMPLER_PID" 2>/dev/null || true

peak_rss=$(sort -n "$SAMPLE_FILE" | tail -n 1)
delta_rss=$(( peak_rss - baseline_rss ))

echo ""
echo "=== Response Headers ==="
head -n 1 /tmp/geojson.hdr
grep -i -E "^(content-type|content-disposition):" /tmp/geojson.hdr || true

echo ""
echo "=== Server RSS Monitoring ==="
echo "Baseline: ${baseline_rss} kB"
echo "Peak:     ${peak_rss} kB"
echo "Delta:    ${delta_rss} kB"

echo ""
echo "=== GeoJSON Validation ==="
is_valid_json=true
if ! jq -e . /tmp/geojson.json >/dev/null 2>&1; then
  is_valid_json=false
  echo "JSON Validation: FAILED (file is not valid JSON)"
else
  echo "JSON Validation: PASSED (valid JSON)"
fi

if [ "$is_valid_json" = true ]; then
  feature_count=$(jq '.features | length' /tmp/geojson.json)
  null_geom_count=$(jq '[.features[] | select(.geometry == null)] | length' /tmp/geojson.json)
  first_coords=$(jq -c '.features[0].geometry.coordinates // "null"' /tmp/geojson.json)
  echo "Feature count:               $feature_count"
  echo "Null-geometry feature count: $null_geom_count"
  echo "First feature coordinates:   $first_coords (expected: [lon, lat])"
else
  feature_count=0
fi

echo ""
echo "=== Database Truth Count ==="
db_count=$(docker exec shadowcheck_postgres_local psql -U shadowcheck_admin -d shadowcheck_db -tAc "SELECT COUNT(*) FROM app.observations")
echo "SELECT COUNT(*) FROM app.observations: $db_count"

echo ""
echo "=== Verification Result ==="
if [ "$is_valid_json" = true ] && [ "$feature_count" -eq "$db_count" ]; then
  echo "PASS: features ($feature_count) matches DB count ($db_count) and JSON is valid."
  exit 0
else
  echo "FAIL: features ($feature_count) does not match DB count ($db_count) or JSON is invalid."
  exit 1
fi
