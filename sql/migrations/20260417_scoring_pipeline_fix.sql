-- Migration: Fix threat scoring pipeline (v5)
-- Purpose: Standardize threat levels, fix final_threat_score/level derivation
-- Model version: 5.0

-- Step 1: Standardize existing 'MED' values to 'MEDIUM'
UPDATE app.network_threat_scores
SET final_threat_level = 'MEDIUM'
WHERE final_threat_level = 'MED';

-- Step 2: Replace the trigger function with proper derivation logic
CREATE OR REPLACE FUNCTION app.network_threat_scores_update_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_final_score numeric(5,2);
  v_ml_enabled  boolean;
  v_ml_weight   numeric;
BEGIN
  NEW.updated_at := NOW();

  -- Respect FALSE_POSITIVE tag: zero out scoring
  IF EXISTS (
    SELECT 1 FROM app.network_tags
    WHERE bssid = NEW.bssid::text
      AND (threat_tag = 'FALSE_POSITIVE' OR tags @> '["legit"]'::jsonb)
  ) THEN
    NEW.final_threat_score := 0;
    NEW.final_threat_level := 'NONE';
    RETURN NEW;
  END IF;

  -- Blend rule + ML if ML is enabled and trained
  SELECT
    COALESCE((value::text)::boolean, false),
    COALESCE((
      SELECT (value::text)::numeric
      FROM app.settings WHERE key = 'ml_blending_weight'
    ), 0.3)
  INTO v_ml_enabled, v_ml_weight
  FROM app.settings WHERE key = 'ml_blending_enabled';

  v_ml_enabled := COALESCE(v_ml_enabled, false);

  IF v_ml_enabled
     AND NEW.ml_threat_score IS NOT NULL
     AND NEW.ml_threat_score > 0
  THEN
    v_final_score := ROUND(
      (COALESCE(NEW.rule_based_score, 0) * (1 - v_ml_weight)) +
      (COALESCE(NEW.ml_threat_score,  0) * v_ml_weight),
      2
    );
  ELSE
    v_final_score := COALESCE(NEW.rule_based_score, 0);
  END IF;

  NEW.final_threat_score := LEAST(100, v_final_score);

  NEW.final_threat_level :=
    CASE
      WHEN NEW.final_threat_score >= 81 THEN 'CRITICAL'
      WHEN NEW.final_threat_score >= 61 THEN 'HIGH'
      WHEN NEW.final_threat_score >= 41 THEN 'MEDIUM'
      WHEN NEW.final_threat_score >= 21 THEN 'LOW'
      ELSE 'NONE'
    END;

  NEW.model_version := '5.0';
  RETURN NEW;
END;
$$;

-- Step 3: Replace trigger binding for UPDATE
DROP TRIGGER IF EXISTS network_threat_scores_update
  ON app.network_threat_scores;

CREATE TRIGGER network_threat_scores_update
  BEFORE UPDATE ON app.network_threat_scores
  FOR EACH ROW
  EXECUTE FUNCTION app.network_threat_scores_update_trigger();

-- Step 4: Add trigger for INSERT (currently missing)
DROP TRIGGER IF EXISTS network_threat_scores_insert
  ON app.network_threat_scores;

CREATE TRIGGER network_threat_scores_insert
  BEFORE INSERT ON app.network_threat_scores
  FOR EACH ROW
  EXECUTE FUNCTION app.network_threat_scores_update_trigger();

-- Step 5: Backfill existing rows to fix stale final_threat_score/level
UPDATE app.network_threat_scores
SET rule_based_score = rule_based_score  -- triggers BEFORE UPDATE
WHERE rule_based_score IS NOT NULL;

-- For rows with no rule_based_score yet:
UPDATE app.network_threat_scores
SET final_threat_score = 0,
    final_threat_level = 'NONE',
    model_version = '5.0'
WHERE rule_based_score IS NULL;
