-- Fix Broken Kismet-Related Functions
-- Generated: 2025-11-18
-- Purpose: Fix column name mismatches and type errors in surveillance detection functions

-- ============================================================================
-- FIX 1: analyze_individual_network_sightings
-- Problem: Function looks at networks_legacy (1 row per network) instead of
--          locations_legacy (multiple observations per network)
-- Solution: Rewrite to use locations_legacy for full observation history
-- ============================================================================

CREATE OR REPLACE FUNCTION app.analyze_individual_network_sightings(
    p_analysis_days integer DEFAULT 30,
    p_home_radius_meters numeric DEFAULT 500
)
RETURNS TABLE(
    bssid text,
    ssid text,
    total_sightings bigint,
    unique_locations bigint,
    first_seen_timestamp bigint,
    last_seen_timestamp bigint,
    home_sightings bigint,
    away_sightings bigint,
    max_distance_from_home_km numeric,
    sighting_pattern text,
    stalking_risk_score numeric,
    location_details text
)
LANGUAGE plpgsql
AS $function$
DECLARE
    home_location GEOMETRY;
    analysis_start_time BIGINT;
BEGIN
    -- Get home location
    SELECT location_point INTO home_location
    FROM app.location_markers
    WHERE marker_type = 'home'
    LIMIT 1;

    -- Convert analysis window to Unix timestamp (milliseconds)
    analysis_start_time := EXTRACT(EPOCH FROM (NOW() - (p_analysis_days || ' days')::INTERVAL)) * 1000;

    RETURN QUERY
    WITH sightings_with_location AS (
        SELECT
            l.bssid,
            n.ssid,
            l.time as observation_time,
            ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326) as observation_point,
            ST_Distance(
                ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326)::geography,
                home_location::geography
            ) as distance_from_home_meters
        FROM app.locations_legacy l
        LEFT JOIN app.networks_legacy n ON l.bssid = n.bssid
        WHERE l.time >= analysis_start_time
            AND l.lat IS NOT NULL
            AND l.lon IS NOT NULL
            AND l.bssid IS NOT NULL
            AND l.lat BETWEEN -90 AND 90
            AND l.lon BETWEEN -180 AND 180
    ),
    sighting_analysis AS (
        SELECT
            swl.bssid,
            swl.ssid,
            COUNT(*) as total_sightings,
            COUNT(DISTINCT ST_SnapToGrid(swl.observation_point, 0.001)) as unique_locations,
            MIN(swl.observation_time) as first_seen_ms,
            MAX(swl.observation_time) as last_seen_ms,
            COUNT(*) FILTER (WHERE swl.distance_from_home_meters <= p_home_radius_meters) as home_sightings,
            COUNT(*) FILTER (WHERE swl.distance_from_home_meters > 2000) as away_sightings,
            MAX(swl.distance_from_home_meters / 1000.0) as max_distance_km,
            STRING_AGG(
                (
                    ROUND(ST_Y(swl.observation_point)::numeric, 4) || ',' ||
                    ROUND(ST_X(swl.observation_point)::numeric, 4) ||
                    ' (' || ROUND((swl.distance_from_home_meters/1000.0)::numeric, 1) || 'km)'
                ),
                ' | '
                ORDER BY swl.distance_from_home_meters DESC
                LIMIT 10  -- Only show top 10 locations
            ) as location_summary
        FROM sightings_with_location swl
        GROUP BY swl.bssid, swl.ssid
    )
    SELECT
        sa.bssid,
        COALESCE(sa.ssid, '') as ssid,
        sa.total_sightings,
        sa.unique_locations,
        sa.first_seen_ms as first_seen_timestamp,
        sa.last_seen_ms as last_seen_timestamp,
        sa.home_sightings,
        sa.away_sightings,
        ROUND(sa.max_distance_km::numeric, 2) as max_distance_from_home_km,
        CASE
            WHEN sa.home_sightings > 0 AND sa.away_sightings > 0 AND sa.max_distance_km > 50
                THEN 'CRITICAL_HOME_AND_DISTANT'
            WHEN sa.home_sightings > 0 AND sa.away_sightings > 0 AND sa.max_distance_km > 10
                THEN 'HIGH_HOME_AND_DISTANT'
            WHEN sa.home_sightings > 0 AND sa.away_sightings > 0 AND sa.max_distance_km > 2
                THEN 'MEDIUM_HOME_AND_LOCAL'
            WHEN sa.unique_locations > 5 AND sa.max_distance_km > 20
                THEN 'MOBILE_SURVEILLANCE'
            WHEN sa.home_sightings > 0 AND sa.away_sightings = 0
                THEN 'HOME_ONLY'
            WHEN sa.away_sightings > 0 AND sa.home_sightings = 0
                THEN 'AWAY_ONLY'
            ELSE 'OTHER'
        END as sighting_pattern,
        -- Stalking risk score (0-100)
        CASE
            WHEN sa.home_sightings > 0 AND sa.away_sightings > 0 AND sa.max_distance_km > 50 THEN 95
            WHEN sa.home_sightings > 0 AND sa.away_sightings > 0 AND sa.max_distance_km > 20 THEN 85
            WHEN sa.home_sightings > 0 AND sa.away_sightings > 0 AND sa.max_distance_km > 10 THEN 75
            WHEN sa.home_sightings > 0 AND sa.away_sightings > 0 AND sa.max_distance_km > 2 THEN 60
            WHEN sa.unique_locations > 10 AND sa.max_distance_km > 20 THEN 70
            WHEN sa.unique_locations > 5 AND sa.max_distance_km > 10 THEN 50
            WHEN sa.home_sightings > 5 THEN 30
            ELSE 10
        END as stalking_risk_score,
        sa.location_summary as location_details
    FROM sighting_analysis sa
    WHERE sa.total_sightings > 1  -- At least 2 sightings
    ORDER BY stalking_risk_score DESC, sa.total_sightings DESC;
END;
$function$;

-- ============================================================================
-- FIX 2: analyze_temporal_sighting_patterns
-- Problem: References "measurement_time" column that doesn't exist
-- Solution: Use "time" (bigint) or "observation_time" (timestamp) from locations_legacy
-- ============================================================================

CREATE OR REPLACE FUNCTION app.analyze_temporal_sighting_patterns(
    p_time_window_minutes integer DEFAULT 60,
    p_analysis_days integer DEFAULT 14
)
RETURNS TABLE(
    bssid text,
    ssid text,
    correlation_type text,
    occurrences integer,
    avg_time_offset_minutes numeric,
    locations_involved integer,
    pattern_confidence numeric
)
LANGUAGE plpgsql
AS $function$
DECLARE
    home_location GEOMETRY;
BEGIN
    -- Get home location
    SELECT location_point INTO home_location
    FROM app.location_markers
    WHERE marker_type = 'home'
    LIMIT 1;

    RETURN QUERY
    WITH user_location_changes AS (
        -- Detect when user moves away from or returns to home
        SELECT
            observation_time,
            ST_SetSRID(ST_MakePoint(lon, lat), 4326) as location_point,
            CASE
                WHEN ST_Distance(
                    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                    home_location::geography
                ) <= 500 THEN 'AT_HOME'
                ELSE 'AWAY_FROM_HOME'
            END as location_context,
            LAG(CASE
                WHEN ST_Distance(
                    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                    home_location::geography
                ) <= 500 THEN 'AT_HOME'
                ELSE 'AWAY_FROM_HOME'
            END) OVER (ORDER BY observation_time) as previous_context
        FROM app.locations_legacy
        WHERE observation_time >= NOW() - (p_analysis_days || ' days')::INTERVAL
            AND lat IS NOT NULL
            AND lon IS NOT NULL
    ),
    context_changes AS (
        SELECT
            observation_time as change_time,
            location_point as change_location,
            CASE
                WHEN location_context = 'AT_HOME' AND previous_context = 'AWAY_FROM_HOME' THEN 'ARRIVING_HOME'
                WHEN location_context = 'AWAY_FROM_HOME' AND previous_context = 'AT_HOME' THEN 'LEAVING_HOME'
                ELSE NULL
            END as change_type
        FROM user_location_changes
        WHERE location_context != previous_context
    ),
    network_sightings_near_changes AS (
        SELECT
            l.bssid,
            n.ssid,
            l.observation_time as sighting_time,
            cc.change_time,
            cc.change_type,
            EXTRACT(EPOCH FROM (l.observation_time - cc.change_time)) / 60 as time_offset_minutes
        FROM context_changes cc
        JOIN app.locations_legacy l ON
            l.observation_time BETWEEN cc.change_time - (p_time_window_minutes || ' minutes')::INTERVAL
                                  AND cc.change_time + (p_time_window_minutes || ' minutes')::INTERVAL
        LEFT JOIN app.networks_legacy n ON l.bssid = n.bssid
        WHERE cc.change_type IS NOT NULL
            AND ST_Distance(
                ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326)::geography,
                cc.change_location::geography
            ) <= 2000 -- Within 2km
            AND l.bssid IS NOT NULL
    )
    SELECT
        nsnc.bssid,
        COALESCE(nsnc.ssid, '') as ssid,
        CASE
            WHEN nsnc.change_type = 'ARRIVING_HOME' AND AVG(nsnc.time_offset_minutes) < 0 THEN 'APPEARS_BEFORE_ARRIVING_HOME'
            WHEN nsnc.change_type = 'ARRIVING_HOME' AND AVG(nsnc.time_offset_minutes) > 0 THEN 'APPEARS_AFTER_ARRIVING_HOME'
            WHEN nsnc.change_type = 'LEAVING_HOME' AND AVG(nsnc.time_offset_minutes) < 0 THEN 'APPEARS_BEFORE_LEAVING_HOME'
            WHEN nsnc.change_type = 'LEAVING_HOME' AND AVG(nsnc.time_offset_minutes) > 0 THEN 'APPEARS_AFTER_LEAVING_HOME'
            ELSE 'UNCLEAR_PATTERN'
        END as correlation_type,
        COUNT(*)::INTEGER as occurrences,
        ROUND(AVG(ABS(nsnc.time_offset_minutes)), 2) as avg_time_offset_minutes,
        COUNT(DISTINCT nsnc.change_time)::INTEGER as locations_involved,
        CASE
            WHEN COUNT(*) >= 5 AND nsnc.change_type = 'ARRIVING_HOME' AND AVG(nsnc.time_offset_minutes) < -10 THEN 0.95
            WHEN COUNT(*) >= 3 AND ABS(AVG(nsnc.time_offset_minutes)) <= 15 THEN 0.85
            WHEN COUNT(*) >= 3 THEN 0.7
            WHEN COUNT(*) >= 2 THEN 0.6
            ELSE 0.4
        END as pattern_confidence
    FROM network_sightings_near_changes nsnc
    GROUP BY nsnc.bssid, nsnc.ssid, nsnc.change_type
    HAVING COUNT(*) >= 2  -- At least 2 correlated sightings
    ORDER BY pattern_confidence DESC, occurrences DESC;
END;
$function$;

-- ============================================================================
-- FIX 3: get_surveillance_threats_with_settings
-- Problem: Type mismatch - returns numeric for threat_level but expects text
-- Solution: Cast threat_level to text in the wrapper function
-- ============================================================================

CREATE OR REPLACE FUNCTION app.get_surveillance_threats_with_settings(
    p_radio_type text DEFAULT 'wifi',
    p_limit integer DEFAULT 100
)
RETURNS TABLE(
    bssid text,
    ssid text,
    radio_band text,
    total_sightings bigint,
    home_sightings bigint,
    away_sightings bigint,
    max_distance_km numeric,
    threat_level text,
    threat_description text,
    confidence_score numeric,
    is_mobile_hotspot boolean
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_min_distance numeric;
    v_home_radius numeric;
    v_min_home_sightings integer;
BEGIN
    -- Load settings from detection_settings table
    SELECT
        min_distance_km * 1000,  -- Convert to meters
        home_radius_m,
        min_home_sightings
    INTO v_min_distance, v_home_radius, v_min_home_sightings
    FROM app.detection_settings
    WHERE radio_type = p_radio_type
        AND enabled = true
    LIMIT 1;

    -- Use defaults if no settings found
    IF v_min_distance IS NULL THEN
        v_min_distance := 500;
        v_home_radius := 500;
        v_min_home_sightings := 1;
    END IF;

    -- Call underlying function and cast threat_level to text
    RETURN QUERY
    SELECT
        t.bssid,
        t.ssid,
        t.radio_band,
        t.total_sightings,
        t.home_sightings,
        t.away_sightings,
        t.max_distance_km,
        t.threat_level::text,  -- CAST to text
        t.threat_description,
        t.confidence_score,
        t.is_mobile_hotspot
    FROM app.get_wifi_surveillance_threats(
        v_min_distance / 1000.0,  -- Convert back to km
        v_home_radius,
        v_min_home_sightings,
        p_limit
    ) t;
END;
$function$;

-- ============================================================================
-- VALIDATION QUERIES - Run these to test the fixes
-- ============================================================================

-- Test 1: analyze_individual_network_sightings (should now return data)
-- SELECT * FROM app.analyze_individual_network_sightings(30, 500)
-- WHERE stalking_risk_score > 50
-- ORDER BY stalking_risk_score DESC
-- LIMIT 10;

-- Test 2: analyze_temporal_sighting_patterns (should not error)
-- SELECT * FROM app.analyze_temporal_sighting_patterns(60, 30)
-- WHERE pattern_confidence > 0.5
-- ORDER BY pattern_confidence DESC
-- LIMIT 10;

-- Test 3: get_surveillance_threats_with_settings (should not have type error)
-- SELECT * FROM app.get_surveillance_threats_with_settings('wifi', 20)
-- ORDER BY max_distance_km DESC;

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Fixed Functions:
-- 1. analyze_individual_network_sightings - Now uses locations_legacy for full observation history
-- 2. analyze_temporal_sighting_patterns - Fixed column name from measurement_time to observation_time
-- 3. get_surveillance_threats_with_settings - Cast threat_level to text to fix type mismatch

-- All functions should now execute without errors and return meaningful data.
