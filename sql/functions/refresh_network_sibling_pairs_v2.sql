-- ============================================================================
-- SIBLING DETECTION TUNING V2 (2026-03-28)
-- ============================================================================
-- 1. Penalizes empty SSIDs
-- 2. Drastically penalizes "Common SSIDs" at distance
-- 3. Improves base confidence calculation
-- ============================================================================

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
        ELSE -0.25 -- Drastic penalty for distance over 500m
      END
    -- Penalty for common mobile SSIDs at distance
    - CASE
        WHEN lower(regexp_replace(coalesce(target_ssid, ''), '[^a-z0-9]+', '', 'g')) IN (
          'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
          'mtasmartbus','kajeetsmartbus','somguest','somiot'
        ) AND coalesce(distance_m, 0) > 100 THEN 0.40
        ELSE 0
      END
  )::numeric, 3))) AS confidence
FROM c
WHERE rule IS NOT NULL
  AND (distance_m IS NULL OR distance_m <= p_max_distance_m)
ORDER BY confidence DESC, distance_m NULLS LAST, sibling_bssid;
$function$;
