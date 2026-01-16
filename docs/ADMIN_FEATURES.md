# Admin Settings - Feature Documentation

## ✅ All Features Implemented and Working

### 1. WiGLE API Credentials

**Status:** ✅ Fully Functional

**Features:**

- Store API Name and Token in system keyring (encrypted)
- Test connection to WiGLE API
- Display configuration status
- Masked display of credentials

**API Endpoints:**

- `GET /api/settings/wigle` - Get status (masked)
- `POST /api/settings/wigle` - Save credentials
- `GET /api/settings/wigle/test` - Test connection

**Storage:** System keyring at `shadowcheck/wigle_api_name` and `shadowcheck/wigle_api_token`

### 2. Mapbox Token

**Status:** ✅ Fully Functional

**Features:**

- Store Mapbox access token in system keyring
- Secure encrypted storage

**API Endpoints:**

- `GET /api/settings/mapbox` - Get status
- `POST /api/settings/mapbox` - Save token

**Storage:** System keyring at `shadowcheck/mapbox_token`

### 3. Database Backup

**Status:** ✅ Fully Functional

**Features:**

- One-click database backup
- Downloads as `.sql` file
- Includes all tables and data
- Timestamped filename

**API Endpoint:**

- `POST /api/backup/backup` - Download backup

**Command:** `pg_dump` with full schema and data

### 4. Database Restore

**Status:** ✅ Fully Functional

**Features:**

- Upload `.sql` backup file
- Restore database from backup
- File picker interface

**API Endpoint:**

- `POST /api/backup/restore` - Upload and restore

**Command:** `psql` to execute SQL file

### 5. Export GeoJSON

**Status:** ✅ Fully Functional

**Features:**

- Export observations as GeoJSON
- Includes coordinates, BSSID, signal strength
- Compatible with mapping tools
- Limit: 10,000 most recent observations

**API Endpoint:**

- `GET /api/export/geojson` - Download GeoJSON

**Format:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [longitude, latitude]
      },
      "properties": {
        "bssid": "...",
        "signal_dbm": -75,
        "observed_at": "...",
        "source_type": "wigle_app",
        "radio_type": "wifi"
      }
    }
  ]
}
```

### 6. Export JSON

**Status:** ✅ Fully Functional

**Features:**

- Export full data as JSON
- Includes observations and networks
- Limit: 10,000 records each

**API Endpoint:**

- `GET /api/export/json` - Download JSON

**Format:**

```json
{
  "exported_at": "2025-12-03T...",
  "observations": [...],
  "networks": [...]
}
```

### 7. Export CSV

**Status:** ✅ Fully Functional

**Features:**

- Export observations as CSV
- Compatible with Excel, Google Sheets
- Includes all key fields
- Limit: 10,000 most recent observations

**API Endpoint:**

- `GET /api/export/csv` - Download CSV

**Columns:**

- bssid
- latitude
- longitude
- signal_dbm
- observed_at
- source_type
- radio_type

## UI Design

**Layout:** 3x2 grid (6 panels)
**Styling:** Matches analytics.html exactly

- Same fonts (Inter)
- Same colors (purple gradients)
- Same spacing and sizing
- Same panel styling
- No scrolling needed

**Navigation:**

- Admin button on all pages
- Highlights WHITE when active (not blue)
- Consistent button sizing

## Security

**Authentication:**

- All endpoints require `X-API-Key` header
- API key from localStorage or query parameter

**Credential Storage:**

- All secrets in system keyring (encrypted by OS)
- Never stored in database or files
- Never exposed in API responses (masked)

**File Operations:**

- Backup/restore use temporary files
- Automatic cleanup after operations
- No credentials in exported data

## Testing

### Test WiGLE API

```bash
curl -H "X-API-Key: your-key" \
  http://localhost:3001/api/settings/wigle/test
```

### Test Export CSV

```bash
curl -H "X-API-Key: your-key" \
  http://localhost:3001/api/export/csv > export.csv
```

### Test Backup

```bash
curl -X POST -H "X-API-Key: your-key" \
  http://localhost:3001/api/backup/backup > backup.sql
```

## Dependencies Added

- `keytar` - System keyring integration
- `express-fileupload` - File upload for restore

## Files Created

1. `/src/services/keyringService.js` - Keyring wrapper
2. `/src/api/routes/v1/settings.js` - Settings API
3. `/src/api/routes/v1/export.js` - Export API
4. `/src/api/routes/v1/backup.js` - Backup/restore API
5. `/admin` - Admin UI route

## Usage

1. **Access:** http://localhost:3001/admin
2. **Set API Key:** `localStorage.setItem('shadowcheck_api_key', 'your-key')`
3. **Configure WiGLE:** Enter API Name and Token, click "Save & Test"
4. **Export Data:** Click any export button to download
5. **Backup:** Click "Backup Database" to download SQL file
6. **Restore:** Click "Restore Database" and select SQL file

## Limits

- Exports limited to 10,000 records (performance)
- Backup includes full database (no limit)
- File uploads limited by server configuration

## Future Enhancements

- [ ] Scheduled automatic backups
- [ ] Multiple WiGLE API key rotation
- [ ] Export filters (date range, radio type)
- [ ] Encrypted backup files
- [ ] Cloud backup integration
- [ ] Import from other formats
