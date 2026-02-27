#!/bin/bash
# Comprehensive Filter Testing System
# Tests all filters individually and in combinations with performance metrics

IP="${1:-34.204.161.164:3001}"
LIMIT=5

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
        local query_ms=$(echo "$body" | jq -r '.queryTimeMs // "N/A"')
        local applied=$(echo "$body" | jq -c '.appliedFilters // []')
        local ignored=$(echo "$body" | jq -c '.ignoredFilters // []')
        echo "✅ $name | Count: $count | Query: ${query_ms}ms | Total: ${duration}ms"
        if [ "$ignored" != "[]" ]; then
            echo "   ⚠️  Ignored: $ignored"
        fi
    else
        echo "❌ $name | HTTP $http_code | ${duration}ms"
        echo "$body" | jq -r '.error // .message // "Unknown error"' | head -1
    fi
}

echo "=== A. IDENTITY FILTERS ==="
test_filter "SSID" '{"ssid":"test"}' '{"ssid":true}'
test_filter "BSSID (full)" '{"bssid":"AA:BB:CC:DD:EE:FF"}' '{"bssid":true}'
test_filter "BSSID (prefix)" '{"bssid":"AA:BB"}' '{"bssid":true}'
test_filter "Manufacturer (name)" '{"manufacturer":"Apple"}' '{"manufacturer":true}'
test_filter "Manufacturer (OUI)" '{"manufacturer":"00:50:F2"}' '{"manufacturer":true}'

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
test_filter "Custom date range" '{"startDate":"2026-02-01T00:00:00Z","endDate":"2026-02-27T23:59:59Z"}' '{"startDate":true,"endDate":true}'

echo ""
echo "=== H. ENGAGEMENT FILTERS ==="
test_filter "Has notes=true" '{"has_notes":true}' '{"has_notes":true}'
test_filter "Has notes=false" '{"has_notes":false}' '{"has_notes":true}'
test_filter "Tag type [threat]" '{"tag_type":["threat"]}' '{"tag_type":true}'
test_filter "Tag type [investigate]" '{"tag_type":["investigate"]}' '{"tag_type":true}'

echo ""
echo "=== H. ENGAGEMENT FILTERS ==="
test_filter "Has notes=true" '{"has_notes":true}' '{"has_notes":true}'
test_filter "Has notes=false" '{"has_notes":false}' '{"has_notes":true}'
test_filter "Tag type [threat]" '{"tag_type":["threat"]}' '{"tag_type":true}'
test_filter "Tag type [investigate]" '{"tag_type":["investigate"]}' '{"tag_type":true}'

echo ""
echo "=== I. COMPLEX COMBINATIONS ==="
test_filter "WiFi + 2.4GHz + Ch6-11 + RSSI>-70" '{"radioTypes":["W"],"frequencyBands":["2.4GHz"],"channelMin":6,"channelMax":11,"rssiMin":-70}' '{"radioTypes":true,"frequencyBands":true,"channelMin":true,"channelMax":true,"rssiMin":true}'
test_filter "OPEN + ObsCount>10 + ThreatScore>50" '{"encryptionTypes":["OPEN"],"observationCountMin":10,"threatScoreMin":50}' '{"encryptionTypes":true,"observationCountMin":true,"threatScoreMin":true}'
test_filter "5GHz + WPA2 + High threat" '{"frequencyBands":["5GHz"],"encryptionTypes":["WPA2"],"threatCategories":["high"]}' '{"frequencyBands":true,"encryptionTypes":true,"threatCategories":true}'

echo ""
echo "=== TEST COMPLETE ==="
