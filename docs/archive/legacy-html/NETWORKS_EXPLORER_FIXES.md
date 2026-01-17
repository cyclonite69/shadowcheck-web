# Networks Explorer Fixes

## Issues Fixed

### 1. ✅ Distance Field

**Issue:** Distance from home not populated  
**Fix:**

- Already computed in server.js using PostGIS `ST_Distance`
- Changed `default: false` to `default: true` in NETWORK_COLUMNS
- Now visible by default in networks table

### 2. ✅ Last Seen Field

**Issue:** lastSeen not computed correctly  
**Fix:**

- Server.js already computes from `latest_times` CTE
- Fixed timestamp conversion: `new Date(row.lastseen).getTime()` instead of `parseInt(row.lastseen)`
- Returns proper Unix timestamp in milliseconds

### 3. ✅ Security Field Parsing

**Issue:** Security should be parsed from capabilities field  
**Fix:** Already implemented in server.js with comprehensive parsing:

```sql
CASE
  -- Bluetooth/BLE use different security models
  WHEN n.type IN ('B', 'E') THEN 'N/A'
  -- WiFi security parsing
  WHEN UPPER(n.capabilities) LIKE '%WPA3%' OR UPPER(n.capabilities) LIKE '%SAE%' THEN
    CASE WHEN UPPER(n.capabilities) LIKE '%EAP%' OR UPPER(n.capabilities) LIKE '%MGT%' THEN 'WPA3-E' ELSE 'WPA3-P' END
  WHEN UPPER(n.capabilities) LIKE '%WPA2%' OR UPPER(n.capabilities) LIKE '%RSN%' THEN
    CASE WHEN UPPER(n.capabilities) LIKE '%EAP%' OR UPPER(n.capabilities) LIKE '%MGT%' THEN 'WPA2-E' ELSE 'WPA2-P' END
  WHEN UPPER(n.capabilities) LIKE '%WPA-%' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
  WHEN UPPER(n.capabilities) LIKE '%WEP%' OR LOWER(n.encryption) = 'wep' THEN 'WEP'
  WHEN UPPER(n.capabilities) LIKE '%WPS%' AND UPPER(n.capabilities) NOT LIKE '%WPA%' THEN 'WPS'
  WHEN LOWER(n.encryption) = 'wpa3' THEN 'WPA3-P'
  WHEN LOWER(n.encryption) = 'wpa2' THEN 'WPA2-P'
  WHEN LOWER(n.encryption) = 'wpa' THEN 'WPA'
  WHEN n.capabilities IS NOT NULL AND n.capabilities != '' AND n.capabilities != 'Misc' AND n.capabilities != 'Uncategorized;10' THEN 'Unknown'
  ELSE 'OPEN'
END as security
```

**Security Types Detected:**

- `WPA3-E` - WPA3 Enterprise (802.1X)
- `WPA3-P` - WPA3 Personal (SAE)
- `WPA2-E` - WPA2 Enterprise
- `WPA2-P` - WPA2 Personal (PSK)
- `WPA` - Original WPA
- `WEP` - Legacy WEP
- `WPS` - WiFi Protected Setup
- `OPEN` - No encryption
- `N/A` - Bluetooth/BLE (different security model)

### 4. ✅ Accuracy Field

**Issue:** Accuracy field not populated  
**Fix:**

- Fixed mapping: `row.accuracy_meters` instead of `row.accuracy`
- Format: Shows meters with 1 decimal place
- Display: `3.8 m`, `10.5 m`, etc.

### 5. ✅ Type Icons with Colorized Pills

**Issue:** Type column needs icons with colored pills  
**Fix:** Added styled type badges:

```javascript
type: {
    label: 'Type',
    width: '80px',
    sortable: true,
    default: true,
    format: (val) => {
        const types = {
            'W': { label: 'WiFi', icon: '📶', color: '#3b82f6' },
            'E': { label: 'BLE', icon: '🔵', color: '#8b5cf6' },
            'B': { label: 'BT', icon: '🔵', color: '#3b82f6' },
            'L': { label: 'LTE', icon: '📡', color: '#10b981' },
            'N': { label: '5G', icon: '🚀', color: '#f59e0b' },
            'G': { label: 'GSM', icon: '📞', color: '#6b7280' }
        };
        const t = types[val] || types['W'];
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:${t.color}22;border:1px solid ${t.color}44;border-radius:6px;font-size:11px;font-weight:500;color:${t.color}"><span>${t.icon}</span><span>${t.label}</span></span>`;
    }
}
```

**Type Badges:**

- 📶 WiFi (blue)
- 🔵 BLE (purple)
- 🔵 BT (blue)
- 📡 LTE (green)
- 🚀 5G (orange)
- 📞 GSM (gray)

### 6. ✅ Selection Checkbox

**Issue:** Need checkbox at start of each row  
**Fix:** Added `select` column as first column:

```javascript
select: {
    label: '☑',
    width: '40px',
    sortable: false,
    default: true,
    format: (val, network) => `<input type="checkbox" class="network-checkbox" data-bssid="${network.bssid}" onclick="event.stopPropagation()">`
}
```

- Checkbox prevents row click event propagation
- Stores BSSID in `data-bssid` attribute
- Can be used for bulk operations

## API Response Example

```json
{
  "networks": [
    {
      "id": "445306",
      "ssid": "AndroidAP_3395",
      "bssid": "00:08:22:1D:5A:27",
      "type": "W",
      "security": "WPA2-P",
      "frequency": 5.22,
      "channel": 44,
      "signal": -82,
      "accuracy": 3.79,
      "observations": 1,
      "manufacturer": "Unknown",
      "lastSeen": 1764308971000,
      "distanceFromHome": null,
      "latitude": 43.0234528565662,
      "longitude": -83.6968437708818
    }
  ],
  "total": 117687,
  "page": 1,
  "limit": 1
}
```

## Default Visible Columns

After fixes, default columns shown:

1. ☑ Select (checkbox)
2. Type (with icon pill)
3. SSID
4. BSSID
5. Signal
6. Security
7. Distance from Home
8. Last Seen

## Files Modified

1. `public/networks.html`
   - Added `select` column with checkbox
   - Updated `type` column with colorized icon pills
   - Changed `distanceFromHome` default to `true`
   - Fixed column rendering to pass network object for select

2. `server.js`
   - Fixed `accuracy` mapping: `row.accuracy_meters`
   - Fixed `lastSeen` conversion: `new Date(row.lastseen).getTime()`
   - Security parsing already implemented correctly

## Testing

```bash
# Test API
curl "http://localhost:3001/api/networks?page=1&limit=1"

# Check fields
curl -s "http://localhost:3001/api/networks?page=1&limit=1" | jq '.networks[0] | {bssid, type, security, lastSeen, accuracy, distanceFromHome}'
```

## Next Steps

Potential enhancements:

- Bulk selection actions (tag multiple networks, export selected)
- Select all checkbox in header
- Selection count indicator
- Keyboard shortcuts for selection (Shift+Click for range)
