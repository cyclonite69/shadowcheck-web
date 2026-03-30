#!/bin/bash
set -euo pipefail
# Fix Docker bridge network missing gateway IP

BRIDGE="br-0198a91b1396"
GATEWAY_IP="172.19.0.1/16"

# Check if IP is already assigned
if ! ip addr show $BRIDGE | grep -q "$GATEWAY_IP"; then
    echo "Adding $GATEWAY_IP to $BRIDGE..."
    sudo ip addr add $GATEWAY_IP dev $BRIDGE
    echo "✓ IP added"
else
    echo "✓ IP already configured"
fi
