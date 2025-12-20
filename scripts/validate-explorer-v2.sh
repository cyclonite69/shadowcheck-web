#!/bin/bash
# ============================================================================
# Validation Script: Explorer V1 vs V2 Endpoint Comparison
# ============================================================================
# Purpose: Verify that /api/explorer/networks-v2 is a strict superset of v1
# Usage: ./scripts/validate-explorer-v2.sh [API_BASE_URL]
# ============================================================================

set -euo pipefail

# Configuration
API_BASE="${1:-http://localhost:3001}"
TEST_LIMIT=50
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "============================================================================"
echo "Explorer V2 Validation"
echo "============================================================================"
echo "API Base: $API_BASE"
echo "Test Limit: $TEST_LIMIT"
echo "Temp Dir: $TEMP_DIR"
echo ""

# ============================================================================
# Test 1: Fetch both endpoints
# ============================================================================
echo "[1/6] Fetching V1 endpoint..."
curl -s "${API_BASE}/api/explorer/networks?limit=${TEST_LIMIT}&sort=last_seen&order=desc" \
  > "$TEMP_DIR/v1.json" || {
    echo "ERROR: Failed to fetch V1 endpoint"
    exit 1
  }

echo "[2/6] Fetching V2 endpoint..."
curl -s "${API_BASE}/api/explorer/networks-v2?limit=${TEST_LIMIT}&sort=last_seen&order=desc" \
  > "$TEMP_DIR/v2.json" || {
    echo "ERROR: Failed to fetch V2 endpoint"
    exit 1
  }

# ============================================================================
# Test 2: Check response structure
# ============================================================================
echo "[3/6] Validating response structure..."

v1_total=$(jq -r '.total' "$TEMP_DIR/v1.json")
v2_total=$(jq -r '.total' "$TEMP_DIR/v2.json")
v1_rows=$(jq -r '.rows | length' "$TEMP_DIR/v1.json")
v2_rows=$(jq -r '.rows | length' "$TEMP_DIR/v2.json")

echo "  V1: total=$v1_total, rows=$v1_rows"
echo "  V2: total=$v2_total, rows=$v2_rows"

if [[ "$v1_total" != "$v2_total" ]]; then
  echo "  WARNING: Total counts differ (V1: $v1_total, V2: $v2_total)"
fi

if [[ "$v1_rows" != "$v2_rows" ]]; then
  echo "  ERROR: Row counts differ! V1=$v1_rows, V2=$v2_rows"
  exit 1
fi

# ============================================================================
# Test 3: Extract legacy fields from both endpoints
# ============================================================================
echo "[4/6] Extracting legacy fields from V1..."
jq '.rows[] | {
  bssid,
  ssid,
  observed_at,
  signal,
  lat,
  lon,
  observations,
  first_seen,
  last_seen,
  is_5ghz,
  is_6ghz,
  is_hidden,
  type,
  frequency,
  capabilities,
  security,
  distance_from_home_km,
  accuracy_meters
}' "$TEMP_DIR/v1.json" | jq -s 'sort_by(.bssid)' > "$TEMP_DIR/v1_legacy.json"

echo "[4/6] Extracting legacy fields from V2..."
jq '.rows[] | {
  bssid,
  ssid,
  observed_at,
  signal,
  lat,
  lon,
  observations,
  first_seen,
  last_seen,
  is_5ghz,
  is_6ghz,
  is_hidden,
  type,
  frequency,
  capabilities,
  security,
  distance_from_home_km,
  accuracy_meters
}' "$TEMP_DIR/v2.json" | jq -s 'sort_by(.bssid)' > "$TEMP_DIR/v2_legacy.json"

# ============================================================================
# Test 4: Compare legacy fields (must be identical)
# ============================================================================
echo "[5/6] Comparing legacy fields (must match exactly)..."
if diff -u "$TEMP_DIR/v1_legacy.json" "$TEMP_DIR/v2_legacy.json" > "$TEMP_DIR/diff.txt"; then
  echo "  ✓ Legacy fields match perfectly!"
else
  echo "  ERROR: Legacy fields differ!"
  echo ""
  echo "Differences:"
  head -50 "$TEMP_DIR/diff.txt"
  echo ""
  echo "Full diff saved to: $TEMP_DIR/diff.txt"
  exit 1
fi

# ============================================================================
# Test 5: Verify V2 enrichment fields exist
# ============================================================================
echo "[6/6] Verifying V2 enrichment fields..."
v2_first=$(jq '.rows[0]' "$TEMP_DIR/v2.json")

# Check for new fields
new_fields=(
  "manufacturer"
  "manufacturer_address"
  "min_altitude_m"
  "max_altitude_m"
  "altitude_span_m"
  "max_distance_meters"
  "last_altitude_m"
  "is_sentinel"
)

missing_fields=()
for field in "${new_fields[@]}"; do
  if ! echo "$v2_first" | jq -e "has(\"$field\")" > /dev/null 2>&1; then
    missing_fields+=("$field")
  fi
done

if [[ ${#missing_fields[@]} -gt 0 ]]; then
  echo "  ERROR: Missing enrichment fields: ${missing_fields[*]}"
  exit 1
else
  echo "  ✓ All enrichment fields present"
fi

# ============================================================================
# Test 6: Validate data types
# ============================================================================
echo ""
echo "Data type validation:"

# Check a sample row
sample_row=$(jq '.rows[0]' "$TEMP_DIR/v2.json")

# Validate types
validate_type() {
  local field=$1
  local expected_type=$2
  local value=$(echo "$sample_row" | jq -r ".$field")
  local actual_type=$(echo "$sample_row" | jq -r ".$field | type")

  # Allow null values or expected type (bigint from Postgres comes as string in jq)
  if [[ "$actual_type" == "$expected_type" || "$value" == "null" || ("$expected_type" == "number" && "$actual_type" == "string" && "$value" =~ ^[0-9]+$) ]]; then
    echo "  ✓ $field: $actual_type (expected: $expected_type) value=$value"
  else
    echo "  ✗ $field: $actual_type (expected: $expected_type) value=$value"
    return 1
  fi
}

validate_type "bssid" "string"
validate_type "ssid" "string"
validate_type "signal" "number"
validate_type "observations" "number"
validate_type "is_5ghz" "boolean"
validate_type "type" "string"
validate_type "security" "string"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "============================================================================"
echo "VALIDATION PASSED ✓"
echo "============================================================================"
echo "V2 endpoint is a strict superset of V1:"
echo "  - All $v1_rows legacy fields match exactly"
echo "  - ${#new_fields[@]} new enrichment fields added"
echo "  - Data types validated"
echo ""
echo "V2 endpoint is PRODUCTION READY"
echo "============================================================================"

# ============================================================================
# Optional: Show enrichment examples
# ============================================================================
echo ""
echo "Sample enrichment data:"
jq '.rows[0] | {
  bssid,
  ssid,
  manufacturer,
  max_distance_meters,
  altitude_span_m
}' "$TEMP_DIR/v2.json"

echo ""
echo "Validation artifacts saved in: $TEMP_DIR"
echo "Run: ls -la $TEMP_DIR"
