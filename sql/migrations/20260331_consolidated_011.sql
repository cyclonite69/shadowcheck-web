-- ============================================================================
-- Consolidated Migration 011
-- ============================================================================
-- Squashes 12 individual migrations applied between 2026-03-27 and 2026-03-30.
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE / ON CONFLICT).
-- Safe to apply on a fresh DB or skip on existing DBs where the originals ran.
--
-- Replaces:
--   20260327_grant_network_threat_scores_runtime_permissions.sql
--   20260327_tune_sibling_pair_scoring.sql
--   20260328_add_critical_infra_dashboard_indexes.sql
--   20260328_fix_mv_scoring_columns.sql
--   20260329_add_missing_network_columns.sql
--   20260329_deploy_optimized_sibling_detection.sql
--   20260329_fix_job_runs_constraint.sql
--   20260329_fix_users_table.sql
--   20260330_add_upper_bssid_functional_indexes.sql
--   20260330_backfill_network_altitude_columns.sql
--   20260330_create_network_locations.sql
--   20260330_install_refresh_network_locations.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Runtime permissions
-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.network_threat_scores TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.network_threat_scores_id_seq TO shadowcheck_user;


-- ----------------------------------------------------------------------------
-- 2. Wigle dashboard indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_wigle_v2_country_region_encryption_lasttime
  ON app.wigle_v2_networks_search (country, region, encryption, lasttime DESC)
  WHERE trilat IS NOT NULL AND trilong IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wigle_v2_bssid_oui24_expr
  ON app.wigle_v2_networks_search ((LEFT(UPPER(REPLACE(bssid, ':', '')), 6)))
  WHERE country = 'US';


-- ----------------------------------------------------------------------------
-- 3. api_network_explorer_mv — add scoring + is_ignored + stationary_confidence
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv CASCADE;

CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
WITH best_obs AS (
  SELECT DISTINCT ON (o.bssid)
    o.bssid,
    o.lat,
    o.lon
  FROM app.observations o
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
  ORDER BY o.bssid, public.st_distance(
    public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::public.geography,
    (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
     FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
  ) DESC
),
obs_spatial AS (
  SELECT
    bssid,
    CASE
      WHEN count(*) < 3 THEN 0
      WHEN stddev(lat) < 0.0001 AND stddev(lon) < 0.0001 THEN 0.95
      WHEN stddev(lat) < 0.0005 AND stddev(lon) < 0.0005 THEN 0.75
      ELSE 0.25
    END AS stationary_confidence
  FROM app.observations
  WHERE lat IS NOT NULL AND lon IS NOT NULL
    AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
  GROUP BY bssid
)
SELECT
  n.bssid,
  n.ssid,
  n.type,
  n.frequency,
  n.bestlevel AS signal,
  bo.lat,
  bo.lon,
  to_timestamp((((n.lasttime_ms)::numeric / 1000.0))::double precision) AS observed_at,
  n.capabilities,
  CASE
    WHEN COALESCE(n.capabilities, '') = '' THEN 'OPEN'
    WHEN UPPER(n.capabilities) LIKE '%WEP%' THEN 'WEP'
    WHEN UPPER(n.capabilities) ~ '^\s*\[ESS\]\s*$' THEN 'OPEN'
    WHEN UPPER(n.capabilities) ~ '^\s*\[IBSS\]\s*$' THEN 'OPEN'
    WHEN UPPER(n.capabilities) ~ 'RSN-OWE' THEN 'WPA3-OWE'
    WHEN UPPER(n.capabilities) ~ 'RSN-SAE' THEN 'WPA3-P'
    WHEN UPPER(n.capabilities) ~ '(WPA3|SAE)' AND UPPER(n.capabilities) ~ '(EAP|MGT)' THEN 'WPA3-E'
    WHEN UPPER(n.capabilities) ~ '(WPA3|SAE)' THEN 'WPA3'
    WHEN UPPER(n.capabilities) ~ '(WPA2|RSN)' AND UPPER(n.capabilities) ~ '(EAP|MGT)' THEN 'WPA2-E'
    WHEN UPPER(n.capabilities) ~ '(WPA2|RSN)' THEN 'WPA2'
    WHEN UPPER(n.capabilities) ~ 'WPA-' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
    WHEN UPPER(n.capabilities) LIKE '%WPA%' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' AND UPPER(n.capabilities) NOT LIKE '%WPA3%' AND UPPER(n.capabilities) NOT LIKE '%RSN%' THEN 'WPA'
    WHEN UPPER(n.capabilities) LIKE '%WPS%' AND UPPER(n.capabilities) NOT LIKE '%WPA%' AND UPPER(n.capabilities) NOT LIKE '%RSN%' THEN 'WPS'
    WHEN UPPER(n.capabilities) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
    ELSE 'UNKNOWN'
  END AS security,
  COALESCE(w3.wigle_v3_observation_count, n.wigle_v3_observation_count, 0) AS wigle_v3_observation_count,
  COALESCE(w3.wigle_v3_last_import_at, n.wigle_v3_last_import_at) AS wigle_v3_last_import_at,
  COALESCE(t.threat_tag, 'untagged'::character varying) AS tag_type,
  COALESCE(t.is_ignored, FALSE) AS is_ignored,
  count(o.id) AS observations,
  count(DISTINCT date(o."time")) AS unique_days,
  count(DISTINCT ((round((o.lat)::numeric, 3) || ','::text) || round((o.lon)::numeric, 3))) AS unique_locations,
  max(o.accuracy) AS accuracy_meters,
  min(o."time") AS first_seen,
  max(o."time") AS last_seen,
  CASE WHEN COALESCE(t.is_ignored, FALSE) THEN 0::numeric ELSE COALESCE(ts.final_threat_score, 0::numeric) END AS threat_score,
  CASE WHEN COALESCE(t.is_ignored, FALSE) THEN 'NONE'::character varying ELSE COALESCE(ts.final_threat_level, 'NONE'::character varying) END AS threat_level,
  COALESCE(ts.rule_based_score, 0::numeric) AS rule_based_score,
  COALESCE(ts.ml_threat_score, 0::numeric) AS ml_threat_score,
  COALESCE((ts.ml_feature_values->>'evidence_weight')::numeric, 0) AS ml_weight,
  COALESCE((ts.ml_feature_values->>'ml_boost')::numeric, 0) AS ml_boost,
  ts.model_version,
  COALESCE((public.st_distance(
    public.st_setsrid(public.st_makepoint(bo.lon, bo.lat), 4326)::public.geography,
    (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
     FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
  ) / 1000.0::double precision), 0::double precision) AS distance_from_home_km,
  (SELECT MAX(public.st_distance(
    public.st_setsrid(public.st_makepoint(o1.lon, o1.lat), 4326)::public.geography,
    public.st_setsrid(public.st_makepoint(o2.lon, o2.lat), 4326)::public.geography
  ))
   FROM app.observations o1, app.observations o2
   WHERE o1.bssid = n.bssid AND o2.bssid = n.bssid
     AND o1.lat IS NOT NULL AND o1.lon IS NOT NULL
     AND o2.lat IS NOT NULL AND o2.lon IS NOT NULL
     AND (o1.is_quality_filtered = false OR o1.is_quality_filtered IS NULL)
     AND (o2.is_quality_filtered = false OR o2.is_quality_filtered IS NULL)
  ) AS max_distance_meters,
  rm.manufacturer,
  osp.stationary_confidence
FROM app.networks n
  LEFT JOIN app.network_tags t ON n.bssid = t.bssid::text
  LEFT JOIN app.observations o ON n.bssid = o.bssid
  LEFT JOIN app.network_threat_scores ts ON n.bssid = ts.bssid::text
  LEFT JOIN best_obs bo ON n.bssid = bo.bssid
  LEFT JOIN obs_spatial osp ON n.bssid = osp.bssid
  LEFT JOIN (
    SELECT netid,
      COUNT(*)::integer AS wigle_v3_observation_count,
      MAX(COALESCE(last_update, observed_at, imported_at)) AS wigle_v3_last_import_at
    FROM app.wigle_v3_observations
    GROUP BY netid
  ) w3 ON UPPER(n.bssid) = UPPER(w3.netid)
  LEFT JOIN app.radio_manufacturers rm ON UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', '')) = rm.prefix
WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
  AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
GROUP BY
  n.bssid, n.ssid, n.type, n.frequency, n.bestlevel, n.lasttime_ms, n.capabilities,
  n.wigle_v3_observation_count, n.wigle_v3_last_import_at,
  w3.wigle_v3_observation_count, w3.wigle_v3_last_import_at,
  t.threat_tag, t.is_ignored,
  ts.final_threat_score, ts.final_threat_level, ts.rule_based_score,
  ts.ml_threat_score, ts.ml_feature_values, ts.model_version,
  rm.manufacturer, bo.lat, bo.lon, osp.stationary_confidence;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid
  ON app.api_network_explorer_mv (bssid);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type
  ON app.api_network_explorer_mv (type);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observed_at
  ON app.api_network_explorer_mv (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat
  ON app.api_network_explorer_mv (threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_rule_score
  ON app.api_network_explorer_mv (rule_based_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_ml_score
  ON app.api_network_explorer_mv (ml_threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_stationary
  ON app.api_network_explorer_mv (stationary_confidence)
  WHERE stationary_confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_ignored
  ON app.api_network_explorer_mv (is_ignored)
  WHERE is_ignored = TRUE;

GRANT SELECT ON app.api_network_explorer_mv TO shadowcheck_user;
GRANT SELECT ON app.api_network_explorer_mv TO grafana_reader;
GRANT SELECT ON app.api_network_explorer_mv TO PUBLIC;

REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;


-- ----------------------------------------------------------------------------
-- 4. Missing columns on app.networks
-- ----------------------------------------------------------------------------

ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS min_altitude_m      double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS max_altitude_m      double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_span_m     double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS last_altitude_m     double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_m          double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_accuracy_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS unique_days         integer          DEFAULT 1;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS unique_locations    integer          DEFAULT 1;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS is_sentinel         boolean          DEFAULT false;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS accuracy_meters     double precision DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'app' AND table_name = 'access_points') THEN
    UPDATE app.networks n
    SET is_sentinel = ap.is_sentinel
    FROM app.access_points ap
    WHERE n.bssid = ap.bssid;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 5. Sibling detection — find_sibling_radios v3
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.find_sibling_radios(
  p_bssid text,
  p_max_octet_delta integer DEFAULT 6,
  p_max_distance_m double precision DEFAULT 1500.0
)
RETURNS TABLE(
  target_bssid text, sibling_bssid text,
  target_ssid text, sibling_ssid text,
  frequency_target integer, frequency_sibling integer,
  d_last_octet integer, d_third_octet integer,
  distance_m double precision, rule text, confidence numeric
)
LANGUAGE sql STABLE
AS $function$
WITH t AS (
  SELECT
    n.bssid, n.ssid, n.frequency,
    COALESCE(n.bestlat, n.lastlat) AS lat,
    COALESCE(n.bestlon, n.lastlon) AS lon,
    upper(split_part(n.bssid, ':', 1)) AS o1,
    upper(split_part(n.bssid, ':', 2)) AS o2
  FROM app.networks n
  WHERE upper(n.bssid) = upper(p_bssid)
  LIMIT 1
),
c AS (
  SELECT
    t.bssid AS target_bssid,
    n.bssid AS sibling_bssid,
    t.ssid AS target_ssid,
    n.ssid AS sibling_ssid,
    t.frequency AS frequency_target,
    n.frequency AS frequency_sibling,
    NULL::integer AS d_last_octet,
    NULL::integer AS d_third_octet,
    CASE
      WHEN t.lat IS NOT NULL AND t.lon IS NOT NULL
        AND COALESCE(n.bestlat, n.lastlat) IS NOT NULL
        AND COALESCE(n.bestlon, n.lastlon) IS NOT NULL
      THEN ST_Distance(
        ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::public.geography,
        ST_SetSRID(ST_MakePoint(COALESCE(n.bestlon, n.lastlon), COALESCE(n.bestlat, n.lastlat)), 4326)::public.geography
      )
      ELSE NULL
    END AS distance_m,
    CASE
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) = lower(n.ssid) THEN 'ssid_exact'
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) LIKE lower(n.ssid) || '%' THEN 'ssid_prefix_target'
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(n.ssid) LIKE lower(t.ssid) || '%' THEN 'ssid_prefix_sibling'
      WHEN (t.ssid IS NULL OR t.ssid = '') AND (n.ssid IS NULL OR n.ssid = '') THEN 'empty_ssid_match'
      ELSE 'mac_only_match'
    END AS rule,
    CASE
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) = lower(n.ssid) THEN 0.85
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) LIKE lower(n.ssid) || '%' THEN 0.70
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(n.ssid) LIKE lower(t.ssid) || '%' THEN 0.70
      WHEN (t.ssid IS NULL OR t.ssid = '') AND (n.ssid IS NULL OR n.ssid = '') THEN 0.40
      ELSE 0.30
    END AS base_confidence
  FROM t
  JOIN app.networks n
    ON upper(n.bssid) <> upper(t.bssid)
    AND upper(split_part(n.bssid, ':', 1)) = t.o1
    AND upper(split_part(n.bssid, ':', 2)) = t.o2
)
SELECT
  target_bssid, sibling_bssid, target_ssid, sibling_ssid,
  frequency_target, frequency_sibling, d_last_octet, d_third_octet, distance_m, rule,
  GREATEST(0, LEAST(1.000, round((
    COALESCE(base_confidence, 0)
    + CASE
        WHEN frequency_target = frequency_sibling THEN 0.10
        WHEN abs(frequency_target - frequency_sibling) <= 25 THEN 0.05
        ELSE 0
      END
    + CASE
        WHEN distance_m IS NULL THEN 0
        WHEN distance_m <= 50 THEN 0.10
        WHEN distance_m <= 250 THEN 0.05
        WHEN distance_m <= 500 THEN 0.01
        ELSE -0.25
      END
    - CASE
        WHEN lower(regexp_replace(coalesce(target_ssid, ''), '[^a-z0-9]+', '', 'g')) IN (
          'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
          'mtasmartbus','kajeetsmartbus','somguest','somiot'
        ) AND coalesce(distance_m, 0) > 100 THEN 0.45
        ELSE 0
      END
  )::numeric, 3))) AS confidence
FROM c
WHERE rule IS NOT NULL
  AND (distance_m IS NULL OR distance_m <= p_max_distance_m)
ORDER BY confidence DESC, distance_m NULLS LAST, sibling_bssid;
$function$;


-- ----------------------------------------------------------------------------
-- 6. Sibling detection — refresh_network_sibling_pairs (tune + incremental)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.refresh_network_sibling_pairs(
  p_max_octet_delta int DEFAULT 6,
  p_max_distance_m numeric DEFAULT 5000,
  p_min_candidate_conf numeric DEFAULT 0.70,
  p_min_strong_conf numeric DEFAULT 0.92,
  p_seed_limit int DEFAULT NULL,
  p_incremental boolean DEFAULT true
)
RETURNS bigint
LANGUAGE plpgsql AS $$
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
      AND (
        NOT p_incremental
        OR NOT EXISTS (
          SELECT 1 FROM app.network_sibling_pairs p
          WHERE (p.bssid1 = ne.bssid OR p.bssid2 = ne.bssid)
            AND p.computed_at > now() - interval '7 days'
        )
      )
    ORDER BY ne.bssid
    LIMIT COALESCE(p_seed_limit, 5000)
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
      rule, confidence, d_last_octet, d_third_octet,
      target_ssid AS ssid1, sibling_ssid AS ssid2,
      frequency_target AS frequency1, frequency_sibling AS frequency2, distance_m
    FROM hits
    ORDER BY LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid), confidence DESC
  ),
  scored AS (
    SELECT
      d.*,
      lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) AS n1,
      lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g')) AS n2,
      (lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g'))
       = lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g'))) AS ssid_same,
      (lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) IN (
        'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
        'mtasmartbus','kajeetsmartbus','somguest','somiot'
      )) AS ssid_common,
      CASE
        WHEN d.distance_m IS NULL THEN 0
        WHEN (lower(regexp_replace(coalesce(d.ssid1,''),'[^a-z0-9]+','','g'))
              = lower(regexp_replace(coalesce(d.ssid2,''),'[^a-z0-9]+','','g')))
          AND (lower(regexp_replace(coalesce(d.ssid1,''),'[^a-z0-9]+','','g')) IN (
            'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
            'mtasmartbus','kajeetsmartbus','somguest','somiot'))
        THEN CASE
          WHEN d.distance_m <= 25  THEN 0
          WHEN d.distance_m <= 75  THEN 0.05
          WHEN d.distance_m <= 150 THEN 0.12
          WHEN d.distance_m <= 300 THEN 0.28
          WHEN d.distance_m <= 500 THEN 0.45
          WHEN d.distance_m <= 1000 THEN 0.70
          ELSE 1.00
        END
        WHEN d.distance_m <= 100  THEN 0
        WHEN d.distance_m <= 500  THEN 0.03
        WHEN d.distance_m <= 1500 THEN 0.08
        ELSE 0.15
      END AS distance_penalty
    FROM dedup d
  ),
  partner_stats AS (
    SELECT radio_bssid,
      COUNT(*) FILTER (WHERE ssid_same AND ssid_common) AS common_partner_count
    FROM (
      SELECT s.bssid1 AS radio_bssid, s.ssid_same, s.ssid_common FROM scored s
      UNION ALL
      SELECT s.bssid2 AS radio_bssid, s.ssid_same, s.ssid_common FROM scored s
    ) rp
    GROUP BY radio_bssid
  ),
  family_stats AS (
    SELECT fn.ssid_norm, fp.family_pair_count, COUNT(*) AS family_radio_count
    FROM (
      SELECT DISTINCT s.n1 AS ssid_norm, s.bssid1 AS radio_bssid
      FROM scored s WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
      UNION
      SELECT DISTINCT s.n1, s.bssid2 FROM scored s
      WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
    ) fn
    JOIN (
      SELECT n1 AS ssid_norm, COUNT(*) AS family_pair_count
      FROM scored WHERE ssid_same AND ssid_common AND n1 <> ''
      GROUP BY n1
    ) fp ON fp.ssid_norm = fn.ssid_norm
    GROUP BY fn.ssid_norm, fp.family_pair_count
  ),
  final_pairs AS (
    SELECT
      s.bssid1, s.bssid2, s.rule,
      GREATEST(0, (
        s.confidence - s.distance_penalty
        + CASE
            WHEN s.n1 <> '' AND s.n2 <> '' AND s.ssid_same AND s.ssid_common
              THEN CASE WHEN coalesce(s.distance_m,999999) <= 75 THEN 0.03 ELSE 0 END
            WHEN s.n1 <> '' AND s.n2 <> ''
              AND (s.n1 = s.n2 OR s.n1 LIKE s.n2||'%' OR s.n2 LIKE s.n1||'%') THEN 0.07
            ELSE 0
          END
        - CASE
            WHEN s.rule = 'ssid_exact' AND s.ssid_same AND s.ssid_common
              AND coalesce(s.distance_m,999999) > 150 THEN 0.35
            ELSE 0
          END
        - CASE WHEN s.ssid_same AND s.ssid_common THEN
            CASE
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 12 THEN 0.55
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 8  THEN 0.40
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 5  THEN 0.25
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 3  THEN 0.12
              ELSE 0
            END ELSE 0 END
        - CASE WHEN s.ssid_same AND s.ssid_common THEN
            CASE
              WHEN COALESCE(fs.family_radio_count,0) >= 18 THEN 0.25
              WHEN COALESCE(fs.family_radio_count,0) >= 10 THEN 0.15
              WHEN COALESCE(fs.family_radio_count,0) >= 6  THEN 0.08
              ELSE 0
            END ELSE 0 END
      )) AS final_conf,
      s.d_last_octet, s.d_third_octet,
      s.ssid1, s.ssid2, s.frequency1, s.frequency2, s.distance_m
    FROM scored s
    LEFT JOIN partner_stats ps1 ON ps1.radio_bssid = s.bssid1
    LEFT JOIN partner_stats ps2 ON ps2.radio_bssid = s.bssid2
    LEFT JOIN family_stats fs ON fs.ssid_norm = s.n1
  )
  INSERT INTO app.network_sibling_pairs (
    bssid1, bssid2, rule, confidence,
    d_last_octet, d_third_octet, ssid1, ssid2,
    frequency1, frequency2, distance_m, quality_scope, computed_at
  )
  SELECT
    f.bssid1, f.bssid2, f.rule, f.final_conf,
    f.d_last_octet, f.d_third_octet, f.ssid1, f.ssid2,
    f.frequency1, f.frequency2, f.distance_m, 'default', now()
  FROM final_pairs f
  WHERE f.final_conf >= p_min_candidate_conf
  ON CONFLICT (bssid1, bssid2) DO UPDATE SET
    rule = EXCLUDED.rule, confidence = EXCLUDED.confidence,
    d_last_octet = EXCLUDED.d_last_octet, d_third_octet = EXCLUDED.d_third_octet,
    ssid1 = EXCLUDED.ssid1, ssid2 = EXCLUDED.ssid2,
    frequency1 = EXCLUDED.frequency1, frequency2 = EXCLUDED.frequency2,
    distance_m = EXCLUDED.distance_m, quality_scope = EXCLUDED.quality_scope,
    computed_at = EXCLUDED.computed_at;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  RETURN v_rowcount;
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. background_job_runs constraint
-- ----------------------------------------------------------------------------

ALTER TABLE app.background_job_runs
  DROP CONSTRAINT IF EXISTS background_job_runs_job_name_check;

ALTER TABLE app.background_job_runs
  ADD CONSTRAINT background_job_runs_job_name_check
  CHECK (job_name IN ('backup', 'mlScoring', 'mvRefresh', 'siblingDetection'));


-- ----------------------------------------------------------------------------
-- 8. users table — force_password_change column
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app' AND table_name = 'users'
                 AND column_name = 'force_password_change') THEN
    ALTER TABLE app.users ADD COLUMN force_password_change boolean DEFAULT false;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 9. Functional UPPER(bssid) indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_network_tags_bssid_upper
  ON app.network_tags (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_network_notes_bssid_upper
  ON app.network_notes (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_networks_bssid_upper
  ON app.networks (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid_upper
  ON app.api_network_explorer_mv (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_network_threat_scores_bssid_upper
  ON app.network_threat_scores (UPPER(bssid));


-- ----------------------------------------------------------------------------
-- 10. Backfill altitude columns on app.networks
-- ----------------------------------------------------------------------------

UPDATE app.networks n
SET
  min_altitude_m  = agg.min_alt,
  max_altitude_m  = agg.max_alt,
  altitude_span_m = agg.max_alt - agg.min_alt,
  last_altitude_m = agg.last_alt
FROM (
  SELECT bssid,
    MIN(altitude) AS min_alt,
    MAX(altitude) AS max_alt,
    (array_agg(altitude ORDER BY "time" DESC))[1] AS last_alt
  FROM app.observations
  WHERE altitude IS NOT NULL AND altitude BETWEEN -500 AND 10000
  GROUP BY bssid
) agg
WHERE n.bssid = agg.bssid;


-- ----------------------------------------------------------------------------
-- 11. app.network_locations table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app.network_locations (
  bssid            text PRIMARY KEY,
  centroid_lat     double precision,
  centroid_lon     double precision,
  weighted_lat     double precision,
  weighted_lon     double precision,
  obs_count        integer     NOT NULL DEFAULT 0,
  last_computed_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_locations_bssid
  ON app.network_locations (bssid);
CREATE INDEX IF NOT EXISTS idx_network_locations_bssid_upper
  ON app.network_locations (UPPER(bssid));

GRANT SELECT ON app.network_locations TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.network_locations TO shadowcheck_admin;


-- ----------------------------------------------------------------------------
-- 12. refresh_network_locations() function + initial population
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.refresh_network_locations()
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO app.network_locations (
    bssid, centroid_lat, centroid_lon, weighted_lat, weighted_lon, obs_count, last_computed_at
  )
  WITH bounds AS (
    SELECT bssid, MIN(level) AS min_level, MAX(level) AS max_level
    FROM app.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL AND level IS NOT NULL
      AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
    GROUP BY bssid
  ),
  weighted AS (
    SELECT
      o.bssid,
      AVG(o.lat) AS centroid_lat,
      AVG(o.lon) AS centroid_lon,
      CASE
        WHEN b.max_level = b.min_level THEN AVG(o.lat)
        ELSE SUM(((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)) * o.lat)
             / NULLIF(SUM((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)), 0)
      END AS weighted_lat,
      CASE
        WHEN b.max_level = b.min_level THEN AVG(o.lon)
        ELSE SUM(((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)) * o.lon)
             / NULLIF(SUM((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)), 0)
      END AS weighted_lon,
      COUNT(*)::integer AS obs_count
    FROM app.observations o
    JOIN bounds b ON b.bssid = o.bssid
    WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL AND o.level IS NOT NULL
      AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
    GROUP BY o.bssid, b.min_level, b.max_level
  )
  SELECT bssid, centroid_lat, centroid_lon, weighted_lat, weighted_lon, obs_count, NOW()
  FROM weighted
  ON CONFLICT (bssid) DO UPDATE SET
    centroid_lat     = EXCLUDED.centroid_lat,
    centroid_lon     = EXCLUDED.centroid_lon,
    weighted_lat     = EXCLUDED.weighted_lat,
    weighted_lon     = EXCLUDED.weighted_lon,
    obs_count        = EXCLUDED.obs_count,
    last_computed_at = EXCLUDED.last_computed_at;
END;
$$;

GRANT EXECUTE ON FUNCTION app.refresh_network_locations() TO shadowcheck_admin;

SELECT app.refresh_network_locations();
