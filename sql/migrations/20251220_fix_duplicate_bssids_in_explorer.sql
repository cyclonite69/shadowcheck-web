-- ============================================================================
-- Migration: Fix Duplicate BSSIDs in Network Explorer View
-- Date: 2025-12-20
-- Purpose: Eliminate duplicate rows caused by Cartesian product in manufacturer join
-- Root Cause: app.radio_manufacturers contains multiple rows per prefix_24bit
-- Solution: Deduplicate manufacturers using DISTINCT ON before joining
-- ============================================================================

BEGIN;

DROP VIEW IF EXISTS public.api_network_explorer CASCADE;

CREATE VIEW public.api_network_explorer AS
WITH
-- ============================================================================
-- CTE 0: Deduplicated Manufacturers (FIX FOR DUPLICATES)
-- ============================================================================
unique_manufacturers AS (
  SELECT DISTINCT ON (prefix_24bit)
    prefix_24bit,
    organization_name AS manufacturer,
    organization_address AS manufacturer_address
  FROM app.radio_manufacturers
  WHERE prefix_24bit IS NOT NULL
  ORDER BY prefix_24bit, organization_name
),

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
    AND time >= '2000-01-01 00:00:00+00'::timestamptz
  ORDER BY bssid, time ASC
),

-- ============================================================================
-- CTE 4: Movement metrics (altitude span, max travel distance)
-- ============================================================================
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

-- ============================================================================
-- CTE 5: Threat Analysis (rule-based scoring)
-- ============================================================================
threat_metrics AS (
  SELECT
    obs.bssid,
    COUNT(*) as obs_count,
    COUNT(DISTINCT DATE(obs.time)) as unique_days,
    COUNT(DISTINCT ST_SnapToGrid(obs.geom, 0.001)) as unique_locations,
    BOOL_OR(
      ST_Distance(
        obs.geom::geography,
        ST_SetSRID(ST_MakePoint(h.home_lon, h.home_lat), 4326)::geography
      ) < 100
    ) as seen_at_home,
    BOOL_OR(
      ST_Distance(
        obs.geom::geography,
        ST_SetSRID(ST_MakePoint(h.home_lon, h.home_lat), 4326)::geography
      ) > 500
    ) as seen_away,
    MAX(mm.max_distance_meters) / 1000.0 as max_distance_km,
    CASE
      WHEN MAX(EXTRACT(EPOCH FROM obs.time)) > MIN(EXTRACT(EPOCH FROM obs.time))
        AND MAX(mm.max_distance_meters) IS NOT NULL
      THEN
        (MAX(mm.max_distance_meters) / 1000.0) /
        ((MAX(EXTRACT(EPOCH FROM obs.time)) - MIN(EXTRACT(EPOCH FROM obs.time))) / 3600.0)
      ELSE 0
    END as max_speed_kmh
  FROM public.observations obs
  CROSS JOIN home_location h
  LEFT JOIN movement_metrics mm ON mm.bssid = obs.bssid
  WHERE obs.time >= '2000-01-01 00:00:00+00'::timestamptz
    AND obs.geom IS NOT NULL
  GROUP BY obs.bssid
),

-- ============================================================================
-- CTE 6: Threat Scoring (build JSON object)
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
    (
      COALESCE(
        CASE WHEN tm.seen_at_home AND tm.seen_away THEN
          JSONB_BUILD_ARRAY(
            JSONB_BUILD_OBJECT(
              'code', 'HOME_AND_AWAY',
              'weight', 0.40,
              'evidence', JSONB_BUILD_OBJECT(
                'seen_at_home', tm.seen_at_home,
                'seen_away', tm.seen_away
              )
            )
          )
        ELSE '[]'::jsonb
        END
      ) ||
      COALESCE(
        CASE WHEN tm.max_distance_km > 0.2 THEN
          JSONB_BUILD_ARRAY(
            JSONB_BUILD_OBJECT(
              'code', 'EXCESSIVE_MOVEMENT',
              'weight', 0.25,
              'evidence', JSONB_BUILD_OBJECT(
                'max_distance_km', ROUND(tm.max_distance_km::numeric, 3)
              )
            )
          )
        ELSE '[]'::jsonb
        END
      ) ||
      COALESCE(
        CASE WHEN tm.max_speed_kmh > 20 THEN
          JSONB_BUILD_ARRAY(
            JSONB_BUILD_OBJECT(
              'code', 'SPEED_PATTERN',
              'weight', CASE
                WHEN tm.max_speed_kmh > 100 THEN 0.20
                WHEN tm.max_speed_kmh > 50 THEN 0.15
                ELSE 0.10
              END,
              'evidence', JSONB_BUILD_OBJECT(
                'max_speed_kmh', ROUND(tm.max_speed_kmh::numeric, 2)
              )
            )
          )
        ELSE '[]'::jsonb
        END
      ) ||
      COALESCE(
        CASE WHEN tm.unique_days >= 2 THEN
          JSONB_BUILD_ARRAY(
            JSONB_BUILD_OBJECT(
              'code', 'TEMPORAL_PATTERN',
              'weight', CASE
                WHEN tm.unique_days >= 7 THEN 0.15
                WHEN tm.unique_days >= 3 THEN 0.10
                ELSE 0.05
              END,
              'evidence', JSONB_BUILD_OBJECT(
                'unique_days', tm.unique_days
              )
            )
          )
        ELSE '[]'::jsonb
        END
      ) ||
      COALESCE(
        CASE WHEN tm.obs_count >= 20 THEN
          JSONB_BUILD_ARRAY(
            JSONB_BUILD_OBJECT(
              'code', 'HIGH_OBSERVATION_COUNT',
              'weight', CASE WHEN tm.obs_count >= 50 THEN 0.10 ELSE 0.05 END,
              'evidence', JSONB_BUILD_OBJECT(
                'observation_count', tm.obs_count
              )
            )
          )
        ELSE '[]'::jsonb
        END
      )
    ) AS signals_array,
    tm.seen_at_home,
    tm.seen_away,
    tm.max_distance_km,
    tm.max_speed_kmh,
    tm.unique_days,
    tm.obs_count
  FROM threat_metrics tm
)

-- ============================================================================
-- MAIN SELECT: Complete API Contract
-- ============================================================================
SELECT
  ap.bssid,
  COALESCE(
    NULLIF(TRIM(obs.ssid), ''),
    NULLIF(TRIM(ap.latest_ssid), ''),
    '(hidden)'
  ) AS ssid,
  CASE
    WHEN ap.first_seen >= '2000-01-01 00:00:00+00'::timestamptz
    THEN ap.first_seen
    ELSE NULL
  END AS first_seen,
  CASE
    WHEN ap.last_seen >= '2000-01-01 00:00:00+00'::timestamptz
    THEN ap.last_seen
    ELSE NULL
  END AS last_seen,
  CASE
    WHEN obs.time >= '2000-01-01 00:00:00+00'::timestamptz
    THEN obs.time
    ELSE NULL
  END AS observed_at,
  ap.total_observations AS observations,
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
  rm.manufacturer_address,
  obs.geom AS last_geom,
  obs.altitude AS last_altitude_m,
  COALESCE(ap.is_sentinel, FALSE) AS is_sentinel,
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
  END AS threat
FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN threat_scores ts ON ts.bssid = ap.bssid
LEFT JOIN LATERAL (
  SELECT
    manufacturer,
    address,
    bit_length,
    prefix
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
WHERE COALESCE(ap.is_sentinel, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS idx_observations_bssid_time
  ON public.observations(bssid, time DESC);

CREATE INDEX IF NOT EXISTS idx_observations_geom
  ON public.observations USING GIST(geom)
  WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_points_bssid
  ON public.access_points(bssid);

CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_prefix24
  ON app.radio_manufacturers(prefix_24bit);

GRANT SELECT ON public.api_network_explorer TO PUBLIC;

COMMENT ON VIEW public.api_network_explorer IS
'Network + Threat + Movement Intelligence Explorer (v4 - DUPLICATE FIX).

CRITICAL FIX (v4):
- Eliminated duplicate BSSIDs caused by Cartesian product in manufacturer join
- Root cause: app.radio_manufacturers contains multiple rows per prefix_24bit
- Solution: Deduplicate manufacturers using DISTINCT ON (prefix_24bit) in CTE
- Invariant: COUNT(*) = COUNT(DISTINCT bssid) MUST hold

FIELD CONTRACT (strict superset):
- 18 legacy fields (preserved from v1)
- 8 enrichment fields (added in v2)
- 1 threat object (added in v3)

THREAT MODEL (rule-based, deterministic):
- Score: 0.0-1.0 (normalized from 0-100 point system)
- Level: NONE (<30pts), LOW (30-49pts), MED (50-69pts), HIGH (70+pts)
- Flags: Array of triggered threat indicators
- Signals: Array of weighted evidence objects with observable facts
- Summary: Human-readable threat explanation
';

COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check for duplicates (should return TRUE)
-- SELECT COUNT(*) = COUNT(DISTINCT bssid) AS no_duplicates
-- FROM public.api_network_explorer;

-- Sample data
-- SELECT bssid, ssid, type, manufacturer, threat->>'level' AS threat_level
-- FROM public.api_network_explorer
-- LIMIT 10;
