# Secrets Management

**Wiki reference (diagrams):** [Security](../.github/wiki/Security.md)

ShadowCheck uses **AWS Secrets Manager** as the single source of truth for secrets.
Secrets are never written to disk.

## Architecture

**Single Source of Truth:** AWS Secrets Manager
**Runtime Loading:** `secretsManager` resolves secrets at runtime
**Local Overrides:** Environment variables only (explicit, non-persistent)

## Required Secrets

- `db_password` - PostgreSQL password
- `session_secret` - Express session secret
- `mapbox_token` - Mapbox API token

## Optional Secrets

- `admin_app_password`
- `wigle_api_key`
- `wigle_api_token`
- `opencage_api_key`
- `locationiq_api_key`
- `google_maps_api_key`

## Runtime Usage

```js
const secretsManager = require('./services/secretsManager');
const dbPassword = secretsManager.getOrThrow('db_password');
```

## Development Setup

Use environment variables only for local dev overrides:

```bash
export DB_PASSWORD=...
export SESSION_SECRET=...
export MAPBOX_TOKEN=...
```

## Security Guarantees

- **No disk storage:** Secrets are never written to files.
- **Runtime-only:** Secrets are loaded from AWS SM or env vars.
- **No hardcoded values:** Secrets are never committed to the repo.

## Troubleshooting

### AWS Secrets Manager Access Denied

- Ensure the IAM role/user has access to the secret.
- Verify the AWS region configuration.
- Use environment variables only for explicit local overrides.
