# WiGLE SQLite Database Import Analysis

## Database Overview

**File:** `backup-1764309125210.sqlite`
**Location:** `/home/cyclonite01/ShadowCheckStatic/`

### Statistics

- **Networks:** 129,633 unique BSSIDs
- **Observations:** 419,969 location sightings
- **Routes:** 36,784 route points

### Schema Analysis

#### Table: `network`

Primary table for WiFi networks (unique BSSIDs)

| Column       | Type    | Description              | Maps To                    |
| ------------ | ------- | ------------------------ | -------------------------- |
| bssid        | TEXT PK | MAC address              | app.networks.bssid         |
| ssid         | TEXT    | Network name             | app.networks.ssid          |
| frequency    | INT     | Frequency in MHz         | app.networks.frequency_mhz |
| capabilities | TEXT    | Security capabilities    | app.networks.encryption[]  |
| lasttime     | LONG    | Last seen timestamp (ms) | app.networks.last_seen_at  |
| lastlat      | DOUBLE  | Last latitude            | app.networks.latitude      |
| lastlon      | DOUBLE  | Last longitude           | app.networks.longitude     |
| type         | TEXT    | Type (W=WiFi)            | app.networks.metadata      |
| bestlevel    | INT     | Best signal level        | (computed in view)         |
| bestlat      | DOUBLE  | Best signal latitude     | app.networks.latitude      |
| bestlon      | DOUBLE  | Best signal longitude    | app.networks.longitude     |
| rcois        | TEXT    | Roaming Consortium OIs   | app.networks.metadata      |
| mfgrid       | INT     | Manufacturer grid        | app.networks.metadata      |
| service      | TEXT    | Service info             | app.networks.metadata      |

#### Table: `location`

Observation/sighting data (multiple per BSSID)

| Column   | Type       | Description        | Maps To                          |
| -------- | ---------- | ------------------ | -------------------------------- |
| \_id     | INTEGER PK | Auto-increment ID  | app.observations.id              |
| bssid    | TEXT       | MAC address        | app.observations.bssid           |
| level    | INT        | Signal level (dBm) | app.observations.signal_dbm      |
| lat      | DOUBLE     | Latitude           | app.observations.latitude        |
| lon      | DOUBLE     | Longitude          | app.observations.longitude       |
| altitude | DOUBLE     | Altitude (meters)  | app.observations.altitude_meters |
| accuracy | FLOAT      | GPS accuracy       | app.observations.accuracy_meters |
| time     | LONG       | Timestamp (ms)     | app.observations.observed_at     |
| external | INT        | External flag      | app.observations.metadata        |
| mfgrid   | INT        | Manufacturer grid  | app.observations.metadata        |

#### Table: `route`

Wardriving route/path data

| Column       | Type       | Description               | Notes                        |
| ------------ | ---------- | ------------------------- | ---------------------------- |
| \_id         | INTEGER PK | Auto-increment ID         |                              |
| run_id       | INT        | Run/session ID            | Could map to device_sessions |
| wifi_visible | INT        | WiFi networks visible     |                              |
| cell_visible | INT        | Cell towers visible       |                              |
| bt_visible   | INT        | Bluetooth devices visible |                              |
| lat          | DOUBLE     | Latitude                  |                              |
| lon          | DOUBLE     | Longitude                 |                              |
| altitude     | DOUBLE     | Altitude                  |                              |
| accuracy     | FLOAT      | GPS accuracy              |                              |
| time         | LONG       | Timestamp (ms)            |                              |

## Import Script

**Location:** `scripts/import/import-wigle-sqlite.js`

### Features

✅ Imports networks to `app.networks`
✅ Imports observations to `app.observations`
✅ Parses capabilities to encryption array
✅ Converts timestamps (ms → timestamptz)
✅ Creates import tracking record
✅ Full precision (DOUBLE PRECISION)
✅ Error tracking
✅ Progress reporting
✅ Uses keyring for database password

### Usage

```bash
# Import with default file location
node scripts/import/import-wigle-sqlite.js

# Import specific file
node scripts/import/import-wigle-sqlite.js /path/to/wigle.sqlite
```

### Import Process

1. **Create import record** in `app.imports`
2. **Import networks** (129,633 records)
   - Upsert to handle duplicates
   - Parse capabilities to encryption array
   - Store metadata (type, bestlevel, mfgrid, rcois)
3. **Import observations** (419,969 records)
   - Link to networks via BSSID
   - Full precision coordinates
   - Signal strength in dBm
4. **Import routes** (36,784 records)
   - Currently counted only
   - Could create device_sessions if needed
5. **Update import record** with statistics

### Data Transformations

#### Capabilities → Encryption Array

```
Input:  "[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS][WPS]"
Output: ["WPA2", "PSK", "CCMP", "WPS"]
```

#### Timestamp Conversion

```
Input:  1753536632000 (milliseconds)
Output: 2025-05-25 12:30:32+00 (timestamptz)
```

#### Coordinates

```
Input:  43.0234267319432 (double)
Output: 43.0234267319432 (DOUBLE PRECISION - no rounding)
```

## Sample Data

### Network Example

```
BSSID: c8:99:b2:1d:b7:2a
SSID: HAL9000
Frequency: 5560 MHz (5GHz band)
Capabilities: [WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS][WPS]
Last Seen: 2025-05-25 12:30:32
Location: 43.0234267319432, -83.6968051694321
Best Signal: -41 dBm
```

### Observation Example

```
BSSID: c8:99:b2:1d:b7:2a
Signal: -63 dBm
Location: 43.0233892779573, -83.6968152019178
Altitude: 225.425354003906 m
Accuracy: 8.91701316833496 m
Time: 2024-03-18 15:20:33
```

## Expected Results

After import:

- **app.networks:** ~129,633 networks
- **app.observations:** ~419,969 observations
- **app.imports:** 1 import record with statistics
- **Triggers will:**
  - Auto-populate geography columns
  - Calculate trilateration (every 10 observations)
  - Update network statistics
  - Auto-score threats

## Post-Import Verification

```sql
-- Check import statistics
SELECT * FROM app.imports ORDER BY id DESC LIMIT 1;

-- Count networks
SELECT COUNT(*) FROM app.networks;

-- Count observations
SELECT COUNT(*) FROM app.observations;

-- Check sample network with observations
SELECT
    n.bssid,
    n.ssid,
    COUNT(o.id) as observation_count,
    MAX(o.signal_dbm) as max_signal,
    MIN(o.signal_dbm) as min_signal,
    AVG(o.signal_dbm) as avg_signal
FROM app.networks n
LEFT JOIN app.observations o ON n.bssid = o.bssid
GROUP BY n.bssid, n.ssid
LIMIT 10;

-- Check geospatial data
SELECT
    bssid,
    ssid,
    ST_AsText(location) as location_wkt,
    ST_AsText(trilat_location) as trilat_wkt
FROM app.networks
WHERE location IS NOT NULL
LIMIT 5;
```

## Next Steps

1. ✅ Run import script
2. ✅ Verify data integrity
3. ✅ Refresh materialized views
4. ✅ Test map visualization
5. ✅ Run threat detection
6. ✅ Test API endpoints

## Notes

- Import preserves full precision (DOUBLE PRECISION)
- No data rounding or truncation
- Timestamps converted from milliseconds to timestamptz
- Capabilities parsed to structured array
- Metadata preserved in JSONB
- Automatic deduplication via BSSID primary key
- Progress reporting every 1000 networks / 5000 observations
