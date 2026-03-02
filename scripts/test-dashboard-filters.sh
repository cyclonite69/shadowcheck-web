#!/bin/bash
set -u

BASE="${1:-http://localhost:3001}"
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

echo "=== SHADOWCHECK DASHBOARD FILTER SMOKE ==="
echo "Base URL: $BASE"
echo "Timestamp: $(date -Iseconds)"
echo ""

urlencode_json() {
  echo "$1" | jq -sRr @uri
}

fetch_dashboard() {
  local filters="$1"
  local enabled="$2"
  local f_enc
  local e_enc
  f_enc=$(urlencode_json "$filters")
  e_enc=$(urlencode_json "$enabled")
  curl -s -w "\n%{http_code}" \
    "$BASE/api/dashboard-metrics?filters=${f_enc}&enabled=${e_enc}"
}

record_pass() {
  echo "✅ $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

record_warn() {
  echo "⚠️  $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

record_fail() {
  echo "❌ $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

require_num() {
  local value="$1"
  [[ "$value" =~ ^[0-9]+$ ]]
}

echo "[1/5] Baseline dashboard metrics"
baseline_resp=$(fetch_dashboard '{}' '{}')
baseline_code=$(echo "$baseline_resp" | tail -1)
baseline_body=$(echo "$baseline_resp" | head -n -1)
if [ "$baseline_code" != "200" ]; then
  record_fail "Baseline request failed (HTTP $baseline_code)"
  echo "$baseline_body" | head -c 240
  echo ""
else
  baseline_total=$(echo "$baseline_body" | jq -r '.networks.total // -1')
  baseline_obs=$(echo "$baseline_body" | jq -r '.observations.total // -1')
  baseline_filters=$(echo "$baseline_body" | jq -r '.filtersApplied // -1')
  if require_num "$baseline_total" && require_num "$baseline_obs"; then
    record_pass "Baseline returned numeric totals (networks=$baseline_total observations=$baseline_obs)"
  else
    record_fail "Baseline totals are not numeric"
  fi
  if [ "$baseline_filters" = "0" ]; then
    record_pass "Baseline filtersApplied=0"
  else
    record_warn "Baseline filtersApplied expected 0, got $baseline_filters"
  fi
fi

echo ""
echo "[2/5] Impossible BSSID should collapse totals"
none_resp=$(fetch_dashboard '{"bssid":"00:00:00:00:00:00"}' '{"bssid":true}')
none_code=$(echo "$none_resp" | tail -1)
none_body=$(echo "$none_resp" | head -n -1)
if [ "$none_code" != "200" ]; then
  record_fail "Impossible BSSID request failed (HTTP $none_code)"
else
  none_total=$(echo "$none_body" | jq -r '.networks.total // -1')
  none_obs=$(echo "$none_body" | jq -r '.observations.total // -1')
  none_filters=$(echo "$none_body" | jq -r '.filtersApplied // -1')
  if [ "$none_total" = "0" ] && [ "$none_obs" = "0" ]; then
    record_pass "Impossible BSSID yields zero totals"
  else
    record_fail "Impossible BSSID should yield zero totals (got networks=$none_total observations=$none_obs)"
  fi
  if [ "$none_filters" -ge 1 ] 2>/dev/null; then
    record_pass "Impossible BSSID increments filtersApplied ($none_filters)"
  else
    record_warn "Impossible BSSID filtersApplied not incremented (value=$none_filters)"
  fi
fi

echo ""
echo "[3/5] radioTypes=[W] should materially scope dashboard"
wifi_resp=$(fetch_dashboard '{"radioTypes":["W"]}' '{"radioTypes":true}')
wifi_code=$(echo "$wifi_resp" | tail -1)
wifi_body=$(echo "$wifi_resp" | head -n -1)
if [ "$wifi_code" != "200" ]; then
  record_fail "WiFi-only request failed (HTTP $wifi_code)"
else
  wifi_total=$(echo "$wifi_body" | jq -r '.networks.total // -1')
  wifi_wifi=$(echo "$wifi_body" | jq -r '.networks.wifi // -1')
  wifi_filters=$(echo "$wifi_body" | jq -r '.filtersApplied // -1')
  if [ "${baseline_total:-0}" -gt 0 ] 2>/dev/null && [ "$wifi_total" -le "${baseline_total:-0}" ] 2>/dev/null; then
    record_pass "WiFi-only total <= baseline ($wifi_total <= ${baseline_total:-0})"
  else
    record_fail "WiFi-only total should be <= baseline (got $wifi_total, baseline ${baseline_total:-unknown})"
  fi
  if [ "$wifi_total" = "$wifi_wifi" ]; then
    record_pass "WiFi-only networks total matches wifi bucket"
  else
    record_warn "WiFi-only networks total ($wifi_total) != wifi bucket ($wifi_wifi)"
  fi
  if [ "$wifi_filters" -ge 1 ] 2>/dev/null; then
    record_pass "WiFi-only filtersApplied increments ($wifi_filters)"
  else
    record_fail "WiFi-only filtersApplied did not increment (value=$wifi_filters)"
  fi
fi

echo ""
echo "[4/5] All supported radio types should be neutral"
all_resp=$(fetch_dashboard '{"radioTypes":["W","B","E","L","N","G","C","D","F","?"]}' '{"radioTypes":true}')
all_code=$(echo "$all_resp" | tail -1)
all_body=$(echo "$all_resp" | head -n -1)
if [ "$all_code" != "200" ]; then
  record_fail "All-radio request failed (HTTP $all_code)"
else
  all_total=$(echo "$all_body" | jq -r '.networks.total // -1')
  all_obs=$(echo "$all_body" | jq -r '.observations.total // -1')
  all_filters=$(echo "$all_body" | jq -r '.filtersApplied // -1')
  if [ "$all_total" = "${baseline_total:-x}" ] && [ "$all_obs" = "${baseline_obs:-x}" ]; then
    record_pass "All-radio selection is neutral vs baseline"
  else
    record_fail "All-radio selection diverges from baseline (networks $all_total vs ${baseline_total:-unknown}, observations $all_obs vs ${baseline_obs:-unknown})"
  fi
  if [ "$all_filters" = "0" ]; then
    record_pass "All-radio filtersApplied neutralized to 0"
  else
    record_warn "All-radio filtersApplied expected 0, got $all_filters"
  fi
fi

echo ""
echo "[5/5] Severity counts endpoint should be healthy"
severity_code=$(curl -s -o /tmp/sc_dashboard_severity.json -w "%{http_code}" "$BASE/api/v2/threats/severity-counts")
if [ "$severity_code" = "200" ]; then
  severity_type=$(jq -r '.counts | type' /tmp/sc_dashboard_severity.json 2>/dev/null)
  if [ "$severity_type" = "object" ]; then
    record_pass "Severity counts endpoint healthy"
  else
    record_warn "Severity counts returned unexpected shape"
  fi
else
  record_fail "Severity counts endpoint failed (HTTP $severity_code)"
fi

echo ""
echo "=== DASHBOARD SMOKE COMPLETE ==="
echo "Summary: PASS=$PASS_COUNT WARN=$WARN_COUNT FAIL=$FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

