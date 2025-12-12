# Legacy Database Schema Documentation

**IMPORTANT**: This documents the **OLD** database schema that is no longer accessible. Keep this for reference when rebuilding or migrating data.

## Overview

The original ShadowCheck database used a schema based on Kismet-style wireless network capture with the following core tables in the `app` schema.

## Core Tables

### `app.networks_legacy`

Primary table for network metadata. Based on Kismet's network table structure.

```sql
CREATE TABLE app.networks_legacy (
    bssid TEXT PRIMARY KEY,              -- MAC address (AA:BB:CC:DD:EE:FF) or tower ID
    ssid TEXT,                            -- Network name (SSID)
    type TEXT,                            -- Network type: W/E/B/L/N/G
    encryption TEXT,                      -- Security type (WPA2-PSK, WPA3-SAE, etc.)
    capabilities TEXT,                    -- Raw capabilities string from scan
    channel INTEGER,                      -- Channel number
    frequency INTEGER,                    -- Frequency in MHz
    first_seen BIGINT,                    -- Unix timestamp (milliseconds)
    last_seen BIGINT,                     -- Unix timestamp (milliseconds)
    max_signal INTEGER,                   -- Best signal strength (dBm)
    manufacturer TEXT,                    -- Manufacturer from OUI lookup
    device_type TEXT,                     -- Device classification
    latitude NUMERIC,                     -- Last known latitude
    longitude NUMERIC,                    -- Last known longitude
    location GEOGRAPHY(POINT, 4326)       -- PostGIS geography point
);

-- Indexes
CREATE INDEX idx_networks_legacy_bssid ON app.networks_legacy(bssid);
CREATE INDEX idx_networks_legacy_ssid ON app.networks_legacy(ssid);
CREATE INDEX idx_networks_legacy_type ON app.networks_legacy(type);
CREATE INDEX idx_networks_legacy_last_seen ON app.networks_legacy(last_seen);
CREATE INDEX idx_networks_legacy_location ON app.networks_legacy USING GIST(location);
```

**Network Type Codes**:

- `W`: WiFi (802.11)
- `E`: BLE (Bluetooth Low Energy)
- `B`: Bluetooth Classic
- `L`: LTE (4G cellular)
- `N`: 5G NR (New Radio)
- `G`: GSM/Cellular

**Timestamp Format**:

- Unix timestamps in **milliseconds** (not seconds!)
- Minimum valid: `946684800000` (Jan 1, 2000)

---

### `app.locations_legacy`

Observation records - every time a network was seen at a specific location.

```sql
CREATE TABLE app.locations_legacy (
    id SERIAL PRIMARY KEY,
    bssid TEXT,                           -- Foreign key to networks_legacy
    lat NUMERIC,                          -- Observation latitude
    lon NUMERIC,                          -- Observation longitude
    signal_strength INTEGER,              -- Signal strength (dBm)
    time BIGINT,                          -- Unix timestamp (milliseconds)
    accuracy NUMERIC,                     -- GPS accuracy (meters)
    altitude NUMERIC,                     -- Altitude (meters)
    speed NUMERIC,                        -- Speed at time of observation (m/s)
    location GEOGRAPHY(POINT, 4326)       -- PostGIS geography point
);

-- Indexes
CREATE INDEX idx_locations_legacy_bssid ON app.locations_legacy(bssid);
CREATE INDEX idx_locations_legacy_time ON app.locations_legacy(time) WHERE time >= 946684800000;
CREATE INDEX idx_locations_legacy_location ON app.locations_legacy USING GIST(location);
```

**Key Points**:

- One row per observation
- BSSID is not a foreign key (allows orphan observations)
- Time filter in index: `WHERE time >= 946684800000` (excludes invalid timestamps)

---

### `app.network_tags`

User-generated classifications and threat assessments.

```sql
CREATE TABLE app.network_tags (
    bssid TEXT PRIMARY KEY,              -- Network being tagged
    tag_type TEXT NOT NULL,              -- LEGIT, FALSE_POSITIVE, INVESTIGATE, THREAT
    confidence INTEGER DEFAULT 50,       -- User confidence (0-100)
    notes TEXT,                          -- User notes
    threat_score NUMERIC,                -- 0.0-1.0 based on tag_type
    ml_confidence NUMERIC,               -- ML model confidence (0.0-1.0)
    user_override BOOLEAN DEFAULT FALSE, -- User manually overrode ML
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tag_history JSONB                    -- Audit trail
);

-- Indexes
CREATE INDEX idx_network_tags_bssid ON app.network_tags(bssid);
CREATE INDEX idx_network_tags_type ON app.network_tags(tag_type);
```

**Tag Types & Threat Scores**:

- `LEGIT`: 0.0 (confirmed safe)
- `FALSE_POSITIVE`: 0.05 (incorrectly flagged)
- `INVESTIGATE`: 0.7 (suspicious, needs investigation)
- `THREAT`: 1.0 (confirmed threat)

**Confidence**: User confidence in their classification (0-100, converted to 0.0-1.0 internally)

---

### `app.location_markers`

Home and work location markers for threat detection.

```sql
CREATE TABLE app.location_markers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,                  -- 'home', 'work', etc.
    lat NUMERIC NOT NULL,
    lon NUMERIC NOT NULL,
    radius INTEGER DEFAULT 100,          -- Radius in meters
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_location_markers_name ON app.location_markers(name);
CREATE INDEX idx_location_markers_location ON app.location_markers USING GIST(location);
```

**Purpose**:

- Threat detection algorithm checks if networks seen at home are also seen away from home
- Typical radius: 100-200 meters

---

### `app.wigle_networks_enriched`

WiGLE API enrichment data.

```sql
CREATE TABLE app.wigle_networks_enriched (
    bssid TEXT PRIMARY KEY,
    ssid TEXT,
    trilat_lat NUMERIC,                  -- Trilateration latitude
    trilat_lon NUMERIC,                  -- Trilateration longitude
    qos INTEGER,                         -- Quality of Service score
    first_seen_wigle TIMESTAMP,          -- First seen in WiGLE database
    last_seen_wigle TIMESTAMP,           -- Last seen in WiGLE database
    location GEOGRAPHY(POINT, 4326)
);

-- Indexes
CREATE INDEX idx_wigle_enriched_bssid ON app.wigle_networks_enriched(bssid);
```

**Source**: WiGLE.net API or CSV exports

---

### `app.radio_manufacturers`

MAC address OUI (Organizationally Unique Identifier) to manufacturer mapping.

```sql
CREATE TABLE app.radio_manufacturers (
    id SERIAL PRIMARY KEY,
    mac_prefix TEXT NOT NULL,           -- First 3 octets (AA:BB:CC)
    manufacturer TEXT NOT NULL,
    category TEXT,                       -- consumer_electronics, networking, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_radio_manufacturers_prefix ON app.radio_manufacturers(mac_prefix);
```

**Purpose**: Lookup manufacturer from MAC address for device identification

---

## Enrichment Tables

### `app.ap_addresses`

Reverse geocoded addresses and venue names.

```sql
CREATE TABLE app.ap_addresses (
    bssid TEXT PRIMARY KEY,
    address TEXT,                        -- Street address
    venue_name TEXT,                     -- Business/venue name
    venue_category TEXT,                 -- Category (retail, restaurant, etc.)
    venue_brand TEXT,                    -- Brand name (Starbucks, Target, etc.)
    data_source TEXT,                    -- LocationIQ, OpenCage, Overpass, Nominatim
    confidence NUMERIC,                  -- 0.0-1.0
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Sources**: Multi-API enrichment system (LocationIQ, OpenCage, Overpass, Nominatim)

---

### `app.ap_locations`

Trilateration results - calculated AP positions.

```sql
CREATE TABLE app.ap_locations (
    bssid TEXT PRIMARY KEY,
    calculated_lat NUMERIC,
    calculated_lon NUMERIC,
    accuracy_radius INTEGER,             -- Meters
    sample_count INTEGER,                -- Number of observations used
    calculation_method TEXT,             -- centroid, weighted_avg, trilateration
    location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);
```

**Purpose**: More accurate AP location than single observation

---

### `app.business_classifications`

Device type and contextual classifications.

```sql
CREATE TABLE app.business_classifications (
    bssid TEXT PRIMARY KEY,
    device_category TEXT,                -- vehicle, iot, mobile, infrastructure
    is_government BOOLEAN,
    is_education BOOLEAN,
    is_commercial BOOLEAN,
    confidence NUMERIC,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Query Patterns

### Threat Detection Query (Simplified)

```sql
WITH home_location AS (
  SELECT ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography AS home_point
  FROM app.location_markers WHERE name = 'home' LIMIT 1
),
network_stats AS (
  SELECT
    l.bssid,
    COUNT(*) AS observation_count,
    COUNT(DISTINCT DATE(to_timestamp(l.time / 1000))) AS unique_days,
    MAX(ST_Distance(
      ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326)::geography,
      h.home_point
    )) / 1000.0 AS max_distance_km,
    MIN(ST_Distance(
      ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326)::geography,
      h.home_point
    )) / 1000.0 AS min_distance_km
  FROM app.locations_legacy l
  CROSS JOIN home_location h
  WHERE l.time >= 946684800000
    AND l.lat IS NOT NULL
    AND l.lon IS NOT NULL
  GROUP BY l.bssid
  HAVING COUNT(*) >= 2
),
threat_scores AS (
  SELECT
    bssid,
    observation_count,
    unique_days,
    (max_distance_km - min_distance_km) AS distance_range_km,
    -- Scoring algorithm
    CASE
      WHEN min_distance_km < 0.2 AND max_distance_km > 0.2 THEN 40 -- Seen at home AND away
      ELSE 0
    END +
    CASE WHEN (max_distance_km - min_distance_km) > 0.2 THEN 25 ELSE 0 END +
    CASE
      WHEN unique_days >= 7 THEN 15
      WHEN unique_days >= 3 THEN 10
      WHEN unique_days >= 2 THEN 5
      ELSE 0
    END +
    CASE
      WHEN observation_count >= 50 THEN 10
      WHEN observation_count >= 20 THEN 5
      ELSE 0
    END AS threat_score
  FROM network_stats
)
SELECT
  t.*,
  n.ssid,
  n.type,
  n.encryption,
  n.last_seen
FROM threat_scores t
JOIN app.networks_legacy n ON t.bssid = n.bssid
WHERE t.threat_score >= 30
ORDER BY t.threat_score DESC;
```

---

## Data Relationships

```
app.networks_legacy (1) ──┬──< (many) app.locations_legacy
                          │
                          ├──< (0..1) app.network_tags
                          │
                          ├──< (0..1) app.wigle_networks_enriched
                          │
                          ├──< (0..1) app.ap_addresses
                          │
                          ├──< (0..1) app.ap_locations
                          │
                          └──< (0..1) app.business_classifications

app.radio_manufacturers (independent lookup table)
app.location_markers (independent reference points)
```

---

## Important Constants

- **MIN_VALID_TIMESTAMP**: `946684800000` (Jan 1, 2000 in milliseconds)
- **Threat Threshold**: 30-40 points (configurable)
- **Min Observations**: 2 (for threat detection)
- **Home Radius**: 100-200 meters

---

## Migration Notes

### If Rebuilding Database

1. **Start with init schema**: `sql/migrations/00_init_schema.sql`
2. **Create legacy tables**: May need to rename `networks` → `networks_legacy`, `observations` → `locations_legacy`
3. **Apply enrichment migrations**: Order matters (see filenames)
4. **Import data**: Use WiGLE CSV import scripts

### Table Name Discrepancy

The code uses `networks_legacy` and `locations_legacy`, but `00_init_schema.sql` creates `networks` and `observations`. This suggests:

- Either rename during migration: `ALTER TABLE app.networks RENAME TO networks_legacy;`
- Or there was a separate migration that did the rename
- Or this is a v1 vs v2 schema issue

**Recommendation**: Create tables with `_legacy` suffix from the start to match the code.

---

## Backup Commands

```bash
# Full database backup
pg_dump -U shadowcheck_user -d shadowcheck -F c -f shadowcheck_backup.dump

# Schema-only backup
pg_dump -U shadowcheck_user -d shadowcheck -s > shadowcheck_schema.sql

# Data-only backup for specific tables
pg_dump -U shadowcheck_user -d shadowcheck -a -t app.networks_legacy -t app.locations_legacy > shadowcheck_data.sql

# Restore
pg_restore -U shadowcheck_user -d shadowcheck shadowcheck_backup.dump
```

---

## Known Issues

1. **Timestamp Inconsistency**: Some records have timestamps < MIN_VALID_TIMESTAMP
2. **Orphan Observations**: `locations_legacy.bssid` not enforced as foreign key
3. **Cellular Tower IDs**: BSSID field contains non-MAC identifiers for cellular networks
4. **Duplicate Networks**: Possible duplicates due to case sensitivity or formatting differences

---

## Reference Queries

### Count records by table

```sql
SELECT 'networks_legacy' AS table, COUNT(*) FROM app.networks_legacy
UNION ALL
SELECT 'locations_legacy', COUNT(*) FROM app.locations_legacy
UNION ALL
SELECT 'network_tags', COUNT(*) FROM app.network_tags
UNION ALL
SELECT 'location_markers', COUNT(*) FROM app.location_markers;
```

### Check timestamp range

```sql
SELECT
  to_timestamp(MIN(time) / 1000) AS earliest,
  to_timestamp(MAX(time) / 1000) AS latest
FROM app.locations_legacy
WHERE time >= 946684800000;
```

### Network type distribution

```sql
SELECT type, COUNT(*)
FROM app.networks_legacy
GROUP BY type
ORDER BY COUNT(*) DESC;
```

---

**Last Updated**: 2025-12-02
**Status**: LEGACY - Original database no longer accessible
**Purpose**: Reference for rebuilding or migration
