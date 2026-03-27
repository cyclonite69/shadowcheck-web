#!/bin/sh
# Generate a self-signed TLS certificate.
# If CERT_DIR is set explicitly, preserve the legacy server.crt/server.key names.
# Otherwise, write to the canonical EBS path on-server or to a gitignored local dir.
set -e

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

if [ -n "${CERT_DIR:-}" ]; then
    TARGET_DIR="$CERT_DIR"
    CERT_BASENAME="${CERT_BASENAME:-server}"
elif [ -w "/var/lib/postgresql" ] || [ -w "/var/lib/postgresql/certs" ]; then
    TARGET_DIR="/var/lib/postgresql/certs"
    CERT_BASENAME="${CERT_BASENAME:-shadowcheck}"
else
    TARGET_DIR="$REPO_ROOT/docker/infrastructure/certs/local"
    CERT_BASENAME="${CERT_BASENAME:-shadowcheck}"
fi

CERT_DIR="$TARGET_DIR"
CERT_FILE="$CERT_DIR/$CERT_BASENAME.crt"
KEY_FILE="$CERT_DIR/$CERT_BASENAME.key"

mkdir -p "$CERT_DIR"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    if openssl x509 -checkend 2592000 -noout -in "$CERT_FILE" >/dev/null 2>&1; then
        echo "[cert] Existing cert valid, skipping generation: $CERT_FILE"
        exit 0
    fi
    echo "[cert] Cert expiring soon, regenerating: $CERT_FILE"
fi

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

OPENSSL_CONFIG=$(mktemp)
cat > "$OPENSSL_CONFIG" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = $PUBLIC_IP

[v3_req]
subjectAltName = IP:$PUBLIC_IP,IP:127.0.0.1,DNS:localhost
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days 3650 \
    -config "$OPENSSL_CONFIG" >/dev/null 2>&1

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"
rm -f "$OPENSSL_CONFIG"

echo "[cert] Done: $CERT_FILE"
