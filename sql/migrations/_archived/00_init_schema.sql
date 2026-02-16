-- Initialize base schema for ShadowCheck
-- This creates the minimal structure needed before running other migrations

BEGIN;

-- Create app schema
CREATE SCHEMA IF NOT EXISTS app;

-- Create networks table (core Kismet-style table)
CREATE TABLE IF NOT EXISTS app.networks (
    bssid TEXT PRIMARY KEY,
    ssid TEXT,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    channel INTEGER,
    frequency NUMERIC,
    encryption TEXT,
    max_signal INTEGER,
    manufacturer TEXT,
    device_type TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    location GEOGRAPHY(POINT, 4326)
);

-- Create network_tags table for threat classification
CREATE TABLE IF NOT EXISTS app.network_tags (
    bssid TEXT PRIMARY KEY REFERENCES app.networks(bssid),
    tag_type TEXT,
    confidence INTEGER DEFAULT 50,
    notes TEXT,
    tagged_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create observations table for location tracking
CREATE TABLE IF NOT EXISTS app.observations (
    id SERIAL PRIMARY KEY,
    bssid TEXT REFERENCES app.networks(bssid),
    latitude NUMERIC,
    longitude NUMERIC,
    signal INTEGER,
    observed_at TIMESTAMP DEFAULT NOW(),
    location GEOGRAPHY(POINT, 4326)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_networks_bssid ON app.networks(bssid);
CREATE INDEX IF NOT EXISTS idx_networks_ssid ON app.networks(ssid);
CREATE INDEX IF NOT EXISTS idx_networks_location ON app.networks USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_observations_bssid ON app.observations(bssid);
CREATE INDEX IF NOT EXISTS idx_observations_location ON app.observations USING GIST(location);

COMMIT;
