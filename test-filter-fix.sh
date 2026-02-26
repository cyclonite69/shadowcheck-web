#!/bin/bash
# Test script to verify filter system is working

echo "Testing filter system..."
echo ""

# Test 1: No filters (should return data)
echo "Test 1: No filters enabled"
curl -s "http://localhost:3001/api/v2/networks/filtered?filters=%7B%7D&enabled=%7B%7D&limit=5&offset=0" | jq '.data | length'

# Test 2: Single filter enabled (RSSI min)
echo ""
echo "Test 2: RSSI filter enabled (rssiMin: -70)"
FILTERS='{"rssiMin":-70}'
ENABLED='{"rssiMin":true}'
curl -s "http://localhost:3001/api/v2/networks/filtered?filters=$(echo $FILTERS | jq -sRr @uri)&enabled=$(echo $ENABLED | jq -sRr @uri)&limit=5&offset=0" | jq '{count: (.data | length), appliedFilters: .filterTransparency.appliedFilters}'

# Test 3: Multiple filters
echo ""
echo "Test 3: Multiple filters (RSSI + radioTypes)"
FILTERS='{"rssiMin":-70,"radioTypes":["WiFi"]}'
ENABLED='{"rssiMin":true,"radioTypes":true}'
curl -s "http://localhost:3001/api/v2/networks/filtered?filters=$(echo $FILTERS | jq -sRr @uri)&enabled=$(echo $ENABLED | jq -sRr @uri)&limit=5&offset=0" | jq '{count: (.data | length), appliedFilters: .filterTransparency.appliedFilters}'

echo ""
echo "Tests complete!"
