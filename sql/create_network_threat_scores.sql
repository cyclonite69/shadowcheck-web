-- Network Threat Scores Cache Table
-- Stores precomputed ML predictions + rule-based scores for fast API reads

CREATE TABLE IF NOT EXISTS app.network_threat_scores (
    id BIGSERIAL PRIMARY KEY,
    bssid VARCHAR(17) NOT NULL UNIQUE,
    
    -- ML Predictions
    ml_threat_score NUMERIC(5,2),           -- 0.0-100.0, NULL if model not trained
    ml_threat_probability NUMERIC(3,2),     -- 0.0-1.0 (confidence)
    ml_primary_class VARCHAR(20),           -- 'THREAT', 'FALSE_POSITIVE', 'LEGITIMATE', NULL
    ml_feature_values JSONB,                -- Debug: feature values used for prediction
    
    -- Rule-based Scoring (from MV)
    rule_based_score NUMERIC(5,2),
    rule_based_flags JSONB,                 -- Full rule-based details (summary, flags, factors, metrics)
    
    -- Combined Score
    final_threat_score NUMERIC(5,2),        -- Weighted combination of ML + rules
    final_threat_level VARCHAR(10),         -- 'CRITICAL', 'HIGH', 'MED', 'LOW', 'NONE'
    
    -- Metadata
    scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    model_version VARCHAR(50),              -- Which model version created this score
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_network_threat_scores_bssid ON app.network_threat_scores(bssid);
CREATE INDEX idx_network_threat_scores_threat_level ON app.network_threat_scores(final_threat_level);
CREATE INDEX idx_network_threat_scores_scored_at ON app.network_threat_scores(scored_at DESC);

-- Update trigger
CREATE OR REPLACE FUNCTION app.network_threat_scores_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER network_threat_scores_update
    BEFORE UPDATE ON app.network_threat_scores
    FOR EACH ROW
    EXECUTE FUNCTION app.network_threat_scores_update_trigger();
