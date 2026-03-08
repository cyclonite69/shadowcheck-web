-- Sibling Detection Pipeline
-- Creates:
--   - app.network_sibling_pairs (heuristic candidates + strong links)
--   - app.network_sibling_overrides (analyst truth table)
--   - app.network_siblings_effective (manual + strong heuristic, with exclusions)
--   - app.refresh_network_sibling_pairs(...) (batch refresh from find_sibling_radios)
--   - app.set_network_sibling_override(...) (helper for manual decisions)

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relname = 'network_sibling_pairs'
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_conf ON app.network_sibling_pairs (confidence DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_strength ON app.network_sibling_pairs (pair_strength, confidence DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_bssid1 ON app.network_sibling_pairs (bssid1)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_bssid2 ON app.network_sibling_pairs (bssid2)';
  END IF;
END
$$;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relname = 'network_sibling_overrides'
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_network_sibling_overrides_relation ON app.network_sibling_overrides (relation, is_active)';
  END IF;
END
$$;

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
    p.pair_strength,
    p.d_last_octet,
    p.d_third_octet,
    p.ssid1,
    p.ssid2,
    p.frequency1,
    p.frequency2,
    p.distance_m,
    p.quality_scope,
    p.source,
    p.computed_at
  FROM app.network_sibling_pairs p
  LEFT JOIN blocked b
    ON b.bssid1 = p.bssid1 AND b.bssid2 = p.bssid2
  WHERE p.is_active = true
    AND p.pair_strength IN ('strong', 'verified')
    AND b.bssid1 IS NULL
)
SELECT * FROM manual_positive
UNION ALL
SELECT hs.*
FROM heuristic_strong hs
LEFT JOIN manual_positive mp
  ON mp.bssid1 = hs.bssid1 AND mp.bssid2 = hs.bssid2
WHERE mp.bssid1 IS NULL;

CREATE OR REPLACE FUNCTION app.refresh_network_sibling_pairs(
  p_max_octet_delta int DEFAULT 6,
  p_max_distance_m numeric DEFAULT 5000,
  p_min_candidate_conf numeric DEFAULT 0.70,
  p_min_strong_conf numeric DEFAULT 0.92,
  p_seed_limit int DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_rowcount bigint := 0;
BEGIN
  IF to_regprocedure('app.find_sibling_radios(text,integer,numeric)') IS NULL
     AND to_regprocedure('app.find_sibling_radios(text,integer,double precision)') IS NULL THEN
    RAISE EXCEPTION 'Missing function app.find_sibling_radios(text, integer, numeric/double precision)';
  END IF;

  WITH seeds AS (
    SELECT ne.bssid
    FROM app.api_network_explorer_mv ne
    WHERE ne.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
    ORDER BY ne.bssid
    LIMIT COALESCE(p_seed_limit, 2147483647)
  ),
  hits AS (
    SELECT s.bssid AS seed_bssid, r.*
    FROM seeds s
    CROSS JOIN LATERAL app.find_sibling_radios(s.bssid, p_max_octet_delta, p_max_distance_m) r
  ),
  dedup AS (
    SELECT DISTINCT ON (LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid))
      LEAST(seed_bssid, sibling_bssid) AS bssid1,
      GREATEST(seed_bssid, sibling_bssid) AS bssid2,
      rule,
      confidence,
      d_last_octet,
      d_third_octet,
      target_ssid AS ssid1,
      sibling_ssid AS ssid2,
      frequency_target AS frequency1,
      frequency_sibling AS frequency2,
      distance_m
    FROM hits
    ORDER BY LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid), confidence DESC
  ),
  scored AS (
    SELECT
      d.*,
      lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) AS n1,
      lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g')) AS n2,
      CASE
        WHEN d.distance_m IS NULL THEN 0
        WHEN d.distance_m <= 100 THEN 0
        WHEN d.distance_m <= 500 THEN 0.03
        WHEN d.distance_m <= 1500 THEN 0.08
        ELSE 0.15
      END AS distance_penalty
    FROM dedup d
  ),
  final_pairs AS (
    SELECT
      s.bssid1,
      s.bssid2,
      s.rule,
      (
        s.confidence
        - s.distance_penalty
        + CASE
            WHEN s.n1 <> '' AND s.n2 <> ''
             AND (s.n1 = s.n2 OR s.n1 LIKE s.n2 || '%' OR s.n2 LIKE s.n1 || '%') THEN 0.07
            ELSE 0
          END
      ) AS final_conf,
      s.d_last_octet,
      s.d_third_octet,
      s.ssid1,
      s.ssid2,
      s.frequency1,
      s.frequency2,
      s.distance_m
    FROM scored s
  )
  INSERT INTO app.network_sibling_pairs (
    bssid1, bssid2, rule, confidence, pair_strength,
    d_last_octet, d_third_octet, ssid1, ssid2,
    frequency1, frequency2, distance_m,
    quality_scope, source, computed_at, is_active
  )
  SELECT
    f.bssid1,
    f.bssid2,
    f.rule,
    f.final_conf,
    CASE WHEN f.final_conf >= p_min_strong_conf THEN 'strong' ELSE 'candidate' END AS pair_strength,
    f.d_last_octet,
    f.d_third_octet,
    f.ssid1,
    f.ssid2,
    f.frequency1,
    f.frequency2,
    f.distance_m,
    'default',
    'heuristic',
    now(),
    true
  FROM final_pairs f
  WHERE f.final_conf >= p_min_candidate_conf
  ON CONFLICT (bssid1, bssid2) DO UPDATE
  SET
    rule = EXCLUDED.rule,
    confidence = EXCLUDED.confidence,
    pair_strength = EXCLUDED.pair_strength,
    d_last_octet = EXCLUDED.d_last_octet,
    d_third_octet = EXCLUDED.d_third_octet,
    ssid1 = EXCLUDED.ssid1,
    ssid2 = EXCLUDED.ssid2,
    frequency1 = EXCLUDED.frequency1,
    frequency2 = EXCLUDED.frequency2,
    distance_m = EXCLUDED.distance_m,
    quality_scope = EXCLUDED.quality_scope,
    source = EXCLUDED.source,
    computed_at = EXCLUDED.computed_at,
    is_active = true;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  RETURN v_rowcount;
END;
$$;

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relname = 'network_sibling_pairs'
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    EXECUTE $sql$
      COMMENT ON TABLE app.network_sibling_pairs IS
      'Heuristic sibling detection output. pair_strength in (candidate,strong,verified).'
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relname = 'network_sibling_overrides'
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    EXECUTE $sql$
      COMMENT ON TABLE app.network_sibling_overrides IS
      'Analyst truth table for sibling/not_sibling decisions.'
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relname = 'network_siblings_effective'
      AND c.relkind = 'v'
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  ) THEN
    EXECUTE $sql$
      COMMENT ON VIEW app.network_siblings_effective IS
      'Effective sibling graph: manual overrides plus strong heuristic pairs not explicitly blocked.'
    $sql$;
  END IF;
END
$$;
