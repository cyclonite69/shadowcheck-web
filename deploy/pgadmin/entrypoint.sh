#!/bin/sh
set -e

echo "--- [ShadowCheck] Starting Automated Discovery ---"

# Set location for AWS CLI config if using mounted volume
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    export AWS_SHARED_CREDENTIALS_FILE=/var/lib/pgadmin/.aws/credentials
    export AWS_CONFIG_FILE=/var/lib/pgadmin/.aws/config
fi

# 1. Resolve Region
if [ -z "$AWS_DEFAULT_REGION" ]; then
    REGION=$(aws configure get region 2>/dev/null || \
             curl -s --connect-timeout 1 http://169.254.169.254/latest/meta-data/placement/region 2>/dev/null || \
             echo "us-east-1")
    export AWS_DEFAULT_REGION=$REGION
fi
echo "Region: $AWS_DEFAULT_REGION"

# 2. Resolve EC2 Host
echo "Searching for ShadowCheck EC2 instance..."
HOST_DNS=$(aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query "Reservations[].Instances[?Tags[?Key=='Name' && contains(Value, 'shadowcheck')]].PublicDnsName" \
    --output text | head -n 1)

if [ -z "$HOST_DNS" ] || [ "$HOST_DNS" = "None" ]; then
    # Fallback: just get any running instance
    HOST_DNS=$(aws ec2 describe-instances \
        --filters "Name=instance-state-name,Values=running" \
        --query "Reservations[0].Instances[0].PublicDnsName" \
        --output text)
fi

if [ -z "$HOST_DNS" ] || [ "$HOST_DNS" = "None" ]; then
    echo "Error: No running EC2 host discovered."
    exit 1
fi
echo "Found Host: $HOST_DNS"

# 3. Resolve Secret
SECRET_NAME=$(aws secretsmanager list-secrets \
    --query "SecretList[?contains(Name, 'shadowcheck')].Name" \
    --output text | awk '{print $1}')

if [ -z "$SECRET_NAME" ]; then
    echo "Error: No ShadowCheck secret found."
    exit 1
fi

SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text)
PGADMIN_PASS=$(echo "$SECRET_JSON" | jq -r '.admin_password // "admin"')

export PGADMIN_DEFAULT_PASSWORD=$PGADMIN_PASS
echo "Secrets retrieved."

# 4. SSL Cert
SSL_CERT_PATH="/var/lib/pgadmin/global-bundle.pem"
if [ ! -f "$SSL_CERT_PATH" ]; then
    echo "Downloading AWS Global Bundle..."
    curl -s -o "$SSL_CERT_PATH" https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
fi

# 5. Servers JSON
cat <<EOF > /pgadmin4/servers.json
{
    "Servers": {
        "1": {
            "Name": "ShadowCheck (Auto-Discovered)",
            "Group": "ShadowCheck",
            "Host": "${HOST_DNS}",
            "Port": 5432,
            "MaintenanceDB": "shadowcheck_db",
            "Username": "shadowcheck_user",
            "SSLMode": "verify-full",
            "SSLRootCert": "${SSL_CERT_PATH}"
        }
    }
}
EOF

echo "--- [ShadowCheck] Discovery Complete. Handing off to pgAdmin4 ---"
exec /entrypoint.sh "$@"
