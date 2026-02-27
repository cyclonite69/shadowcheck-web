-- Add performance indexes to api_network_explorer_mv
-- Improves filter query performance for commonly used filters

BEGIN;

-- Frequency index (for frequency band filters)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_frequency 
ON app.api_network_explorer_mv (frequency);

-- Signal/RSSI index (for RSSI min/max filters)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_signal 
ON app.api_network_explorer_mv (signal);

-- First seen index (for temporal filters)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_first_seen 
ON app.api_network_explorer_mv (first_seen DESC);

-- Last seen index (for temporal filters)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_last_seen 
ON app.api_network_explorer_mv (last_seen DESC);

-- Observations count index (for quality filters)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observations 
ON app.api_network_explorer_mv (observations);

-- Composite index: type + frequency (for radio type + frequency band combinations)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type_freq 
ON app.api_network_explorer_mv (type, frequency);

-- Composite index: threat_score + type (for threat + radio type combinations)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat_type 
ON app.api_network_explorer_mv (threat_score DESC, type);

-- Security index (for encryption type filters)
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_security 
ON app.api_network_explorer_mv (security);

COMMIT;
