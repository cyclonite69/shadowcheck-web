-- Migration: Deploy Optimized Sibling Detection (V3)
-- Date: 2026-03-29

BEGIN;

-- 1. Update find_sibling_radios with better scoring and penalties
CREATE OR REPLACE FUNCTION app.find_sibling_radios(
  p_bssid text, 
  p_max_octet_delta integer DEFAULT 6, 
  p_max_distance_m double precision DEFAULT 1500.0
)
RETURNS TABLE(
  target_bssid text, 
  sibling_bssid text, 
  target_ssid text, 
  sibling_ssid text, 
  frequency_target integer, 
  frequency_sibling integer, 
  d_last_octet integer, 
  d_third_octet integer, 
  distance_m double precision, 
  rule text, 
  confidence numeric
)
LANGUAGE sql
STABLE
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
  frequency_target, frequency_sibling, d_last_octet, d_third_octet, distance_m,
  rule,
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

-- 2. Update refresh_network_sibling_pairs with incremental logic and safety limits
CREATE OR REPLACE FUNCTION app.refresh_network_sibling_pairs(
  p_max_octet_delta int DEFAULT 6,
  p_max_distance_m numeric DEFAULT 5000,
  p_min_candidate_conf numeric DEFAULT 0.70,
  p_min_strong_conf numeric DEFAULT 0.92,
  p_seed_limit int DEFAULT NULL,
  p_incremental boolean DEFAULT true
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_rowcount bigint := 0;
BEGIN
  WITH seeds AS (
    SELECT ne.bssid
    FROM app.api_network_explorer_mv ne
    WHERE ne.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
      -- Optimized: only check networks that don't have recent sibling computation
      -- or if full refresh is requested
      AND (
        NOT p_incremental 
        OR NOT EXISTS (
          SELECT 1 FROM app.network_sibling_pairs p 
          WHERE p.bssid1 = ne.bssid OR p.bssid2 = ne.bssid
          AND p.computed_at > now() - interval '7 days'
        )
      )
    ORDER BY ne.bssid
    LIMIT COALESCE(p_seed_limit, 5000) -- Safety limit for one run
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
  )
  INSERT INTO app.network_sibling_pairs (
    bssid1, bssid2, rule, confidence,
    d_last_octet, d_third_octet, ssid1, ssid2,
    frequency1, frequency2, distance_m,
    quality_scope, computed_at
  )
  SELECT
    f.bssid1,
    f.bssid2,
    f.rule,
    f.confidence,
    f.d_last_octet,
    f.d_third_octet,
    f.ssid1,
    f.ssid2,
    f.frequency1,
    f.frequency2,
    f.distance_m,
    'default',
    now()
  FROM dedup f
  WHERE f.confidence >= p_min_candidate_conf
  ON CONFLICT (bssid1, bssid2) DO UPDATE
  SET
    rule = EXCLUDED.rule,
    confidence = EXCLUDED.confidence,
    d_last_octet = EXCLUDED.d_last_octet,
    d_third_octet = EXCLUDED.d_third_octet,
    ssid1 = EXCLUDED.ssid1,
    ssid2 = EXCLUDED.ssid2,
    frequency1 = EXCLUDED.frequency1,
    frequency2 = EXCLUDED.frequency2,
    distance_m = EXCLUDED.distance_m,
    quality_scope = EXCLUDED.quality_scope,
    computed_at = EXCLUDED.computed_at;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  RETURN v_rowcount;
END;
$$;

COMMIT;
