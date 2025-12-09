# Keyring Architecture - Production Design

**Version:** 2.0  
**Date:** 2025-12-05  
**Status:** Design Complete - Ready for Implementation

---

## Overview

Production-grade secrets management with 3-tier fallback:
1. **Docker Secrets** (production) - `/run/secrets/*`
2. **System Keyring** (local dev) - Encrypted file
3. **Environment Variables** (fallback/testing) - `.env` file

---

## Architecture Diagram

```
Application Startup
    ↓
SecretsManager.initialize()
    ↓
For each required secret:
    ↓
    ├─→ Check Docker Secrets (/run/secrets/*)
    │   ├─→ Found? → Use it ✅
    │   └─→ Not found? → Continue
    ↓
    ├─→ Check System Keyring (~/.local/share/shadowcheck/keyring.enc)
    │   ├─→ Found? → Use it ✅
    │   └─→ Not found? → Continue
    ↓
    ├─→ Check Environment Variables (process.env.*)
    │   ├─→ Found? → Use it ⚠️ (log warning)
    │   └─→ Not found? → FAIL ❌
    ↓
All secrets loaded?
    ├─→ Yes → Start application ✅
    └─→ No → Exit with error ❌
```

---

## Secret Definitions

### Required Secrets (App won't start without these)

**1. DB_PASSWORD**
- **Purpose:** PostgreSQL authentication
- **Format:** String (any characters)
- **Docker Secret:** `/run/secrets/db_password`
- **Keyring Key:** `db_password`
- **Env Var:** `DB_PASSWORD`
- **Used By:** Database connection pool

**2. MAPBOX_TOKEN**
- **Purpose:** Mapbox API authentication
- **Format:** `pk.ey...` (starts with pk.)
- **Docker Secret:** `/run/secrets/mapbox_token`
- **Keyring Key:** `mapbox_token_default`
- **Env Var:** `MAPBOX_TOKEN`
- **Used By:** Geospatial routes, geocoding scripts

### Optional Secrets (App starts without these, features disabled)

**3. API_KEY**
- **Purpose:** Application API authentication
- **Format:** String (recommend 32+ chars)
- **Docker Secret:** `/run/secrets/api_key`
- **Keyring Key:** `api_key`
- **Env Var:** `API_KEY`
- **Used By:** Protected endpoints (tag, backup, export)
- **Behavior if missing:** Authentication disabled (open access)

**4. WIGLE_API_NAME**
- **Purpose:** WiGLE username
- **Format:** String
- **Docker Secret:** `/run/secrets/wigle_api_name`
- **Keyring Key:** `wigle_api_name`
- **Env Var:** `WIGLE_API_NAME`
- **Used By:** WiGLE integration scripts
- **Behavior if missing:** WiGLE features disabled

**5. WIGLE_API_TOKEN**
- **Purpose:** WiGLE API token
- **Format:** String
- **Docker Secret:** `/run/secrets/wigle_api_token`
- **Keyring Key:** `wigle_api_token`
- **Env Var:** `WIGLE_API_TOKEN`
- **Used By:** WiGLE integration scripts
- **Behavior if missing:** WiGLE features disabled

**6. LOCATIONIQ_API_KEY**
- **Purpose:** LocationIQ geocoding
- **Format:** String
- **Docker Secret:** `/run/secrets/locationiq_api_key`
- **Keyring Key:** `locationiq_api_key`
- **Env Var:** `LOCATIONIQ_API_KEY`
- **Used By:** Address enrichment scripts
- **Behavior if missing:** LocationIQ enrichment disabled

**7. OPENCAGE_API_KEY**
- **Purpose:** OpenCage geocoding
- **Format:** String
- **Docker Secret:** `/run/secrets/opencage_api_key`
- **Keyring Key:** `opencage_api_key`
- **Env Var:** `OPENCAGE_API_KEY`
- **Used By:** Address enrichment scripts
- **Behavior if missing:** OpenCage enrichment disabled

---

## Loading Priority & Fallback Chain

### Priority Order (Highest to Lowest)

**1. Docker Secrets** (Production)
```javascript
// Check /run/secrets/<secret_name>
const secretPath = `/run/secrets/${secretName}`;
if (fs.existsSync(secretPath)) {
  return fs.readFileSync(secretPath, 'utf8').trim();
}
```

**Why First:**
- Standard for containerized deployments
- Kubernetes native support
- Docker Swarm native support
- Secrets never in environment or logs

**2. System Keyring** (Local Development)
```javascript
// Check ~/.local/share/shadowcheck/keyring.enc
const value = await keyringService.getCredential(keyName);
if (value) {
  return value;
}
```

**Why Second:**
- Encrypted at rest
- Machine-specific
- Good for local development
- Not suitable for production (file-based)

**3. Environment Variables** (Fallback/Testing)
```javascript
// Check process.env.*
const value = process.env[envVarName];
if (value && value !== 'your-key-here') {
  console.warn(`⚠️  Using ${envVarName} from environment (not recommended for production)`);
  return value;
}
```

**Why Last:**
- Visible in process list
- Visible in Docker inspect
- Easy to leak in logs
- Only for testing/fallback

---

## Error Handling

### Missing Required Secret

```javascript
if (!dbPassword) {
  console.error('❌ FATAL: DB_PASSWORD not found');
  console.error('Checked:');
  console.error('  1. Docker secret: /run/secrets/db_password');
  console.error('  2. System keyring: ~/.local/share/shadowcheck/keyring.enc');
  console.error('  3. Environment variable: DB_PASSWORD');
  console.error('');
  console.error('Set secret using one of:');
  console.error('  Docker: echo "password" | docker secret create db_password -');
  console.error('  Keyring: node scripts/set-secret.js db_password');
  console.error('  Env var: export DB_PASSWORD=your_password');
  process.exit(1);
}
```

### Missing Optional Secret

```javascript
if (!apiKey) {
  console.warn('⚠️  API_KEY not found - authentication disabled');
  console.warn('Protected endpoints will be accessible without authentication');
  console.warn('Set API_KEY to enable authentication');
}
```

### Invalid Secret Format

```javascript
if (mapboxToken && !mapboxToken.startsWith('pk.')) {
  console.error('❌ FATAL: MAPBOX_TOKEN has invalid format');
  console.error('Expected: pk.ey...');
  console.error('Got:', mapboxToken.substring(0, 10) + '...');
  process.exit(1);
}
```

---

## Key Naming Conventions

### Docker Secrets (lowercase with underscores)
```
/run/secrets/db_password
/run/secrets/mapbox_token
/run/secrets/api_key
/run/secrets/wigle_api_name
/run/secrets/wigle_api_token
/run/secrets/locationiq_api_key
/run/secrets/opencage_api_key
```

### Keyring Keys (lowercase with underscores)
```
db_password
mapbox_token_default
api_key
wigle_api_name
wigle_api_token
locationiq_api_key
opencage_api_key
```

### Environment Variables (UPPERCASE with underscores)
```
DB_PASSWORD
MAPBOX_TOKEN
API_KEY
WIGLE_API_NAME
WIGLE_API_TOKEN
LOCATIONIQ_API_KEY
OPENCAGE_API_KEY
```

---

## Rotation Procedure

### Step 1: Generate New Key
```bash
# Generate new API key
openssl rand -hex 32
```

### Step 2: Store New Key (with version)
```bash
# Docker
echo "new_key_value" | docker secret create api_key_v2 -

# Keyring
node scripts/set-secret.js api_key_v2 new_key_value

# Environment
export API_KEY_V2=new_key_value
```

### Step 3: Update Application
```javascript
// Support both versions during transition
const apiKey = await secrets.get('api_key_v2') || await secrets.get('api_key');
```

### Step 4: Verify New Key Works
```bash
curl -H "x-api-key: new_key_value" http://localhost:3001/api/tag-network
```

### Step 5: Revoke Old Key
```bash
# Docker
docker secret rm api_key

# Keyring
node scripts/delete-secret.js api_key

# Environment
unset API_KEY
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create src/services/secretsManager.js
- [ ] Implement Docker secrets reader
- [ ] Implement 3-tier fallback
- [ ] Add startup validation
- [ ] Add error messages

### Phase 2: Integration
- [ ] Update server.js to use SecretsManager
- [ ] Update all route files
- [ ] Update all scripts
- [ ] Remove direct process.env.* access

### Phase 3: Docker Support
- [ ] Update Dockerfile
- [ ] Update docker-compose.yml with secrets
- [ ] Create secrets setup script
- [ ] Test in Docker environment

### Phase 4: Documentation
- [ ] Update .env.example
- [ ] Create DOCKER_SECRETS_SETUP.md
- [ ] Update README.md
- [ ] Create secrets rotation guide

### Phase 5: Testing
- [ ] Unit tests for SecretsManager
- [ ] Integration tests with Docker secrets
- [ ] Test all fallback scenarios
- [ ] Test error messages

---

## Success Criteria

✅ All secrets loaded from Docker secrets in production  
✅ All secrets loaded from keyring in local dev  
✅ Environment variables work as fallback  
✅ Clear error messages if secrets missing  
✅ No secrets in logs or process list  
✅ Secrets can be rotated without code changes  
✅ Audit log of secret access  

---

**Design Status:** ✅ COMPLETE  
**Next Step:** Implement Phase 3 (Docker secrets support)
