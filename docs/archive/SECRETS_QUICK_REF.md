# Secrets Management - Quick Reference

## 3-Tier Fallback System

```
1. Docker Secrets (/run/secrets/*)     [PRODUCTION]
         ↓ (if not found)
2. System Keyring (encrypted)          [DEVELOPMENT]
         ↓ (if not found)
3. Environment Variables (.env)        [FALLBACK]
```

## Setup Commands

### Docker Secrets (Production)
```bash
mkdir -p secrets && chmod 700 secrets
echo "your_password" > secrets/db_password.txt
echo "pk.your_token" > secrets/mapbox_token.txt
chmod 600 secrets/*.txt
docker-compose up -d
```

### Keyring (Development)
```bash
node scripts/keyring-cli.js set db_password
node scripts/keyring-cli.js set mapbox_token
node scripts/keyring-cli.js list
npm start
```

### Environment Variables (Fallback)
```bash
cp .env.example .env
# Edit .env and set:
# DB_PASSWORD=your_password
# MAPBOX_TOKEN=pk.your_token
npm start
```

## API Usage

```javascript
const secretsManager = require('../services/secretsManager');

// Get optional secret (returns null if missing)
const apiKey = secretsManager.get('api_key');

// Get required secret (throws if missing)
const password = secretsManager.getOrThrow('db_password');

// Check if secret exists
if (secretsManager.has('wigle_api_key')) {
  // Use WiGLE API
}

// Get secret source (for debugging)
const source = secretsManager.getSource('mapbox_token');
// Returns: 'docker', 'keyring', or 'env'
```

## Required Secrets

| Secret | Description | Format |
|--------|-------------|--------|
| `db_password` | PostgreSQL password | Any string |
| `mapbox_token` | Mapbox API token | Must start with `pk.` |

## Optional Secrets

| Secret | Description |
|--------|-------------|
| `api_key` | API authentication key |
| `wigle_api_key` | WiGLE API key |
| `wigle_api_token` | WiGLE API token |
| `locationiq_api_key` | LocationIQ geocoding key |
| `opencage_api_key` | OpenCage geocoding key |

## Troubleshooting

### Server won't start
```bash
# Check each tier:
ls -la /run/secrets/                    # Docker
node scripts/keyring-cli.js list        # Keyring
grep DB_PASSWORD .env                   # Environment
```

### Mapbox token warning
```
⚠ MAPBOX_TOKEN should start with "pk."
```
**Fix:** Use public token (pk.*), not secret token (sk.*)

### Production warning
```
⚠ db_password loaded from env vars in production
```
**Fix:** Use Docker secrets or keyring instead of .env

## Testing

```bash
# Run unit tests
npm test -- tests/unit/secretsManager.test.js

# Test server startup
npm start
```

## Files

- `src/services/secretsManager.js` - Core module
- `src/utils/validateSecrets.js` - Startup validation
- `SECRETS_IMPLEMENTATION_GUIDE.md` - Full documentation
- `secrets/` - Docker secrets directory (gitignored)

## Security Checklist

- [ ] Secrets in Docker secrets or keyring (not .env in production)
- [ ] `secrets/` directory has 700 permissions
- [ ] Secret files have 600 permissions
- [ ] `.env` is in `.gitignore`
- [ ] Mapbox token starts with `pk.`
- [ ] Strong database password (32+ chars)

## Migration

### From .env to Keyring
```bash
# Set in keyring
node scripts/keyring-cli.js set db_password
# Remove from .env
sed -i '/DB_PASSWORD/d' .env
```

### From .env to Docker
```bash
# Create secret file
grep DB_PASSWORD .env | cut -d= -f2 > secrets/db_password.txt
chmod 600 secrets/db_password.txt
# Remove from .env
sed -i '/DB_PASSWORD/d' .env
```

## Support

Full documentation: `SECRETS_IMPLEMENTATION_GUIDE.md`
