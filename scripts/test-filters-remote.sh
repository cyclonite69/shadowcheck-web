#!/bin/bash
# Remote Filter Testing - Run from local machine to test EC2 instance
# Usage: ./test-filters-remote.sh [IP_ADDRESS]

IP="${1:-34.204.161.164}"
PORT="3001"
TARGET="http://${IP}:${PORT}"
LIMIT=5

echo "=== SHADOWCHECK REMOTE FILTER TEST ==="
echo "Target: $TARGET"
echo "Timestamp: $(date -Iseconds)"
echo ""

test_filter() {
    local name="$1"
    local filters="$2"
    local enabled="$3"
    
    local start=$(date +%s%N)
    local response=$(curl -s -w "\n%{http_code}" "${TARGET}/api/v2/networks/filtered?limit=$LIMIT&offset=0&filters=$(echo "$filters" | jq -sRr @uri)&enabled=$(echo "$enabled" | jq -sRr @uri)")
    local end=$(date +%s%N)
    local duration=$(( (end - start) / 1000000 ))
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        local count=$(echo "$body" | jq -r '.data | length')
        local query_ms=$(echo "$body" | jq -r '.queryTimeMs // "N/A"')
        echo "✅ $name | Count: $count | Query: ${query_ms}ms | Total: ${duration}ms"
    else
        echo "❌ $name | HTTP $http_code | ${duration}ms"
    fi
}

echo "=== QUICK SMOKE TEST ==="
test_filter "SSID" '{"ssid":"guest"}' '{"ssid":true}'
test_filter "ThreatScore>=50" '{"threatScoreMin":50}' '{"threatScoreMin":true}'
test_filter "OPEN networks" '{"encryptionTypes":["OPEN"]}' '{"encryptionTypes":true}'
test_filter "WPA2 networks" '{"encryptionTypes":["WPA2"]}' '{"encryptionTypes":true}'
test_filter "Insecure flag" '{"securityFlags":["insecure"]}' '{"securityFlags":true}'
test_filter "WiFi only" '{"radioTypes":["W"]}' '{"radioTypes":true}'
test_filter "BLE only" '{"radioTypes":["E"]}' '{"radioTypes":true}'
test_filter "Bluetooth" '{"radioTypes":["B"]}' '{"radioTypes":true}'
test_filter "Has notes=false" '{"has_notes":false}' '{"has_notes":true}'

echo ""
echo "=== TEST COMPLETE ==="
echo ""
echo "Run full test suite with:"
echo "  ssh to EC2 and run: ./scripts/test-all-filters.sh localhost:3001"
