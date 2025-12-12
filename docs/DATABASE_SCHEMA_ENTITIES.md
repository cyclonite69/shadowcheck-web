# Core Entity Tables

## 1. Networks (WiFi Access Points)

**Purpose:** Central registry of all WiFi networks (APs) discovered across all sources

```sql
CREATE TABLE app.networks (
    -- Identity
    bssid MACADDR PRIMARY KEY,  -- Use native MAC type
    ssid TEXT,
    ssid_hidden BOOLEAN DEFAULT FALSE,

    -- Technical Details
    channel INTEGER CHECK (channel BETWEEN 1 AND 196),
    frequency_mhz INTEGER,
    band TEXT CHECK (band IN ('2.4GHz', '5GHz', '6GHz', '60GHz')),
    channel_width INTEGER CHECK (channel_width IN (20, 40, 80, 160)),

    -- Security
    encryption TEXT[],  -- Array: ['WPA2', 'PSK', 'AES']
    encryption_summary TEXT,  -- Human readable: "WPA2-PSK-AES"
    wps_enabled BOOLEAN,
    wps_locked BOOLEAN,

    -- Manufacturer
    manufacturer TEXT,  -- From OUI lookup
    device_type TEXT,   -- Router, Mobile Hotspot, Vehicle, IoT, etc.

    -- Location (best known)
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    location GEOGRAPHY(POINT, 4326),
    location_accuracy_meters NUMERIC(8, 2),
    trilat_location GEOGRAPHY(POINT, 4326),  -- Calculated from observations
    trilat_confidence NUMERIC(3, 2),

    -- Signal
    max_signal_dbm INTEGER,
    min_signal_dbm INTEGER,
    avg_signal_dbm NUMERIC(5, 2),

    -- Temporal
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    observation_count INTEGER DEFAULT 0,
    observation_days INTEGER DEFAULT 0,  -- Unique days seen

    -- Metadata
    metadata JSONB,  -- Flexible storage for source-specific data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT networks_location_check CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

-- Indexes
CREATE INDEX idx_networks_ssid ON app.networks USING btree(ssid);
CREATE INDEX idx_networks_ssid_trgm ON app.networks USING gin(ssid gin_trgm_ops);
CREATE INDEX idx_networks_location ON app.networks USING gist(location);
CREATE INDEX idx_networks_trilat_location ON app.networks USING gist(trilat_location);
CREATE INDEX idx_networks_manufacturer ON app.networks(manufacturer);
CREATE INDEX idx_networks_device_type ON app.networks(device_type);
CREATE INDEX idx_networks_last_seen ON app.networks USING brin(last_seen_at);
CREATE INDEX idx_networks_metadata ON app.networks USING gin(metadata);
```

## 2. Observations (Location Sightings)

**Purpose:** Time-series data of network sightings with location and signal

**Partitioned by month for performance**

```sql
CREATE TABLE app.observations (
    id BIGSERIAL,
    bssid MACADDR NOT NULL REFERENCES app.networks(bssid) ON DELETE CASCADE,

    -- Location
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    altitude_meters NUMERIC(8, 2),
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    accuracy_meters NUMERIC(8, 2),

    -- Signal
    signal_dbm INTEGER,
    noise_dbm INTEGER,
    snr_db INTEGER,

    -- Temporal
    observed_at TIMESTAMPTZ NOT NULL,

    -- Source tracking
    source_type TEXT NOT NULL,  -- 'wigle_app', 'wigle_api_v2', 'kismet', 'pentest'
    source_id TEXT,  -- Import batch ID or scan ID
    import_id BIGINT REFERENCES app.imports(id),

    -- Metadata
    metadata JSONB,

    PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);

-- Create partitions (example for 2025)
CREATE TABLE app.observations_2025_01 PARTITION OF app.observations
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... create more partitions as needed

-- Indexes (on parent, inherited by partitions)
CREATE INDEX idx_observations_bssid ON app.observations(bssid);
CREATE INDEX idx_observations_location ON app.observations USING gist(location);
CREATE INDEX idx_observations_time ON app.observations USING brin(observed_at);
CREATE INDEX idx_observations_source ON app.observations(source_type, source_id);
CREATE INDEX idx_observations_import ON app.observations(import_id);
```

## 3. Devices (Client Devices)

**Purpose:** Track client devices (phones, laptops, IoT) seen connecting to networks

```sql
CREATE TABLE app.devices (
    mac_address MACADDR PRIMARY KEY,

    -- Identity
    hostname TEXT,
    device_name TEXT,

    -- Classification
    manufacturer TEXT,
    device_type TEXT,  -- smartphone, laptop, iot, vehicle, etc.
    os_type TEXT,

    -- Network associations
    associated_networks MACADDR[],  -- Array of BSSIDs
    primary_network MACADDR REFERENCES app.networks(bssid),

    -- Temporal
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_manufacturer ON app.devices(manufacturer);
CREATE INDEX idx_devices_type ON app.devices(device_type);
CREATE INDEX idx_devices_last_seen ON app.devices USING brin(last_seen_at);
CREATE INDEX idx_devices_associated ON app.devices USING gin(associated_networks);
```

## 4. Network Tags (Threat Classification)

**Purpose:** User and ML-based threat classification with full audit trail

```sql
CREATE TABLE app.network_tags (
    id SERIAL PRIMARY KEY,
    bssid MACADDR NOT NULL REFERENCES app.networks(bssid) ON DELETE CASCADE,

    -- Classification
    tag_type TEXT NOT NULL CHECK (tag_type IN (
        'LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT', 'UNKNOWN'
    )),
    threat_score NUMERIC(5, 4) CHECK (threat_score BETWEEN 0 AND 1),

    -- Confidence
    ml_confidence NUMERIC(5, 4) CHECK (ml_confidence BETWEEN 0 AND 1),
    user_confidence NUMERIC(5, 4) CHECK (user_confidence BETWEEN 0 AND 1),
    user_override BOOLEAN DEFAULT FALSE,

    -- ML Features
    feature_vector JSONB,
    model_version INTEGER,

    -- Audit
    notes TEXT,
    tagged_by TEXT,  -- User or 'system'
    tagged_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tag_history JSONB DEFAULT '[]'::jsonb,

    -- Ensure one active tag per network
    UNIQUE(bssid)
);

CREATE INDEX idx_network_tags_type ON app.network_tags(tag_type);
CREATE INDEX idx_network_tags_threat_score ON app.network_tags(threat_score DESC);
CREATE INDEX idx_network_tags_features ON app.network_tags USING gin(feature_vector);
```
