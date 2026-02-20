#!/bin/sh
# Generate self-signed TLS certificate for EC2 public IP.
# Safe to run repeatedly — skips if cert is valid for >30 days.
set -e

CERT_DIR="${CERT_DIR:-/etc/nginx/certs}"
mkdir -p "$CERT_DIR"

# Skip if cert is already valid and not expiring within 30 days
if [ -f "$CERT_DIR/server.crt" ] && [ -f "$CERT_DIR/server.key" ]; then
    if openssl x509 -checkend 2592000 -noout -in "$CERT_DIR/server.crt" 2>/dev/null; then
        echo "[cert] Existing cert valid, skipping generation."
        exit 0
    fi
    echo "[cert] Cert expiring soon, regenerating..."
fi

# Fetch EC2 public IP via IMDSv2, fall back to IMDSv1, then localhost
IMDS_TOKEN=$(curl -sf --connect-timeout 2 \
    -X PUT "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || echo "")

if [ -n "$IMDS_TOKEN" ]; then
    PUBLIC_IP=$(curl -sf --connect-timeout 2 \
        -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" \
        "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || echo "")
else
    PUBLIC_IP=$(curl -sf --connect-timeout 2 \
        "http://169.254.169.254/latest/meta-data/public-ipv4" 2>/dev/null || echo "")
fi
PUBLIC_IP="${PUBLIC_IP:-127.0.0.1}"

echo "[cert] Generating self-signed cert for IP: $PUBLIC_IP"

cat > /tmp/openssl.cnf <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = $PUBLIC_IP

[v3_req]
subjectAltName = IP:$PUBLIC_IP,IP:127.0.0.1
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -days 365 \
    -config /tmp/openssl.cnf

chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"
rm -f /tmp/openssl.cnf

echo "[cert] Done — valid 365 days."
