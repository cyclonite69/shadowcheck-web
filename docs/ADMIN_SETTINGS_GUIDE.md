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

**Authentication:** Access to the Admin UI is gated by user roles. You must be logged in as a user with the `admin` role to access this page.

**UI Gating:**

- **Navigation:** The "Admin" link is hidden from non-admin users.
- **Geospatial Explorer:** Tagging options and note-taking are hidden in the context menu for non-admin users.
- **Admin Page:** Direct access to `/admin` returns an "Access Denied" screen for unauthorized users.

## Configure WiGLE API

...
✅ **Authentication (Current)**

- Admin UI access requires `admin` user role
- Sensitive routes (tagging, imports, backups) are protected by `requireAdmin` middleware
- Backup and Restore endpoints require both API key and Admin role

✅ **No Hardcoded Secrets**

- All credentials via keyring or env vars
- `.env` excluded from git
- `.env.example` provided as template

## Backup & Export

### Database Backup (Admin Tab)

- **Run Full Backup** triggers `POST /api/admin/backup`
- Stored locally inside the app container at `/app/backups/db`
- When using docker-compose, bind-mount `./backups:/app/backups` to access files on the host
- Retention controlled by `BACKUP_RETENTION_DAYS` (default 14)

### Export Formats

- **CSV:** `GET /api/csv`
- **JSON:** `GET /api/json`
- **GeoJSON:** `GET /api/geojson`

**Note:** Exports are currently unauthenticated and return full datasets. Use only in trusted environments.

## Troubleshooting

### "Unauthorized" Error (Settings Routes)

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
