-- Migration: Update api_network_explorer_mv to include Threat Score v2.0
-- Purpose: Add threat_score_v2, threat_factors, threat_level columns while keeping legacy threat column
-- Date: 2026-01-17

BEGIN;

-- Drop backup if it exists (it's blocking the main MV drop)
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv_backup CASCADE;

-- Create backup BEFORE dropping main MV
CREATE MATERIALIZED VIEW public.api_network_explorer_mv_backup AS
SELECT * FROM public.api_network_explorer_mv;

-- Now drop and recreate main MV
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;

-- Recreate MV with threat_score_v2 integration
CREATE MATERIALIZED VIEW public.api_network_explorer_mv AS
WITH
-- ============================================================================
-- CTE 1: Latest observation per BSSID (ground truth)
-- ============================================================================
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

-- ============================================================================
-- CTE 2: Home location (fallback to hardcoded point)
-- ============================================================================
home_location AS (
  SELECT
    -83.69682688::double precision AS home_lon,
    43.02345147::double precision AS home_lat
),

-- ============================================================================
-- CTE 3: First observation geom per BSSID (for movement calculation)
-- ============================================================================
obs_first AS (
  SELECT DISTINCT ON (bssid)
    bssid,
    geom AS first_geom
  FROM public.observations
  WHERE geom IS NOT NULL
    AND bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
    AND time >= '2000-01-01 00:00:00+00'::timestamptz
  ORDER BY bssid, time ASC
),

-- ============================================================================
-- CTE 4: Movement metrics per BSSID
-- ============================================================================
movement_metrics AS (
  SELECT
    obs.bssid,
    MIN(obs.altitude) AS min_altitude_m,
    MAX(obs.altitude) AS max_altitude_m,
    ST_Distance(
      ST_Point(MIN(obs.lon), MIN(obs.lat))::geography,
      ST_Point(MAX(obs.lon), MAX(obs.lat))::geography
    ) AS max_distance_meters
  FROM public.observations obs
  WHERE obs.geom IS NOT NULL
    AND obs.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  GROUP BY obs.bssid
),

-- ============================================================================
-- CTE 5: Threat Analysis (rule-based scoring) - LEGACY
-- ============================================================================
threat_metrics AS (
  SELECT
    obs.bssid,
    COUNT(*) AS obs_count,
    COUNT(DISTINCT DATE(obs.time)) AS unique_days,
    MAX(ST_Distance(
      COALESCE(
        home_marker.location,
        ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography
      ),
      obs.geom::geography
    )) / 1000.0 AS max_distance_km,
    BOOL_OR(
      ST_Distance(
        COALESCE(
          home_marker.location,
          ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography
        ),
        obs.geom::geography
      ) < 100
    ) AS seen_at_home,
    BOOL_OR(
      ST_Distance(
        COALESCE(
          home_marker.location,
          ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography
        ),
        obs.geom::geography
      ) > 500
    ) AS seen_away,
    COALESCE(
      MAX(
        ST_Distance(
          LAG(obs.geom::geography) OVER (PARTITION BY obs.bssid ORDER BY obs.time),
          obs.geom::geography
        ) / 1000.0 / NULLIF(
          EXTRACT(EPOCH FROM (obs.time - LAG(obs.time) OVER (PARTITION BY obs.bssid ORDER BY obs.time))) / 3600.0,
          0
        )
      ),
      0
    ) AS max_speed_kmh
  FROM public.observations obs
  CROSS JOIN home_location home
  LEFT JOIN LATERAL (
    SELECT location
    FROM app.location_markers
    WHERE marker_type = 'gps_reading'
    ORDER BY created_at DESC
    LIMIT 1
  ) home_marker ON true
  WHERE obs.geom IS NOT NULL
    AND obs.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  GROUP BY obs.bssid
),

-- ============================================================================
-- CTE 6: Threat Scoring (build JSON object) - LEGACY
-- ============================================================================
threat_scores AS (
  SELECT
    tm.bssid,
    (
      CASE WHEN tm.seen_at_home AND tm.seen_away THEN 40 ELSE 0 END +
      CASE WHEN tm.max_distance_km > 0.2 THEN 25 ELSE 0 END +
      CASE
        WHEN tm.max_speed_kmh > 100 THEN 20
        WHEN tm.max_speed_kmh > 50 THEN 15
        WHEN tm.max_speed_kmh > 20 THEN 10
        ELSE 0
      END +
      CASE
        WHEN tm.unique_days >= 7 THEN 15
        WHEN tm.unique_days >= 3 THEN 10
        WHEN tm.unique_days >= 2 THEN 5
        ELSE 0
      END +
      CASE
        WHEN tm.obs_count >= 50 THEN 10
        WHEN tm.obs_count >= 20 THEN 5
        ELSE 0
      END
    ) AS raw_score,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN tm.seen_at_home AND tm.seen_away THEN 'SEEN_AT_HOME_AND_AWAY' END,
      CASE WHEN tm.max_distance_km > 0.2 THEN 'EXCESSIVE_MOVEMENT' END,
      CASE WHEN tm.max_speed_kmh > 100 THEN 'VEHICLE_SPEED'
           WHEN tm.max_speed_kmh > 50 THEN 'HIGH_SPEED'
           WHEN tm.max_speed_kmh > 20 THEN 'MODERATE_SPEED' END,
      CASE WHEN tm.unique_days >= 7 THEN 'PERSISTENT_TRACKING'
           WHEN tm.unique_days >= 3 THEN 'MULTI_DAY_OBSERVATION' END,
      CASE WHEN tm.obs_count >= 50 THEN 'HIGH_OBSERVATION_COUNT' END
    ], NULL) AS threat_flags,
    '[]'::jsonb AS signals_array,
    tm.seen_at_home,
    tm.seen_away,
    tm.max_distance_km,
    tm.max_speed_kmh,
    tm.unique_days,
    tm.obs_count
  FROM threat_metrics tm
)

-- ============================================================================
-- MAIN SELECT: Build final materialized view with v2 threat scoring
-- ============================================================================
SELECT
  ap.bssid,
  COALESCE(obs.ssid, ap.ssid) AS ssid,
  obs.time AS first_seen,
  obs.time AS last_seen,
  obs.time AS observed_at,
  COALESCE(tm.obs_count, 0) AS observations,
  obs.lat,
  obs.lon,
  obs.accuracy AS accuracy_meters,
  obs.level AS signal,
  obs.radio_frequency AS frequency,
  obs.radio_capabilities AS capabilities,
  CASE WHEN obs.radio_frequency >= 5925 THEN true ELSE false END AS is_6ghz,
  CASE WHEN obs.radio_frequency >= 5000 AND obs.radio_frequency < 5925 THEN true ELSE false END AS is_5ghz,
  CASE WHEN COALESCE(obs.ssid, ap.ssid) = '' OR COALESCE(obs.ssid, ap.ssid) IS NULL THEN true ELSE false END AS is_hidden,
  CASE
    WHEN obs.radio_frequency BETWEEN 2400 AND 2500 THEN 'W'
    WHEN obs.radio_frequency BETWEEN 5000 AND 6000 THEN 'W'
    WHEN obs.radio_frequency BETWEEN 5925 AND 7125 THEN 'W'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(WPA|WEP|WPS|RSN|ESS|CCMP|TKIP)' THEN 'W'
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
        COALESCE(
          home_marker.location,
          ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography
        ),
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
  
  -- LEGACY THREAT COLUMN (keep for backward compatibility)
  CASE
    WHEN ts.raw_score IS NOT NULL THEN
      JSONB_BUILD_OBJECT(
        'score', ROUND((ts.raw_score / 100.0)::numeric, 3),
        'level', CASE
          WHEN ts.raw_score >= 70 THEN 'HIGH'
          WHEN ts.raw_score >= 50 THEN 'MED'
          WHEN ts.raw_score >= 30 THEN 'LOW'
          ELSE 'NONE'
        END,
        'flags', TO_JSONB(ts.threat_flags),
        'signals', ts.signals_array,
        'summary', CASE
          WHEN ts.seen_at_home AND ts.seen_away AND ts.max_speed_kmh > 20 THEN
            FORMAT('Mobile tracking device: observed at home and %s km away, max speed %s km/h',
              ROUND(ts.max_distance_km::numeric, 1),
              ROUND(ts.max_speed_kmh::numeric, 0))
          WHEN ts.seen_at_home AND ts.seen_away THEN
            FORMAT('Potential stalking device: observed both at home and %s km away',
              ROUND(ts.max_distance_km::numeric, 1))
          WHEN ts.max_distance_km > 1 AND ts.unique_days > 1 THEN
            FORMAT('Following pattern: %s km range over %s days',
              ROUND(ts.max_distance_km::numeric, 1),
              ts.unique_days)
          WHEN ts.max_speed_kmh > 100 THEN
            FORMAT('High-speed vehicle tracker: %s km/h maximum speed',
              ROUND(ts.max_speed_kmh::numeric, 0))
          WHEN ts.raw_score < 30 THEN
            'No significant threat indicators detected'
          ELSE
            FORMAT('Suspicious movement: %s observations over %s days',
              ts.obs_count, ts.unique_days)
        END
      )
    ELSE
      JSONB_BUILD_OBJECT(
        'score', 0.0,
        'level', 'NONE',
        'flags', '[]'::jsonb,
        'signals', '[]'::jsonb,
        'summary', 'Insufficient data for threat analysis'
      )
  END AS threat,
  
  -- NEW: THREAT SCORE V2.0 COLUMNS
  COALESCE(ts_v2.threat_score_v2, 0.0) AS threat_score_v2,
  COALESCE(ts_v2.threat_factors, '{}'::jsonb) AS threat_factors,
  COALESCE(ts_v2.threat_level, 'MINIMAL') AS threat_level

FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN threat_scores ts ON ts.bssid = ap.bssid
LEFT JOIN LATERAL (
  SELECT
    location,
    location_3d,
    latitude,
    longitude,
    accuracy,
    altitude
  FROM app.location_markers
  WHERE marker_type = 'gps_reading'
  ORDER BY created_at DESC
  LIMIT 1
) home_marker ON true
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
-- NEW: LATERAL join to calculate threat_score_v2 for each BSSID
LEFT JOIN LATERAL (
  SELECT 
    threat_score_v2,
    threat_factors,
    threat_level
  FROM calculate_threat_score_v2(ap.bssid)
) ts_v2 ON true
WHERE COALESCE(ap.is_sentinel, FALSE) = FALSE
WITH NO DATA;

-- Create indexes for performance and concurrent refresh
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
  ON public.api_network_explorer_mv (((threat->>'score')::numeric));
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_distance_home_idx
  ON public.api_network_explorer_mv (distance_from_home_km);

-- NEW: Indexes for threat_score_v2
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_threat_v2_score_idx
  ON public.api_network_explorer_mv (threat_score_v2 DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_threat_v2_level_idx
  ON public.api_network_explorer_mv (threat_level);

-- Recreate view
CREATE OR REPLACE VIEW public.api_network_explorer AS
SELECT * FROM public.api_network_explorer_mv;

GRANT SELECT ON public.api_network_explorer_mv TO PUBLIC;
GRANT SELECT ON public.api_network_explorer TO PUBLIC;

COMMIT;

-- Populate materialized view data
REFRESH MATERIALIZED VIEW public.api_network_explorer_mv;
