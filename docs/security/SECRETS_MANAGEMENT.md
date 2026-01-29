# Secrets Management

> **Consolidated from**: SECRETS_IMPLEMENTATION_GUIDE.md, SECRETS_IMPLEMENTATION_SUMMARY.md, SECRETS_QUICK_REF.md

## Overview

ShadowCheck uses a multi-layered secrets management system that prioritizes security while maintaining developer convenience.

## Architecture

**Secret Loading Priority** (highest to lowest):
1. **Docker Secrets** (`/run/secrets/*`) - Production deployments
2. **System Keyring** (via `keytar`) - Local development
3. **Environment Variables** (`.env`) - CI/CD fallback

Implementation: `server/src/services/secretsManager.js`

## Required Secrets

- `db_password` - PostgreSQL database password (shadowcheck_user)
- `db_admin_password` - PostgreSQL admin password (shadowcheck_admin)
- `mapbox_token` - Mapbox GL JS API token for maps

## Optional Secrets

- `api_key` - API authentication key (enables endpoint protection)
- `wigle_api_key` / `wigle_api_token` - WiGLE network database integration
- `locationiq_api_key` - LocationIQ geocoding service
- `opencage_api_key` - OpenCage geocoding service

## Quick Reference

### Using Keyring (Development)

```bash
# Set secrets (JavaScript)
node scripts/set-secret.js db_password "your-password"
node scripts/set-secret.js db_admin_password "your-admin-password"
node scripts/set-secret.js mapbox_token "pk.your-token"

# List all stored secrets (Python)
python3 scripts/keyring/list-keyring-items.py

# Get a specific secret (Python)
python3 scripts/keyring/get-keyring-password.py db_password

# Setup keyring for PostgreSQL (Shell)
bash scripts/keyring/setup-postgres-keyring.sh
```

### Programmatic Access

```javascript
const secretsManager = require('../services/secretsManager');

// Get optional secret (returns null if not found)
const apiKey = secretsManager.get('api_key');
if (apiKey) {
  // Use API key
}

// Get required secret (throws error if not found)
const dbPassword = secretsManager.getOrThrow('db_password');
```

### Docker Secrets (Production)

**docker-compose.yml**:
```yaml
services:
  api:
    secrets:
      - db_password
      - mapbox_token
      - api_key

secrets:
  db_password:
    file: ./secrets/db_password.txt
  mapbox_token:
    file: ./secrets/mapbox_token.txt
  api_key:
    file: ./secrets/api_key.txt
```

**Create secret files**:
```bash
mkdir -p secrets
echo "your-db-password" > secrets/db_password.txt
echo "pk.your-mapbox-token" > secrets/mapbox_token.txt
chmod 600 secrets/*
```

**Docker secrets location inside container**: `/run/secrets/secret_name`

### Environment Variables (Fallback)

**For CI/CD or local testing only**:

`.env`:
```env
DB_PASSWORD=your_password_here
MAPBOX_TOKEN=pk.your_token_here
API_KEY=your_api_key_here
```

⚠️ **Never commit .env files to version control**

## Validation

Secrets are validated at application startup:
- `server/src/utils/validateSecrets.js` checks for required secrets
- Application exits with error if required secrets are missing
- Error messages indicate which secrets are missing and where to configure them

## Security Best Practices

### ✅ DO
- Use system keyring for local development
- Use Docker secrets for production
- Use environment variables only for CI/CD
- Rotate secrets regularly
- Use strong, randomly generated passwords
- Restrict file permissions on secret files (`chmod 600`)

### ❌ DON'T
- Commit `.env` files to git (already in `.gitignore`)
- Hardcode secrets in source code
- Store secrets in Docker images
- Share secrets via email or chat
- Use weak or default passwords
- Commit `secrets/` directory (already in `.gitignore`)

## Troubleshooting

### Secret Not Found
```
Error: Required secret 'db_password' not found
```

**Solutions**:
1. Set via keyring: `node scripts/set-secret.js db_password "password"`
2. Create Docker secret file: `echo "password" > secrets/db_password.txt`

### Keyring Access Denied
```
Error: Access to keyring denied
```

**Linux**: Install libsecret
```bash
sudo apt-get install libsecret-1-dev
```

**macOS**: Use Keychain Access
- Keyring uses macOS Keychain automatically

**Windows**: Use Credential Manager
- Keyring uses Windows Credential Manager automatically

### Docker Secrets Not Loading
```
Error: ENOENT: no such file or directory, open '/run/secrets/db_password'
```

**Check**:
1. Secret files exist in `./secrets/`
2. Secrets are defined in `docker-compose.yml`
3. Service has `secrets:` section
4. Files have correct permissions

## Migration Guide

### From Environment Variables to Keyring

```bash
# 1. Read current values from .env
source .env

# 2. Store in keyring
echo $DB_PASSWORD | node -e "
  const keytar = require('keytar');
  const password = require('fs').readFileSync(0, 'utf-8').trim();
  keytar.setPassword('shadowcheck', 'db_password', password);
  console.log('✓ db_password stored in keyring');
"

# 3. Remove from .env
sed -i '/^DB_PASSWORD=/d' .env

# 4. Restart server
npm run dev
```

### From Keyring to Docker Secrets

```bash
# 1. Export from keyring to file
# Use set-secret.js to manage keys, or direct keytar scripts
node scripts/set-secret.js db_password "your-value"
...
```

## Implementation Details

### Secret Sources

**1. Docker Secrets** (`/run/secrets/`):
```javascript
// Loaded from files in /run/secrets/
const fs = require('fs');
const secretPath = `/run/secrets/${key}`;
if (fs.existsSync(secretPath)) {
  return fs.readFileSync(secretPath, 'utf8').trim();
}
```

**2. System Keyring**:
```javascript
const keytar = require('keytar');
const password = await keytar.getPassword('shadowcheck', key);
```

**3. Environment Variables**:
```javascript
const value = process.env[key.toUpperCase()];
```

### Startup Validation

`server/src/utils/validateSecrets.js`:
```javascript
async function validateSecrets() {
  const required = ['db_password', 'mapbox_token'];

  for (const secret of required) {
    if (!secretsManager.get(secret)) {
      throw new Error(`Required secret '${secret}' not found`);
    }
  }
}
```

### File-based Keyring Fallback

If system keyring is unavailable (e.g., headless Linux), a file-based fallback is used:
- Location: `.keyring/secrets.json`
- Encrypted with machine-specific key
- Automatically created on first use
- ⚠️ Less secure than system keyring, use only when necessary

## See Also

- [Security Policy](../SECURITY.md)
- [Production Deployment](../deployment/PRODUCTION.md)
- [Environment Configuration](../DEVELOPMENT.md#configure-environment)
