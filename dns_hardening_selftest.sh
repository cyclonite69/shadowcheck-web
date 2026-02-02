#!/bin/bash

# DNS Hardening Self-Test Script
# Tests Unbound + nftables DNS bypass prevention

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

print_result() {
    local test_name="$1"
    local result="$2"
    local details="$3"
    
    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}[PASS]${NC} $test_name"
        [ -n "$details" ] && echo "       $details"
        ((PASS_COUNT++))
    else
        echo -e "${RED}[FAIL]${NC} $test_name"
        [ -n "$details" ] && echo "       $details"
        ((FAIL_COUNT++))
    fi
}

echo "=== DNS Hardening Self-Test ==="
echo

# Test 1: Unbound Service Status
echo "1. Testing Unbound service..."
if systemctl is-active unbound >/dev/null 2>&1 && systemctl is-enabled unbound >/dev/null 2>&1; then
    print_result "Unbound service active and enabled" "PASS"
else
    print_result "Unbound service status" "FAIL" "Service not active or not enabled"
fi

# Test 2: Unbound Listening Sockets
echo "2. Testing Unbound listening sockets..."
SOCKETS=$(ss -tulpn | grep :53 | grep -E "(127.0.0.1|::1)" | wc -l)
if [ "$SOCKETS" -ge 2 ]; then
    print_result "Unbound listening on localhost" "PASS" "Found $SOCKETS localhost:53 sockets"
else
    print_result "Unbound listening on localhost" "FAIL" "Expected >=2 sockets, found $SOCKETS"
fi

# Test 3: DNSSEC Validation
echo "3. Testing DNSSEC validation..."
if dig @127.0.0.1 example.com 2>/dev/null | grep -q "flags.*ad"; then
    print_result "DNSSEC validation (ad flag)" "PASS"
else
    print_result "DNSSEC validation (ad flag)" "FAIL" "No 'ad' flag in DNS response"
fi

# Test 4: resolv.conf Content
echo "4. Testing resolv.conf..."
RESOLV_CONTENT=$(cat /etc/resolv.conf | grep -v "^#" | grep -v "^$")
if [ "$RESOLV_CONTENT" = "nameserver 127.0.0.1" ]; then
    print_result "resolv.conf contains only localhost" "PASS"
else
    print_result "resolv.conf content" "FAIL" "Expected 'nameserver 127.0.0.1', got: $RESOLV_CONTENT"
fi

# Test 5: nftables DNS Hardening Table
echo "5. Testing nftables DNS hardening..."
if sudo nft list table inet dns_hardening >/dev/null 2>&1; then
    print_result "nftables dns_hardening table exists" "PASS"
else
    print_result "nftables dns_hardening table" "FAIL" "Table 'inet dns_hardening' not found"
fi

# Test 6: DNS Bypass Prevention - External DNS Blocked
echo "6. Testing DNS bypass prevention..."
BYPASS_BLOCKED=true

# Test 1.1.1.1
if timeout 3 dig @1.1.1.1 example.com +short >/dev/null 2>&1; then
    print_result "Block DNS to 1.1.1.1" "FAIL" "External DNS query succeeded (should be blocked)"
    BYPASS_BLOCKED=false
else
    print_result "Block DNS to 1.1.1.1" "PASS"
fi

# Test 8.8.8.8
if timeout 3 dig @8.8.8.8 example.com +short >/dev/null 2>&1; then
    print_result "Block DNS to 8.8.8.8" "FAIL" "External DNS query succeeded (should be blocked)"
    BYPASS_BLOCKED=false
else
    print_result "Block DNS to 8.8.8.8" "PASS"
fi

# Test 7: Local DNS Still Works
echo "7. Testing local DNS functionality..."
if timeout 5 dig @127.0.0.1 example.com +short >/dev/null 2>&1; then
    print_result "Local DNS queries work" "PASS"
else
    print_result "Local DNS queries work" "FAIL" "Local DNS query failed"
fi

# Test 8: Unbound Error Check
echo "8. Checking for recent Unbound errors..."
ERROR_COUNT=$(journalctl -u unbound --since "1 hour ago" 2>/dev/null | grep -i "error\|servfail" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    print_result "No recent Unbound errors" "PASS"
else
    print_result "Unbound error check" "FAIL" "Found $ERROR_COUNT errors in last hour"
fi

# Test 9: NetworkManager DNS Override Check
echo "9. Testing NetworkManager DNS configuration..."
NM_DNS=$(nmcli dev show 2>/dev/null | grep "IP4.DNS" | grep -v "127.0.0.1" | wc -l)
if [ "$NM_DNS" -eq 0 ]; then
    print_result "NetworkManager not overriding DNS" "PASS"
else
    print_result "NetworkManager DNS override" "FAIL" "NetworkManager has external DNS servers configured"
fi

echo
echo "=== Summary ==="
echo -e "Tests passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Tests failed: ${RED}$FAIL_COUNT${NC}"

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo -e "${GREEN}All tests passed! DNS hardening is properly configured.${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. DNS hardening needs attention.${NC}"
    exit 1
fi
