# Full Precision Data Storage - No Rounding

## Principle: Store Raw, Compute in Views

**Store:** All data at full precision as received from source
**Compute:** Aggregations, averages, statistics in views/MVs only

## Updated Data Types

### Coordinates (Full Precision)

```sql
-- BEFORE: NUMERIC(10, 7) - limited precision
-- AFTER: DOUBLE PRECISION - full IEEE 754 precision
latitude DOUBLE PRECISION
longitude DOUBLE PRECISION
altitude_meters DOUBLE PRECISION
```

### Signal Measurements (Full Precision)

```sql
-- Store exact values as received
signal_dbm DOUBLE PRECISION  -- Not INTEGER
noise_dbm DOUBLE PRECISION
snr_db DOUBLE PRECISION
rssi DOUBLE PRECISION
```

### Frequencies (Full Precision)

```sql
frequency_mhz DOUBLE PRECISION  -- Not INTEGER
center_freq0_mhz DOUBLE PRECISION
center_freq1_mhz DOUBLE PRECISION
```

### Accuracy/Confidence (Full Precision)

```sql
accuracy_meters DOUBLE PRECISION  -- Not NUMERIC(8,2)
gps_accuracy_meters DOUBLE PRECISION
location_accuracy_meters DOUBLE PRECISION
confidence DOUBLE PRECISION  -- 0.0 to 1.0, full precision
threat_score DOUBLE PRECISION
ml_confidence DOUBLE PRECISION
```

### Sensor Values (Full Precision)

```sql
value_x DOUBLE PRECISION  -- Not REAL
value_y DOUBLE PRECISION
value_z DOUBLE PRECISION
value_scalar DOUBLE PRECISION
```

### Distances (Full Precision)

```sql
distance_meters DOUBLE PRECISION
radius_meters DOUBLE PRECISION
```

## Remove Computed Fields

### Networks Table - Store Raw Only

```sql
CREATE TABLE app.networks (
    bssid MACADDR PRIMARY KEY,
    ssid TEXT,

    -- Location (raw from best observation)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326),
    location_accuracy_meters DOUBLE PRECISION,

    -- Trilateration (calculated, but stored for performance)
    trilat_location GEOGRAPHY(POINT, 4326),
    trilat_confidence DOUBLE PRECISION,

    -- Temporal (raw)
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,

    -- REMOVED: observation_count, observation_days, max_signal_dbm, min_signal_dbm, avg_signal_dbm
    -- These are computed in views

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Compute Statistics in View

```sql
CREATE VIEW app.network_statistics AS
SELECT
    n.bssid,
    n.ssid,

    -- Computed from observations
    COUNT(o.id) as observation_count,
    COUNT(DISTINCT DATE(o.observed_at)) as observation_days,
    MAX(o.signal_dbm) as max_signal_dbm,
    MIN(o.signal_dbm) as min_signal_dbm,
    AVG(o.signal_dbm) as avg_signal_dbm,
    STDDEV(o.signal_dbm) as signal_stddev,

    -- Location statistics
    COUNT(DISTINCT ST_SnapToGrid(o.location::geometry, 0.001)) as unique_locations,

    -- Temporal
    n.first_seen_at,
    n.last_seen_at,
    EXTRACT(EPOCH FROM (n.last_seen_at - n.first_seen_at)) as lifespan_seconds
FROM app.networks n
LEFT JOIN app.observations o ON n.bssid = o.bssid
GROUP BY n.bssid, n.ssid, n.first_seen_at, n.last_seen_at;
```

### Materialized View for Performance

```sql
CREATE MATERIALIZED VIEW analytics.network_stats AS
SELECT * FROM app.network_statistics;

CREATE UNIQUE INDEX idx_network_stats_bssid ON analytics.network_stats(bssid);
```

## Updated Table Definitions

### app.networks (Minimal, Raw Data)

```sql
CREATE TABLE app.networks (
    bssid MACADDR PRIMARY KEY,
    ssid TEXT,
    ssid_hidden BOOLEAN DEFAULT FALSE,

    channel INTEGER,
    frequency_mhz DOUBLE PRECISION,
    band TEXT,
    channel_width INTEGER,

    encryption TEXT[],
    encryption_summary TEXT,
    wps_enabled BOOLEAN,
    wps_locked BOOLEAN,

    manufacturer TEXT,
    device_type TEXT,

    -- Best known location (raw)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326),
    location_accuracy_meters DOUBLE PRECISION,

    -- Trilateration (computed but cached)
    trilat_location GEOGRAPHY(POINT, 4326),
    trilat_confidence DOUBLE PRECISION,

    -- Temporal (raw)
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,

    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### app.observations (Full Precision)

```sql
CREATE TABLE app.observations (
    id BIGSERIAL,
    bssid MACADDR NOT NULL REFERENCES app.networks(bssid) ON DELETE CASCADE,

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

    -- Source
    source_type TEXT NOT NULL,
    source_id TEXT,
    import_id BIGINT REFERENCES app.imports(id),
    device_uuid UUID REFERENCES app.scanning_devices(device_uuid),
    session_uuid UUID REFERENCES app.device_sessions(session_uuid),

    metadata JSONB,

    PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);
```

### app.sensor_readings (Full Precision)

```sql
CREATE TABLE app.sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    device_uuid UUID NOT NULL REFERENCES app.scanning_devices(device_uuid),

    sensor_type TEXT NOT NULL,
    sensor_name TEXT,

    -- Full precision values
    value_x DOUBLE PRECISION,
    value_y DOUBLE PRECISION,
    value_z DOUBLE PRECISION,
    value_scalar DOUBLE PRECISION,

    accuracy INTEGER,

    -- Location (full precision)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude_meters DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326),

    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB
) PARTITION BY RANGE (timestamp);
```

### app.media_attachments (Full Precision)

```sql
CREATE TABLE app.media_attachments (
    id BIGSERIAL PRIMARY KEY,
    media_uuid UUID DEFAULT gen_random_uuid() UNIQUE,

    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,

    media_type TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_extension TEXT,

    file_data BYTEA NOT NULL,
    file_size_bytes BIGINT NOT NULL,

    -- Image metadata (exact values)
    width_pixels INTEGER,
    height_pixels INTEGER,
    duration_seconds DOUBLE PRECISION,
    frame_rate DOUBLE PRECISION,
    bitrate_kbps INTEGER,

    -- Camera metadata (exact values)
    focal_length_mm DOUBLE PRECISION,
    aperture DOUBLE PRECISION,
    iso INTEGER,
    shutter_speed TEXT,

    -- Location (full precision from EXIF)
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    altitude_meters DOUBLE PRECISION,
    location GEOGRAPHY(POINT, 4326),
    gps_accuracy_meters DOUBLE PRECISION,

    compass_heading DOUBLE PRECISION,

    captured_at TIMESTAMPTZ NOT NULL,
    device_uuid UUID REFERENCES app.scanning_devices(device_uuid),

    exif_data JSONB,
    metadata JSONB,

    file_hash TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### app.scanning_devices (Full Precision)

```sql
CREATE TABLE app.scanning_devices (
    id SERIAL PRIMARY KEY,
    device_uuid UUID DEFAULT gen_random_uuid() UNIQUE,

    device_name TEXT,
    device_type TEXT,
    manufacturer TEXT,
    model TEXT,

    -- Calibration (full precision)
    gps_accuracy_meters DOUBLE PRECISION,
    wifi_signal_offset_db DOUBLE PRECISION,
    bluetooth_signal_offset_db DOUBLE PRECISION,

    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Views for Computed Values

### Network Signal Statistics

```sql
CREATE VIEW app.network_signal_stats AS
SELECT
    bssid,
    MAX(signal_dbm) as max_signal,
    MIN(signal_dbm) as min_signal,
    AVG(signal_dbm) as avg_signal,
    STDDEV(signal_dbm) as signal_stddev,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY signal_dbm) as median_signal
FROM app.observations
GROUP BY bssid;
```

### Device Session Statistics

```sql
CREATE VIEW app.session_stats AS
SELECT
    s.session_uuid,
    s.device_uuid,
    COUNT(DISTINCT o.bssid) as networks_found,
    COUNT(o.id) as observations_recorded,
    ST_Distance(s.start_location, s.end_location) as distance_traveled_meters,
    COUNT(m.id) as media_captured,
    s.started_at,
    s.ended_at,
    EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) as duration_seconds
FROM app.device_sessions s
LEFT JOIN app.observations o ON s.session_uuid = o.session_uuid
LEFT JOIN app.media_attachments m ON s.session_uuid::text = m.entity_id AND m.entity_type = 'session'
GROUP BY s.session_uuid, s.device_uuid, s.start_location, s.end_location, s.started_at, s.ended_at;
```

## Remove Computed Columns from device_sessions

```sql
CREATE TABLE app.device_sessions (
    id BIGSERIAL PRIMARY KEY,
    device_uuid UUID NOT NULL REFERENCES app.scanning_devices(device_uuid),
    session_uuid UUID DEFAULT gen_random_uuid() UNIQUE,

    session_type TEXT,
    status TEXT,

    -- REMOVED: networks_found, observations_recorded, distance_traveled_meters, media_captured
    -- Computed in view

    start_location GEOGRAPHY(POINT, 4326),
    end_location GEOGRAPHY(POINT, 4326),
    bounding_box GEOGRAPHY(POLYGON, 4326),

    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    battery_start_percent INTEGER,
    battery_end_percent INTEGER,

    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Precision Summary

| Data Type     | Old           | New              |
| ------------- | ------------- | ---------------- |
| Coordinates   | NUMERIC(10,7) | DOUBLE PRECISION |
| Signal        | INTEGER       | DOUBLE PRECISION |
| Frequency     | INTEGER       | DOUBLE PRECISION |
| Accuracy      | NUMERIC(8,2)  | DOUBLE PRECISION |
| Confidence    | NUMERIC(5,4)  | DOUBLE PRECISION |
| Sensor Values | REAL          | DOUBLE PRECISION |
| Distances     | NUMERIC       | DOUBLE PRECISION |

## Performance Strategy

1. **Store raw** in base tables
2. **Compute on-demand** in views for real-time queries
3. **Cache in MVs** for dashboard/analytics (refresh every 15 min)
4. **Index appropriately** for view performance

This preserves full precision while maintaining performance through materialized views.
