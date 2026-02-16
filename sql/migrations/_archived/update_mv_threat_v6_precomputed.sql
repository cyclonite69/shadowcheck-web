-- Update Materialized View to Use Pre-computed Threat Scores from Cache Table
-- Purpose: Replace complex CASE statements with fast cache table lookups

BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;

-- Recreate MV with cache table integration (simplified and fast)
CREATE MATERIALIZED VIEW public.api_network_explorer_mv AS
WITH
-- Latest observation per BSSID
obs_latest AS (
  SELECT DISTINCT ON (bssid)
    bssid,
    ssid,
    lat,
    lon,
    level,
    accuracy,
    time,
    radio_type,
    radio_frequency,
    radio_capabilities,
    geom,
    altitude
  FROM public.observations
  WHERE geom IS NOT NULL
    AND bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
    AND time >= '2000-01-01 00:00:00+00'::timestamptz
  ORDER BY bssid, time DESC
),

-- Home location
home_location AS (
  SELECT
    COALESCE(
      (SELECT longitude FROM app.location_markers WHERE marker_type = 'home' LIMIT 1),
      -83.69682688
    )::double precision AS home_lon,
    COALESCE(
      (SELECT latitude FROM app.location_markers WHERE marker_type = 'home' LIMIT 1),
      43.02345147
    )::double precision AS home_lat
),

-- Movement metrics for threat computation
movement_metrics AS (
  SELECT
    obs.bssid,
    MIN(obs.altitude) AS min_altitude_m,
    MAX(obs.altitude) AS max_altitude_m,
    ST_Distance(
      ST_SetSRID(ST_MakePoint(MIN(obs.lon), MIN(obs.lat)), 4326)::geography,
      ST_SetSRID(ST_MakePoint(MAX(obs.lon), MAX(obs.lat)), 4326)::geography
    ) AS max_distance_meters,
    COUNT(*) AS obs_count,
    COUNT(DISTINCT DATE(obs.time)) AS unique_days,
    COUNT(DISTINCT (FLOOR(obs.lat * 1000)::text || ',' || FLOOR(obs.lon * 1000)::text)) AS unique_locations,
    CASE
      WHEN MAX(obs.radio_frequency) BETWEEN 2412 AND 2484 THEN 'W'
      WHEN MAX(obs.radio_frequency) BETWEEN 5000 AND 5900 THEN 'W'
      WHEN MAX(obs.radio_frequency) BETWEEN 5925 AND 7125 THEN 'W'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(BLE|BTLE)' THEN 'E'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(BLUETOOTH)' THEN 'B'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(LTE|4G)' THEN 'L'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(5G|NR)' THEN 'N'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(GSM|CDMA)' THEN 'G'
      ELSE 'W'
    END AS inferred_type
  FROM public.observations obs
  WHERE obs.geom IS NOT NULL
    AND obs.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
    AND obs.lat IS NOT NULL AND obs.lon IS NOT NULL
    AND obs.lat BETWEEN -90 AND 90 AND obs.lon BETWEEN -180 AND 180
  GROUP BY obs.bssid
)

-- Main select - FAST version using cache table
SELECT
  ap.bssid,
  COALESCE(obs.ssid, ap.latest_ssid) AS ssid,
  (SELECT MIN(time) FROM public.observations WHERE bssid = ap.bssid) AS first_seen,
  obs.time AS last_seen,
  obs.time AS observed_at,
  COALESCE(mm.obs_count, 0) AS observations,
  obs.lat,
  obs.lon,
  obs.accuracy AS accuracy_meters,
  obs.level AS signal,
  obs.radio_frequency AS frequency,
  obs.radio_capabilities AS capabilities,
  CASE WHEN obs.radio_frequency >= 5925 THEN true ELSE false END AS is_6ghz,
  CASE WHEN obs.radio_frequency >= 5000 AND obs.radio_frequency < 5925 THEN true ELSE false END AS is_5ghz,
  CASE WHEN COALESCE(obs.ssid, ap.latest_ssid) = '' OR COALESCE(obs.ssid, ap.latest_ssid) IS NULL THEN true ELSE false END AS is_hidden,
  COALESCE(mm.inferred_type, '?') AS type,
  CASE
    WHEN COALESCE(obs.radio_capabilities, '') = '' THEN 'OPEN'
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA3|SAE)' THEN 'WPA3'
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA2|RSN)' THEN 'WPA2'
    WHEN UPPER(obs.radio_capabilities) LIKE '%WPA%' THEN 'WPA'
    WHEN UPPER(obs.radio_capabilities) LIKE '%WEP%' THEN 'WEP'
    ELSE 'Unknown'
  END AS security,
  CASE WHEN obs.geom IS NOT NULL THEN
    ST_Distance(
      ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography,
      obs.geom::geography
    ) / 1000.0
  ELSE NULL
  END AS distance_from_home_km,
  mm.min_altitude_m,
  mm.max_altitude_m,
  (mm.max_altitude_m - mm.min_altitude_m) AS altitude_span_m,
  mm.max_distance_meters,
  mm.unique_days,
  mm.unique_locations,
  rm.manufacturer,
  obs.geom AS last_geom,
  obs.altitude AS last_altitude_m,
  COALESCE(ap.is_sentinel, FALSE) AS is_sentinel,

  -- THREAT COLUMN: Use cache table when available, fallback to simple logic
  CASE
    -- Use cached values if available and recent (within 24 hours)
    WHEN tsc.computed_at IS NOT NULL AND tsc.computed_at > (NOW() - INTERVAL '24 hours') THEN
      jsonb_build_object(
        'score', COALESCE(tsc.threat_score, 0),
        'level', COALESCE(tsc.threat_level, 'NONE'),
        'summary', COALESCE(tsc.threat_summary, 'Cached threat score'),
        'flags', COALESCE(tsc.threat_flags, ARRAY[]::TEXT[]),
        'computed_at', tsc.computed_at,
        'source', 'cache'
      )
    -- Fallback to simple distance-based logic for new/stale records
    ELSE
      CASE
        WHEN COALESCE(mm.inferred_type, '?') IN ('L', 'G', 'N') THEN
          jsonb_build_object('score', 0, 'level', 'NONE', 'summary', 'Cellular excluded', 'flags', ARRAY['CELLULAR'], 'source', 'fallback')
        WHEN COALESCE(mm.max_distance_meters, 0) > 2000 THEN
          jsonb_build_object('score', 75, 'level', 'HIGH', 'summary', 'High mobility detected', 'flags', ARRAY['MOBILE_HIGH'], 'source', 'fallback')
        WHEN COALESCE(mm.max_distance_meters, 0) > 500 THEN
          jsonb_build_object('score', 45, 'level', 'MED', 'summary', 'Medium mobility detected', 'flags', ARRAY['MOBILE_MED'], 'source', 'fallback')
        WHEN COALESCE(mm.max_distance_meters, 0) > 100 THEN
          jsonb_build_object('score', 25, 'level', 'LOW', 'summary', 'Low mobility detected', 'flags', ARRAY['MOBILE_LOW'], 'source', 'fallback')
        ELSE
          jsonb_build_object('score', 0, 'level', 'NONE', 'summary', 'Stationary device', 'flags', ARRAY['STATIONARY'], 'source', 'fallback')
      END
  END AS threat

FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN public.threat_scores_cache tsc ON tsc.bssid = ap.bssid
LEFT JOIN LATERAL (
  SELECT manufacturer
  FROM app.radio_manufacturers r
  WHERE r.prefix = SUBSTRING(REPLACE(ap.bssid, ':', ''), 1, r.bit_length / 4)
  ORDER BY r.bit_length DESC
  LIMIT 1
) rm ON true
WHERE COALESCE(ap.is_sentinel, FALSE) = FALSE
WITH NO DATA;

-- Create indexes
CREATE UNIQUE INDEX api_network_explorer_mv_bssid_idx ON public.api_network_explorer_mv (bssid);
CREATE INDEX api_network_explorer_mv_last_seen_idx ON public.api_network_explorer_mv (last_seen);
CREATE INDEX api_network_explorer_mv_threat_level_idx ON public.api_network_explorer_mv ((threat->>'level'));
CREATE INDEX api_network_explorer_mv_threat_score_idx ON public.api_network_explorer_mv (((threat->>'score')::numeric) DESC);
CREATE INDEX api_network_explorer_mv_max_distance_idx ON public.api_network_explorer_mv (max_distance_meters DESC);

-- Recreate view
CREATE OR REPLACE VIEW public.api_network_explorer AS SELECT * FROM public.api_network_explorer_mv;

GRANT SELECT ON public.api_network_explorer_mv TO PUBLIC;
GRANT SELECT ON public.api_network_explorer TO PUBLIC;

COMMIT;

-- Initial population
REFRESH MATERIALIZED VIEW public.api_network_explorer_mv;
