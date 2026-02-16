-- Create legacy tables for ShadowCheck-Static
-- These are the tables referenced throughout the application codebase
-- Based on the documented legacy schema

BEGIN;

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create app schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS app;

-- Create networks_legacy table (main network metadata)
CREATE TABLE IF NOT EXISTS app.networks_legacy (
    bssid TEXT PRIMARY KEY,
    ssid TEXT,
    type TEXT,  -- W/E/B/L/N/G
    encryption TEXT,
    last_seen BIGINT,  -- Unix timestamp in milliseconds
    first_seen BIGINT,  -- Unix timestamp in milliseconds
    channel INTEGER,
    frequency NUMERIC,
    max_signal INTEGER,
    manufacturer TEXT,
    capabilities TEXT,
    device_type TEXT,
    latitude NUMERIC,
    longitude NUMERIC
);

-- Create locations_legacy table (observation records)
CREATE TABLE IF NOT EXISTS app.locations_legacy (
    id SERIAL PRIMARY KEY,
    bssid TEXT NOT NULL,
    lat NUMERIC,
    lon NUMERIC,
    signal INTEGER,
    time BIGINT,  -- Unix timestamp in milliseconds
    accuracy NUMERIC,
    altitude NUMERIC,
    speed NUMERIC,
    bearing NUMERIC,
    source TEXT
);

-- Create network_tags table for threat classification
CREATE TABLE IF NOT EXISTS app.network_tags (
    bssid TEXT PRIMARY KEY,
    tag_type TEXT CHECK (tag_type IN ('LEGIT', 'FALSE_POSITIVE', 'INVESTIGATE', 'THREAT')),
    confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
    notes TEXT,
    threat_score NUMERIC,
    ml_confidence NUMERIC,
    user_override BOOLEAN DEFAULT FALSE,
    tagged_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    tag_history JSONB DEFAULT '[]'::jsonb
);

-- Create location_markers table (home/work locations)
CREATE TABLE IF NOT EXISTS app.location_markers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,  -- 'home', 'work', etc.
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create wigle_networks_enriched table (WiGLE API enrichment data)
CREATE TABLE IF NOT EXISTS app.wigle_networks_enriched (
    bssid TEXT PRIMARY KEY,
    ssid TEXT,
    encryption TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    trilat NUMERIC,  -- WiGLE trilaterated latitude
    trilon NUMERIC,  -- WiGLE trilaterated longitude
    first_seen TEXT,
    last_seen TEXT,
    enriched_at TIMESTAMP DEFAULT NOW()
);

-- Create radio_manufacturers table (OUI-to-manufacturer mapping)
CREATE TABLE IF NOT EXISTS app.radio_manufacturers (
    mac_prefix TEXT PRIMARY KEY,
    manufacturer_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_networks_legacy_bssid ON app.networks_legacy(bssid);
CREATE INDEX IF NOT EXISTS idx_networks_legacy_ssid ON app.networks_legacy(ssid);
CREATE INDEX IF NOT EXISTS idx_networks_legacy_type ON app.networks_legacy(type);
CREATE INDEX IF NOT EXISTS idx_networks_legacy_last_seen ON app.networks_legacy(last_seen);

CREATE INDEX IF NOT EXISTS idx_locations_legacy_bssid ON app.locations_legacy(bssid);
CREATE INDEX IF NOT EXISTS idx_locations_legacy_time ON app.locations_legacy(time);
CREATE INDEX IF NOT EXISTS idx_locations_legacy_coords ON app.locations_legacy(lat, lon);

CREATE INDEX IF NOT EXISTS idx_network_tags_type ON app.network_tags(tag_type);
CREATE INDEX IF NOT EXISTS idx_location_markers_name ON app.location_markers(name);

-- Add comments for documentation
COMMENT ON TABLE app.networks_legacy IS 'Main network metadata table - WiFi, BLE, cellular network information';
COMMENT ON TABLE app.locations_legacy IS 'Observation records - location/signal readings for each network';
COMMENT ON TABLE app.network_tags IS 'User tagging and ML classification for threat analysis';
COMMENT ON TABLE app.location_markers IS 'Reference locations (home, work) for threat detection';
COMMENT ON TABLE app.wigle_networks_enriched IS 'Enrichment data from WiGLE API lookups';
COMMENT ON TABLE app.radio_manufacturers IS 'MAC address OUI to manufacturer name mapping';

COMMENT ON COLUMN app.networks_legacy.type IS 'W=WiFi, E=BLE, B=Bluetooth, L=LTE, N=5G NR, G=GSM/Cellular';
COMMENT ON COLUMN app.networks_legacy.last_seen IS 'Unix timestamp in milliseconds (filter by >= 946684800000 for valid data)';
COMMENT ON COLUMN app.locations_legacy.time IS 'Unix timestamp in milliseconds (filter by >= 946684800000 for valid data)';

COMMIT;
