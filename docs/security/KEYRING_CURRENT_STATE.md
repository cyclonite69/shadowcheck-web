# Keyring Current State - Audit Report

**Date:** 2025-12-05  
**Auditor:** Secrets Management Review  
**Status:** ⚠️ PARTIAL IMPLEMENTATION

---

## Executive Summary

The application has a **file-based encrypted keyring** system for API keys, but it's **not consistently used**. Most API keys still come from environment variables, creating a mixed approach that reduces security.

**Key Findings:**

- ✅ Encryption: AES-256-GCM with machine-specific key derivation
- ⚠️ Coverage: Only WiGLE and Mapbox have keyring support
- ❌ Consistency: Most code still uses `process.env.*` directly
- ❌ Docker: No Docker secrets support
- ❌ Validation: No startup checks for required secrets

---

## 1. Current Keyring Implementation

### File Location

```
~/.local/share/shadowcheck/keyring.enc
```

**Permissions:** 0600 (owner read/write only)  
**Directory Permissions:** 0700 (owner only)

### Encryption Details

**Algorithm:** AES-256-GCM (Authenticated Encryption)

**Key Derivation:**

```javascript
function getMachineKey() {
  const machineId = os.hostname() + os.userInfo().username;
  return crypto.scryptSync(machineId, 'shadowcheck-salt', 32);
}
```

**Strengths:**

- ✅ Authenticated encryption (prevents tampering)
- ✅ Machine-specific key (can't copy keyring to another machine)
- ✅ Scrypt for key derivation (memory-hard, resistant to brute force)

**Weaknesses:**

- ⚠️ Salt is hardcoded ('shadowcheck-salt')
- ⚠️ Key is deterministic (same machine always generates same key)
- ⚠️ No key rotation mechanism
- ⚠️ Hostname + username is not cryptographically strong

### Storage Format

```
<iv_hex>:<encrypted_data_hex><auth_tag_hex>
```

Example:

```
a1b2c3d4e5f6...:<encrypted_json><16_byte_auth_tag>
```

**Decrypted JSON Structure:**

```json
{
  "wigle_api_name": "username",
  "wigle_api_token": "token123",
  "wigle_api_encoded": "base64_encoded_auth",
  "mapbox_token_default": "pk.ey...",
  "mapbox_primary": "default"
}
```

---

## 2. API Key Inventory

### Currently Managed by Keyring

**WiGLE API (3 keys):**

- `wigle_api_name` - Username
- `wigle_api_token` - API token
- `wigle_api_encoded` - Base64 encoded auth header

**Mapbox (2+ keys):**

- `mapbox_token_<label>` - Token with label
- `mapbox_primary` - Which token is primary

### NOT Managed by Keyring (Still in Environment Variables)

**Application Secrets:**

- `API_KEY` - Application API key for protected endpoints
  - Used in: networks.js, backup.js, export.js, settings.js
  - Purpose: Authentication for admin operations

**Database:**

- `DB_PASSWORD` - PostgreSQL password
  - Used in: server.js, all scripts
  - Purpose: Database authentication

**External APIs:**

- `MAPBOX_TOKEN` - Mapbox API token (fallback if not in keyring)
  - Used in: geospatial.js, geocoding scripts, enrichment scripts
  - Purpose: Geocoding and mapping

- `LOCATIONIQ_API_KEY` - LocationIQ geocoding
  - Used in: enrichment scripts
  - Purpose: Address enrichment

- `OPENCAGE_API_KEY` - OpenCage geocoding
  - Used in: enrichment scripts
  - Purpose: Address enrichment

**Total API Keys:** 7 unique keys  
**In Keyring:** 2 (WiGLE, Mapbox)  
**In Environment:** 5 (API_KEY, DB_PASSWORD, MAPBOX_TOKEN, LOCATIONIQ_API_KEY, OPENCAGE_API_KEY)

---

## 3. Current Flow Diagrams

### Storing a Key

```
User/Script
    ↓
keyringService.setCredential(key, value)
    ↓
Load existing keyring from file (decrypt)
    ↓
Add/update key in JSON object
    ↓
Encrypt JSON with AES-256-GCM
    ↓
Write to ~/.local/share/shadowcheck/keyring.enc
    ↓
Update in-memory cache
```

### Retrieving a Key

```
Application Code
    ↓
keyringService.getCredential(key)
    ↓
Check in-memory cache
    ↓ (if not cached)
Read keyring.enc file
    ↓
Decrypt with machine-specific key
    ↓
Parse JSON
    ↓
Cache in memory
    ↓
Return value (or null if not found)
```

### Mapbox Token Retrieval (with Fallback)

```
geospatial.js requests Mapbox token
    ↓
keyringService.getMapboxToken()
    ↓
Check keyring for mapbox_token_default
    ↓ (if not found)
Check process.env.MAPBOX_TOKEN
    ↓ (if not found)
Return empty string ''
    ↓
API returns 500 error
```

---

## 4. Failure Scenarios

### Scenario 1: Keyring File Missing

**Trigger:** First run or file deleted  
**Behavior:** Returns empty object `{}`  
**Impact:** All keyring.getCredential() calls return null  
**Fallback:** Code falls back to environment variables (if implemented)

### Scenario 2: Decryption Fails

**Trigger:** File corrupted or copied from another machine  
**Behavior:** Throws error, crashes application  
**Impact:** ❌ Application won't start  
**Fallback:** None - fatal error

### Scenario 3: Key Not Found

**Trigger:** Key never stored in keyring  
**Behavior:** Returns null  
**Impact:** Depends on calling code  
**Fallback:** Some code checks env vars, some returns error

### Scenario 4: Environment Variable Missing

**Trigger:** .env file incomplete  
**Behavior:** `process.env.KEY` returns undefined  
**Impact:** Silent failure or runtime error  
**Fallback:** None - code assumes key exists

---

## 5. Key Rotation & Expiration

### Current State

**Key Rotation:** ❌ NOT IMPLEMENTED

- No mechanism to rotate keys
- No versioning of keys
- No audit log of key changes

**Key Expiration:** ❌ NOT IMPLEMENTED

- No expiration dates stored
- No automatic expiration checks
- Keys remain valid indefinitely

**Key Revocation:** ⚠️ PARTIAL

- Can delete keys with `deleteCredential()`
- No revocation list
- No notification of revoked keys

**Audit Logging:** ❌ NOT IMPLEMENTED

- No log of key access
- No log of key modifications
- Can't detect unauthorized access

---

## 6. Endpoint Usage Analysis

### Endpoints Using API Keys

**Protected Endpoints (require API_KEY):**

- `POST /api/tag-network` - Tag network as threat
- `DELETE /api/tag-network/:bssid` - Remove tag
- `GET /api/backup` - Backup database
- `POST /api/restore` - Restore database
- `GET /api/export/*` - Export data
- `GET /api/settings/*` - Settings management

**External API Endpoints:**

- `GET /api/mapbox-token` - Returns Mapbox token to frontend
  - Uses: `process.env.MAPBOX_TOKEN` (no keyring check)
  - Risk: Token exposed to frontend

**Background Scripts:**

- Geocoding scripts - Use MAPBOX_TOKEN
- Enrichment scripts - Use LOCATIONIQ_API_KEY, OPENCAGE_API_KEY
- Import scripts - Use DB_PASSWORD

---

## 7. Security Issues

### Critical Issues

❌ **Mixed Secret Sources**

- Some keys in keyring, some in env vars
- Inconsistent security posture
- Developers don't know where to look

❌ **No Docker Secrets Support**

- Can't use Docker secrets in production
- Must pass secrets via environment variables
- Secrets visible in `docker inspect`

❌ **Mapbox Token Exposed to Frontend**

- Token sent to browser in API response
- Can be extracted by users
- No rate limiting per token

❌ **No Startup Validation**

- App starts even if critical keys missing
- Fails at runtime with cryptic errors
- No clear error messages

### Medium Issues

⚠️ **Weak Key Derivation**

- Hostname + username is predictable
- No random salt per installation
- Same machine always generates same key

⚠️ **No Audit Logging**

- Can't detect unauthorized key access
- Can't track key usage
- No compliance trail

⚠️ **No Key Rotation**

- Keys never expire
- Can't rotate compromised keys
- No versioning

### Low Issues

⚠️ **Cache Never Invalidates**

- Keys cached in memory forever
- Can't update keys without restart
- Stale keys if file modified externally

---

## 8. Comparison: Keyring vs Environment Variables

| Feature                    | Keyring              | Environment Variables |
| -------------------------- | -------------------- | --------------------- |
| Encryption at rest         | ✅ Yes (AES-256-GCM) | ❌ No (plaintext)     |
| Visible in process list    | ✅ No                | ❌ Yes (`ps aux`)     |
| Visible in Docker inspect  | ✅ No                | ❌ Yes                |
| Visible in logs            | ✅ No                | ⚠️ Depends            |
| Machine-specific           | ✅ Yes               | ❌ No                 |
| Easy to rotate             | ⚠️ Manual            | ⚠️ Manual             |
| Docker secrets support     | ❌ No                | ❌ No                 |
| Kubernetes secrets support | ❌ No                | ✅ Yes                |
| Cloud provider secrets     | ❌ No                | ✅ Yes (via env)      |

---

## 9. Recommendations

### Immediate (Must Fix)

1. **Extend keyring to all API keys**
   - Move API_KEY to keyring
   - Move LOCATIONIQ_API_KEY to keyring
   - Move OPENCAGE_API_KEY to keyring
   - Keep DB_PASSWORD in env (needed before keyring loads)

2. **Add Docker secrets support**
   - Check `/run/secrets/*` first
   - Fall back to keyring
   - Fall back to environment variables

3. **Add startup validation**
   - Check all required secrets present
   - Fail loudly if missing
   - Clear error messages

4. **Stop exposing Mapbox token to frontend**
   - Proxy Mapbox API through backend
   - Or use restricted tokens per user

### Short-term (Should Fix)

5. **Add audit logging**
   - Log when keys accessed
   - Log when keys modified
   - Store in separate audit log file

6. **Improve key derivation**
   - Add random salt per installation
   - Store salt in separate file
   - Use PBKDF2 or Argon2

7. **Add key rotation support**
   - Version keys (key_v1, key_v2)
   - Support multiple active versions
   - Automatic expiration

### Long-term (Nice to Have)

8. **Integrate with cloud secret managers**
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Secret Manager

9. **Add key expiration**
   - Store expiration date with key
   - Automatic expiration checks
   - Notification before expiration

10. **Add key revocation list**
    - Track revoked keys
    - Prevent use of revoked keys
    - Sync revocation list

---

## 10. Migration Path

### Phase 1: Extend Keyring (Current)

- Add all API keys to keyring
- Maintain env var fallback
- Update documentation

### Phase 2: Docker Secrets

- Add Docker secrets support
- Update docker-compose.yml
- Test in staging

### Phase 3: Validation

- Add startup validation
- Fail if secrets missing
- Clear error messages

### Phase 4: Audit & Rotation

- Add audit logging
- Add key rotation
- Add expiration

---

## Conclusion

The current keyring system is **well-designed but underutilized**. The encryption is solid (AES-256-GCM), but only 2 of 7 API keys use it. The biggest gaps are:

1. ❌ No Docker secrets support
2. ❌ Inconsistent usage (mixed with env vars)
3. ❌ No startup validation
4. ❌ No audit logging

**Recommendation:** Proceed with Phase 2 (extend keyring) and Phase 3 (Docker secrets) immediately.

---

**Audit Completed:** 2025-12-05  
**Next Steps:** Implement KEYRING_ARCHITECTURE.md design
