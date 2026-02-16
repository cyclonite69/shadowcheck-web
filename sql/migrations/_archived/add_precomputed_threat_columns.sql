-- Performance Optimization: Pre-computed Threat Scores
-- Purpose: Create table for pre-computed threat data and update materialized view

BEGIN;

-- Create table to store pre-computed threat scores
CREATE TABLE IF NOT EXISTS public.threat_scores_cache (
  bssid TEXT PRIMARY KEY,
  threat_score NUMERIC(5,1),
  threat_level TEXT,
  threat_summary TEXT,
  threat_flags TEXT[],
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  needs_recompute BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS threat_scores_cache_needs_recompute_idx 
  ON public.threat_scores_cache (needs_recompute) WHERE needs_recompute = TRUE;

CREATE INDEX IF NOT EXISTS threat_scores_cache_computed_at_idx 
  ON public.threat_scores_cache (computed_at);

CREATE INDEX IF NOT EXISTS threat_scores_cache_threat_level_idx 
  ON public.threat_scores_cache (threat_level);

CREATE INDEX IF NOT EXISTS threat_scores_cache_threat_score_idx 
  ON public.threat_scores_cache (threat_score DESC);

COMMIT;
