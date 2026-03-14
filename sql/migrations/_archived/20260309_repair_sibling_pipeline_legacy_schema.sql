-- Repair migration for environments where sibling pipeline was partially
-- applied or created against a legacy app.network_sibling_pairs schema.
-- This migration is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS app.network_sibling_pairs (
  bssid1 varchar(17) NOT NULL,
  bssid2 varchar(17) NOT NULL,
  rule text NOT NULL DEFAULT 'heuristic',
  confidence numeric(6,3) NOT NULL,
  pair_strength text NOT NULL DEFAULT 'candidate',
  d_last_octet int,
  d_third_octet int,
  ssid1 text,
  ssid2 text,
  frequency1 int,
  frequency2 int,
  distance_m numeric,
  quality_scope text NOT NULL DEFAULT 'default',
  source text NOT NULL DEFAULT 'heuristic',
  computed_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT network_sibling_pairs_pkey PRIMARY KEY (bssid1, bssid2),
  CONSTRAINT network_sibling_pairs_order_chk CHECK (bssid1 < bssid2),
  CONSTRAINT network_sibling_pairs_strength_chk CHECK (pair_strength IN ('candidate', 'strong', 'verified')),
  CONSTRAINT network_sibling_pairs_conf_chk CHECK (confidence >= 0 AND confidence <= 2)
);

ALTER TABLE IF EXISTS app.network_sibling_pairs
  ADD COLUMN IF NOT EXISTS pair_strength text,
  ADD COLUMN IF NOT EXISTS quality_scope text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean;

UPDATE app.network_sibling_pairs
SET
  pair_strength = COALESCE(pair_strength, 'candidate'),
  quality_scope = COALESCE(quality_scope, 'default'),
  source = COALESCE(source, 'heuristic'),
  computed_at = COALESCE(computed_at, now()),
  is_active = COALESCE(is_active, true)
WHERE pair_strength IS NULL
   OR quality_scope IS NULL
   OR source IS NULL
   OR computed_at IS NULL
   OR is_active IS NULL;

ALTER TABLE IF EXISTS app.network_sibling_pairs
  ALTER COLUMN pair_strength SET DEFAULT 'candidate',
  ALTER COLUMN quality_scope SET DEFAULT 'default',
  ALTER COLUMN source SET DEFAULT 'heuristic',
  ALTER COLUMN computed_at SET DEFAULT now(),
  ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE IF EXISTS app.network_sibling_pairs
  ALTER COLUMN pair_strength SET NOT NULL,
  ALTER COLUMN quality_scope SET NOT NULL,
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN computed_at SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'network_sibling_pairs_strength_chk'
      AND conrelid = 'app.network_sibling_pairs'::regclass
  ) THEN
    ALTER TABLE app.network_sibling_pairs
      ADD CONSTRAINT network_sibling_pairs_strength_chk
      CHECK (pair_strength IN ('candidate', 'strong', 'verified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'network_sibling_pairs_conf_chk'
      AND conrelid = 'app.network_sibling_pairs'::regclass
  ) THEN
    ALTER TABLE app.network_sibling_pairs
      ADD CONSTRAINT network_sibling_pairs_conf_chk
      CHECK (confidence >= 0 AND confidence <= 2);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_conf
  ON app.network_sibling_pairs (confidence DESC);

CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_strength
  ON app.network_sibling_pairs (pair_strength, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_bssid1
  ON app.network_sibling_pairs (bssid1);

CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_bssid2
  ON app.network_sibling_pairs (bssid2);

CREATE TABLE IF NOT EXISTS app.network_sibling_overrides (
  bssid1 varchar(17) NOT NULL,
  bssid2 varchar(17) NOT NULL,
  relation text NOT NULL,
  confidence numeric(6,3) NOT NULL DEFAULT 1.000,
  notes text,
  updated_by text NOT NULL DEFAULT 'analyst',
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT network_sibling_overrides_pkey PRIMARY KEY (bssid1, bssid2),
  CONSTRAINT network_sibling_overrides_order_chk CHECK (bssid1 < bssid2),
  CONSTRAINT network_sibling_overrides_relation_chk CHECK (relation IN ('sibling', 'not_sibling')),
  CONSTRAINT network_sibling_overrides_conf_chk CHECK (confidence >= 0 AND confidence <= 2)
);

CREATE INDEX IF NOT EXISTS idx_network_sibling_overrides_relation
  ON app.network_sibling_overrides (relation, is_active);

CREATE OR REPLACE VIEW app.network_siblings_effective AS
WITH blocked AS (
  SELECT bssid1, bssid2
  FROM app.network_sibling_overrides
  WHERE is_active = true
    AND relation = 'not_sibling'
),
manual_positive AS (
  SELECT
    o.bssid1,
    o.bssid2,
    'manual_override'::text AS rule,
    o.confidence,
    'verified'::text AS pair_strength,
    null::int AS d_last_octet,
    null::int AS d_third_octet,
    null::text AS ssid1,
    null::text AS ssid2,
    null::int AS frequency1,
    null::int AS frequency2,
    null::numeric AS distance_m,
    'default'::text AS quality_scope,
    'manual'::text AS source,
    o.updated_at AS computed_at
  FROM app.network_sibling_overrides o
  WHERE o.is_active = true
    AND o.relation = 'sibling'
),
heuristic_strong AS (
  SELECT
    p.bssid1,
    p.bssid2,
    p.rule,
    p.confidence,
    CASE
      WHEN p.confidence >= 0.97 THEN 'strong'
      WHEN p.confidence >= 0.90 THEN 'candidate'
      ELSE 'candidate'
    END AS pair_strength,
    p.d_last_octet,
    p.d_third_octet,
    p.ssid1,
    p.ssid2,
    p.frequency1,
    p.frequency2,
    p.distance_m,
    p.quality_scope,
    'heuristic'::text AS source,
    p.computed_at
  FROM app.network_sibling_pairs p
  LEFT JOIN blocked b
    ON b.bssid1 = p.bssid1 AND b.bssid2 = p.bssid2
  WHERE p.confidence >= 0.92
    AND b.bssid1 IS NULL
)
SELECT * FROM manual_positive
UNION ALL
SELECT hs.*
FROM heuristic_strong hs
LEFT JOIN manual_positive mp
  ON mp.bssid1 = hs.bssid1 AND mp.bssid2 = hs.bssid2
WHERE mp.bssid1 IS NULL;

CREATE OR REPLACE FUNCTION app.set_network_sibling_override(
  p_bssid_a text,
  p_bssid_b text,
  p_relation text,
  p_updated_by text,
  p_notes text DEFAULT NULL,
  p_confidence numeric DEFAULT 1.000
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_bssid1 text;
  v_bssid2 text;
BEGIN
  v_bssid1 := LEAST(upper(trim(p_bssid_a)), upper(trim(p_bssid_b)));
  v_bssid2 := GREATEST(upper(trim(p_bssid_a)), upper(trim(p_bssid_b)));

  INSERT INTO app.network_sibling_overrides (
    bssid1, bssid2, relation, confidence, notes, updated_by, updated_at, is_active
  )
  VALUES (
    v_bssid1, v_bssid2, lower(trim(p_relation)), p_confidence, p_notes, p_updated_by, now(), true
  )
  ON CONFLICT (bssid1, bssid2) DO UPDATE
  SET
    relation = EXCLUDED.relation,
    confidence = EXCLUDED.confidence,
    notes = EXCLUDED.notes,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at,
    is_active = true;
END;
$$;

