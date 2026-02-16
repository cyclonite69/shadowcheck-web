-- Migration: Update api_network_explorer_mv with FAST Threat Score v3.0
-- Purpose: Replace legacy scoring with v3 methodology using inline calculation
-- Date: 2026-01-18
--
-- This version uses inline calculation instead of function calls for speed.
-- Co-occurrence analysis is deferred to a future async job.

BEGIN;

-- Drop existing views (no backup - MV was empty)
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv_backup CASCADE;

-- Recreate MV with inline v3 threat scoring
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

-- Extended movement metrics including v3 threat components
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

  -- THREAT COLUMN: Inline v3 scoring calculation
  CASE
    -- Exclude cellular networks
    WHEN COALESCE(mm.inferred_type, '?') IN ('L', 'G', 'N') THEN
      jsonb_build_object(
        'score', 0,
        'level', 'NONE',
        'summary', 'Cellular network excluded from threat analysis',
        'flags', ARRAY['CELLULAR_EXCLUDED']::TEXT[],
        'factors', jsonb_build_object(
          'range_violation', 0,
          'co_occurrence', 0,
          'multi_location', 0,
          'signal_pattern', 0,
          'temporal', 0
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
            WHEN composite_score >= 70 THEN 'High threat: Device observed beyond radio range'
            WHEN composite_score >= 45 THEN 'Medium threat: Suspicious movement pattern'
            WHEN composite_score >= 25 THEN 'Low threat: Some anomalous patterns'
            ELSE 'No significant threat indicators'
          END,
          'flags', ARRAY_REMOVE(ARRAY[
            CASE WHEN range_score >= 70 THEN 'EXTREME_RANGE_VIOLATION'
                 WHEN range_score >= 40 THEN 'SIGNIFICANT_RANGE_VIOLATION'
                 WHEN range_score > 0 THEN 'RANGE_VIOLATION' END,
            CASE WHEN multi_loc_score >= 50 THEN 'MULTI_LOCATION_TRACKING' END,
            CASE WHEN signal_score >= 50 THEN 'VARIABLE_WEAK_SIGNAL'
                 WHEN signal_score >= 30 THEN 'VARIABLE_SIGNAL' END,
            CASE WHEN temporal_score >= 80 THEN 'PERSISTENT_MULTI_DAY' END
          ], NULL),
          'factors', jsonb_build_object(
            'range_violation', ROUND(range_score::numeric, 1),
            'co_occurrence', 0,
            'multi_location', ROUND(multi_loc_score::numeric, 1),
            'signal_pattern', ROUND(signal_score::numeric, 1),
            'temporal', ROUND(temporal_score::numeric, 1)
          )
        )
        FROM (
          SELECT
            -- Expected range based on type
            CASE COALESCE(mm.inferred_type, 'W')
              WHEN 'E' THEN 100  -- BLE
              WHEN 'B' THEN 200  -- Bluetooth
              ELSE 250          -- WiFi
            END AS expected_range,
            -- Range violation score (40% weight)
            CASE
              WHEN COALESCE(mm.max_distance_meters, 0) >
                   CASE COALESCE(mm.inferred_type, 'W')
                     WHEN 'E' THEN 100 WHEN 'B' THEN 200 ELSE 250
                   END * 5 THEN 100  -- >5x range = max
              WHEN COALESCE(mm.max_distance_meters, 0) >
                   CASE COALESCE(mm.inferred_type, 'W')
                     WHEN 'E' THEN 100 WHEN 'B' THEN 200 ELSE 250
                   END THEN
                LEAST(100, (mm.max_distance_meters /
                  CASE COALESCE(mm.inferred_type, 'W')
                    WHEN 'E' THEN 100 WHEN 'B' THEN 200 ELSE 250
                  END) * 40)
              ELSE 0
            END AS range_score,
            -- Multi-location score (20% weight)
            CASE
              WHEN COALESCE(mm.unique_locations, 0) >= 3 AND
                   COALESCE(ld.max_obs_single_location, 0)::numeric / NULLIF(mm.obs_count, 0) < 0.5
              THEN LEAST(100, mm.unique_locations * 10)
              WHEN COALESCE(mm.unique_locations, 0) >= 3 AND
                   COALESCE(ld.max_obs_single_location, 0)::numeric / NULLIF(mm.obs_count, 0) < 0.8
              THEN LEAST(50, mm.unique_locations * 5)
              ELSE 0
            END AS multi_loc_score,
            -- Signal pattern score (10% weight)
            CASE
              WHEN COALESCE(mm.signal_stddev, 0) > 15 AND COALESCE(mm.signal_mean, 0) < -70 THEN 80
              WHEN COALESCE(mm.signal_stddev, 0) > 10 THEN 40
              WHEN COALESCE(mm.signal_mean, 0) < -80 AND COALESCE(mm.unique_locations, 0) >= 3 THEN 50
              ELSE 0
            END AS signal_score,
            -- Temporal score (5% weight)
            CASE
              WHEN COALESCE(mm.unique_days, 0) >= 7 THEN 100
              WHEN COALESCE(mm.unique_days, 0) >= 3 THEN 60
              WHEN COALESCE(mm.unique_days, 0) >= 2 THEN 30
              ELSE 0
            END AS temporal_score
        ) scores,
        LATERAL (
          SELECT
            (scores.range_score * 0.40) +
            (scores.multi_loc_score * 0.20) +
            (scores.signal_score * 0.10) +
            (scores.temporal_score * 0.05) AS composite_score
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
