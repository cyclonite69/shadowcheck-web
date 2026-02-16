-- Migration: Add Threat Scoring v2.0 columns
-- Purpose: Add new threat scoring columns for A/B testing and enhanced analysis
-- Date: 2026-01-17

-- Add new threat scoring columns to networks table
ALTER TABLE networks ADD COLUMN IF NOT EXISTS threat_score_v2 NUMERIC(5,1);
ALTER TABLE networks ADD COLUMN IF NOT EXISTS threat_factors JSONB;
ALTER TABLE networks ADD COLUMN IF NOT EXISTS threat_level VARCHAR(20);
ALTER TABLE networks ADD COLUMN IF NOT EXISTS threat_updated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_networks_threat_score_v2 ON networks(threat_score_v2 DESC);
CREATE INDEX IF NOT EXISTS idx_networks_threat_level ON networks(threat_level);
CREATE INDEX IF NOT EXISTS idx_networks_threat_updated_at ON networks(threat_updated_at);

-- Add comments for documentation
COMMENT ON COLUMN networks.threat_score_v2 IS 'Enhanced threat score (0-100) using v2.0 algorithm with geographical impossibility, multi-radio correlation, and temporal analysis';
COMMENT ON COLUMN networks.threat_factors IS 'JSON breakdown of threat scoring factors for transparency and debugging';
COMMENT ON COLUMN networks.threat_level IS 'Threat level classification: CRITICAL, HIGH, MEDIUM, LOW, MINIMAL';
COMMENT ON COLUMN networks.threat_updated_at IS 'Timestamp when threat score was last calculated';
