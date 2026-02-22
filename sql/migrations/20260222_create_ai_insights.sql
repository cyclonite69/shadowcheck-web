-- Migration: Create app.ai_insights table
-- Date: 2026-02-22
-- Purpose: Persist Claude/Bedrock network analysis history with user feedback

BEGIN;

CREATE TABLE IF NOT EXISTS app.ai_insights (
  id            SERIAL PRIMARY KEY,
  user_id       UUID,
  question      TEXT,
  filtered_networks JSONB,                   -- networks sent to Claude for analysis
  claude_response   TEXT,                    -- full analysis text returned by Claude
  suggestions   TEXT[],                      -- parsed suggestions array
  tags          TEXT[],                      -- auto-categorised insight tags
  useful        BOOLEAN,                     -- user feedback thumbs up/down
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_created
  ON app.ai_insights(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insights_created
  ON app.ai_insights(created_at DESC);

COMMENT ON TABLE app.ai_insights IS
  'Persisted Claude/Bedrock analyses of network observations, with optional user feedback.';

COMMIT;
