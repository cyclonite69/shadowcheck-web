# 🚨 CRITICAL SECURITY NOTICE

## Exposed WiGLE API Credentials

**Date:** December 3, 2025, 20:56 EST

### What Happened

WiGLE API credentials were exposed in chat conversation:

- **API Name:** AIDc40fa13ea2238ef65909f4a816b48e60
- **API Token:** 4100473fda765a037a5d0aefc67c5bbb
- **Encoded:** QUlEYzQwZmExM2VhMjIzOGVmNjU5MDlmNGE4MTZiNDhlNjA6NDEwMDQ3M2ZkYTc2NWEwMzdhNWQwYWVmYzY3YzViYmI=

### Immediate Actions Required

1. **Revoke Current API Key**
   - Go to: https://wigle.net/account
   - Navigate to API section
   - Revoke/Delete current API key
   - Generate new API key

2. **Use New Admin Settings Page**
   - Access: http://localhost:3001/admin
   - Enter new WiGLE credentials
   - Credentials stored in system keyring (encrypted)
   - Test connection before saving

3. **Verify No Exposure**
   - Check git history: `git log --all -S "AIDc40fa13ea2238ef65909f4a816b48e60"`
   - Check files: `grep -r "AIDc40fa13ea2238ef65909f4a816b48e60" .`
   - Both should return nothing

### How to Revoke WiGLE API Key

1. Visit: https://wigle.net/account
2. Log in with your WiGLE account
3. Scroll to "API" section
4. Click "Revoke" or "Delete" next to current key
5. Click "Generate New API Token"
6. Copy new API Name and API Token
7. Enter in Admin Settings page (http://localhost:3001/admin)

### New Security Implementation

✅ **Admin Settings Page Created**

- Location: `/admin`
- Requires API key authentication
- All credentials stored in system keyring
- Never stored in database or files

✅ **Keyring Service**

- Uses `keytar` npm package
- Integrates with OS keyring (Linux Secret Service)
- Encrypted at rest by operating system
- Credentials: `shadowcheck/wigle_api_name`, `shadowcheck/wigle_api_token`

✅ **API Routes**

- `/api/settings/wigle` - Get/Set WiGLE credentials
- `/api/settings/wigle/test` - Test WiGLE connection
- `/api/settings/mapbox` - Get/Set Mapbox token
- All require `X-API-Key` header

### WiGLE API Authentication

WiGLE uses HTTP Basic Authentication:

```
Authorization: Basic <base64(apiName:apiToken)>
```

Example:

```bash
curl -i -H 'Accept:application/json' \
  -u AIDxxxxx:xxxxxx \
  --basic https://api.wigle.net/api/v2/profile/user
```

Our implementation:

```javascript
const encoded = Buffer.from(`${apiName}:${apiToken}`).toString('base64');
headers['Authorization'] = `Basic ${encoded}`;
```

### Testing New Credentials

After entering new credentials in admin page:

1. Click "Save & Test" button
2. System will:
   - Store in keyring
   - Test connection to WiGLE API
   - Display result (success/failure)

3. Verify with curl:

```bash
curl -i -H 'Accept:application/json' \
  -u YOUR_NEW_API_NAME:YOUR_NEW_API_TOKEN \
  --basic https://api.wigle.net/api/v2/profile/user
```

### Prevention Measures

1. ✅ Never paste credentials in chat/email
2. ✅ Always use keyring for storage
3. ✅ Never commit credentials to git
4. ✅ Use environment variables only for development
5. ✅ Rotate API keys regularly
6. ✅ Use admin settings page for all credential management

### Files Created

- `/server/src/services/keyringService.js` - Keyring integration
- `/server/src/api/routes/v1/settings.js` - Settings API routes
- `/admin` - Admin settings UI

### Next Steps

1. ⚠️ **REVOKE OLD KEY IMMEDIATELY**
2. Generate new WiGLE API key
3. Enter in admin settings page
4. Test connection
5. Delete this notice file after completion

### Support

If you need help:

- WiGLE API docs: https://api.wigle.net
- WiGLE support: WiGLE-admin@wigle.net
- Include username and use case for increased API limits

---

**Remember:** This conversation may be logged. Always revoke exposed credentials immediately.
