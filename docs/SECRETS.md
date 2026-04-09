# Secrets Management

ShadowCheck uses **AWS Secrets Manager** as the single source of truth for all sensitive credentials (database passwords, API tokens, etc.). Secrets are never written to disk and are resolved at runtime.

## Core Mandates

- **No Secrets on Disk**: Never commit `.env` files with real credentials or write secrets to local configuration files.
- **Runtime Resolution**: Use `server/src/services/secretsManager.ts` to fetch secrets from AWS at application startup.
- **Local Overrides**: For local development only, environment variables (e.g., `DB_PASSWORD`) can be used as explicit overrides.

## Required Secret Keys

Provision these keys in your AWS Secrets Manager secret (default: `shadowcheck/config`):

| Secret Key | Description |
| :--- | :--- |
| `db_password` | Standard database user password. |
| `db_admin_password` | Admin database role password (required for migrations). |
| `mapbox_token` | Mapbox GL JS access token. |
| `wigle_api_token` | WiGLE API v2 bearer token. |

## Accessing Secrets

### Backend (Node.js)
```typescript
import secretsManager from './services/secretsManager';
const dbPassword = secretsManager.get('db_password');
```

### Scripts (Bash)
Use `aws secretsmanager get-secret-value` with `jq` to parse the `SecretString`.

## Rotation Policy

- **Schedule**: Database and API secrets should be rotated every 90 days.
- **Automation**: Use `deploy/aws/scripts/rotate-grafana-passwords.sh` for monitoring credentials.
- **Database Rotation**: Use `./scripts/rotate-db-password.sh` for `db_password`, and `--rotate-admin` when `db_admin_password` must change too.
- **Incident Response**: If a secret is ever committed, treat it as exposed immediately. Rewrite history if needed, but rotate the secret regardless.

## Enforcement

- Husky runs local pre-commit secret scanning.
- CI runs `npm run policy:secrets` and `gitleaks` on push / pull request.
- CI also runs a scheduled full-history secret scan.

## Security Audit
All data-modifying scripts (`scs_rebuild.sh`, `deploy-postgres.sh`) are audited to ensure they do not log or persist decrypted secret values to the filesystem or terminal history.
