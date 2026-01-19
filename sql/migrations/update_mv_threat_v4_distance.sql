-- Migration: Update api_network_explorer_mv with Threat Score v4.1 (Distance-Focused)
-- Purpose: Flag ANY device seen at distant locations - even one distant observation matters
-- Date: 2026-01-19
--
-- Key insights from user:
-- 1. Even ONE observation at a distant location is significant
-- 2. Same BSSID at distant locations = suspicious (not SSID matching)
-- 3. More observations at distant locations = more relevance
-- 4. Dual-band (2.4+5GHz) correlation via MAC walking adds relevance
-- 5. High accuracy distant observations are more significant
--
-- Scoring:
-- - Primary: max_distance_meters (50%) - how far apart observations are
-- - Secondary: distant_observation_count (25%) - how many obs at distant locations
-- - Tertiary: temporal span at distant locations (15%)
-- - Bonus: dual-band correlation (5%) + accuracy (5%)

BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv_backup CASCADE;

-- Recreate MV with v4.1 distance-focused threat scoring
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

-- Movement metrics with distant observation analysis
movement_metrics AS (
  SELECT
    obs.bssid,
    MIN(obs.altitude) AS min_altitude_m,
    MAX(obs.altitude) AS max_altitude_m,
    -- Max distance (bounding box diagonal) - PRIMARY FACTOR
    ST_Distance(
      ST_SetSRID(ST_MakePoint(MIN(obs.lon), MIN(obs.lat)), 4326)::geography,
      ST_SetSRID(ST_MakePoint(MAX(obs.lon), MAX(obs.lat)), 4326)::geography
    ) AS max_distance_meters,
    COUNT(*) AS obs_count,
    COUNT(DISTINCT DATE(obs.time)) AS unique_days,
    STDDEV(obs.level) AS signal_stddev,
    AVG(obs.level) AS signal_mean,
    -- Average accuracy (lower = better GPS fix)
    AVG(obs.accuracy) AS avg_accuracy,
    -- Min accuracy of distant observations (best GPS fix when far)
    MIN(obs.accuracy) AS min_accuracy,
    -- Unique location clusters (~100m grid)
    COUNT(DISTINCT (FLOOR(obs.lat * 1000)::text || ',' || FLOOR(obs.lon * 1000)::text)) AS unique_locations,
    -- Centroid of observations (to calculate distant obs)
    AVG(obs.lat) AS centroid_lat,
    AVG(obs.lon) AS centroid_lon,
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
    END AS inferred_type,
    -- Check if has both 2.4 and 5GHz observations (dual-band)
    CASE
      WHEN COUNT(DISTINCT CASE WHEN obs.radio_frequency BETWEEN 2400 AND 2500 THEN 1 END) > 0
       AND COUNT(DISTINCT CASE WHEN obs.radio_frequency BETWEEN 5000 AND 6000 THEN 1 END) > 0
      THEN TRUE ELSE FALSE
    END AS is_dual_band
  FROM public.observations obs
  WHERE obs.geom IS NOT NULL
    AND obs.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
    AND obs.lat IS NOT NULL AND obs.lon IS NOT NULL
    AND obs.lat BETWEEN -90 AND 90 AND obs.lon BETWEEN -180 AND 180
  GROUP BY obs.bssid
),

-- Count observations that are DISTANT from the primary cluster
-- This counts how many times device was seen far from its "home base"
distant_observations AS (
  SELECT
    o.bssid,
    -- Count observations more than 250m from centroid
    COUNT(*) FILTER (
      WHERE ST_Distance(
        ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(mm.centroid_lon, mm.centroid_lat), 4326)::geography
      ) > 250
    ) AS distant_obs_count,
    -- Count observations more than 1km from centroid
    COUNT(*) FILTER (
      WHERE ST_Distance(
        ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(mm.centroid_lon, mm.centroid_lat), 4326)::geography
      ) > 1000
    ) AS very_distant_obs_count,
    -- Count unique days with distant observations
    COUNT(DISTINCT DATE(o.time)) FILTER (
      WHERE ST_Distance(
        ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(mm.centroid_lon, mm.centroid_lat), 4326)::geography
      ) > 250
    ) AS distant_unique_days,
    -- Best accuracy among distant observations
    MIN(o.accuracy) FILTER (
      WHERE ST_Distance(
        ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(mm.centroid_lon, mm.centroid_lat), 4326)::geography
      ) > 250
    ) AS distant_best_accuracy
  FROM public.observations o
  JOIN movement_metrics mm ON mm.bssid = o.bssid
  WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
  GROUP BY o.bssid
),

-- Dual-band correlation: find related BSSIDs (MAC walking)
-- Adjacent MACs that are also seen at distant locations
dual_band_correlation AS (
  SELECT
    ap.bssid,
    COUNT(DISTINCT related.bssid) AS related_bssid_count,
    -- Check if any related BSSID also has distant observations
    BOOL_OR(related_mm.max_distance_meters > 500) AS related_also_distant
  FROM public.access_points ap
  LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
  -- Find BSSIDs with adjacent MAC addresses (differ by 1-4 in last octet)
  LEFT JOIN LATERAL (
    SELECT ap2.bssid
    FROM public.access_points ap2
    WHERE ap2.bssid != ap.bssid
      -- Same OUI (first 8 chars)
      AND SUBSTRING(REPLACE(ap2.bssid, ':', ''), 1, 6) = SUBSTRING(REPLACE(ap.bssid, ':', ''), 1, 6)
      -- Last octet differs by 1-4 (common for dual-band routers)
      AND ABS(
        ('x' || SUBSTRING(REPLACE(ap2.bssid, ':', ''), 11, 2))::bit(8)::integer -
        ('x' || SUBSTRING(REPLACE(ap.bssid, ':', ''), 11, 2))::bit(8)::integer
      ) BETWEEN 1 AND 4
    LIMIT 5
  ) related ON true
  LEFT JOIN movement_metrics related_mm ON related_mm.bssid = related.bssid
  WHERE mm.max_distance_meters > 250  -- Only calculate for devices with movement
  GROUP BY ap.bssid
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

  -- THREAT COLUMN: v4.1 distance-focused scoring
  CASE
    -- Exclude cellular networks (towers have huge range)
    WHEN COALESCE(mm.inferred_type, '?') IN ('L', 'G', 'N') THEN
      jsonb_build_object(
        'score', 0,
        'level', 'NONE',
        'summary', 'Cellular network excluded from threat analysis',
        'flags', ARRAY['CELLULAR_EXCLUDED']::TEXT[],
        'factors', jsonb_build_object(
          'distance', 0,
          'distant_obs', 0,
          'temporal', 0,
          'dual_band', 0,
          'accuracy', 0
        )
      )
    -- No movement detected - not a threat
    WHEN COALESCE(mm.max_distance_meters, 0) < 100 THEN
      jsonb_build_object(
        'score', 0,
        'level', 'NONE',
        'summary', 'No significant movement detected',
        'flags', ARRAY[]::TEXT[],
        'factors', jsonb_build_object(
          'distance', 0,
          'distant_obs', 0,
          'temporal', 0,
          'dual_band', 0,
          'accuracy', 0
        )
      )
    -- Calculate threat for devices with movement
    ELSE
      (
        SELECT jsonb_build_object(
          'score', ROUND(composite_score::numeric, 1),
          'level', CASE
            WHEN composite_score >= 60 THEN 'HIGH'
            WHEN composite_score >= 35 THEN 'MED'
            WHEN composite_score >= 15 THEN 'LOW'
            ELSE 'NONE'
          END,
          'summary', CASE
            WHEN composite_score >= 60 THEN
              'HIGH: Same BSSID seen ' || ROUND(COALESCE(mm.max_distance_meters, 0)::numeric / 1000, 1) ||
              'km apart, ' || COALESCE(dobs.distant_obs_count, 0) || ' distant obs over ' ||
              COALESCE(dobs.distant_unique_days, 0) || ' days'
            WHEN composite_score >= 35 THEN
              'MED: Device seen at multiple distant locations (' ||
              ROUND(COALESCE(mm.max_distance_meters, 0)::numeric / 1000, 1) || 'km spread)'
            WHEN composite_score >= 15 THEN
              'LOW: Some movement detected (' ||
              ROUND(COALESCE(mm.max_distance_meters, 0)::numeric) || 'm spread)'
            ELSE 'Minimal movement'
          END,
          'flags', ARRAY_REMOVE(ARRAY[
            CASE WHEN COALESCE(mm.max_distance_meters, 0) > 5000 THEN 'EXTREME_DISTANCE'
                 WHEN COALESCE(mm.max_distance_meters, 0) > 2000 THEN 'SIGNIFICANT_DISTANCE'
                 WHEN COALESCE(mm.max_distance_meters, 0) > 500 THEN 'NOTABLE_DISTANCE' END,
            CASE WHEN COALESCE(dobs.distant_obs_count, 0) >= 5 THEN 'MULTIPLE_DISTANT_OBS' END,
            CASE WHEN COALESCE(dobs.distant_unique_days, 0) >= 7 THEN 'PERSISTENT_MULTI_DAY' END,
            CASE WHEN COALESCE(dbc.related_also_distant, FALSE) THEN 'DUAL_BAND_CORRELATION' END,
            CASE WHEN COALESCE(dobs.distant_best_accuracy, 100) < 20 THEN 'HIGH_ACCURACY_DISTANT' END
          ], NULL),
          'factors', jsonb_build_object(
            'distance', ROUND(distance_score::numeric, 1),
            'distant_obs', ROUND(distant_obs_score::numeric, 1),
            'temporal', ROUND(temporal_score::numeric, 1),
            'dual_band', ROUND(dual_band_score::numeric, 1),
            'accuracy', ROUND(accuracy_score::numeric, 1)
          ),
          'metrics', jsonb_build_object(
            'max_distance_m', ROUND(COALESCE(mm.max_distance_meters, 0)::numeric, 1),
            'distant_obs_count', COALESCE(dobs.distant_obs_count, 0),
            'very_distant_obs_count', COALESCE(dobs.very_distant_obs_count, 0),
            'distant_unique_days', COALESCE(dobs.distant_unique_days, 0),
            'distant_best_accuracy', COALESCE(dobs.distant_best_accuracy, 0),
            'related_bssid_count', COALESCE(dbc.related_bssid_count, 0),
            'related_also_distant', COALESCE(dbc.related_also_distant, FALSE)
          )
        )
        FROM (
          SELECT
            -- DISTANCE SCORE (50% weight) - Primary factor
            -- Even one distant observation matters!
            CASE
              WHEN COALESCE(mm.max_distance_meters, 0) > 10000 THEN 100  -- >10km
              WHEN COALESCE(mm.max_distance_meters, 0) > 5000 THEN 90   -- >5km
              WHEN COALESCE(mm.max_distance_meters, 0) > 2000 THEN 75   -- >2km
              WHEN COALESCE(mm.max_distance_meters, 0) > 1000 THEN 60   -- >1km
              WHEN COALESCE(mm.max_distance_meters, 0) > 500 THEN 45    -- >500m
              WHEN COALESCE(mm.max_distance_meters, 0) > 250 THEN 30    -- >250m
              WHEN COALESCE(mm.max_distance_meters, 0) > 100 THEN 15    -- >100m
              ELSE 0
            END AS distance_score,

            -- DISTANT OBSERVATION COUNT (25% weight)
            -- More observations at distant locations = more relevance
            CASE
              WHEN COALESCE(dobs.very_distant_obs_count, 0) >= 10 THEN 100  -- 10+ obs >1km away
              WHEN COALESCE(dobs.very_distant_obs_count, 0) >= 5 THEN 80
              WHEN COALESCE(dobs.very_distant_obs_count, 0) >= 2 THEN 60
              WHEN COALESCE(dobs.distant_obs_count, 0) >= 10 THEN 70        -- 10+ obs >250m away
              WHEN COALESCE(dobs.distant_obs_count, 0) >= 5 THEN 50
              WHEN COALESCE(dobs.distant_obs_count, 0) >= 2 THEN 30
              WHEN COALESCE(dobs.distant_obs_count, 0) >= 1 THEN 15         -- Even 1 distant obs matters
              ELSE 0
            END AS distant_obs_score,

            -- TEMPORAL PERSISTENCE (15% weight)
            -- Seen at distant locations over multiple days = pattern
            CASE
              WHEN COALESCE(dobs.distant_unique_days, 0) >= 30 THEN 100
              WHEN COALESCE(dobs.distant_unique_days, 0) >= 14 THEN 80
              WHEN COALESCE(dobs.distant_unique_days, 0) >= 7 THEN 60
              WHEN COALESCE(dobs.distant_unique_days, 0) >= 3 THEN 40
              WHEN COALESCE(dobs.distant_unique_days, 0) >= 2 THEN 25
              WHEN COALESCE(dobs.distant_unique_days, 0) >= 1 THEN 10
              ELSE 0
            END AS temporal_score,

            -- DUAL-BAND CORRELATION (5% weight)
            -- Related BSSID (MAC walk) also seen at distant locations
            CASE
              WHEN COALESCE(dbc.related_also_distant, FALSE) THEN 100
              WHEN COALESCE(dbc.related_bssid_count, 0) > 0 THEN 30
              ELSE 0
            END AS dual_band_score,

            -- ACCURACY BONUS (5% weight)
            -- High GPS accuracy on distant observations increases confidence
            CASE
              WHEN COALESCE(dobs.distant_best_accuracy, 100) < 10 THEN 100  -- <10m accuracy
              WHEN COALESCE(dobs.distant_best_accuracy, 100) < 20 THEN 70   -- <20m
              WHEN COALESCE(dobs.distant_best_accuracy, 100) < 50 THEN 40   -- <50m
              ELSE 0
            END AS accuracy_score
        ) scores,
        LATERAL (
          SELECT
            (scores.distance_score * 0.50) +
            (scores.distant_obs_score * 0.25) +
            (scores.temporal_score * 0.15) +
            (scores.dual_band_score * 0.05) +
            (scores.accuracy_score * 0.05) AS composite_score
        ) calc
      )
  END AS threat

FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN distant_observations dobs ON dobs.bssid = ap.bssid
LEFT JOIN dual_band_correlation dbc ON dbc.bssid = ap.bssid
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
