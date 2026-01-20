-- Migration: Update threat scoring to use distance-based mobile detection
-- Purpose: Replace fragile SSID patterns with actual movement behavior
-- Key insight: If it moves significant distances, it's mobile regardless of SSID

BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;

-- Recreate MV with distance-based mobile detection
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

-- Movement metrics - THE KEY TO MOBILE DETECTION
movement_metrics AS (
  SELECT
    obs.bssid,
    MIN(obs.altitude) AS min_altitude_m,
    MAX(obs.altitude) AS max_altitude_m,
    -- Max distance (bounding box diagonal) - PRIMARY MOBILE INDICATOR
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

-- Distance-based mobile classification
mobile_classification AS (
  SELECT
    ap.bssid,
    COALESCE(obs.ssid, ap.latest_ssid) AS ssid,
    mm.max_distance_meters,
    mm.inferred_type,
    mm.unique_locations,
    mm.unique_days,
    -- DISTANCE-BASED MOBILE DETECTION (not SSID patterns!)
    CASE
      -- Cellular networks: Always exclude (too large range)
      WHEN mm.inferred_type IN ('L', 'G', 'N') THEN 'CELLULAR'
      -- WiFi/BLE/Bluetooth: Use distance thresholds
      WHEN mm.inferred_type IN ('W', 'E', 'B') THEN
        CASE
          -- HIGH MOBILITY: >2km spread = definitely mobile
          WHEN COALESCE(mm.max_distance_meters, 0) > 2000 THEN 'MOBILE_HIGH'
          -- MEDIUM MOBILITY: >500m spread + multiple locations = likely mobile
          WHEN COALESCE(mm.max_distance_meters, 0) > 500 AND COALESCE(mm.unique_locations, 0) >= 3 THEN 'MOBILE_MEDIUM'
          -- LOW MOBILITY: >100m spread + multiple days = possibly mobile
          WHEN COALESCE(mm.max_distance_meters, 0) > 100 AND COALESCE(mm.unique_days, 0) >= 2 THEN 'MOBILE_LOW'
          -- STATIONARY: <100m spread = stationary
          ELSE 'STATIONARY'
        END
      -- Unknown types: Conservative approach
      ELSE 
        CASE
          WHEN COALESCE(mm.max_distance_meters, 0) > 5000 THEN 'MOBILE_HIGH'
          WHEN COALESCE(mm.max_distance_meters, 0) > 1000 AND COALESCE(mm.unique_locations, 0) >= 5 THEN 'MOBILE_MEDIUM'
          ELSE 'STATIONARY'
        END
    END AS mobility_class
  FROM public.access_points ap
  LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
  LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
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
  rm.manufacturer,
  rm.address AS manufacturer_address,
  obs.geom AS last_geom,
  obs.altitude AS last_altitude_m,
  COALESCE(ap.is_sentinel, FALSE) AS is_sentinel,

  -- THREAT COLUMN: Distance-based scoring (no SSID patterns!)
  CASE
    -- Exclude cellular networks
    WHEN mc.mobility_class = 'CELLULAR' THEN
      jsonb_build_object(
        'score', 0,
        'level', 'NONE',
        'summary', 'Cellular network excluded from threat analysis',
        'flags', ARRAY['CELLULAR_EXCLUDED']::TEXT[],
        'mobility_class', 'CELLULAR'
      )
    -- HIGH MOBILITY: Definite threat (>2km movement)
    WHEN mc.mobility_class = 'MOBILE_HIGH' THEN
      jsonb_build_object(
        'score', LEAST(100, 50 + (COALESCE(mm.max_distance_meters, 0) / 1000.0) * 10),
        'level', 'HIGH',
        'summary', 'High mobility device: ' || ROUND(COALESCE(mm.max_distance_meters, 0) / 1000.0, 1) || 'km movement detected',
        'flags', ARRAY['MOBILE_HIGH', 'EXTREME_RANGE']::TEXT[],
        'mobility_class', 'MOBILE_HIGH'
      )
    -- MEDIUM MOBILITY: Likely threat (>500m + multiple locations)
    WHEN mc.mobility_class = 'MOBILE_MEDIUM' THEN
      jsonb_build_object(
        'score', LEAST(80, 30 + (COALESCE(mm.max_distance_meters, 0) / 100.0) * 2),
        'level', 'MED',
        'summary', 'Medium mobility device: ' || ROUND(COALESCE(mm.max_distance_meters, 0), 0) || 'm across ' || COALESCE(mm.unique_locations, 0) || ' locations',
        'flags', ARRAY['MOBILE_MEDIUM', 'MULTI_LOCATION']::TEXT[],
        'mobility_class', 'MOBILE_MEDIUM'
      )
    -- LOW MOBILITY: Possible threat (>100m + multiple days)
    WHEN mc.mobility_class = 'MOBILE_LOW' THEN
      jsonb_build_object(
        'score', LEAST(50, 15 + (COALESCE(mm.max_distance_meters, 0) / 50.0)),
        'level', 'LOW',
        'summary', 'Low mobility device: ' || ROUND(COALESCE(mm.max_distance_meters, 0), 0) || 'm over ' || COALESCE(mm.unique_days, 0) || ' days',
        'flags', ARRAY['MOBILE_LOW', 'MULTI_DAY']::TEXT[],
        'mobility_class', 'MOBILE_LOW'
      )
    -- STATIONARY: No threat
    ELSE
      jsonb_build_object(
        'score', 0,
        'level', 'NONE',
        'summary', 'Stationary device: <100m movement',
        'flags', ARRAY['STATIONARY']::TEXT[],
        'mobility_class', 'STATIONARY'
      )
  END AS threat

FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN mobile_classification mc ON mc.bssid = ap.bssid
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
CREATE INDEX IF NOT EXISTS api_network_explorer_mv_max_distance_idx
  ON public.api_network_explorer_mv (max_distance_meters DESC);

-- Recreate view
CREATE OR REPLACE VIEW public.api_network_explorer AS
SELECT * FROM public.api_network_explorer_mv;

GRANT SELECT ON public.api_network_explorer_mv TO PUBLIC;
GRANT SELECT ON public.api_network_explorer TO PUBLIC;

COMMIT;

-- Populate the materialized view
REFRESH MATERIALIZED VIEW public.api_network_explorer_mv;
