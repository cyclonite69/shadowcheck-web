# Admin Settings Guide

## 🚨 FIRST: Revoke Exposed Credentials

Your WiGLE API credentials were exposed. **Revoke them immediately:**

1. Go to: https://wigle.net/account
2. Find "API" section
3. Click "Revoke" or "Delete" on current key
4. Generate new API key
5. Copy the new API Name and API Token

## Access Admin Settings

**URL:** http://localhost:3001/admin

**Authentication:** Requires API key in localStorage

```javascript
localStorage.setItem('shadowcheck_api_key', 'your-secure-random-key-here');
```

## Configure WiGLE API

### Step 1: Enter Credentials

1. Open admin page: http://localhost:3001/admin
2. Enter your **new** WiGLE API Name (starts with `AID`)
3. Enter your **new** WiGLE API Token (32 character hex)
4. Click "Save & Test"

### Step 2: Verify Connection

- Green box = Success ✓
- Red box = Failed (check credentials)

### How It Works

```
User Input → Keyring Service → System Keyring (Encrypted)
                                      ↓
                              Linux Secret Service
                                      ↓
                              Encrypted Storage
```

**Storage locations:**

- `shadowcheck/wigle_api_name` - Your API Name
- `shadowcheck/wigle_api_token` - Your API Token
- `shadowcheck/wigle_api_encoded` - Base64 encoded (for convenience)

## WiGLE API Usage

### Authentication Format

```javascript
const apiName = 'AIDxxxxx...';
const apiToken = 'xxxxxx...';
const encoded = Buffer.from(`${apiName}:${apiToken}`).toString('base64');

fetch('https://api.wigle.net/api/v2/profile/user', {
  headers: {
    Authorization: `Basic ${encoded}`,
    Accept: 'application/json',
  },
});
```

### Test with curl

```bash
curl -i -H 'Accept:application/json' \
  -u YOUR_API_NAME:YOUR_API_TOKEN \
  --basic https://api.wigle.net/api/v2/profile/user
```

### API Endpoints

- **v2 API:** https://api.wigle.net/api/v2/
- **v3 Alpha:** https://api.wigle.net/api/v3/ (if you have access)
- **Docs:** https://api.wigle.net

### Rate Limits

- Default: Limited daily queries
- For increased access: Email WiGLE-admin@wigle.net with username and use case
- Commercial use requires licensing

## Configure Mapbox Token

1. Get token from: https://account.mapbox.com/access-tokens/
2. Enter in admin page
3. Click "Save Token"

**Storage:** `shadowcheck/mapbox_token`

## API Routes

All routes require `X-API-Key` header:

### Get WiGLE Status

```bash
curl -H "X-API-Key: your-key" http://localhost:3001/api/settings/wigle
```

Response:

```json
{
  "configured": true,
  "apiName": "AIDc40fa13...",
  "apiToken": "****5bbb"
}
```

### Set WiGLE Credentials

```bash
curl -X POST -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"apiName":"AIDxxx","apiToken":"xxx"}' \
  http://localhost:3001/api/settings/wigle
```

### Test WiGLE Connection

```bash
curl -H "X-API-Key: your-key" \
  http://localhost:3001/api/settings/wigle/test
```

Response:

```json
{
  "success": true,
  "user": "your_username"
}
```

## Security Features

✅ **Keyring Storage**

- All secrets stored in OS keyring
- Encrypted at rest by Linux Secret Service
- Never in database, files, or git

✅ **Masked Display**

- API keys shown as: `AIDc40fa13...` and `****5bbb`
- Full keys never displayed in UI

✅ **Authentication Required**

- All settings routes require API key
- Unauthorized access returns 401

✅ **No Hardcoded Secrets**

- All credentials via keyring or env vars
- `.env` excluded from git
- `.env.example` provided as template

## Backup & Export (Coming Soon)

### Database Backup

- Encrypted SQL dump
- Excludes credentials
- Password-protected archive

### Export Formats

- **GeoJSON** - Observations with coordinates
- **JSON** - Full data export
- **CSV** - Tabular format

All exports exclude sensitive data.

## Troubleshooting

### "Unauthorized" Error

- Check API key in localStorage
- Verify key matches `.env` file: `API_KEY=...`

### "No credentials stored"

- Enter credentials in admin page
- Click "Save & Test"

### "Connection failed"

- Verify WiGLE credentials are correct
- Check internet connection
- Test with curl command above

### Keyring Access Issues

```bash
# Check if keytar is installed
npm list keytar

# Reinstall if needed
npm install keytar --save
```

## Development Notes

### Keyring Service

Location: `/server/src/services/keyringService.js`

Methods:

- `setCredential(key, value)` - Store credential
- `getCredential(key)` - Retrieve credential
- `deleteCredential(key)` - Delete credential
- `setWigleCredentials(apiName, apiToken)` - Store WiGLE creds
- `getWigleCredentials()` - Retrieve WiGLE creds
- `testWigleCredentials()` - Test WiGLE connection

### Settings Routes

Location: `/server/src/api/routes/v1/settings.js`

Endpoints:

- `GET /api/settings/wigle` - Get WiGLE status
- `POST /api/settings/wigle` - Set WiGLE credentials
- `GET /api/settings/wigle/test` - Test WiGLE connection
- `GET /api/settings/mapbox` - Get Mapbox status
- `POST /api/settings/mapbox` - Set Mapbox token
- `GET /api/settings/list` - List all stored keys

## Next Steps

1. ⚠️ **Revoke old WiGLE API key**
2. Generate new key at https://wigle.net/account
3. Enter in admin page
4. Test connection
5. Start using WiGLE API in your scripts

## Support

- **WiGLE API Docs:** https://api.wigle.net
- **WiGLE Support:** WiGLE-admin@wigle.net
- **Mapbox Docs:** https://docs.mapbox.com
