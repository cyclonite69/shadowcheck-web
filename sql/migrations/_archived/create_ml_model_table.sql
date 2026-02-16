-- Create table to store ML model configurations
CREATE TABLE IF NOT EXISTS app.ml_model_config (
  model_type VARCHAR(100) PRIMARY KEY,
  coefficients JSONB NOT NULL,
  intercept FLOAT NOT NULL,
  feature_names JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE app.ml_model_config IS 'Stores trained ML model coefficients for threat scoring';

SELECT 'ML model config table created successfully!' as status;
