# Schema Redesign: Observations-First Architecture

## Problem Identified

**Current design has it backwards:**

- `app.networks` stores computed fields (max_signal, last_seen, etc.)
- `app.observations` references networks
- This violates "store raw, compute in views" principle

**Reality:**

- WiGLE stores raw in `location` table, computes `network` table
- ShadowCheckMobile stores raw in `wifi_networks`, no aggregation
- We should store raw observations, compute networks

## Proposed Solution

### 1. Rename and Restructure

**Primary table: `app.observations`** (raw data, no foreign keys)

- Stores every sighting with full precision
- No dependencies on other tables
- Partitioned by timestamp

**Computed: `app.networks` becomes a VIEW**

- Aggregates from observations
- All fields computed (best location, signal stats, etc.)
- Materialized for performance

### 2. Updated Schema

#### app.observations (Primary - Raw Data)

```sql
CREATE TABLE app.observations (
    id BIGSERIAL,

    -- Network Identity (no FK, just identifier)
    bssid MACADDR NOT NULL,
    ssid TEXT,

    -- Technical Details (as observed)
    frequency_mhz DOUBLE PRECISION,
    channel INTEGER,
    capabilities TEXT, -- Raw string from scan

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

    -- Source tracking
    source_type TEXT NOT NULL, -- 'wigle_app', 'wigle_api_v2', 'mobile', 'pentest'
    source_id TEXT,
    import_id BIGINT,
    device_uuid UUID,
    session_uuid UUID,

    -- Metadata (preserve everything)
    metadata JSONB,

    PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);

-- Indexes
CREATE INDEX idx_observations_bssid ON app.observations(bssid);
CREATE INDEX idx_observations_location ON app.observations USING gist(location);
CREATE INDEX idx_observations_time ON app.observations USING brin(observed_at);
CREATE INDEX idx_observations_source ON app.observations(source_type);
```

#### app.networks (View - Computed)

```sql
CREATE VIEW app.networks AS
SELECT
    bssid,

    -- SSID (most common non-hidden)
    MODE() WITHIN GROUP (ORDER BY ssid) FILTER (WHERE ssid != '' AND ssid IS NOT NULL) as ssid,

    -- Technical (most recent)
    (SELECT frequency_mhz FROM app.observations o2
     WHERE o2.bssid = o.bssid AND frequency_mhz IS NOT NULL
     ORDER BY observed_at DESC LIMIT 1) as frequency_mhz,

    (SELECT channel FROM app.observations o2
     WHERE o2.bssid = o.bssid AND channel IS NOT NULL
     ORDER BY observed_at DESC LIMIT 1) as channel,

    (SELECT capabilities FROM app.observations o2
     WHERE o2.bssid = o.bssid AND capabilities IS NOT NULL
     ORDER BY observed_at DESC LIMIT 1) as capabilities,

    -- Best location (strongest signal)
    (SELECT latitude FROM app.observations o2
     WHERE o2.bssid = o.bssid
     ORDER BY signal_dbm DESC NULLS LAST LIMIT 1) as best_latitude,

    (SELECT longitude FROM app.observations o2
     WHERE o2.bssid = o.bssid
     ORDER BY signal_dbm DESC NULLS LAST LIMIT 1) as best_longitude,

    (SELECT location FROM app.observations o2
     WHERE o2.bssid = o.bssid
     ORDER BY signal_dbm DESC NULLS LAST LIMIT 1) as best_location,

    -- Last location (most recent)
    (SELECT latitude FROM app.observations o2
     WHERE o2.bssid = o.bssid
     ORDER BY observed_at DESC LIMIT 1) as last_latitude,

    (SELECT longitude FROM app.observations o2
     WHERE o2.bssid = o.bssid
     ORDER BY observed_at DESC LIMIT 1) as last_longitude,

    (SELECT location FROM app.observations o2
     WHERE o2.bssid = o.bssid
     ORDER BY observed_at DESC LIMIT 1) as last_location,

    -- Signal statistics
    MAX(signal_dbm) as max_signal_dbm,
    MIN(signal_dbm) as min_signal_dbm,
    AVG(signal_dbm) as avg_signal_dbm,

    -- Temporal
    MIN(observed_at) as first_seen_at,
    MAX(observed_at) as last_seen_at,

    -- Counts
    COUNT(*) as observation_count,
    COUNT(DISTINCT DATE(observed_at)) as observation_days,
    COUNT(DISTINCT ST_SnapToGrid(location::geometry, 0.001)) as unique_locations

FROM app.observations o
GROUP BY bssid;
```

#### analytics.networks (Materialized View - Cached)

```sql
CREATE MATERIALIZED VIEW analytics.networks AS
SELECT * FROM app.networks;

CREATE UNIQUE INDEX idx_networks_bssid ON analytics.networks(bssid);
CREATE INDEX idx_networks_ssid ON analytics.networks(ssid);
CREATE INDEX idx_networks_best_location ON analytics.networks USING gist(best_location);
CREATE INDEX idx_networks_last_location ON analytics.networks USING gist(last_location);
```

### 3. Additional Tables (Keep as-is)

These store additional metadata, not raw observations:

```sql
-- User/ML classifications
CREATE TABLE app.network_tags (
    bssid MACADDR PRIMARY KEY,
    tag_type TEXT,
    threat_score DOUBLE PRECISION,
    -- ... rest of fields
);

-- Enrichment data
CREATE TABLE app.enrichments (
    bssid MACADDR,
    api_source TEXT,
    venue_name TEXT,
    -- ... rest of fields
);

-- Trilateration results (computed but cached)
CREATE TABLE app.ap_locations (
    bssid MACADDR,
    location GEOGRAPHY(POINT, 4326),
    confidence DOUBLE PRECISION,
    calculated_at TIMESTAMPTZ,
    -- ... rest of fields
);
```

### 4. Import Strategy

#### From WiGLE SQLite

```javascript
// Import to observations only
// WiGLE "location" → app.observations (direct)
// WiGLE "network" → SKIP (it's computed, we'll recompute)

INSERT INTO app.observations (
    bssid, ssid, frequency_mhz, capabilities,
    latitude, longitude, altitude_meters, location,
    accuracy_meters, signal_dbm, observed_at,
    source_type, metadata
) SELECT ...
```

#### From ShadowCheckMobile

```javascript
// Mobile wifi_networks → app.observations (direct)
// No transformation needed, already raw
```

### 5. Query Patterns

#### Get network info (use MV for performance)

```sql
SELECT * FROM analytics.networks WHERE bssid = '00:11:22:33:44:55';
```

#### Get raw observations

```sql
SELECT * FROM app.observations WHERE bssid = '00:11:22:33:44:55' ORDER BY observed_at DESC;
```

#### Real-time view (always current)

```sql
SELECT * FROM app.networks WHERE bssid = '00:11:22:33:44:55';
```

### 6. Refresh Strategy

```sql
-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.networks;

-- Schedule every 15 minutes
SELECT cron.schedule('refresh-networks', '*/15 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.networks');
```

## Benefits

✅ **Single source of truth** - observations table
✅ **No computed fields in base tables** - all in views
✅ **Full precision preserved** - raw data never modified
✅ **Matches mobile architecture** - raw observations only
✅ **Flexible** - can recompute networks with different logic
✅ **Auditable** - all raw data preserved
✅ **Performance** - MV for fast queries

## Migration Path

1. Keep current schema temporarily
2. Create new `app.observations` table
3. Migrate data from old tables
4. Create views
5. Update application code
6. Drop old tables

## Naming Decision

**Recommendation: Keep "observations"**

Reasons:

- More descriptive (observation = sighting with context)
- Distinguishes from "location" (just coordinates)
- Matches domain language (SIGINT observations)
- "location" is ambiguous (table vs. column)

Alternative names considered:

- ❌ locations (too generic, conflicts with column name)
- ❌ sightings (less technical)
- ❌ detections (implies threat)
- ✅ observations (clear, technical, domain-appropriate)

## Updated Table List

### Core Tables (Raw Data)

1. **app.observations** - All raw sightings (PRIMARY)
2. app.sensor_readings - Raw sensor data
3. app.media_attachments - Files with metadata
4. app.scanning_devices - Device metadata
5. app.device_sessions - Session tracking

### Computed/Metadata Tables

6. app.network_tags - User/ML classifications
7. app.enrichments - API enrichment data
8. app.ap_locations - Trilateration results
9. app.imports - Import tracking
10. app.baselines - Known good networks
11. app.scans - Scan sessions
12. app.tracked_devices - UUID tracking
13. app.ml_models - ML model storage

### Views (Computed)

- **app.networks** (view) - Computed from observations
- **analytics.networks** (MV) - Cached for performance
- analytics.network_stats (MV)
- analytics.daily_activity (MV)
- analytics.threat_dashboard (MV)

## Decision Required

**Option A: Observations-first (Recommended)**

- Primary: app.observations (raw)
- Computed: app.networks (view/MV)
- Matches mobile architecture
- True to "store raw, compute in views"

**Option B: Keep current design**

- Primary: app.networks (with computed fields)
- Detail: app.observations (references networks)
- Requires triggers to maintain computed fields
- More complex, violates principles

**Which do you prefer?**
