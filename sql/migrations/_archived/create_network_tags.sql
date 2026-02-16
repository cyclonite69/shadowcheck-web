-- Migration: Create network_tags table for user classification and ML training
-- Run: psql -h localhost -U shadowcheck_user -d shadowcheck_db -f sql/migrations/create_network_tags.sql

BEGIN;

-- Create the network_tags table in app schema
CREATE TABLE IF NOT EXISTS app.network_tags (
    id SERIAL PRIMARY KEY,
    bssid VARCHAR(17) NOT NULL,

    -- Ignore/Known status (friends list / known networks)
    is_ignored BOOLEAN DEFAULT FALSE,
    ignore_reason VARCHAR(50),  -- 'own_device', 'known_friend', 'neighbor', 'business', 'infrastructure'

    -- Threat classification (for ML training labels)
    -- Values: 'THREAT', 'SUSPECT', 'FALSE_POSITIVE', 'INVESTIGATE', NULL (untagged)
    threat_tag VARCHAR(20),
    threat_confidence NUMERIC(3,2) CHECK (threat_confidence IS NULL OR (threat_confidence >= 0 AND threat_confidence <= 1)),

    -- Notes
    notes TEXT,

    -- WiGLE crowdsource lookup tracking
    wigle_lookup_requested BOOLEAN DEFAULT FALSE,
    wigle_lookup_at TIMESTAMPTZ,
    wigle_result JSONB,  -- Store WiGLE response for reference

    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'user',

    -- ML training history (preserves previous classifications for iteration)
    tag_history JSONB DEFAULT '[]',

    -- Ensure one row per network
    CONSTRAINT network_tags_bssid_unique UNIQUE (bssid)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_network_tags_bssid ON app.network_tags(bssid);
CREATE INDEX IF NOT EXISTS idx_network_tags_ignored ON app.network_tags(is_ignored) WHERE is_ignored = TRUE;
CREATE INDEX IF NOT EXISTS idx_network_tags_threat ON app.network_tags(threat_tag) WHERE threat_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_network_tags_investigate ON app.network_tags(threat_tag) WHERE threat_tag = 'INVESTIGATE';
CREATE INDEX IF NOT EXISTS idx_network_tags_wigle_pending ON app.network_tags(wigle_lookup_requested)
    WHERE wigle_lookup_requested = TRUE AND wigle_result IS NULL;

-- Function to auto-update updated_at and preserve tag history
CREATE OR REPLACE FUNCTION app.network_tags_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- If threat_tag changed, append to history
    IF OLD.threat_tag IS DISTINCT FROM NEW.threat_tag THEN
        NEW.tag_history = COALESCE(OLD.tag_history, '[]'::jsonb) || jsonb_build_object(
            'previous_tag', OLD.threat_tag,
            'new_tag', NEW.threat_tag,
            'changed_at', NOW(),
            'confidence', OLD.threat_confidence
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS network_tags_update ON app.network_tags;
CREATE TRIGGER network_tags_update
    BEFORE UPDATE ON app.network_tags
    FOR EACH ROW
    EXECUTE FUNCTION app.network_tags_update_trigger();

-- Comment documentation
COMMENT ON TABLE app.network_tags IS 'User classifications and notes for networks - used for ML training and filtering';
COMMENT ON COLUMN app.network_tags.is_ignored IS 'If true, network is known/friendly and excluded from threat detection';
COMMENT ON COLUMN app.network_tags.ignore_reason IS 'Why ignored: own_device, known_friend, neighbor, business, infrastructure';
COMMENT ON COLUMN app.network_tags.threat_tag IS 'User classification: THREAT, SUSPECT, FALSE_POSITIVE, INVESTIGATE, or NULL';
COMMENT ON COLUMN app.network_tags.threat_confidence IS 'User confidence in classification 0.00-1.00';
COMMENT ON COLUMN app.network_tags.wigle_lookup_requested IS 'If true, queued for WiGLE crowdsource lookup';
COMMENT ON COLUMN app.network_tags.tag_history IS 'JSONB array of previous tag changes for ML training iteration';

COMMIT;

-- Verify
SELECT 'network_tags table created successfully' AS status;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'app' AND table_name = 'network_tags'
ORDER BY ordinal_position;
