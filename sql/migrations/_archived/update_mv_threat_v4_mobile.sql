-- Migration: Update api_network_explorer_mv with Threat Score v4.0 (Mobile Device Focus)
-- Purpose: Only flag MOBILE devices (vehicle WiFi, phone hotspots) seen at distant locations
-- Date: 2026-01-19
--
-- Key insight: Business WiFi at fixed locations is NOT a threat.
-- Mobile devices (vehicle WiFi, phone hotspots) seen at distant locations ARE threats.
--
-- SSID patterns for mobile devices:
-- - Vehicle WiFi: myGMC, myChevrolet, CADILLAC, Ford Pass, Tesla, etc.
-- - Phone hotspots: iPhone, Galaxy, Pixel, Hotspot, Mobile Hotspot
--
-- SSID patterns for stationary (excluded):
-- - Business names: Meijer, McDonald's, Starbucks, Costco, Walmart, etc.
-- - Guest networks: Guest, Free, Public
-- - Institutions: Hospital, University, Library, Airport, Hotel

BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv_backup CASCADE;

-- Recreate MV with v4 mobile-focused threat scoring
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

-- Extended movement metrics including v4 threat components
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
),

-- SSID classification: mobile vs stationary
ssid_classification AS (
  SELECT
    ap.bssid,
    COALESCE(obs.ssid, ap.latest_ssid) AS ssid,
    -- Is this a mobile device (vehicle WiFi, phone hotspot)?
    CASE
      -- Vehicle WiFi patterns (GM OnStar, Ford, Tesla, etc.)
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^MY(GMC|CHEVROLET|CHEVY|BUICK|CADILLAC)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(CHEVROLET|GMC|BUICK|CADILLAC|CORVETTE)[0-9]' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^FORD.?(PASS|LINK|SYNC)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(LINCOLN|JEEP|CHRYSLER|DODGE|RAM)[0-9\-_]' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(HONDA|TOYOTA|LEXUS|ACURA|NISSAN|INFINITI)[0-9\-_]' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(MAZDA|SUBARU|HYUNDAI|KIA|GENESIS)[0-9\-_]' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(BMW|MERCEDES|AUDI|VOLKSWAGEN|VW|PORSCHE)[0-9\-_]' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(TESLA|RIVIAN|LUCID)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(VOLVO|JAGUAR|LAND.?ROVER)[0-9\-_]' THEN TRUE
      -- Phone hotspot patterns
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(IPHONE|IPAD|MACBOOK)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(GALAXY|SAMSUNG|ANDROID|PIXEL|ONEPLUS)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '''S (IPHONE|GALAXY|PHONE|HOTSPOT)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(MOBILE.?HOTSPOT|WIFI.?HOTSPOT|HOTSPOT[0-9]|MIFI)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^HOTSPOT$' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(PORTABLE|JETPACK|AIRCARD)' THEN TRUE
      -- Generic mobile patterns
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^[A-Z]+.?MOBILE$' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ 'MOBILE.?(WIFI|AP|HOTSPOT)' THEN TRUE
      ELSE FALSE
    END AS is_mobile_device,
    -- Is this a known stationary network (businesses, institutions)?
    CASE
      -- Retail/restaurants
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(MEIJER|WALMART|TARGET|COSTCO|SAMS.?CLUB|KROGER|ALDI)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(MCDONALD|BURGER.?KING|WENDY|TACO.?BELL|CHICK.?FIL|SUBWAY)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(STARBUCKS|DUNKIN|PANERA|CHIPOTLE|FIVE.?GUYS)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(HOME.?DEPOT|LOWES|MENARDS|ACE.?HARDWARE)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(CVS|WALGREENS|RITE.?AID|PHARMACY)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(BEST.?BUY|STAPLES|OFFICE.?DEPOT|MICROCENTER)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(DOLLAR.?GENERAL|DOLLAR.?TREE|FAMILY.?DOLLAR)' THEN TRUE
      -- Institutions
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(HOSPITAL|MEDICAL|CLINIC|HEALTH|URGENT.?CARE)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(UNIVERSITY|COLLEGE|SCHOOL|CAMPUS|STUDENT|EDU)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(LIBRARY|MUSEUM|COMMUNITY|CIVIC|CITY.?OF)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(AIRPORT|AIRLINE|TERMINAL|GATE)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(HOTEL|MARRIOTT|HILTON|HYATT|IHG|HOLIDAY.?INN|HAMPTON)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(MOTEL|SUITES|INN|LODGE|RESORT)' THEN TRUE
      -- Guest networks
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(GUEST|FREE|PUBLIC|OPEN|VISITOR)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(GUEST|FREE.?WIFI|PUBLIC.?WIFI)$' THEN TRUE
      -- ISP default names (stationary home routers)
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(XFINITY|SPECTRUM|ATT|VERIZON|TMOBILE|FRONTIER)' THEN TRUE
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '^(NETGEAR|LINKSYS|ASUS|TPLINK|DLINK|ARRIS)' THEN TRUE
      -- Corporate/enterprise patterns
      WHEN UPPER(COALESCE(obs.ssid, ap.latest_ssid)) ~ '(CORP|CORPORATE|ENTERPRISE|EMPLOYEE|STAFF)' THEN TRUE
      ELSE FALSE
    END AS is_stationary_network
  FROM public.access_points ap
  LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
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

  -- THREAT COLUMN: v4 mobile-focused scoring
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
    -- Exclude known stationary networks (businesses, institutions)
    WHEN sc.is_stationary_network = TRUE THEN
      jsonb_build_object(
        'score', 0,
        'level', 'NONE',
        'summary', 'Known stationary network (business/institution)',
        'flags', ARRAY['STATIONARY_EXCLUDED']::TEXT[],
        'factors', jsonb_build_object(
          'range_violation', 0,
          'co_occurrence', 0,
          'multi_location', 0,
          'signal_pattern', 0,
          'temporal', 0
        )
      )
    -- MOBILE DEVICES: Apply full threat scoring
    WHEN sc.is_mobile_device = TRUE THEN
      (
        SELECT jsonb_build_object(
          'score', ROUND(composite_score::numeric, 1),
          'level', CASE
            WHEN composite_score >= 50 THEN 'HIGH'
            WHEN composite_score >= 30 THEN 'MED'
            WHEN composite_score >= 15 THEN 'LOW'
            ELSE 'NONE'
          END,
          'summary', CASE
            WHEN composite_score >= 50 THEN 'HIGH: Mobile device seen ' || ROUND(COALESCE(mm.max_distance_meters, 0)::numeric / 1000, 1) || 'km apart over ' || COALESCE(mm.unique_days, 0) || ' days'
            WHEN composite_score >= 30 THEN 'MED: Mobile device with suspicious movement pattern'
            WHEN composite_score >= 15 THEN 'LOW: Mobile device with some anomalies'
            ELSE 'Mobile device - no significant threat'
          END,
          'flags', ARRAY_REMOVE(ARRAY[
            'MOBILE_DEVICE',
            CASE WHEN range_score >= 70 THEN 'EXTREME_RANGE_VIOLATION'
                 WHEN range_score >= 40 THEN 'SIGNIFICANT_RANGE_VIOLATION'
                 WHEN range_score > 0 THEN 'RANGE_VIOLATION' END,
            CASE WHEN multi_loc_score >= 50 THEN 'MULTI_LOCATION_TRACKING' END,
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
            -- Range violation score (50% weight for mobile devices)
            CASE
              WHEN COALESCE(mm.max_distance_meters, 0) > 5000 THEN 100  -- >5km = max
              WHEN COALESCE(mm.max_distance_meters, 0) > 2000 THEN 80   -- >2km
              WHEN COALESCE(mm.max_distance_meters, 0) > 1000 THEN 60   -- >1km
              WHEN COALESCE(mm.max_distance_meters, 0) > 500 THEN 40    -- >500m
              WHEN COALESCE(mm.max_distance_meters, 0) > 250 THEN 20    -- >250m
              ELSE 0
            END AS range_score,
            -- Multi-location score (25% weight)
            CASE
              WHEN COALESCE(mm.unique_locations, 0) >= 10 THEN 100
              WHEN COALESCE(mm.unique_locations, 0) >= 5 THEN 60
              WHEN COALESCE(mm.unique_locations, 0) >= 3 THEN 30
              ELSE 0
            END AS multi_loc_score,
            -- Signal pattern score (5% weight)
            CASE
              WHEN COALESCE(mm.signal_stddev, 0) > 15 AND COALESCE(mm.signal_mean, 0) < -70 THEN 80
              WHEN COALESCE(mm.signal_stddev, 0) > 10 THEN 40
              ELSE 0
            END AS signal_score,
            -- Temporal score (20% weight) - IMPORTANT for mobile devices
            CASE
              WHEN COALESCE(mm.unique_days, 0) >= 30 THEN 100
              WHEN COALESCE(mm.unique_days, 0) >= 14 THEN 80
              WHEN COALESCE(mm.unique_days, 0) >= 7 THEN 60
              WHEN COALESCE(mm.unique_days, 0) >= 3 THEN 40
              WHEN COALESCE(mm.unique_days, 0) >= 2 THEN 20
              ELSE 0
            END AS temporal_score
        ) scores,
        LATERAL (
          SELECT
            (scores.range_score * 0.50) +
            (scores.multi_loc_score * 0.25) +
            (scores.signal_score * 0.05) +
            (scores.temporal_score * 0.20) AS composite_score
        ) calc
      )
    -- UNKNOWN DEVICES: Use conservative scoring (higher threshold)
    ELSE
      (
        SELECT jsonb_build_object(
          'score', ROUND(composite_score::numeric, 1),
          'level', CASE
            WHEN composite_score >= 70 THEN 'HIGH'
            WHEN composite_score >= 50 THEN 'MED'
            WHEN composite_score >= 30 THEN 'LOW'
            ELSE 'NONE'
          END,
          'summary', CASE
            WHEN composite_score >= 70 THEN 'Unknown device with extreme range violations'
            WHEN composite_score >= 50 THEN 'Unknown device with suspicious patterns'
            WHEN composite_score >= 30 THEN 'Unknown device with some anomalies'
            ELSE 'No significant threat indicators'
          END,
          'flags', ARRAY_REMOVE(ARRAY[
            CASE WHEN range_score >= 80 THEN 'EXTREME_RANGE_VIOLATION'
                 WHEN range_score >= 50 THEN 'SIGNIFICANT_RANGE_VIOLATION' END,
            CASE WHEN multi_loc_score >= 60 AND temporal_score >= 60 THEN 'MULTI_DAY_MULTI_LOCATION' END
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
            -- Range violation score (40% weight) - higher threshold for unknowns
            CASE
              WHEN COALESCE(mm.max_distance_meters, 0) > 10000 THEN 100  -- >10km = max
              WHEN COALESCE(mm.max_distance_meters, 0) > 5000 THEN 70    -- >5km
              WHEN COALESCE(mm.max_distance_meters, 0) > 2000 THEN 40    -- >2km
              WHEN COALESCE(mm.max_distance_meters, 0) > 1000 THEN 20    -- >1km
              ELSE 0
            END AS range_score,
            -- Multi-location score (25% weight)
            CASE
              WHEN COALESCE(mm.unique_locations, 0) >= 15 THEN 100
              WHEN COALESCE(mm.unique_locations, 0) >= 10 THEN 70
              WHEN COALESCE(mm.unique_locations, 0) >= 5 THEN 40
              ELSE 0
            END AS multi_loc_score,
            -- Signal pattern score (10% weight)
            CASE
              WHEN COALESCE(mm.signal_stddev, 0) > 15 AND COALESCE(mm.signal_mean, 0) < -70 THEN 80
              WHEN COALESCE(mm.signal_stddev, 0) > 10 THEN 40
              ELSE 0
            END AS signal_score,
            -- Temporal score (25% weight) - must be seen many days for unknowns
            CASE
              WHEN COALESCE(mm.unique_days, 0) >= 60 THEN 100
              WHEN COALESCE(mm.unique_days, 0) >= 30 THEN 80
              WHEN COALESCE(mm.unique_days, 0) >= 14 THEN 50
              WHEN COALESCE(mm.unique_days, 0) >= 7 THEN 30
              ELSE 0
            END AS temporal_score
        ) scores,
        LATERAL (
          SELECT
            (scores.range_score * 0.40) +
            (scores.multi_loc_score * 0.25) +
            (scores.signal_score * 0.10) +
            (scores.temporal_score * 0.25) AS composite_score
        ) calc
      )
  END AS threat

FROM public.access_points ap
CROSS JOIN home_location home
LEFT JOIN obs_latest obs ON obs.bssid = ap.bssid
LEFT JOIN movement_metrics mm ON mm.bssid = ap.bssid
LEFT JOIN location_density ld ON ld.bssid = ap.bssid
LEFT JOIN ssid_classification sc ON sc.bssid = ap.bssid
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
