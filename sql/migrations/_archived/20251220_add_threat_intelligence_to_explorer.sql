-- ============================================================================
-- Migration: Add Threat Intelligence to Network Explorer View
-- Date: 2025-12-20
-- Purpose: Extend api_network_explorer with rule-based threat scoring
-- Strategy: DROP + CREATE to add threat object column
-- ============================================================================
--
-- DESIGN PRINCIPLES:
-- 1. Deterministic, reproducible scoring
-- 2. Evidence-backed signals (observable facts only)
-- 3. Explainable threat classification
-- 4. Designed for future ML extension
-- 5. Performance-optimized with CTEs
--
-- THREAT MODEL:
-- - Score: 0.0-1.0 (normalized from 0-100 point system)
-- - Level: NONE (<30), LOW (30-49), MED (50-69), HIGH (70+)
-- - Flags: Array of triggered threat indicators
-- - Signals: Array of weighted evidence objects
-- - Summary: Human-readable explanation
--
-- SCORING ALGORITHM (from /api/threats/detect):
-- 1. Seen at home AND away: +40 points (strongest indicator)
-- 2. Max distance > 200m: +25 points (beyond WiFi range)
-- 3. High speed movement: +10 to +20 points
-- 4. Multiple unique days: +5 to +15 points
-- 5. High observation count: +5 to +10 points
-- ============================================================================

BEGIN;

-- ============================================================================
-- Step 1: Drop existing view
-- ============================================================================
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;

-- ============================================================================
-- Step 2: Create enhanced view with threat intelligence
-- ============================================================================
CREATE VIEW public.api_network_explorer AS
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
    AND time >= '2000-01-01 00:00:00+00'::timestamptz
  ORDER BY bssid, time ASC
),

-- ============================================================================
-- CTE 4: Movement metrics (altitude span, max travel distance)
-- ============================================================================
movement_metrics AS (
  SELECT
    obs.bssid,
    -- Altitude metrics (sanitize unrealistic values)
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
    -- Max distance from first geom to any other geom
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
    -- Raw metrics
    COUNT(*) as obs_count,
    COUNT(DISTINCT DATE(obs.time)) as unique_days,
    COUNT(DISTINCT ST_SnapToGrid(obs.geom, 0.001)) as unique_locations,

    -- Home proximity analysis
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

    -- Movement analysis (use MAX to aggregate since mm has one row per bssid)
    MAX(mm.max_distance_meters) / 1000.0 as max_distance_km,

    -- Speed calculation (requires temporal analysis)
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
  GROUP BY obs.bssid  -- CRITICAL FIX: Only group by bssid to avoid duplicates
),

-- ============================================================================
-- CTE 6: Threat Scoring (build JSON object)
-- ============================================================================
threat_scores AS (
  SELECT
    tm.bssid,

    -- ==========================================================================
    -- Calculate raw threat score (0-100 points)
    -- ==========================================================================
    (
      -- Signal 1: Seen at home AND away (+40 points - strongest indicator)
      CASE WHEN tm.seen_at_home AND tm.seen_away THEN 40 ELSE 0 END +

      -- Signal 2: Excessive movement (+25 points if >200m)
      CASE WHEN tm.max_distance_km > 0.2 THEN 25 ELSE 0 END +

      -- Signal 3: High speed movement (+10 to +20 points)
      CASE
        WHEN tm.max_speed_kmh > 100 THEN 20
        WHEN tm.max_speed_kmh > 50 THEN 15
        WHEN tm.max_speed_kmh > 20 THEN 10
        ELSE 0
      END +

      -- Signal 4: Multiple unique days (+5 to +15 points)
      CASE
        WHEN tm.unique_days >= 7 THEN 15
        WHEN tm.unique_days >= 3 THEN 10
        WHEN tm.unique_days >= 2 THEN 5
        ELSE 0
      END +

      -- Signal 5: High observation count (+5 to +10 points)
      CASE
        WHEN tm.obs_count >= 50 THEN 10
        WHEN tm.obs_count >= 20 THEN 5
        ELSE 0
      END
    ) AS raw_score,

    -- ==========================================================================
    -- Build threat flags array
    -- ==========================================================================
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

    -- ==========================================================================
    -- Build signals array (evidence objects)
    -- Filter NULLs using COALESCE with empty array, then concatenate non-null elements
    -- ==========================================================================
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

    -- Store raw metrics for summary generation
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
  -- ==========================================================================
  -- LEGACY FIELDS (18 required - preserved exactly)
  -- ==========================================================================
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

  -- Radio type inference (preserved from v2 migration)
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

  -- Security classification (preserved from v2 migration)
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

  -- Distance from home (preserved from v2 migration)
  CASE
    WHEN obs.geom IS NOT NULL THEN
      ST_Distance(
        ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography,
        obs.geom::geography
      ) / 1000.0
    ELSE NULL
  END AS distance_from_home_km,

  -- ==========================================================================
  -- ENRICHMENT FIELDS (from v2 migration)
  -- ==========================================================================
  mm.min_altitude_m,
  mm.max_altitude_m,
  (mm.max_altitude_m - mm.min_altitude_m) AS altitude_span_m,
  mm.max_distance_meters,
  rm.organization_name AS manufacturer,
  rm.organization_address AS manufacturer_address,
  obs.geom AS last_geom,
  obs.altitude AS last_altitude_m,
  COALESCE(ap.is_sentinel, FALSE) AS is_sentinel,

  -- ==========================================================================
  -- THREAT INTELLIGENCE (NEW - rule-based scoring)
  -- ==========================================================================
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

-- ============================================================================
-- Step 3: Recreate indexes (idempotent)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_observations_bssid_time
  ON public.observations(bssid, time DESC);

CREATE INDEX IF NOT EXISTS idx_observations_geom
  ON public.observations USING GIST(geom)
  WHERE geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_access_points_bssid
  ON public.access_points(bssid);

CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_prefix24
  ON app.radio_manufacturers(prefix_24bit);

-- ============================================================================
-- Step 4: Grant permissions
-- ============================================================================
GRANT SELECT ON public.api_network_explorer TO PUBLIC;

-- ============================================================================
-- Step 5: Update documentation
-- ============================================================================
COMMENT ON VIEW public.api_network_explorer IS
'Network + Threat + Movement Intelligence Explorer (v3).

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

SCORING ALGORITHM (explainable, evidence-backed):
1. Seen at home AND away: +40 points (strongest tracking indicator)
2. Max distance > 200m: +25 points (beyond typical WiFi range)
3. High speed movement: +10 to +20 points (vehicle tracking patterns)
4. Multiple unique days: +5 to +15 points (persistent surveillance)
5. High observation count: +5 to +10 points (frequent contact)

EXTENSIBILITY:
- Designed for future ML scoring via additional "ml_score" field
- Current rule-based logic provides baseline and training labels
- All evidence preserved in signals array for model explainability

PERFORMANCE:
- CTEs optimized for single-pass computation
- Leverages existing indexes on observations(bssid, time), observations(geom)
- Expected p95 latency: 100-300ms for 500 rows with threat analysis
';

COMMIT;

-- ============================================================================
-- Verification Queries (run after migration)
-- ============================================================================

-- Check view was created with threat column
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'api_network_explorer'
--   AND column_name = 'threat';

-- Sample threat data
-- SELECT
--   bssid,
--   ssid,
--   type,
--   threat->>'level' AS threat_level,
--   threat->>'score' AS threat_score,
--   threat->>'summary' AS threat_summary,
--   jsonb_array_length(threat->'signals') AS signal_count
-- FROM public.api_network_explorer
-- WHERE (threat->>'score')::numeric > 0.3
-- ORDER BY (threat->>'score')::numeric DESC
-- LIMIT 10;

-- Threat level distribution
-- SELECT
--   threat->>'level' AS threat_level,
--   COUNT(*) AS network_count,
--   ROUND(AVG((threat->>'score')::numeric), 3) AS avg_score
-- FROM public.api_network_explorer
-- GROUP BY threat->>'level'
-- ORDER BY avg_score DESC;
