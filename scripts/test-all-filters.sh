#!/bin/bash
# Comprehensive Filter Testing System
# Tests all filters individually and in combinations with performance metrics

IP="${1:-34.204.161.164:3001}"
LIMIT=5
WARN_SLOW_MS="${WARN_SLOW_MS:-10000}"
FAIL_SLOW_MS="${FAIL_SLOW_MS:-30000}"
PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0
KNOWN_ENABLED_KEYS='["ssid","bssid","manufacturer","radioTypes","frequencyBands","channelMin","channelMax","rssiMin","rssiMax","encryptionTypes","securityFlags","timeframe","observationCountMin","observationCountMax","gpsAccuracyMax","excludeInvalidCoords","wigle_v3_observation_count_min","threatScoreMin","threatScoreMax","threatCategories","stationaryConfidenceMin","stationaryConfidenceMax","distanceFromHomeMin","distanceFromHomeMax","boundingBox","radiusFilter","has_notes","tag_type"]'

echo "=== SHADOWCHECK FILTER TEST SUITE ==="
echo "Target: $IP"
echo "Timestamp: $(date -Iseconds)"
echo ""

test_filter() {
    local name="$1"
    local filters="$2"
    local enabled="$3"
    
    local start=$(date +%s%N)
    local response=$(curl -s -w "\n%{http_code}" "http://$IP/api/v2/networks/filtered?limit=$LIMIT&offset=0&filters=$(echo "$filters" | jq -sRr @uri)&enabled=$(echo "$enabled" | jq -sRr @uri)")
    local end=$(date +%s%N)
    local duration=$(( (end - start) / 1000000 ))
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "200" ]; then
        local count=$(echo "$body" | jq -r '.data | length')
        local query_ms=$(echo "$body" | jq -r '.performance.queryTimeMs // .queryTimeMs // "N/A"')
        local applied=$(echo "$body" | jq -c '.filterTransparency.appliedFilters // .appliedFilters // []')
        local ignored=$(echo "$body" | jq -c '.filterTransparency.ignoredFilters // .ignoredFilters // []')
        local enabled_count=$(echo "$enabled" | jq -r 'to_entries | map(select(.value == true)) | length')
        local recognized_enabled_count=$(echo "$enabled" | jq -r --argjson known "$KNOWN_ENABLED_KEYS" 'to_entries | map(select(.value == true and (.key as $k | $known | index($k) != null))) | length')
        echo "✅ $name | Count: $count | Query: ${query_ms}ms | Total: ${duration}ms"
        PASS_COUNT=$((PASS_COUNT + 1))

        if [ "$recognized_enabled_count" -gt 0 ] && [ "$applied" = "[]" ] && [ "$ignored" = "[]" ]; then
            echo "   ❌ Applied/ignored filters both empty despite enabled flags"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi

        if [ "$duration" -ge "$FAIL_SLOW_MS" ]; then
            echo "   ❌ Slow request exceeded hard threshold (${FAIL_SLOW_MS}ms)"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        elif [ "$duration" -ge "$WARN_SLOW_MS" ]; then
            echo "   ⚠️  Slow request exceeded warning threshold (${WARN_SLOW_MS}ms)"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi

        if [ "$ignored" != "[]" ]; then
            echo "   ⚠️  Ignored: $ignored"
            WARN_COUNT=$((WARN_COUNT + 1))
        fi
    else
        echo "❌ $name | HTTP $http_code | ${duration}ms"
        echo "$body" | jq -r '.error // .message // "Unknown error"' | head -1
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

echo "=== A. IDENTITY FILTERS ==="
test_filter "SSID (common)" '{"ssid":"guest"}' '{"ssid":true}'
test_filter "SSID (xfinity)" '{"ssid":"xfinity"}' '{"ssid":true}'
test_filter "BSSID (full)" '{"bssid":"AA:BB:CC:DD:EE:FF"}' '{"bssid":true}'
test_filter "BSSID (prefix)" '{"bssid":"00:50"}' '{"bssid":true}'
test_filter "Manufacturer (Apple)" '{"manufacturer":"Apple"}' '{"manufacturer":true}'
test_filter "Manufacturer (Samsung)" '{"manufacturer":"Samsung"}' '{"manufacturer":true}'
test_filter "Manufacturer (OUI Apple)" '{"manufacturer":"00:50:F2"}' '{"manufacturer":true}'
test_filter "Manufacturer (OUI Samsung)" '{"manufacturer":"00:12:47"}' '{"manufacturer":true}'

echo ""
echo "=== B. RADIO FILTERS ==="
test_filter "RadioTypes [W] WiFi" '{"radioTypes":["W"]}' '{"radioTypes":true}'
test_filter "RadioTypes [E] BLE" '{"radioTypes":["E"]}' '{"radioTypes":true}'
test_filter "RadioTypes [B] Bluetooth" '{"radioTypes":["B"]}' '{"radioTypes":true}'
test_filter "RadioTypes [L] LTE" '{"radioTypes":["L"]}' '{"radioTypes":true}'
test_filter "RadioTypes [G] GSM" '{"radioTypes":["G"]}' '{"radioTypes":true}'
test_filter "RadioTypes [N] 5G NR" '{"radioTypes":["N"]}' '{"radioTypes":true}'
test_filter "RadioTypes [U] Unknown" '{"radioTypes":["U"]}' '{"radioTypes":true}'
test_filter "RadioTypes [W,E] Multi" '{"radioTypes":["W","E"]}' '{"radioTypes":true}'
test_filter "FrequencyBands [2.4GHz]" '{"frequencyBands":["2.4GHz"]}' '{"frequencyBands":true}'
test_filter "FrequencyBands [5GHz]" '{"frequencyBands":["5GHz"]}' '{"frequencyBands":true}'
test_filter "FrequencyBands [6GHz]" '{"frequencyBands":["6GHz"]}' '{"frequencyBands":true}'
test_filter "FrequencyBands [BLE]" '{"frequencyBands":["BLE"]}' '{"frequencyBands":true}'
test_filter "FrequencyBands [Cellular]" '{"frequencyBands":["Cellular"]}' '{"frequencyBands":true}'
test_filter "ChannelMin=6" '{"channelMin":6}' '{"channelMin":true}'
test_filter "ChannelMax=11" '{"channelMax":11}' '{"channelMax":true}'
test_filter "Channel range 6-11" '{"channelMin":6,"channelMax":11}' '{"channelMin":true,"channelMax":true}'
test_filter "RSSI min=-70" '{"rssiMin":-70}' '{"rssiMin":true}'
test_filter "RSSI max=-30" '{"rssiMax":-30}' '{"rssiMax":true}'
test_filter "RSSI range -70 to -30" '{"rssiMin":-70,"rssiMax":-30}' '{"rssiMin":true,"rssiMax":true}'

echo ""
echo "=== C. SECURITY FILTERS ==="
test_filter "EncryptionTypes [OPEN]" '{"encryptionTypes":["OPEN"]}' '{"encryptionTypes":true}'
test_filter "EncryptionTypes [WEP]" '{"encryptionTypes":["WEP"]}' '{"encryptionTypes":true}'
test_filter "EncryptionTypes [WPA]" '{"encryptionTypes":["WPA"]}' '{"encryptionTypes":true}'
test_filter "EncryptionTypes [WPA2]" '{"encryptionTypes":["WPA2"]}' '{"encryptionTypes":true}'
test_filter "EncryptionTypes [WPA3]" '{"encryptionTypes":["WPA3"]}' '{"encryptionTypes":true}'
test_filter "SecurityFlags [insecure]" '{"securityFlags":["insecure"]}' '{"securityFlags":true}'
test_filter "SecurityFlags [deprecated]" '{"securityFlags":["deprecated"]}' '{"securityFlags":true}'
test_filter "SecurityFlags [enterprise]" '{"securityFlags":["enterprise"]}' '{"securityFlags":true}'
test_filter "SecurityFlags [personal]" '{"securityFlags":["personal"]}' '{"securityFlags":true}'
test_filter "SecurityFlags [unknown]" '{"securityFlags":["unknown"]}' '{"securityFlags":true}'

echo ""
echo "=== D. QUALITY FILTERS ==="
test_filter "ObservationCountMin=10" '{"observationCountMin":10}' '{"observationCountMin":true}'
test_filter "ObservationCountMax=100" '{"observationCountMax":100}' '{"observationCountMax":true}'
test_filter "GPS Accuracy max=50m" '{"gpsAccuracyMax":50}' '{"gpsAccuracyMax":true}'
test_filter "ExcludeInvalidCoords" '{"excludeInvalidCoords":true}' '{"excludeInvalidCoords":true}'
test_filter "WiGLE v3 count min=5" '{"wigle_v3_observation_count_min":5}' '{"wigle_v3_observation_count_min":true}'

echo ""
echo "=== E. THREAT FILTERS ==="
test_filter "ThreatScoreMin=50" '{"threatScoreMin":50}' '{"threatScoreMin":true}'
test_filter "ThreatScoreMax=80" '{"threatScoreMax":80}' '{"threatScoreMax":true}'
test_filter "ThreatCategories [high]" '{"threatCategories":["high"]}' '{"threatCategories":true}'
test_filter "ThreatCategories [critical]" '{"threatCategories":["critical"]}' '{"threatCategories":true}'
test_filter "StationaryConfidenceMin=0.8" '{"stationaryConfidenceMin":0.8}' '{"stationaryConfidenceMin":true}'
test_filter "StationaryConfidenceMax=0.3" '{"stationaryConfidenceMax":0.3}' '{"stationaryConfidenceMax":true}'

echo ""
echo "=== F. SPATIAL & PROXIMITY FILTERS ==="
test_filter "DistanceFromHomeMin=1km" '{"distanceFromHomeMin":1}' '{"distanceFromHomeMin":true}'
test_filter "DistanceFromHomeMax=5km" '{"distanceFromHomeMax":5}' '{"distanceFromHomeMax":true}'
test_filter "Distance range 1-5km" '{"distanceFromHomeMin":1,"distanceFromHomeMax":5}' '{"distanceFromHomeMin":true,"distanceFromHomeMax":true}'
test_filter "BoundingBox (NYC area)" '{"boundingBox":{"north":40.8,"south":40.7,"east":-73.9,"west":-74.0}}' '{"boundingBox":true}'

echo ""
echo "=== G. TEMPORAL FILTERS ==="
test_filter "Last 24 hours" '{"timeframe":"last_24h"}' '{"timeframe":true}'
test_filter "Last 7 days" '{"timeframe":"last_7d"}' '{"timeframe":true}'
test_filter "Last 30 days" '{"timeframe":"last_30d"}' '{"timeframe":true}'
test_filter "Custom date range" '{"timeframe":{"type":"absolute","startTimestamp":"2026-02-01T00:00:00Z","endTimestamp":"2026-02-27T23:59:59Z","scope":"observation_time"}}' '{"timeframe":true}'

echo ""
echo "=== H. ENGAGEMENT FILTERS ==="
test_filter "Has notes=true" '{"has_notes":true}' '{"has_notes":true}'
test_filter "Has notes=false" '{"has_notes":false}' '{"has_notes":true}'
test_filter "Tag type [threat]" '{"tag_type":["threat"]}' '{"tag_type":true}'
test_filter "Tag type [investigate]" '{"tag_type":["investigate"]}' '{"tag_type":true}'
test_filter "Tag type [suspect]" '{"tag_type":["suspect"]}' '{"tag_type":true}'
test_filter "Tag type [false_positive]" '{"tag_type":["false_positive"]}' '{"tag_type":true}'
test_filter "Tag type [ignore]" '{"tag_type":["ignore"]}' '{"tag_type":true}'
test_filter "Tag type [untagged]" '{"tag_type":["untagged"]}' '{"tag_type":true}'
test_filter "Tag type [multiple]" '{"tag_type":["threat","investigate"]}' '{"tag_type":true}'

echo ""
echo "=== I. COMPLEX COMBINATIONS ==="
test_filter "WiFi + 2.4GHz + Ch6-11 + RSSI>-70" '{"radioTypes":["W"],"frequencyBands":["2.4GHz"],"channelMin":6,"channelMax":11,"rssiMin":-70}' '{"radioTypes":true,"frequencyBands":true,"channelMin":true,"channelMax":true,"rssiMin":true}'
test_filter "OPEN + ObsCount>10 + ThreatScore>50" '{"encryptionTypes":["OPEN"],"observationCountMin":10,"threatScoreMin":50}' '{"encryptionTypes":true,"observationCountMin":true,"threatScoreMin":true}'
test_filter "5GHz + WPA2 + High threat" '{"frequencyBands":["5GHz"],"encryptionTypes":["WPA2"],"threatCategories":["high"]}' '{"frequencyBands":true,"encryptionTypes":true,"threatCategories":true}'

echo ""
echo "=== TEST COMPLETE ==="
echo "Summary: PASS=$PASS_COUNT WARN=$WARN_COUNT FAIL=$FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
