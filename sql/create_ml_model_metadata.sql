-- ML Model Metadata Tables
-- Track model versions, training history, and performance metrics

CREATE TABLE IF NOT EXISTS app.ml_model_metadata (
    model_type VARCHAR(50) PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    trained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    training_samples INT NOT NULL,
    threat_count INT,
    false_positive_count INT,
    legitimate_count INT,
    accuracy NUMERIC(3,2),                  -- On test set, if available
    feature_names JSONB NOT NULL,
    model_config JSONB,                     -- Class weights, hyperparams, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store training history for rollback/comparison
CREATE TABLE IF NOT EXISTS app.ml_training_history (
    id BIGSERIAL PRIMARY KEY,
    model_type VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    trained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    training_samples INT,
    threat_count INT,
    false_positive_count INT,
    legitimate_count INT,
    accuracy NUMERIC(3,2),
    coefficients JSONB NOT NULL,
    intercept NUMERIC,
    feature_names JSONB NOT NULL,
    model_config JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ml_training_history_model ON app.ml_training_history(model_type, trained_at DESC);
