-- Create import schema for raw data staging
-- Timestamps stored as Unix epoch milliseconds (BIGINT)

BEGIN;

-- Create import schema
CREATE SCHEMA IF NOT EXISTS import;

-- Import tracking table
CREATE TABLE IF NOT EXISTS app.imports (
    id SERIAL PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_file TEXT,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_seconds NUMERIC,
    records_total INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    errors JSONB
);

-- Import sources tracking
CREATE TABLE IF NOT EXISTS app.import_sources (
    id SERIAL PRIMARY KEY,
    source_repo TEXT NOT NULL,
    source_db_path TEXT,
    source_db_hash TEXT,
    import_type TEXT,
    observation_count INTEGER,
    imported_by TEXT,
    imported_at TIMESTAMP DEFAULT NOW()
);

-- WiGLE networks raw staging table
CREATE TABLE IF NOT EXISTS import.wigle_networks_raw (
    bssid TEXT PRIMARY KEY,
    ssid TEXT,
    frequency_mhz INTEGER,
    capabilities TEXT,
    last_time BIGINT NOT NULL,  -- Unix epoch milliseconds
    last_latitude NUMERIC(10, 7),
    last_longitude NUMERIC(10, 7),
    last_location GEOGRAPHY(POINT, 4326),
    type TEXT,
    best_level INTEGER,
    best_latitude NUMERIC(10, 7),
    best_longitude NUMERIC(10, 7),
    best_location GEOGRAPHY(POINT, 4326),
    rcois TEXT,
    mfgrid TEXT,
    service TEXT,
    import_id INTEGER REFERENCES app.imports(id),
    imported_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_bssid CHECK (bssid ~ '^[0-9A-F]{2}(:[0-9A-F]{2}){5}$'),
    CONSTRAINT valid_last_coords CHECK (
        last_latitude BETWEEN -90 AND 90 AND
        last_longitude BETWEEN -180 AND 180
    ),
    CONSTRAINT valid_best_coords CHECK (
        best_latitude BETWEEN -90 AND 90 AND
        best_longitude BETWEEN -180 AND 180
    ),
    CONSTRAINT valid_timestamp CHECK (last_time > 0)
);

-- Update observations table to use Unix epoch
ALTER TABLE app.observations 
    ADD COLUMN IF NOT EXISTS observed_at_epoch BIGINT,
    ADD COLUMN IF NOT EXISTS fingerprint TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS radio_type TEXT DEFAULT 'wifi',
    ADD COLUMN IF NOT EXISTS identifier TEXT,
    ADD COLUMN IF NOT EXISTS altitude_meters NUMERIC,
    ADD COLUMN IF NOT EXISTS accuracy_meters NUMERIC,
    ADD COLUMN IF NOT EXISTS signal_dbm INTEGER,
    ADD COLUMN IF NOT EXISTS source_type TEXT,
    ADD COLUMN IF NOT EXISTS import_id INTEGER REFERENCES app.imports(id),
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS radio_metadata JSONB;

-- Add constraint for valid coordinates (drop first if exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_coords') THEN
        ALTER TABLE app.observations ADD CONSTRAINT valid_coords CHECK (
            latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
        );
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wigle_networks_last_time ON import.wigle_networks_raw(last_time);
CREATE INDEX IF NOT EXISTS idx_wigle_networks_import_id ON import.wigle_networks_raw(import_id);
CREATE INDEX IF NOT EXISTS idx_wigle_networks_last_location ON import.wigle_networks_raw USING GIST(last_location);
CREATE INDEX IF NOT EXISTS idx_wigle_networks_best_location ON import.wigle_networks_raw USING GIST(best_location);

CREATE INDEX IF NOT EXISTS idx_observations_fingerprint ON app.observations(fingerprint);
CREATE INDEX IF NOT EXISTS idx_observations_identifier ON app.observations(identifier);
CREATE INDEX IF NOT EXISTS idx_observations_import_id ON app.observations(import_id);
CREATE INDEX IF NOT EXISTS idx_observations_epoch ON app.observations(observed_at_epoch);

CREATE INDEX IF NOT EXISTS idx_imports_status ON app.imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_source_type ON app.imports(source_type);

COMMIT;
