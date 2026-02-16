-- Migration script to enhance app.network_tags for ML-ready threat scoring
-- Preserves existing data and adds granular scoring capabilities

BEGIN;

-- Add new columns for ML-ready threat classification
-- threat_score: 0.0-1.0 continuous score (ML prediction target)
ALTER TABLE app.network_tags ADD COLUMN IF NOT EXISTS threat_score NUMERIC(5,4) DEFAULT 0.5000;
ALTER TABLE app.network_tags ADD CONSTRAINT threat_score_range CHECK (threat_score >= 0.0 AND threat_score <= 1.0);

-- ml_confidence: How confident the model/system is (0.0-1.0)
ALTER TABLE app.network_tags ADD COLUMN IF NOT EXISTS ml_confidence NUMERIC(5,4) DEFAULT 0.0;
ALTER TABLE app.network_tags ADD CONSTRAINT ml_confidence_range CHECK (ml_confidence >= 0.0 AND ml_confidence <= 1.0);

-- user_override: Allow users to override ML predictions
ALTER TABLE app.network_tags ADD COLUMN IF NOT EXISTS user_override BOOLEAN DEFAULT FALSE;

-- feature_vector: JSON storage for ML features (expandable over time)
ALTER TABLE app.network_tags ADD COLUMN IF NOT EXISTS feature_vector JSONB;

-- tag_history: Track all tag changes for learning (JSONB array)
ALTER TABLE app.network_tags ADD COLUMN IF NOT EXISTS tag_history JSONB DEFAULT '[]'::jsonb;

-- last_ml_update: When ML model last updated this score
ALTER TABLE app.network_tags ADD COLUMN IF NOT EXISTS last_ml_update TIMESTAMP;

-- version: Schema version for ML model iterations
ALTER TABLE app.network_tags ADD COLUMN IF NOT EXISTS model_version INTEGER DEFAULT 1;

-- Update existing confidence to be 0.0-1.0 scale
ALTER TABLE app.network_tags DROP CONSTRAINT IF EXISTS network_tags_confidence_check;
ALTER TABLE app.network_tags ALTER COLUMN confidence TYPE NUMERIC(5,4) USING (COALESCE(confidence, 50)::numeric / 100.0);
ALTER TABLE app.network_tags ALTER COLUMN confidence SET DEFAULT 0.5;
ALTER TABLE app.network_tags ADD CONSTRAINT user_confidence_range CHECK (confidence >= 0.0 AND confidence <= 1.0);

-- Create indexes for ML queries
CREATE INDEX IF NOT EXISTS idx_network_tags_threat_score ON app.network_tags(threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_network_tags_ml_confidence ON app.network_tags(ml_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_network_tags_feature_vector ON app.network_tags USING gin(feature_vector);
CREATE INDEX IF NOT EXISTS idx_network_tags_model_version ON app.network_tags(model_version);

-- Initialize threat_score based on existing tag_type
UPDATE app.network_tags SET
  threat_score = CASE
    WHEN tag_type = 'LEGIT' THEN 0.0000
    WHEN tag_type = 'FALSE_POSITIVE' THEN 0.0500  -- Slight uncertainty
    WHEN tag_type = 'INVESTIGATE' THEN 0.7000  -- High suspicion
    WHEN tag_type = 'THREAT' THEN 1.0000
    ELSE 0.5000  -- Unknown/neutral
  END,
  ml_confidence = CASE
    WHEN confidence >= 0.8 THEN 0.9000  -- High user confidence → high ML confidence
    WHEN confidence >= 0.5 THEN 0.6000  -- Medium
    ELSE 0.3000  -- Low
  END,
  user_override = TRUE  -- Existing tags are user-driven
WHERE threat_score IS NULL;

COMMIT;
