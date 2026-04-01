#!/bin/sh
# Auto-detect Docker socket GID and ensure the app user can access it.
# Falls back gracefully if the socket isn't mounted — PgAdmin controls
# will simply report "Docker CLI not available".

SOCKET=/var/run/docker.sock
AWS_SECRET_NAME="${SHADOWCHECK_AWS_SECRET:-shadowcheck/config}"

load_runtime_secrets() {
  # Never short-circuit on DB_PASSWORD / DB_ADMIN_PASSWORD — those must always
  # come from AWS Secrets Manager.  Only skip the fetch when non-credential
  # tokens are already present AND the aws CLI isn't available.
  if ! command -v aws >/dev/null 2>&1; then
    echo "[entrypoint] Warning: aws CLI not found in PATH"
    return 0
  fi

  _REGION_ARG=""
  _RESOLVED_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
  if [ -n "$_RESOLVED_REGION" ]; then _REGION_ARG="--region $_RESOLVED_REGION"; fi
  
  echo "[entrypoint] Fetching secrets from AWS Secrets Manager (secret: $AWS_SECRET_NAME, region: ${_RESOLVED_REGION:-default})..."
  export SECRET_JSON=$(aws secretsmanager get-secret-value \
    $_REGION_ARG \
    --secret-id "$AWS_SECRET_NAME" \
    --query SecretString \
    --output text 2>&1 || true)

  if [ -z "$SECRET_JSON" ] || [ "$SECRET_JSON" = "None" ]; then
    echo "[entrypoint] Warning: Could not retrieve secrets from AWS Secrets Manager"
    echo "[entrypoint] Secret response: $SECRET_JSON"
    return 0
  fi
  
  echo "[entrypoint] Successfully retrieved secret from AWS Secrets Manager"

  EXPORTS=$(SECRET_JSON="$SECRET_JSON" node -e '
    try {
      const obj = JSON.parse(process.env.SECRET_JSON || "{}");
      // Credential keys: SM always wins (never trust env placeholders for secrets).
      const credentialKeys = new Set([
        "db_password", "db_admin_password",
      ]);
      const mapping = {
        db_password: "DB_PASSWORD",
        db_admin_password: "DB_ADMIN_PASSWORD",
        mapbox_token: "MAPBOX_TOKEN",
        wigle_api_name: "WIGLE_API_NAME",
        wigle_api_token: "WIGLE_API_TOKEN",
        wigle_api_encoded: "WIGLE_API_ENCODED",
        google_maps_api_key: "GOOGLE_MAPS_API_KEY",
        mapbox_unlimited_api_key: "MAPBOX_UNLIMITED_API_KEY",
        opencage_api_key: "OPENCAGE_API_KEY",
        locationiq_api_key: "LOCATIONIQ_API_KEY",
        smarty_auth_id: "SMARTY_AUTH_ID",
        smarty_auth_token: "SMARTY_AUTH_TOKEN",
      };

      for (const [secretKey, envKey] of Object.entries(mapping)) {
        const value = obj[secretKey];
        if (typeof value !== "string" || value.length === 0) continue;
        // For credential keys, SM always overrides env (secrets never live on disk).
        // For non-credential keys, keep existing env if already set.
        if (!credentialKeys.has(secretKey) && process.env[envKey]) continue;
        console.log(`export ${envKey}=${JSON.stringify(value)}`);
      }
    } catch (err) {
      console.error("ERROR parsing secrets:", err.message);
      process.exit(1);
    }
  ' 2>&1)
  
  EXPORT_EXIT=$?
  if [ $EXPORT_EXIT -ne 0 ]; then
    echo "[entrypoint] ERROR: Failed to parse/export secrets from JSON"
    echo "[entrypoint] Parser output: $EXPORTS"
    exit 1
  fi

  if [ -n "$EXPORTS" ]; then
    echo "[entrypoint] Exporting secret values to environment..."
    set -a
    eval "$EXPORTS" || {
      echo "[entrypoint] ERROR: Failed to eval secret exports"
      exit 1
    }
    set +a
    echo "[entrypoint] Environment variables loaded successfully"
  else
    echo "[entrypoint] WARNING: No exports generated from secrets"
  fi
}

load_runtime_secrets

if [ "${API_RUN_AS_ROOT_FOR_DOCKER:-false}" = "true" ]; then
  exec dumb-init -- "$@"
fi

if [ -S "$SOCKET" ]; then
  SOCK_GID=$(stat -c '%g' "$SOCKET" 2>/dev/null)
  if [ -n "$SOCK_GID" ] && [ "$SOCK_GID" != "0" ]; then
    # Create a group with the socket's GID if it doesn't exist, then add our user
    if ! getent group "$SOCK_GID" >/dev/null 2>&1; then
      addgroup -g "$SOCK_GID" -S dockersock 2>/dev/null || true
    fi
    SOCK_GROUP=$(getent group "$SOCK_GID" | cut -d: -f1)
    # Use adduser instead of addgroup to avoid setgroups issue
    if [ -n "$SOCK_GROUP" ]; then
      adduser nodejs "$SOCK_GROUP" 2>/dev/null || true
    fi
  fi
fi

run_migrations() {
  if [ ! -f /app/sql/run-migrations.sh ]; then
    echo "[entrypoint] Migrations script not found, skipping..."
    return 0
  fi
  if [ -z "${DB_HOST:-}" ] || [ -z "${DB_NAME:-}" ]; then
    echo "[entrypoint] DB_HOST or DB_NAME not set, skipping migrations..."
    return 0
  fi
  
  # CRITICAL: Verify database credentials are available before attempting migration
  if [ -z "${DB_PASSWORD:-}" ] && [ -z "${DB_ADMIN_PASSWORD:-}" ]; then
    echo "[entrypoint] ERROR: Database credentials (DB_PASSWORD or DB_ADMIN_PASSWORD) not set!"
    echo "[entrypoint] Environment variable status:"
    echo "[entrypoint]   DB_HOST=${DB_HOST:-<unset>}"
    echo "[entrypoint]   DB_NAME=${DB_NAME:-<unset>}"
    echo "[entrypoint]   DB_USER=${DB_USER:-<unset>}"
    echo "[entrypoint]   DB_PASSWORD=${DB_PASSWORD:+<set>}"
    echo "[entrypoint]   DB_ADMIN_PASSWORD=${DB_ADMIN_PASSWORD:+<set>}"
    echo "[entrypoint]   AWS_REGION=${AWS_REGION:-<unset>}"
    echo "[entrypoint] The AWS Secrets Manager fetch may have failed or secrets were not properly exported."
    echo "[entrypoint] Verify:"
    echo "[entrypoint]   1. AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are available"
    echo "[entrypoint]   2. EC2 instance IAM role has secretsmanager:GetSecretValue permission"
    echo "[entrypoint]   3. Secret exists: $AWS_SECRET_NAME in region ${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
    exit 1
  fi
  
  echo "[entrypoint] Running database migrations..."
  echo "[entrypoint] Migration parameters:"
  echo "[entrypoint]   DB_HOST=${DB_HOST}"
  echo "[entrypoint]   DB_PORT=${DB_PORT:-5432}"
  echo "[entrypoint]   DB_NAME=${DB_NAME}"
  echo "[entrypoint]   DB_USER=${DB_USER:-shadowcheck_user}"
  MIGRATIONS_DIR=/app/sql/migrations \
  MIGRATION_DB_USER="${DB_ADMIN_USER:-${DB_USER:-shadowcheck_user}}" \
  DB_NAME="${DB_NAME:-shadowcheck_db}" \
  PGPASSWORD="${DB_ADMIN_PASSWORD:-${DB_PASSWORD:-}}" \
  PGHOST="${DB_HOST:-postgres}" \
  PGPORT="${DB_PORT:-5432}" \
    sh /app/sql/run-migrations.sh || {
      echo "[entrypoint] Migration failed — aborting startup"
      exit 1
    }
}

run_migrations

# Use su-exec without setting supplementary groups
exec dumb-init -- su-exec nodejs "$@"
