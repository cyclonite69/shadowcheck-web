# Secrets Management

ShadowCheck uses a keyring-based secrets management system with zero hardcoded credentials.

## Architecture

**Single Source of Truth:** System keyring (encrypted at rest)
**Machine ID:** `hostname-username` stored in `~/.shadowcheck-machine-id`
**Auto-generation:** Required secrets generated on first run
**Admin UI:** Optional secrets entered via admin page

## Required Secrets (Auto-Generated)

- `db_password` - PostgreSQL password
- `session_secret` - Express session secret

## Optional Secrets (Admin UI)

- `mapbox_token` - Mapbox API token
- `wigle_api_key` - WiGLE API key
- `wigle_api_token` - WiGLE API token
- `opencage_api_key` - OpenCage Geocoding API key
- `locationiq_api_key` - LocationIQ API key
- `google_maps_api_key` - Google Maps API key

## Bootstrap (First Deployment)

```bash
# Auto-generates required secrets and stores in keyring
npx tsx scripts/bootstrap-secrets.ts
```

This creates:
- `~/.shadowcheck-machine-id` - Encryption key
- Keyring entries for `db_password` and `session_secret`

## Manual Secret Management

### Set a secret
```bash
node scripts/set-secret.js mapbox_token pk.your_token_here
```

### Get a secret
```bash
node scripts/get-secret.js db_password
```

### List secrets (via API)
```bash
curl http://localhost:3001/api/admin/secrets
```

## Deployment Integration

### Local Development
```bash
# Bootstrap once
npx tsx scripts/bootstrap-secrets.ts

# Load secrets and start
source scripts/load-secrets.sh
npm start
```

### AWS Deployment
```bash
# Secrets are auto-bootstrapped on first deploy
./deploy/aws/scripts/scs_rebuild.sh
```

The deployment script:
1. Checks for machine ID
2. Bootstraps secrets if missing
3. Loads secrets from keyring
4. Exports as environment variables
5. Passes to docker-compose

### Docker Compose
```yaml
environment:
  DB_PASSWORD: ${DB_PASSWORD}  # From keyring
  SESSION_SECRET: ${SESSION_SECRET}  # From keyring
  KEYRING_MACHINE_ID: ${KEYRING_MACHINE_ID}  # For container access
```

## Admin UI

Navigate to `/admin` → "Secrets Management"

- View which secrets are configured
- Add/update optional secrets
- Delete non-required secrets

## Security

- **Encryption:** Secrets encrypted with machine-specific key
- **No disk storage:** Never written to files (except encrypted keyring)
- **Container isolation:** Containers access keyring read-only via volume mount
- **Machine ID binding:** Secrets can only be decrypted on the machine that created them

## Troubleshooting

### "Machine ID not found"
```bash
npx tsx scripts/bootstrap-secrets.ts
```

### "Secret not found"
```bash
# Check if bootstrap ran
ls -la ~/.shadowcheck-machine-id

# Re-bootstrap
npx tsx scripts/bootstrap-secrets.ts
```

### Container can't decrypt secrets
```bash
# Verify machine ID matches
cat ~/.shadowcheck-machine-id
echo $KEYRING_MACHINE_ID

# Should be identical
```

### Reset all secrets
```bash
rm ~/.shadowcheck-machine-id
rm -rf ~/.local/share/shadowcheck/
npx tsx scripts/bootstrap-secrets.ts
```

## Migration from Old System

If you have secrets in `.env` or docker-compose:

```bash
# 1. Bootstrap new system
npx tsx scripts/bootstrap-secrets.ts

# 2. Migrate optional secrets
node scripts/set-secret.js mapbox_token $(grep MAPBOX_TOKEN .env | cut -d= -f2)

# 3. Remove from .env
sed -i '/MAPBOX_TOKEN/d' .env

# 4. Redeploy
./deploy/aws/scripts/scs_rebuild.sh
```
