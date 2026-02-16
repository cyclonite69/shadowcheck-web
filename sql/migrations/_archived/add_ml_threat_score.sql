-- Migration: Add ML threat score column to networks table
-- Date: 2025-12-10
-- Description: Adds ml_threat_score column for storing ML-based threat assessments

BEGIN;

-- Add ml_threat_score column to networks table
ALTER TABLE app.networks 
ADD COLUMN IF NOT EXISTS ml_threat_score INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN app.networks.ml_threat_score IS 'ML-based threat score (0-100) calculated from network behavior patterns';

-- Create index for efficient threat score queries
CREATE INDEX IF NOT EXISTS idx_networks_ml_threat_score 
ON app.networks(ml_threat_score) 
WHERE ml_threat_score > 0;

COMMIT;
