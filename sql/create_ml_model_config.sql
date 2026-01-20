-- Create ML model configuration table
CREATE TABLE IF NOT EXISTS app.ml_model_config (
    model_type VARCHAR(50) PRIMARY KEY,
    coefficients JSONB NOT NULL,
    intercept NUMERIC NOT NULL,
    feature_names JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create update trigger
CREATE OR REPLACE FUNCTION app.ml_model_config_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ml_model_config_update
    BEFORE UPDATE ON app.ml_model_config
    FOR EACH ROW
    EXECUTE FUNCTION app.ml_model_config_update_trigger();
