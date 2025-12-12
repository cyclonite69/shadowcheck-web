# Import, Audit, and Supporting Tables

## 1. Import Tracking

**Purpose:** Track all data imports with full lineage

```sql
CREATE TABLE app.imports (
    id BIGSERIAL PRIMARY KEY,

    -- Source
    source_type TEXT NOT NULL,  -- 'wigle_app', 'wigle_api_v2', 'wigle_api_v3', 'kismet', 'pentest'
    source_version TEXT,
    source_file TEXT,
    source_url TEXT,

    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- Statistics
    records_total INTEGER,
    records_imported INTEGER,
    records_updated INTEGER,
    records_skipped INTEGER,
    records_failed INTEGER,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Error tracking
    errors JSONB,

    -- Metadata
    metadata JSONB,
    imported_by TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_imports_source ON app.imports(source_type);
CREATE INDEX idx_imports_status ON app.imports(status);
CREATE INDEX idx_imports_started ON app.imports USING brin(started_at);
```

## 2. Enrichment Tracking

**Purpose:** Track address enrichment API calls and results

```sql
CREATE TABLE app.enrichments (
    id BIGSERIAL PRIMARY KEY,
    bssid MACADDR NOT NULL REFERENCES app.networks(bssid),

    -- Location
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,

    -- Enrichment source
    api_source TEXT NOT NULL,  -- 'opencage', 'locationiq', 'overpass', 'abstract'
    api_version TEXT,

    -- Results
    address_full TEXT,
    address_components JSONB,
    venue_name TEXT,
    venue_type TEXT,
    venue_category TEXT,

    -- Context
    is_government BOOLEAN,
    is_education BOOLEAN,
    is_commercial BOOLEAN,
    is_residential BOOLEAN,

    -- Quality
    confidence NUMERIC(3, 2),

    -- Timing
    enriched_at TIMESTAMPTZ DEFAULT NOW(),
    cache_until TIMESTAMPTZ,

    -- Metadata
    raw_response JSONB,

    UNIQUE(bssid, api_source)
);

CREATE INDEX idx_enrichments_bssid ON app.enrichments(bssid);
CREATE INDEX idx_enrichments_venue ON app.enrichments(venue_name, venue_type);
CREATE INDEX idx_enrichments_context ON app.enrichments(is_government, is_education);
```

## 3. Trilateration Data

**Purpose:** Store AP location calculations from multiple observations

```sql
CREATE TABLE app.ap_locations (
    id SERIAL PRIMARY KEY,
    bssid MACADDR NOT NULL REFERENCES app.networks(bssid),

    -- Calculated location
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,

    -- Quality metrics
    confidence NUMERIC(3, 2),
    observation_count INTEGER,
    radius_meters NUMERIC(8, 2),

    -- Algorithm
    method TEXT,  -- 'centroid', 'weighted_centroid', 'trilateration'

    -- Temporal
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    observations_from TIMESTAMPTZ,
    observations_to TIMESTAMPTZ,

    UNIQUE(bssid, calculated_at)
);

CREATE INDEX idx_ap_locations_bssid ON app.ap_locations(bssid);
CREATE INDEX idx_ap_locations_location ON app.ap_locations USING gist(location);
```

## 4. UUID Tracking (Device Movement)

**Purpose:** Track device movement patterns via randomized MAC addresses

```sql
CREATE TABLE app.tracked_devices (
    id SERIAL PRIMARY KEY,

    -- Identity
    device_uuid UUID DEFAULT gen_random_uuid(),
    mac_addresses MACADDR[],  -- All MACs associated with this device

    -- Classification
    device_type TEXT,
    manufacturer TEXT,
    confidence NUMERIC(3, 2),

    -- Behavioral
    home_location GEOGRAPHY(POINT, 4326),
    work_location GEOGRAPHY(POINT, 4326),
    frequent_locations JSONB,  -- Array of {location, visit_count, last_visit}

    -- Temporal
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracked_devices_macs ON app.tracked_devices USING gin(mac_addresses);
CREATE INDEX idx_tracked_devices_home ON app.tracked_devices USING gist(home_location);
```

## 5. Baselines (Known Good Networks)

**Purpose:** Store baseline configurations for rogue AP detection

```sql
CREATE TABLE app.baselines (
    id SERIAL PRIMARY KEY,

    -- Identity
    name TEXT NOT NULL UNIQUE,
    description TEXT,

    -- Scope
    location_name TEXT,
    location_center GEOGRAPHY(POINT, 4326),
    location_radius_meters NUMERIC(8, 2),

    -- Known networks
    known_networks MACADDR[],
    known_ssids TEXT[],

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Temporal
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_audit_at TIMESTAMPTZ
);

CREATE INDEX idx_baselines_active ON app.baselines(is_active);
CREATE INDEX idx_baselines_location ON app.baselines USING gist(location_center);
```

## 6. Scans (Pentest Scan Sessions)

**Purpose:** Track individual scan sessions from ShadowCheckPentest

```sql
CREATE TABLE app.scans (
    id SERIAL PRIMARY KEY,

    -- Identity
    scan_type TEXT NOT NULL,  -- 'wifi', 'device', 'baseline_audit'
    interface TEXT,

    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    -- Results
    networks_found INTEGER,
    devices_found INTEGER,
    rogues_detected INTEGER,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Metadata
    results JSONB,
    errors TEXT,
    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scans_type ON app.scans(scan_type);
CREATE INDEX idx_scans_status ON app.scans(status);
CREATE INDEX idx_scans_started ON app.scans USING brin(started_at);
```

## 7. ML Model Configuration

**Purpose:** Store ML model versions and configurations

```sql
CREATE TABLE app.ml_models (
    id SERIAL PRIMARY KEY,

    -- Identity
    model_name TEXT NOT NULL,
    model_version INTEGER NOT NULL,

    -- Configuration
    algorithm TEXT,
    hyperparameters JSONB,
    features TEXT[],

    -- Performance
    accuracy NUMERIC(5, 4),
    precision_score NUMERIC(5, 4),
    recall NUMERIC(5, 4),
    f1_score NUMERIC(5, 4),

    -- Model data
    model_data BYTEA,  -- Serialized model

    -- Status
    is_active BOOLEAN DEFAULT FALSE,

    -- Temporal
    trained_at TIMESTAMPTZ DEFAULT NOW(),
    training_samples INTEGER,

    UNIQUE(model_name, model_version)
);

CREATE INDEX idx_ml_models_active ON app.ml_models(is_active);
```
