-- Migration: Add GIN index for manufacturer ILIKE searches
-- Date: 2026-03-02
-- Purpose: Speed up manufacturer filter queries from 8s to <100ms

-- Enable pg_trgm extension for trigram-based pattern matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index to manufacturer column in MV for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_manufacturer_gin 
ON app.api_network_explorer_mv 
USING gin (manufacturer gin_trgm_ops);

-- Also add to radio_manufacturers table for completeness
CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_manufacturer_gin 
ON app.radio_manufacturers 
USING gin (manufacturer gin_trgm_ops);

COMMENT ON INDEX app.idx_api_network_explorer_mv_manufacturer_gin IS 
  'GIN index for fast ILIKE pattern matching on manufacturer names';
