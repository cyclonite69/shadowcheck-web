-- Migration: Update api_network_explorer_mv with FIXED Threat Score v3.0
-- Purpose: Fix false positives - require "seen at home AND away" as primary indicator
-- Date: 2026-01-19
--
-- Key insight: A stalking device must be seen NEAR YOUR HOME to be a threat.
-- A business WiFi you visited is NOT a threat, even if you visited multiple times.

BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv_backup CASCADE;

-- Recreate MV with FIXED v3 threat scoring
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

-- Extended movement metrics including home proximity
movement_metrics AS (
  SELECT
    obs.bssid,
    MIN(obs.altitude) AS min_altitude_m,
    MAX(obs.altitude) AS max_altitude_m,
    -- Max distance (bounding box diagonal)
    ST_Distance(
      ST_SetSRID(ST_MakePoint(MIN(obs.lon), MIN(obs.lat)), 4326)::geography,
      ST_SetSRID(ST_MakePoint(MAX(obs.lon), MAX(obs.lat)), 4326)::geography
    ) AS max_distance_meters,
    COUNT(*) AS obs_count,
    COUNT(DISTINCT DATE(obs.time)) AS unique_days,
    STDDEV(obs.level) AS signal_stddev,
    AVG(obs.level) AS signal_mean,
    -- Unique location clusters (~100m grid)
    COUNT(DISTINCT (FLOOR(obs.lat * 1000)::text || ',' || FLOOR(obs.lon * 1000)::text)) AS unique_locations,
    -- KEY: Check if seen near home (within 150m)
    BOOL_OR(
      ST_DWithin(
        ST_SetSRID(ST_MakePoint(obs.lon, obs.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography,
        150  -- 150 meters from home
      )
    ) AS seen_at_home,
    -- KEY: Check if seen far from home (>500m)
    BOOL_OR(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(obs.lon, obs.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography
      ) > 500
    ) AS seen_away,
    -- Max distance from home
    MAX(
      ST_Distance(
        ST_SetSRID(ST_MakePoint(obs.lon, obs.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography
      )
    ) AS max_distance_from_home_m,
    -- Determine network type
    CASE
      WHEN MAX(obs.radio_frequency) BETWEEN 2412 AND 2484 THEN 'W'
      WHEN MAX(obs.radio_frequency) BETWEEN 5000 AND 5900 THEN 'W'
      WHEN MAX(obs.radio_frequency) BETWEEN 5925 AND 7125 THEN 'W'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(BLE|BTLE|BLUETOOTH.?LOW.?ENERGY)' THEN 'E'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(BLUETOOTH)' THEN 'B'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(LTE|4G|EARFCN)' THEN 'L'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(5G|NR|3GPP)' THEN 'N'
      WHEN MAX(UPPER(COALESCE(obs.radio_capabilities, ''))) ~ '(GSM|CDMA)' THEN 'G'
      ELSE 'W'
    END AS inferred_type
  FROM public.observations obs
  CROSS JOIN home_location home
  WHERE obs.geom IS NOT NULL
    AND obs.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
    AND obs.lat IS NOT NULL AND obs.lon IS NOT NULL
    AND obs.lat BETWEEN -90 AND 90 AND obs.lon BETWEEN -180 AND 180
  GROUP BY obs.bssid
),

-- Max observations at single location (for spread ratio)
location_density AS (
  SELECT
    bssid,
    MAX(cluster_count) AS max_obs_single_location
  FROM (
    SELECT bssid, COUNT(*) AS cluster_count
    FROM public.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL
    GROUP BY bssid, FLOOR(lat * 1000), FLOOR(lon * 1000)
  ) grids
  GROUP BY bssid
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

  -- THREAT COLUMN: FIXED v3 scoring - requires seen at home AND away
  CASE
    -- Exclude cellular networks
    WHEN COALESCE(mm.inferred_type, '?') IN ('L', 'G', 'N') THEN
      jsonb_build_object(
        'score', 0,
        'level', 'NONE',
        'summary', 'Cellular network excluded from threat analysis',
        'flags', ARRAY['CELLULAR_EXCLUDED']::TEXT[],
        'factors', jsonb_build_object(
          'home_and_away', 0,
          'distance_range', 0,
          'multi_day', 0,
          'signal_pattern', 0
        )
      )
    -- Calculate threat for WiFi/Bluetooth/BLE
    ELSE
      (
        SELECT jsonb_build_object(
          'score', ROUND(composite_score::numeric, 1),
          'level', CASE
            WHEN composite_score >= 70 THEN 'HIGH'
            WHEN composite_score >= 45 THEN 'MED'
            WHEN composite_score >= 25 THEN 'LOW'
            ELSE 'NONE'
          END,
          'summary', CASE
            WHEN NOT COALESCE(mm.seen_at_home, false) THEN 'Not seen near home - likely a business/public network'
            WHEN composite_score >= 70 THEN 'HIGH THREAT: Device seen at home AND ' || ROUND(mm.max_distance_from_home_m::numeric/1000, 1) || 'km away'
            WHEN composite_score >= 45 THEN 'MEDIUM THREAT: Suspicious pattern near home'
            WHEN composite_score >= 25 THEN 'LOW THREAT: Some anomalous patterns near home'
            ELSE 'No significant threat indicators'
          END,
          'flags', ARRAY_REMOVE(ARRAY[
            CASE WHEN COALESCE(mm.seen_at_home, false) AND COALESCE(mm.seen_away, false) THEN 'SEEN_HOME_AND_AWAY' END,
            CASE WHEN COALESCE(mm.max_distance_from_home_m, 0) > 5000 THEN 'FOLLOWED_FAR' END,
            CASE WHEN COALESCE(mm.unique_days, 0) >= 7 THEN 'PERSISTENT_MULTI_DAY' END,
            CASE WHEN COALESCE(mm.signal_stddev, 0) > 15 THEN 'VARIABLE_SIGNAL' END
          ], NULL),
          'factors', jsonb_build_object(
            'home_and_away', ROUND(home_away_score::numeric, 1),
            'distance_range', ROUND(distance_score::numeric, 1),
            'multi_day', ROUND(temporal_score::numeric, 1),
            'signal_pattern', ROUND(signal_score::numeric, 1)
          ),
          'metrics', jsonb_build_object(
            'seen_at_home', COALESCE(mm.seen_at_home, false),
            'seen_away', COALESCE(mm.seen_away, false),
            'max_distance_from_home_m', ROUND(COALESCE(mm.max_distance_from_home_m, 0)::numeric, 0),
            'unique_days', COALESCE(mm.unique_days, 0),
            'unique_locations', COALESCE(mm.unique_locations, 0)
          )
        )
        FROM (
          SELECT
            -- PRIMARY FACTOR (50%): Seen at home AND away - THIS IS THE KEY
            CASE
              WHEN COALESCE(mm.seen_at_home, false) AND COALESCE(mm.seen_away, false) THEN
                CASE
                  WHEN COALESCE(mm.max_distance_from_home_m, 0) > 10000 THEN 100  -- >10km = max threat
                  WHEN COALESCE(mm.max_distance_from_home_m, 0) > 5000 THEN 80   -- >5km
                  WHEN COALESCE(mm.max_distance_from_home_m, 0) > 1000 THEN 60   -- >1km
                  WHEN COALESCE(mm.max_distance_from_home_m, 0) > 500 THEN 40    -- >500m
                  ELSE 20
                END
              ELSE 0  -- Not seen at home = NOT a threat
            END AS home_away_score,

            -- SECONDARY FACTOR (25%): Distance range (only matters if seen at home)
            CASE
              WHEN NOT COALESCE(mm.seen_at_home, false) THEN 0
              WHEN COALESCE(mm.max_distance_meters, 0) > 5000 THEN 100
              WHEN COALESCE(mm.max_distance_meters, 0) > 1000 THEN 60
              WHEN COALESCE(mm.max_distance_meters, 0) > 500 THEN 40
              ELSE 0
            END AS distance_score,

            -- TEMPORAL FACTOR (15%): Multiple days (only matters if seen at home)
            CASE
              WHEN NOT COALESCE(mm.seen_at_home, false) THEN 0
              WHEN COALESCE(mm.unique_days, 0) >= 14 THEN 100
              WHEN COALESCE(mm.unique_days, 0) >= 7 THEN 80
              WHEN COALESCE(mm.unique_days, 0) >= 3 THEN 50
              WHEN COALESCE(mm.unique_days, 0) >= 2 THEN 25
              ELSE 0
            END AS temporal_score,

            -- SIGNAL FACTOR (10%): Variable signal (only matters if seen at home)
            CASE
              WHEN NOT COALESCE(mm.seen_at_home, false) THEN 0
              WHEN COALESCE(mm.signal_stddev, 0) > 15 THEN 60
              WHEN COALESCE(mm.signal_stddev, 0) > 10 THEN 30
              ELSE 0
            END AS signal_score
        ) scores,
        LATERAL (
          SELECT
            (scores.home_away_score * 0.50) +
            (scores.distance_score * 0.25) +
            (scores.temporal_score * 0.15) +
            (scores.signal_score * 0.10) AS composite_score
        ) calc
      )
  END AS threat

FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN location_density ld ON ld.bssid = ap.bssid
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

-- Populate the materialized view
REFRESH MATERIALIZED VIEW public.api_network_explorer_mv;
