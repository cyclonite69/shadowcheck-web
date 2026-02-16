-- Update materialized view to use unified threat scores from app.network_threat_scores
-- Replace legacy threat scoring logic with precomputed unified scores

DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv;

CREATE MATERIALIZED VIEW public.api_network_explorer_mv AS
WITH
-- Latest observation per BSSID (ground truth)
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

-- Home location (fallback to hardcoded point)
home_location AS (
  SELECT
    -83.69682688::double precision AS home_lon,
    43.02345147::double precision AS home_lat
),

-- First observation geom per BSSID (for movement calculation)
obs_first AS (
  SELECT DISTINCT ON (bssid)
    bssid,
    geom AS first_geom
  FROM public.observations
  WHERE geom IS NOT NULL
    AND time >= '2000-01-01 00:00:00+00'::timestamptz
  ORDER BY bssid, time ASC
),

-- Movement metrics (altitude span, max travel distance)
movement_metrics AS (
  SELECT
    obs.bssid,
    MIN(obs.altitude) FILTER (
      WHERE obs.altitude IS NOT NULL
        AND obs.altitude > -500
        AND obs.altitude < 10000
    ) AS min_altitude_m,
    MAX(obs.altitude) FILTER (
      WHERE obs.altitude IS NOT NULL
        AND obs.altitude > -500
        AND obs.altitude < 10000
    ) AS max_altitude_m,
    MAX(
      ST_Distance(
        obs.geom::geography,
        first.first_geom::geography
      )
    ) FILTER (WHERE obs.geom IS NOT NULL) AS max_distance_meters
  FROM public.observations obs
  LEFT JOIN obs_first first ON first.bssid = obs.bssid
  WHERE obs.time >= '2000-01-01 00:00:00+00'::timestamptz
    AND obs.geom IS NOT NULL
  GROUP BY obs.bssid
),

-- Observation stats for UI filters and context
observation_stats AS (
  SELECT
    obs.bssid,
    COUNT(*) AS obs_count,
    COUNT(DISTINCT DATE(obs.time)) AS unique_days,
    COUNT(DISTINCT ST_SnapToGrid(obs.geom, 0.001)) AS unique_locations
  FROM public.observations obs
  WHERE obs.time >= '2000-01-01 00:00:00+00'::timestamptz
    AND obs.geom IS NOT NULL
  GROUP BY obs.bssid
)

SELECT
  ap.bssid,
  COALESCE(
    NULLIF(TRIM(obs.ssid), ''),
    NULLIF(TRIM(ap.latest_ssid), ''),
    '(hidden)'
  ) AS ssid,
  COALESCE(
    CASE
      WHEN ap.first_seen >= '2000-01-01 00:00:00+00'::timestamptz
      THEN ap.first_seen
      ELSE NULL
    END,
    obs.time
  ) AS first_seen,
  COALESCE(
    CASE
      WHEN ap.last_seen >= '2000-01-01 00:00:00+00'::timestamptz
      THEN ap.last_seen
      ELSE NULL
    END,
    obs.time
  ) AS last_seen,
  obs.time AS observed_at,
  COALESCE(os.obs_count, ap.total_observations, 0) AS observations,
  obs.lat,
  obs.lon,
  obs.accuracy AS accuracy_meters,
  obs.level AS signal,
  obs.radio_frequency AS frequency,
  obs.radio_capabilities AS capabilities,
  COALESCE(ap.is_5ghz, FALSE) AS is_5ghz,
  COALESCE(ap.is_6ghz, FALSE) AS is_6ghz,
  COALESCE(ap.is_hidden, FALSE) AS is_hidden,
  CASE
    WHEN obs.radio_type IS NOT NULL AND obs.radio_type != '' THEN obs.radio_type
    WHEN UPPER(COALESCE(obs.ssid, '') || ' ' || COALESCE(obs.radio_capabilities, '')) ~ '(5G|NR|5G.?NR)' THEN 'N'
    WHEN UPPER(COALESCE(obs.ssid, '') || ' ' || COALESCE(obs.radio_capabilities, '')) ~ '(LTE|4G|EARFCN)' THEN 'L'
    WHEN UPPER(COALESCE(obs.ssid, '') || ' ' || COALESCE(obs.radio_capabilities, '')) ~ '(WCDMA|3G|UMTS|UARFCN)' THEN 'D'
    WHEN UPPER(COALESCE(obs.ssid, '') || ' ' || COALESCE(obs.radio_capabilities, '')) ~ '(GSM|2G|ARFCN)' THEN 'G'
    WHEN UPPER(COALESCE(obs.ssid, '') || ' ' || COALESCE(obs.radio_capabilities, '')) LIKE '%CDMA%' THEN 'C'
    WHEN UPPER(COALESCE(obs.ssid, '')) ~ '(T-MOBILE|VERIZON|AT&T|ATT|SPRINT|CARRIER|3GPP)' THEN 'L'
    WHEN UPPER(COALESCE(obs.ssid, '') || ' ' || COALESCE(obs.radio_capabilities, '')) ~ '(\\[UNKNOWN.*SPOOFED.*RADIO\\]|BLE|BTLE|BLUETOOTH.?LOW.?ENERGY)' THEN 'E'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) LIKE '%BLUETOOTH%'
      AND UPPER(COALESCE(obs.radio_capabilities, '')) NOT LIKE '%LOW ENERGY%'
      AND UPPER(COALESCE(obs.radio_capabilities, '')) NOT LIKE '%BLE%' THEN 'B'
    WHEN UPPER(COALESCE(obs.ssid, '') || ' ' || COALESCE(obs.radio_capabilities, '')) LIKE '%BLUETOOTH%' THEN 'E'
    WHEN obs.radio_frequency BETWEEN 2412 AND 2484 THEN 'W'
    WHEN obs.radio_frequency BETWEEN 5000 AND 5900 THEN 'W'
    WHEN obs.radio_frequency BETWEEN 5925 AND 7125 THEN 'W'
    WHEN UPPER(COALESCE(obs.radio_capabilities, '')) ~ '(WPA|WEP|WPS|RSN|ESS|CCMP|TKIP)' THEN 'W'
    ELSE '?'
  END AS type,
  CASE
    WHEN COALESCE(obs.radio_capabilities, '') = '' THEN 'OPEN'
    WHEN UPPER(obs.radio_capabilities) ~ '^\s*\[ESS\]\s*$' THEN 'OPEN'
    WHEN UPPER(obs.radio_capabilities) ~ '^\s*\[IBSS\]\s*$' THEN 'OPEN'
    WHEN UPPER(obs.radio_capabilities) ~ 'RSN-OWE' THEN 'WPA3-OWE'
    WHEN UPPER(obs.radio_capabilities) ~ 'RSN-SAE' THEN 'WPA3-SAE'
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA3|SAE)' AND UPPER(obs.radio_capabilities) ~ '(EAP|MGT)' THEN 'WPA3-E'
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA3|SAE)' THEN 'WPA3'
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA2|RSN)' AND UPPER(obs.radio_capabilities) ~ '(EAP|MGT)' THEN 'WPA2-E'
    WHEN UPPER(obs.radio_capabilities) ~ '(WPA2|RSN)' THEN 'WPA2'
    WHEN UPPER(obs.radio_capabilities) ~ 'WPA-' AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
    WHEN UPPER(obs.radio_capabilities) LIKE '%WPA%'
         AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA2%'
         AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA3%'
         AND UPPER(obs.radio_capabilities) NOT LIKE '%RSN%' THEN 'WPA'
    WHEN UPPER(obs.radio_capabilities) LIKE '%WEP%' THEN 'WEP'
    WHEN UPPER(obs.radio_capabilities) LIKE '%WPS%'
         AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA%'
         AND UPPER(obs.radio_capabilities) NOT LIKE '%RSN%' THEN 'WPS'
    WHEN UPPER(obs.radio_capabilities) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
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
  os.unique_days,
  os.unique_locations,
  rm.manufacturer,
  rm.address AS manufacturer_address,
  obs.geom AS last_geom,
  obs.altitude AS last_altitude_m,
  COALESCE(ap.is_sentinel, FALSE) AS is_sentinel,
  CASE
    WHEN nts.bssid IS NOT NULL THEN
      JSONB_BUILD_OBJECT(
        'score', COALESCE(nts.final_threat_score, 0),
        'level', COALESCE(nts.final_threat_level, 'NONE'),
        'summary', COALESCE(nts.rule_based_flags->>'summary', 'Threat score available'),
        'flags', COALESCE(nts.rule_based_flags->'flags', '[]'::jsonb),
        'factors', COALESCE(nts.rule_based_flags->'factors', '{}'::jsonb),
        'metrics', COALESCE(nts.rule_based_flags->'metrics', '{}'::jsonb),
        'confidence', COALESCE((nts.rule_based_flags->>'confidence')::numeric, 0),
        'model_version', nts.model_version,
        'scored_at', nts.scored_at
      )
    ELSE
      JSONB_BUILD_OBJECT(
        'score', 0,
        'level', 'NONE',
        'flags', '[]'::jsonb,
        'summary', 'No threat score available',
        'confidence', 0
      )
  END AS threat
FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN observation_stats os ON os.bssid = ap.bssid
LEFT JOIN app.network_threat_scores nts ON nts.bssid = ap.bssid
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
WHERE COALESCE(ap.is_sentinel, FALSE) = FALSE
  AND (
    (ap.last_seen >= '2000-01-01 00:00:00+00'::timestamptz) OR
    (obs.time >= '2000-01-01 00:00:00+00'::timestamptz)
  )
WITH NO DATA;

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

CREATE OR REPLACE VIEW public.api_network_explorer AS
SELECT * FROM public.api_network_explorer_mv;

GRANT SELECT ON public.api_network_explorer_mv TO PUBLIC;
GRANT SELECT ON public.api_network_explorer TO PUBLIC;
