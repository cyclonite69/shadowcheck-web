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
    return 0
  fi

  _REGION_ARG=""
  _RESOLVED_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
  if [ -n "$_RESOLVED_REGION" ]; then _REGION_ARG="--region $_RESOLVED_REGION"; fi
  export SECRET_JSON=$(aws secretsmanager get-secret-value \
    $_REGION_ARG \
    --secret-id "$AWS_SECRET_NAME" \
    --query SecretString \
    --output text 2>/dev/null || true)

  if [ -z "$SECRET_JSON" ] || [ "$SECRET_JSON" = "None" ]; then
    return 0
  fi

  EXPORTS=$(SECRET_JSON="$SECRET_JSON" node -e '
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
  ')

  if [ -n "$EXPORTS" ]; then
    set -a
    eval "$EXPORTS"
    set +a
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
    return 0
  fi
  if [ -z "${DB_HOST:-}" ] || [ -z "${DB_NAME:-}" ]; then
    return 0
  fi
  echo "[entrypoint] Running database migrations..."
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
