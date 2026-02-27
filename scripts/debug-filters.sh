#!/bin/bash
# Debug filter API calls
# Tests what the backend actually returns for different filter combinations

API_URL="http://localhost:3001"

echo "🔍 Testing Filter API Responses"
echo ""

# Test 1: No filters (should work)
echo "Test 1: No filters enabled"
curl -s "${API_URL}/api/v2/networks/filtered?limit=5&offset=0&filters=%7B%7D&enabled=%7B%7D" | jq -r '.data | length'
echo ""

# Test 2: SSID filter (you said this works)
echo "Test 2: SSID filter enabled with value"
FILTERS='{"ssid":"test"}'
ENABLED='{"ssid":true}'
curl -s "${API_URL}/api/v2/networks/filtered?limit=5&offset=0&filters=$(echo $FILTERS | jq -sRr @uri)&enabled=$(echo $ENABLED | jq -sRr @uri)" | jq -r '.data | length'
echo ""

# Test 3: RadioTypes enabled but empty array
echo "Test 3: RadioTypes enabled with empty array []"
FILTERS='{"radioTypes":[]}'
ENABLED='{"radioTypes":true}'
curl -s "${API_URL}/api/v2/networks/filtered?limit=5&offset=0&filters=$(echo $FILTERS | jq -sRr @uri)&enabled=$(echo $ENABLED | jq -sRr @uri)" | jq -c '{dataLength: (.data | length), warnings: .warnings, ignoredFilters: .ignoredFilters}'
echo ""

# Test 4: RadioTypes enabled with WiFi selected
echo "Test 4: RadioTypes enabled with WiFi ['W']"
FILTERS='{"radioTypes":["W"]}'
ENABLED='{"radioTypes":true}'
curl -s "${API_URL}/api/v2/networks/filtered?limit=5&offset=0&filters=$(echo $FILTERS | jq -sRr @uri)&enabled=$(echo $ENABLED | jq -sRr @uri)" | jq -c '{dataLength: (.data | length), appliedFilters: .appliedFilters}'
echo ""

# Test 5: FrequencyBands enabled with 2.4GHz
echo "Test 5: FrequencyBands enabled with 2.4GHz"
FILTERS='{"frequencyBands":["2.4GHz"]}'
ENABLED='{"frequencyBands":true}'
curl -s "${API_URL}/api/v2/networks/filtered?limit=5&offset=0&filters=$(echo $FILTERS | jq -sRr @uri)&enabled=$(echo $ENABLED | jq -sRr @uri)" | jq -c '{dataLength: (.data | length), appliedFilters: .appliedFilters}'
echo ""

# Test 6: Channel filter
echo "Test 6: Channel min=1"
FILTERS='{"channelMin":1}'
ENABLED='{"channelMin":true}'
curl -s "${API_URL}/api/v2/networks/filtered?limit=5&offset=0&filters=$(echo $FILTERS | jq -sRr @uri)&enabled=$(echo $ENABLED | jq -sRr @uri)" | jq -c '{dataLength: (.data | length), appliedFilters: .appliedFilters}'
echo ""

echo "✅ Tests complete"
