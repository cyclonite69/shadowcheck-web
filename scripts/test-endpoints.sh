#!/bin/bash
set -euo pipefail
# ShadowCheck Endpoint Test Harness
# Safely tests API endpoints without causing OOM or excessive output

BASE="http://localhost:3001"
BSSID="6D:70:9A:A5:7F:4D"
EXPORT_DIR="/tmp/shadowcheck_exports"
DEFAULT_TIMEOUT=20
THREAT_MAP_TIMEOUT=45
mkdir -p "$EXPORT_DIR"
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

echo "--------------------------------------------------"
echo "ShadowCheck API Deployment Test"
echo "Base URL: $BASE"
echo "Target BSSID: $BSSID"
echo "--------------------------------------------------"

test_endpoint() {
    local name=$1
    local method=$2
    local path=$3
    local query=$4
    local body=$5
    local timeout=${6:-$DEFAULT_TIMEOUT}

    echo -n "Testing $name ($path)... "

    local url="${BASE}${path}"
    if [ -n "$query" ]; then
        url="${url}?${query}"
    fi

    local response_file="/tmp/sc_test_$(echo $name | tr ' ' '_').json"
    local status_code
    local curl_exit=0
    
    if [ "$method" == "POST" ]; then
        status_code=$(curl -s -o "$response_file" -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$body" "$url" --connect-timeout 5 --max-time "$timeout")
        curl_exit=$?
    else
        status_code=$(curl -s -o "$response_file" -w "%{http_code}" "$url" --connect-timeout 5 --max-time "$timeout")
        curl_exit=$?
    fi

    if [ "$curl_exit" -ne 0 ]; then
        echo -e "\e[31mCURL ERROR\e[0m (exit=$curl_exit, http=${status_code:-000})"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        if [ -f "$response_file" ]; then
            head -c 160 "$response_file"
            echo "..."
        fi
        return
    fi

    if [ "$status_code" -eq 200 ] || [ "$status_code" -eq 201 ]; then
        # Check if it is JSON
        if grep -q "{" "$response_file"; then
            local summary
            summary=$(jq -r 'if type=="array" then "Array(len=\(length))" else "Object(keys=\(keys | length))" end' "$response_file" 2>/dev/null)
            if [ $? -eq 0 ]; then
                echo -e "\e[32mPASS\e[0m ($status_code) - $summary"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                echo -e "\e[32mPASS\e[0m ($status_code) - Non-JSON body"
                PASS_COUNT=$((PASS_COUNT + 1))
            fi
        else
            echo -e "\e[32mPASS\e[0m ($status_code)"
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
    elif [ "$status_code" -eq 401 ]; then
        echo -e "\e[33mAUTH REQUIRED\e[0m ($status_code)"
        WARN_COUNT=$((WARN_COUNT + 1))
    elif [ "$status_code" -eq 404 ]; then
        echo -e "\e[31mNOT FOUND\e[0m ($status_code)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    else
        echo -e "\e[31mFAIL\e[0m ($status_code)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        if [ -f "$response_file" ]; then
            head -c 100 "$response_file"
            echo "..."
        fi
    fi
}

test_export() {
    local name=$1
    local path=$2
    local ext=$3

    echo -n "Testing Export $name ($path)... "
    local url="${BASE}${path}"
    local output_file="${EXPORT_DIR}/test_${ext}.${ext}"
    
    # Use -r to get just the first few bytes to test if it works, then full with limit
    local status_code
    status_code=$(curl -s -o "$output_file" -w "%{http_code}" "$url" --connect-timeout 5 --max-time 30 --limit-rate 1M)

    if [ "$status_code" -eq 200 ]; then
        local line_count=$(wc -l < "$output_file")
        local size=$(du -h "$output_file" | cut -f1)
        echo -e "\e[32mPASS\e[0m ($status_code) - $line_count lines, $size"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "\e[31mFAIL\e[0m ($status_code)"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# 1. Health
test_endpoint "Health (Root)" "GET" "/health"
test_endpoint "Health (API)" "GET" "/api/health"

# 2. V2 Networks
test_endpoint "Dashboard Metrics (v2)" "GET" "/api/v2/dashboard/metrics"
test_endpoint "Networks List (v2)" "GET" "/api/v2/networks" "limit=2"
test_endpoint "Network Details (v2)" "GET" "/api/v2/networks/$BSSID"
test_endpoint "Threat Map (v2)" "GET" "/api/v2/threats/map" "severity=high&days=1" "" "$THREAT_MAP_TIMEOUT"
test_endpoint "Severity Counts (v2)" "GET" "/api/v2/threats/severity-counts"

# 3. WiGLE
test_endpoint "WiGLE API Status" "GET" "/api/wigle/api-status"
test_endpoint "WiGLE Search" "GET" "/api/wigle/search" "ssid=test&limit=2"
test_endpoint "WiGLE Networks V2" "GET" "/api/wigle/networks-v2" "limit=2"
test_endpoint "WiGLE Observations" "GET" "/api/wigle/observations/$BSSID"

# 4. ML
test_endpoint "ML Status" "GET" "/api/ml/status"
test_endpoint "ML Score (Single)" "GET" "/api/ml/scores/$BSSID"
test_endpoint "ML Score All (limit 1)" "POST" "/api/ml/score-all" "" "{\"limit\": 1, \"overwrite_final\": false}"

# 5. Analytics
test_endpoint "Analytics Dashboard" "GET" "/api/analytics/dashboard"
test_endpoint "Analytics Network Types" "GET" "/api/analytics/network-types"
test_endpoint "Analytics Signal Strength" "GET" "/api/analytics/signal-strength"
test_endpoint "Analytics Top Networks" "GET" "/api/analytics/top-networks" "limit=2"
test_endpoint "Analytics Threat Trends" "GET" "/api/analytics/threat-trends" "range=30d"

# 6. Misc
test_endpoint "Mapbox Token" "GET" "/api/mapbox-token"

# 7. Exports (limited)
test_export "CSV" "/api/csv" "csv"
test_export "JSON" "/api/json" "json"
test_export "GeoJSON" "/api/geojson" "geojson"

echo "--------------------------------------------------"
echo "Test Completed."
echo "Summary: PASS=$PASS_COUNT WARN=$WARN_COUNT FAIL=$FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
