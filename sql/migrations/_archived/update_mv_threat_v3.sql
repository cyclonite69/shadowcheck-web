-- Migration: Update api_network_explorer_mv to use Threat Score v3.0
-- Purpose: Replace legacy scoring with forensically-sound v3 methodology
-- Date: 2026-01-18
--
-- Changes:
-- 1. Replaces home-dependent scoring with radio range-based analysis
-- 2. Excludes cellular networks from threat scoring
-- 3. Co-occurrence weighted at 25% (was 5%)
-- 4. High observation count at single location no longer flagged
-- 5. Signal pattern analysis added

BEGIN;

-- Note: Run calculate_threat_score_v3.sql BEFORE this migration

-- Drop backup if exists
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv_backup CASCADE;

-- Create backup
CREATE MATERIALIZED VIEW public.api_network_explorer_mv_backup AS
SELECT * FROM public.api_network_explorer_mv;

-- Drop existing views
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;

-- Recreate MV with threat_score_v3
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
    )::double precision AS home_lat,
    COALESCE(
      (SELECT radius FROM app.location_markers WHERE marker_type = 'home' LIMIT 1),
      100
    )::integer AS home_radius
),

-- Movement metrics
movement_metrics AS (
  SELECT
    obs.bssid,
    MIN(obs.altitude) AS min_altitude_m,
    MAX(obs.altitude) AS max_altitude_m,
    ST_Distance(
      ST_Point(MIN(obs.lon), MIN(obs.lat))::geography,
      ST_Point(MAX(obs.lon), MAX(obs.lat))::geography
    ) AS max_distance_meters,
    COUNT(*) AS obs_count,
    COUNT(DISTINCT DATE(obs.time)) AS unique_days
  FROM public.observations obs
  WHERE obs.geom IS NOT NULL
    AND obs.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  GROUP BY obs.bssid
)

-- Main select
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
  CASE
    WHEN obs.radio_frequency BETWEEN 2400 AND 2500 THEN 'W'
    WHEN obs.radio_frequency BETWEEN 5000 AND 6000 THEN 'W'
    WHEN obs.radio_frequency BETWEEN 5925 AND 7125 THEN 'W'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(WPA|WEP|WPS|RSN|ESS|CCMP|TKIP)' THEN 'W'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(BLE|BTLE|BLUETOOTH.?LOW.?ENERGY)' THEN 'E'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(BLUETOOTH)' THEN 'B'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(LTE|4G|EARFCN)' THEN 'L'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(5G|NR|3GPP)' THEN 'N'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(GSM|CDMA)' THEN 'G'
    ELSE '?'
  END AS type,
  CASE
    WHEN COALESCE(obs.radio_capabilities, '') = '' THEN 'OPEN'
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA3|SAE)' THEN
      CASE
        WHEN UPPER(obs.radio_capabilities) ~ '(EAP|MGT)' THEN 'WPA3-E'
        ELSE 'WPA3-P'
      END
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA2|RSN)' THEN
      CASE
        WHEN UPPER(obs.radio_capabilities) ~ '(EAP|MGT)' THEN 'WPA2-E'
        ELSE 'WPA2-P'
      END
    WHEN UPPER(obs.radio_capabilities) LIKE '%WPA%' THEN 'WPA'
    WHEN UPPER(obs.radio_capabilities) LIKE '%WEP%' THEN 'WEP'
    WHEN UPPER(obs.radio_capabilities) LIKE '%WPS%'
      AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA%' THEN 'WPS'
    ELSE 'Unknown'
  END AS security,
  CASE
    WHEN obs.geom IS NOT NULL THEN
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
  rm.manufacturer,
  rm.address AS manufacturer_address,
  obs.geom AS last_geom,
  obs.altitude AS last_altitude_m,
  COALESCE(ap.is_sentinel, FALSE) AS is_sentinel,

  -- THREAT COLUMN: Now uses v3 scoring
  COALESCE(
    calculate_threat_score_v3(ap.bssid),
    jsonb_build_object(
      'score', 0,
      'level', 'NONE',
      'summary', 'Insufficient data',
      'flags', ARRAY[]::TEXT[],
      'factors', jsonb_build_object(
        'range_violation', 0,
        'co_occurrence', 0,
        'multi_location', 0,
        'signal_pattern', 0,
        'temporal', 0
      )
    )
  ) AS threat

FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN LATERAL (
  SELECT
    manufacturer,
    address
  FROM app.radio_manufacturers r
  WHERE r.prefix =
    SUBSTRING(
      REPLACE(ap.bssid, ':', ''),
      1,
      r.bit_length / 4
    )
  ORDER BY r.bit_length DESC
  LIMIT 1
) rm ON true
WHERE COALESCE(ap.is_sentinel, FALSE) = FALSE
WITH NO DATA;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS api_network_explorer_mv_bssid_idx
  ON public.api_network_explorer_mv (bssid);

CREATE INDEX IF NOT EXISTS api_network_explorer_mv_last_seen_idx
  ON public.api_network_explorer_mv (last_seen);
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_signal_idx
  ON public.api_network_explorer_mv (signal);
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_security_idx
  ON public.api_network_explorer_mv (security);
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_threat_level_idx
  ON public.api_network_explorer_mv ((threat->>'level'));
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_threat_score_idx
  ON public.api_network_explorer_mv (((threat->>'score')::numeric) DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_distance_home_idx
  ON public.api_network_explorer_mv (distance_from_home_km);
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_type_idx
  ON public.api_network_explorer_mv (type);

-- Recreate view
CREATE OR REPLACE VIEW public.api_network_explorer AS
SELECT * FROM public.api_network_explorer_mv;

GRANT SELECT ON public.api_network_explorer_mv TO PUBLIC;
GRANT SELECT ON public.api_network_explorer TO PUBLIC;

COMMIT;

-- Populate the materialized view (this may take a while for large datasets)
REFRESH MATERIALIZED VIEW public.api_network_explorer_mv;
