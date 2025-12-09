# Security Audit - December 3, 2025

## Audit Summary

✅ **PASSED** - No hardcoded secrets in codebase
✅ **PASSED** - All sensitive files excluded from git
✅ **PASSED** - Credentials use keyring or environment variables

## Files Checked

### Excluded from Git (via .gitignore)
- `.env` - Contains actual database password and API keys
- `backup-*.sql` - Contains password hashes
- `*.sqlite` - SQLite database files
- `*password*.py` - Keyring utility scripts
- `*secret*.py` - Secret management scripts
- `scripts/keyring/setup-postgres-keyring.sh` - Keyring setup script
- `*.key`, `*.pem`, `*.p12`, `*.pfx` - Certificate files
- `server.log`, `nohup.out` - May contain sensitive runtime data

### Safe in Repository
- `.env.example` - Template with placeholder values only
- `server.js` - Uses `process.env.*` for all secrets
- `scripts/import/*.js` - Uses keyring retrieval functions
- All other source files - No hardcoded credentials

## Credential Management

### Current Implementation
All credentials are retrieved via:

1. **Environment Variables** (`.env` file, not in git)
   ```javascript
   const dbPassword = process.env.DB_PASSWORD;
   const mapboxToken = process.env.MAPBOX_TOKEN;
   ```

2. **System Keyring** (Linux Secret Service)
   ```javascript
   const password = getKeyringPassword('postgres_password');
   ```

### Credentials Inventory

#### Database
- `DB_PASSWORD` - PostgreSQL password (in .env, not in git)
- Stored in keyring as: `shadowcheck/postgres_password`

#### API Keys
- `MAPBOX_TOKEN` - Mapbox API token (in .env, not in git)
- `API_KEY` - Internal API authentication (in .env, not in git)

#### Optional APIs (not yet configured)
- `OPENCAGE_API_KEY` - OpenCage geocoding
- `LOCATIONIQ_API_KEY` - LocationIQ geocoding
- `ABSTRACT_API_KEY` - Abstract API geocoding

#### WiGLE API (not yet configured)
- Multiple API keys needed for rate limiting
- Should be stored in keyring
- Format: `wigle_api_key_1`, `wigle_api_key_2`, etc.

## Recommendations for Admin Settings Page

### Required Features

1. **Secrets Management**
   - Store all API keys in system keyring (NOT database)
   - Use Node.js `keytar` package for keyring access
   - Never display full keys (show masked: `sk_live_****1234`)
   - Validate keys before saving

2. **WiGLE API Configuration**
   - Support multiple API keys (for rate limit rotation)
   - Store as: `shadowcheck/wigle_api_key_1`, `shadowcheck/wigle_api_key_2`, etc.
   - Store API names as: `shadowcheck/wigle_api_name_1`, etc.
   - Test connectivity before saving

3. **Mapbox Configuration**
   - Store token in keyring: `shadowcheck/mapbox_token`
   - Validate token with test API call
   - Show usage statistics if available

4. **Database Backup/Restore**
   - Export to encrypted archive
   - Import from encrypted archive
   - Never include credentials in exports

5. **Export Formats**
   - GeoJSON (observations with coordinates)
   - JSON (full data export)
   - CSV (tabular data)
   - All exports should exclude sensitive data

### Security Requirements

1. **Authentication**
   - Admin page requires authentication
   - Use existing `requireAuth` middleware
   - Session timeout after inactivity

2. **Audit Logging**
   - Log all settings changes
   - Log all secret access attempts
   - Store in `app.audit_log` table

3. **Encryption**
   - All secrets in keyring (encrypted by OS)
   - Database backups encrypted with password
   - Export files encrypted if they contain sensitive data

4. **Access Control**
   - Only admin users can access settings
   - Separate read/write permissions
   - Two-factor authentication recommended

## Implementation Plan

### Phase 1: Keyring Integration
- [ ] Install `keytar` npm package
- [ ] Create keyring service wrapper
- [ ] Migrate existing .env secrets to keyring
- [ ] Update server.js to read from keyring

### Phase 2: Admin Settings UI
- [ ] Create `/admin/settings` page
- [ ] Add authentication middleware
- [ ] Build settings form (API keys, tokens)
- [ ] Implement save/retrieve from keyring

### Phase 3: WiGLE Integration
- [ ] Research WiGLE API v2 and v3 alpha
- [ ] Implement multi-key rotation
- [ ] Add rate limiting logic
- [ ] Test with real API keys

### Phase 4: Backup/Export
- [ ] Database backup functionality
- [ ] Database restore functionality
- [ ] GeoJSON export
- [ ] CSV export

## Testing Checklist

- [ ] Verify no secrets in `git log`
- [ ] Verify no secrets in `git diff`
- [ ] Test keyring read/write
- [ ] Test API key validation
- [ ] Test backup encryption
- [ ] Test export data sanitization
- [ ] Penetration test admin page
- [ ] Audit log verification

## Current Status

✅ **Codebase Clean** - No hardcoded secrets
✅ **Git Clean** - All sensitive files excluded
✅ **Commit Safe** - Latest commit contains no secrets
⚠️ **Admin Page** - Not yet implemented
⚠️ **Keyring Migration** - Still using .env for some secrets
⚠️ **WiGLE API** - Not yet configured

## Next Steps

1. Implement admin settings page with keyring integration
2. Research WiGLE API authentication (v2 and v3 alpha)
3. Migrate all .env secrets to keyring
4. Add audit logging for all settings changes
5. Implement backup/restore with encryption
