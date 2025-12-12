# Final Observations-First Schema (Option A)

## Core Principle

**Store ALL raw data in observations, compute everything else in views**

## Unique WiGLE Fields Identified

From WiGLE `network` table analysis:

- **rcois** - Roaming Consortium Organization Identifiers (Passpoint/Hotspot 2.0)
- **service** - Service information (venue, operator)
- **mfgrid** - Manufacturer grid ID
- **type** - Network type (W=WiFi, B=Bluetooth, C=Cellular)

These are NOT in location table, so must be preserved from network table during import.

## Source Tracking Strategy

### 1. Source Type Enum

```sql
CREATE TYPE source_type AS ENUM (
    'wigle_app',           -- WiGLE Android app SQLite export
    'wigle_api_v2',        -- WiGLE API v2 JSON
    'wigle_api_v3',        -- WiGLE API v3 alpha JSON
    'kismet',              -- Kismet sidecar
    'mobile_android',      -- ShadowCheckMobile Android
    'mobile_ios',          -- ShadowCheckMobile iOS (future)
    'pentest_active',      -- ShadowCheckPentest active scan
    'pentest_passive',     -- ShadowCheckPentest passive
    'manual',              -- Manual entry
    'import_csv',          -- CSV import
    'import_json'          -- JSON import
);
```

### 2. Source Metadata Structure

```jsonb
{
    "source": {
        "type": "wigle_app",
        "version": "2.70",
        "device": "Samsung Galaxy S21",
        "import_id": 123,
        "batch_id": "batch_20250102_001"
    },
    "wigle": {
        "rcois": "",
        "service": "",
        "mfgrid": 0,
        "type": "W",
        "external": 0
    },
    "mobile": {
        "session_uuid": "...",
        "app_version": "1.0.0",
        "scanning_mode": "active"
    },
    "pentest": {
        "scan_id": 456,
        "interface": "wlan0",
        "scan_type": "active"
    }
}
```

## Final app.observations Schema

```sql
CREATE TABLE app.observations (
    id BIGSERIAL,

    -- Network Identity (no FK)
    bssid MACADDR NOT NULL,
    ssid TEXT,

    -- Technical Details (as observed)
    frequency_mhz DOUBLE PRECISION,
    channel INTEGER,
    channel_width INTEGER,
    band TEXT, -- '2.4GHz', '5GHz', '6GHz'

    -- Security (raw string + parsed)
    capabilities TEXT, -- Raw from scan
    encryption TEXT[], -- Parsed array
    wps_enabled BOOLEAN,

    -- Manufacturer
    manufacturer TEXT, -- From OUI lookup
    vendor_oui TEXT, -- First 3 octets

    -- Location (full precision)
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude_meters DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy_meters DOUBLE PRECISION,

    -- Signal (full precision)
    signal_dbm DOUBLE PRECISION,
    noise_dbm DOUBLE PRECISION,
    snr_db DOUBLE PRECISION,

    -- Temporal
    observed_at TIMESTAMPTZ NOT NULL,

    -- Source Tracking
    source_type source_type NOT NULL,
    source_version TEXT, -- App/API version
    source_device TEXT, -- Device that collected data

    -- References (optional)
    import_id BIGINT, -- References app.imports
    device_uuid UUID, -- References app.scanning_devices
    session_uuid UUID, -- References app.device_sessions

    -- WiGLE-specific fields (in metadata)
    -- rcois, service, mfgrid, type, external

    -- Full metadata (preserve everything)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);

-- Indexes
CREATE INDEX idx_observations_bssid ON app.observations(bssid);
CREATE INDEX idx_observations_ssid ON app.observations USING gin(ssid gin_trgm_ops);
CREATE INDEX idx_observations_location ON app.observations USING gist(location);
CREATE INDEX idx_observations_time ON app.observations USING brin(observed_at);
CREATE INDEX idx_observations_source ON app.observations(source_type);
CREATE INDEX idx_observations_device ON app.observations(device_uuid);
CREATE INDEX idx_observations_session ON app.observations(session_uuid);
CREATE INDEX idx_observations_metadata ON app.observations USING gin(metadata);

-- Partitions (create monthly)
CREATE TABLE app.observations_2025_01 PARTITION OF app.observations
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## Import Strategy by Source

### From WiGLE SQLite

```javascript
// Import from location table (raw observations)
INSERT INTO app.observations (
    bssid, latitude, longitude, altitude_meters, location,
    accuracy_meters, signal_dbm, observed_at,
    source_type, metadata
)
SELECT
    bssid,
    lat, lon, altitude,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    accuracy,
    level,
    to_timestamp(time / 1000.0),
    'wigle_app',
    jsonb_build_object(
        'source', jsonb_build_object(
            'type', 'wigle_app',
            'import_id', import_id
        ),
        'wigle', jsonb_build_object(
            'external', external,
            'mfgrid', mfgrid
        )
    )
FROM wigle_location;

// Enrich with network table data (rcois, service, etc.)
UPDATE app.observations o
SET
    ssid = n.ssid,
    frequency_mhz = n.frequency,
    capabilities = n.capabilities,
    metadata = metadata || jsonb_build_object(
        'wigle', jsonb_build_object(
            'rcois', n.rcois,
            'service', n.service,
            'mfgrid', n.mfgrid,
            'type', n.type
        )
    )
FROM wigle_network n
WHERE o.bssid = n.bssid
    AND o.source_type = 'wigle_app';
```

### From ShadowCheckMobile

```javascript
// Direct mapping
INSERT INTO app.observations (
    bssid, ssid, frequency_mhz, channel, capabilities,
    latitude, longitude, altitude_meters, location,
    accuracy_meters, signal_dbm, observed_at,
    source_type, source_version, device_uuid, session_uuid,
    metadata
)
SELECT
    bssid, ssid, frequency, channel, capabilities,
    latitude, longitude, altitude,
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    accuracy, signalLevel,
    to_timestamp(timestamp / 1000.0),
    'mobile_android',
    app_version,
    device_uuid,
    session_uuid,
    jsonb_build_object(
        'source', jsonb_build_object(
            'type', 'mobile_android',
            'device', device_name
        ),
        'mobile', jsonb_build_object(
            'vendorOui', vendorOui,
            'vendorName', vendorName,
            'standard', standard,
            'channelWidth', channelWidth,
            'is80211mc', is80211mc,
            'isPasspoint', isPasspoint
        )
    )
FROM mobile_wifi_networks;
```

### From WiGLE API v2/v3

```javascript
// From API JSON response
INSERT INTO app.observations (
    bssid, ssid, frequency_mhz, channel,
    latitude, longitude, location,
    signal_dbm, observed_at,
    source_type, source_version,
    metadata
)
SELECT
    netid, ssid, channel * 5 + 2407, channel, -- Calculate frequency
    trilat, trilong,
    ST_SetSRID(ST_MakePoint(trilong, trilat), 4326)::geography,
    lastupdt,
    to_timestamp(lasttime / 1000.0),
    'wigle_api_v2',
    'v2',
    jsonb_build_object(
        'source', jsonb_build_object(
            'type', 'wigle_api_v2',
            'query_id', query_id
        ),
        'wigle', jsonb_build_object(
            'qos', qos,
            'transid', transid,
            'housenumber', housenumber,
            'road', road,
            'city', city,
            'region', region,
            'country', country
        )
    )
FROM wigle_api_results;
```

### From Kismet

```javascript
// From Kismet SQLite
INSERT INTO app.observations (
    bssid, ssid, frequency_mhz, channel,
    latitude, longitude, location,
    signal_dbm, observed_at,
    source_type, metadata
)
SELECT
    devmac, ssid, frequency / 1000, channel,
    lat, lon,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
    signal,
    to_timestamp(last_time),
    'kismet',
    jsonb_build_object(
        'source', jsonb_build_object(
            'type', 'kismet',
            'server', kismet_server
        ),
        'kismet', jsonb_build_object(
            'type', type,
            'crypt', crypt,
            'manuf', manuf
        )
    )
FROM kismet_devices;
```

## Query Patterns

### Get all observations for a network

```sql
SELECT * FROM app.observations
WHERE bssid = '00:11:22:33:44:55'::macaddr
ORDER BY observed_at DESC;
```

### Get observations by source

```sql
SELECT * FROM app.observations
WHERE source_type = 'wigle_app'
ORDER BY observed_at DESC
LIMIT 100;
```

### Get WiGLE-specific fields

```sql
SELECT
    bssid,
    ssid,
    metadata->'wigle'->>'rcois' as rcois,
    metadata->'wigle'->>'service' as service,
    metadata->'wigle'->>'type' as type
FROM app.observations
WHERE source_type = 'wigle_app'
    AND metadata->'wigle'->>'rcois' != '';
```

### Get mobile-specific fields

```sql
SELECT
    bssid,
    ssid,
    metadata->'mobile'->>'vendorName' as vendor,
    metadata->'mobile'->>'standard' as wifi_standard,
    metadata->'mobile'->'isPasspoint' as is_passpoint
FROM app.observations
WHERE source_type = 'mobile_android';
```

## Source Attribution in Views

```sql
CREATE VIEW app.networks AS
SELECT
    bssid,

    -- Aggregated fields...

    -- Source tracking
    ARRAY_AGG(DISTINCT source_type) as sources,
    COUNT(*) FILTER (WHERE source_type = 'wigle_app') as wigle_observations,
    COUNT(*) FILTER (WHERE source_type = 'mobile_android') as mobile_observations,
    COUNT(*) FILTER (WHERE source_type = 'pentest_active') as pentest_observations,

    -- WiGLE-specific (if available)
    (SELECT metadata->'wigle'->>'rcois' FROM app.observations o2
     WHERE o2.bssid = o.bssid AND metadata->'wigle'->>'rcois' != ''
     LIMIT 1) as rcois,

    (SELECT metadata->'wigle'->>'service' FROM app.observations o2
     WHERE o2.bssid = o.bssid AND metadata->'wigle'->>'service' != ''
     LIMIT 1) as service

FROM app.observations o
GROUP BY bssid;
```

## Benefits

✅ **All raw data preserved** in observations
✅ **Source tracking** at observation level
✅ **WiGLE-specific fields** preserved in metadata
✅ **Flexible** - can add new sources without schema changes
✅ **Auditable** - know exactly where each observation came from
✅ **No data loss** - everything in metadata JSONB
