# Secrets Management Implementation Guide

## Overview

ShadowCheck uses a 3-tier secrets management system with automatic fallback:

1. **Docker Secrets** (Production) - `/run/secrets/*`
2. **System Keyring** (Development) - Encrypted local storage
3. **Environment Variables** (Fallback) - `.env` file

## Required Secrets

- `db_password` - PostgreSQL database password
- `mapbox_token` - Mapbox API token (must start with `pk.`)

## Optional Secrets

- `api_key` - API authentication key for protected endpoints
- `wigle_api_key` - WiGLE API key
- `wigle_api_token` - WiGLE API token
- `locationiq_api_key` - LocationIQ geocoding API key
- `opencage_api_key` - OpenCage geocoding API key

## Setup Methods

### Method 1: Docker Secrets (Production)

1. Create secrets directory:
```bash
mkdir -p secrets
chmod 700 secrets
```

2. Create secret files:
```bash
echo "your_db_password" > secrets/db_password.txt
echo "pk.your_mapbox_token" > secrets/mapbox_token.txt
echo "your_api_key" > secrets/api_key.txt
chmod 600 secrets/*.txt
```

3. Start with docker-compose:
```bash
docker-compose up -d
```

Secrets are automatically mounted to `/run/secrets/` in the container.

### Method 2: System Keyring (Development)

1. Install keyring dependencies (if not already installed):
```bash
npm install
```

2. Set secrets using keyring CLI:
```bash
node scripts/keyring-cli.js set db_password
node scripts/keyring-cli.js set mapbox_token
node scripts/keyring-cli.js set api_key
```

3. Verify secrets:
```bash
node scripts/keyring-cli.js list
```

4. Start server:
```bash
npm start
```

### Method 3: Environment Variables (Development Only)

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` and uncomment/set secrets:
```bash
DB_PASSWORD=your_secure_password
MAPBOX_TOKEN=pk.your_mapbox_token
API_KEY=your_api_key
```

3. Start server:
```bash
npm start
```

**⚠️ Warning:** Environment variables in production will trigger a warning. Use Docker secrets or keyring instead.

## Startup Validation

The server validates all required secrets on startup:

```
[SecretsManager] Loading secrets...
[SecretsManager] ✓ db_password loaded from keyring
[SecretsManager] ✓ mapbox_token loaded from docker
[SecretsManager] ⚠ api_key not found (optional)
[SecretsManager] Loaded 2/7 secrets
✓ Database connected successfully
✓ Server listening on port 3001
```

If a required secret is missing, the server will exit with a helpful error:

```
❌ SECRETS VALIDATION FAILED

Required secret 'db_password' not found.
Tried: Docker secrets (/run/secrets/db_password), 
       Keyring (db_password), 
       Environment (DB_PASSWORD)
Hint: Set DB_PASSWORD in .env or add to keyring with: 
      node scripts/keyring-cli.js set db_password

Server cannot start without required secrets.
```

## Security Best Practices

### Production

1. **Use Docker secrets** - Never use environment variables in production
2. **Rotate secrets regularly** - Update secret files and restart containers
3. **Restrict file permissions** - `chmod 600` on all secret files
4. **Use secret scanning** - Enable GitHub secret scanning
5. **Audit access logs** - Monitor `secretsManager.getAccessLog()`

### Development

1. **Use keyring** - Encrypted storage, better than `.env`
2. **Never commit secrets** - `.env` is in `.gitignore`
3. **Use separate secrets** - Don't reuse production secrets locally
4. **Validate tokens** - Mapbox tokens should start with `pk.`

## Troubleshooting

### Server won't start - "Required secret not found"

Check each tier in order:

1. **Docker secrets:**
```bash
ls -la /run/secrets/
cat /run/secrets/db_password
```

2. **Keyring:**
```bash
node scripts/keyring-cli.js list
node scripts/keyring-cli.js get db_password
```

3. **Environment:**
```bash
grep DB_PASSWORD .env
echo $DB_PASSWORD
```

### Mapbox token warning

If you see: `⚠ MAPBOX_TOKEN should start with "pk."`

Your token is likely a secret token (starts with `sk.`). Use a public token instead:
- Go to https://account.mapbox.com/access-tokens/
- Create a new public token (starts with `pk.`)
- Update your secret

### Production environment variable warning

If you see: `⚠ db_password loaded from env vars in production`

This means you're running `NODE_ENV=production` but using `.env` file. Switch to Docker secrets:

1. Create `secrets/db_password.txt`
2. Update `docker-compose.yml` to mount secrets
3. Restart container

## API Usage

### In Route Handlers

```javascript
const secretsManager = require('../../../services/secretsManager');

router.get('/example', async (req, res) => {
  // Get optional secret (returns null if not found)
  const apiKey = secretsManager.get('api_key');
  
  // Get required secret (throws if not found)
  const dbPassword = secretsManager.getOrThrow('db_password');
  
  // Check if secret exists
  if (secretsManager.has('wigle_api_key')) {
    // Use WiGLE API
  }
  
  // Get secret source (for debugging)
  const source = secretsManager.getSource('mapbox_token');
  console.log(`Mapbox token loaded from: ${source}`); // 'docker', 'keyring', or 'env'
});
```

### Access Logging

Secrets manager logs all access attempts (but not values):

```javascript
const log = secretsManager.getAccessLog();
console.log(log);
// [
//   { secret: 'db_password', timestamp: '2025-12-06T04:56:00Z', found: true },
//   { secret: 'api_key', timestamp: '2025-12-06T04:56:01Z', found: false }
// ]
```

## Migration from Old System

If you're migrating from direct `process.env` usage:

### Before
```javascript
const token = process.env.MAPBOX_TOKEN;
const password = process.env.DB_PASSWORD;
```

### After
```javascript
const secretsManager = require('../services/secretsManager');
const token = secretsManager.get('mapbox_token');
const password = secretsManager.getOrThrow('db_password');
```

All routes have been updated to use `secretsManager`. No changes needed to existing secrets storage.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Startup                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              validateSecrets() - src/utils/                  │
│  • Calls secretsManager.load()                              │
│  • Exits if required secrets missing                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           SecretsManager.load() - src/services/              │
│  For each secret:                                           │
│    1. Try /run/secrets/{name}                               │
│    2. Try keyringService.getCredential(name)                │
│    3. Try process.env.{NAME}                                │
│    4. Throw if required and not found                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server Starts                             │
│  • Database pool uses secretsManager.get('db_password')     │
│  • Routes use secretsManager.get('mapbox_token')            │
│  • Auth middleware uses secretsManager.get('api_key')       │
└─────────────────────────────────────────────────────────────┘
```

## Testing

Run the test suite:

```bash
npm test -- src/services/secretsManager.test.js
```

Test startup validation:

```bash
# Should fail - no secrets
unset DB_PASSWORD MAPBOX_TOKEN
npm start

# Should succeed - env vars
export DB_PASSWORD=test
export MAPBOX_TOKEN=pk.test
npm start

# Should succeed - keyring
node scripts/keyring-cli.js set db_password
node scripts/keyring-cli.js set mapbox_token
npm start
```

## Support

For issues or questions:
1. Check logs: `[SecretsManager]` prefix
2. Verify secret sources: `secretsManager.getSource(name)`
3. Check access log: `secretsManager.getAccessLog()`
4. Review this guide's troubleshooting section
