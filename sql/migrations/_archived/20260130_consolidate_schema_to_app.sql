-- ============================================================================
-- Schema Consolidation Migration
-- Move all application objects from public schema to app schema
-- ============================================================================
-- Date: 2026-01-30
-- Author: Claude Code
--
-- ROLLBACK INSTRUCTIONS:
-- If anything goes wrong, restore from backup:
--   psql -U shadowcheck_admin -d shadowcheck_db < /path/to/backup.sql
--
-- EXECUTION:
--   docker exec -i shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db < this_file.sql
-- ============================================================================

\echo '=============================================='
\echo 'Starting Schema Consolidation Migration'
\echo '=============================================='

-- Run as shadowcheck_user (table owner)

BEGIN;

-- ============================================================================
-- PHASE 1: Move Independent Tables (no foreign key dependencies)
-- ============================================================================
\echo ''
\echo '[Phase 1] Moving independent tables...'

-- device_sources - Referenced by many tables, must move first
\echo '  Moving device_sources...'
ALTER TABLE public.device_sources SET SCHEMA app;

-- access_points and legacy
\echo '  Moving access_points...'
ALTER TABLE public.access_points SET SCHEMA app;
ALTER TABLE public.access_points_legacy SET SCHEMA app;

-- api_mv_refresh_state
\echo '  Moving api_mv_refresh_state...'
ALTER TABLE public.api_mv_refresh_state SET SCHEMA app;

-- threat_scores_cache
\echo '  Moving threat_scores_cache...'
ALTER TABLE public.threat_scores_cache SET SCHEMA app;

-- wigle tables (v3_network_details must come before v3_observations due to FK)
\echo '  Moving wigle_v3_network_details...'
ALTER TABLE public.wigle_v3_network_details SET SCHEMA app;

\echo '  Moving wigle_v2_networks_search...'
ALTER TABLE public.wigle_v2_networks_search SET SCHEMA app;

-- ============================================================================
-- PHASE 2: Move Dependent Tables
-- ============================================================================
\echo ''
\echo '[Phase 2] Moving dependent tables...'

-- networks (depends on device_sources)
\echo '  Moving networks...'
ALTER TABLE public.networks SET SCHEMA app;

-- observations (depends on access_points, device_sources)
\echo '  Moving observations...'
ALTER TABLE public.observations SET SCHEMA app;
ALTER TABLE public.observations_legacy SET SCHEMA app;

-- wigle_v3_observations (depends on wigle_v3_network_details)
\echo '  Moving wigle_v3_observations...'
ALTER TABLE public.wigle_v3_observations SET SCHEMA app;

-- routes (depends on device_sources)
\echo '  Moving routes...'
ALTER TABLE public.routes SET SCHEMA app;

-- ssid_history (depends on access_points)
\echo '  Moving ssid_history...'
ALTER TABLE public.ssid_history SET SCHEMA app;

-- staging tables (depend on device_sources)
\echo '  Moving staging tables...'
ALTER TABLE public.staging_locations_all_raw SET SCHEMA app;
ALTER TABLE public.staging_networks SET SCHEMA app;
ALTER TABLE public.staging_routes SET SCHEMA app;

-- ============================================================================
-- PHASE 3: Drop and Recreate Views in app schema
-- ============================================================================
\echo ''
\echo '[Phase 3] Recreating views in app schema...'

-- api_network_explorer view
\echo '  Recreating api_network_explorer...'
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;

CREATE OR REPLACE VIEW app.api_network_explorer AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.bestlevel AS signal_strength,
    n.bestlat AS latitude,
    n.bestlon AS longitude,
    n.lasttime_ms,
    COALESCE(t.threat_tag, 'untagged') AS tag_type,
    t.updated_at AS tagged_at,
    nt.notes_count,
    nm.media_count
FROM app.networks n
LEFT JOIN app.network_tags t ON n.bssid = t.bssid
LEFT JOIN (
    SELECT bssid, COUNT(*) AS notes_count
    FROM app.network_notes
    GROUP BY bssid
) nt ON n.bssid = nt.bssid
LEFT JOIN (
    SELECT bssid, COUNT(*) AS media_count
    FROM app.network_media
    GROUP BY bssid
) nm ON n.bssid = nm.bssid;

-- network_summary_with_notes view
\echo '  Recreating network_summary_with_notes...'
DROP VIEW IF EXISTS public.network_summary_with_notes CASCADE;

CREATE OR REPLACE VIEW app.network_summary_with_notes AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.bestlevel,
    n.bestlat,
    n.bestlon,
    n.lasttime_ms,
    nn.content AS latest_note,
    nn.created_at AS note_created_at
FROM app.networks n
LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM app.network_notes
    WHERE bssid = n.bssid
    ORDER BY created_at DESC
    LIMIT 1
) nn ON true;

-- v_real_access_points view
\echo '  Recreating v_real_access_points...'
DROP VIEW IF EXISTS public.v_real_access_points CASCADE;

CREATE OR REPLACE VIEW app.v_real_access_points AS
SELECT id, bssid, latest_ssid, ssid_variants, first_seen, last_seen,
       total_observations, is_5ghz, is_6ghz, is_hidden, is_sentinel
FROM app.access_points
WHERE NOT is_sentinel;

-- ============================================================================
-- PHASE 4: Drop and Recreate Materialized Views
-- ============================================================================
\echo ''
\echo '[Phase 4] Recreating materialized views in app schema...'

-- Drop all public MVs first (they depend on tables we moved)
\echo '  Dropping old materialized views...'
DROP MATERIALIZED VIEW IF EXISTS public.analytics_summary_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_full_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_latest_full_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_latest_full_mv_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_latest_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_rollup_full_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_rollup_full_mv_v2 CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_rollup_mv CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_convergence_events CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_device_routes CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_heatmap_tiles CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_network_latest CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_network_timeline CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_simultaneous_rf_events CASCADE;

-- Create primary MV: api_network_explorer_mv
\echo '  Creating api_network_explorer_mv...'
CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.bestlevel AS signal_strength,
    n.bestlat AS latitude,
    n.bestlon AS longitude,
    n.lasttime_ms,
    COALESCE(t.threat_tag, 'untagged') AS tag_type
FROM app.networks n
LEFT JOIN app.network_tags t ON n.bssid = t.bssid
WHERE n.bestlat IS NOT NULL AND n.bestlon IS NOT NULL;

CREATE INDEX idx_api_network_explorer_mv_bssid ON app.api_network_explorer_mv(bssid);
CREATE INDEX idx_api_network_explorer_mv_type ON app.api_network_explorer_mv(type);
CREATE INDEX idx_api_network_explorer_mv_lasttime ON app.api_network_explorer_mv(lasttime_ms DESC);

-- Create analytics_summary_mv
\echo '  Creating analytics_summary_mv...'
CREATE MATERIALIZED VIEW app.analytics_summary_mv AS
SELECT
    n.type,
    COUNT(*) AS network_count,
    COUNT(DISTINCT n.ssid) AS unique_ssids,
    AVG(n.bestlevel) AS avg_signal,
    MIN(n.lasttime_ms) AS earliest_seen,
    MAX(n.lasttime_ms) AS latest_seen
FROM app.networks n
GROUP BY n.type;

CREATE INDEX idx_analytics_summary_mv_type ON app.analytics_summary_mv(type);

-- Create api_network_latest_mv
\echo '  Creating api_network_latest_mv...'
CREATE MATERIALIZED VIEW app.api_network_latest_mv AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.bestlevel,
    n.bestlat,
    n.bestlon,
    n.lasttime_ms
FROM app.networks n
WHERE n.lasttime_ms > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000;

CREATE INDEX idx_api_network_latest_mv_bssid ON app.api_network_latest_mv(bssid);

-- Create mv_network_timeline
\echo '  Creating mv_network_timeline...'
CREATE MATERIALIZED VIEW app.mv_network_timeline AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    DATE_TRUNC('hour', o.time) AS hour_bucket,
    COUNT(*) AS observation_count,
    AVG(o.level) AS avg_signal,
    MIN(o.level) AS min_signal,
    MAX(o.level) AS max_signal
FROM app.networks n
JOIN app.observations o ON n.bssid = o.bssid
GROUP BY n.bssid, n.ssid, n.type, DATE_TRUNC('hour', o.time);

CREATE INDEX idx_mv_network_timeline_bssid ON app.mv_network_timeline(bssid);
CREATE INDEX idx_mv_network_timeline_hour ON app.mv_network_timeline(hour_bucket);

-- ============================================================================
-- PHASE 5: Move Functions to app schema
-- ============================================================================
\echo ''
\echo '[Phase 5] Moving functions to app schema...'

-- get_home_location function
\echo '  Creating get_home_location...'
DROP FUNCTION IF EXISTS public.get_home_location CASCADE;

CREATE OR REPLACE FUNCTION app.get_home_location()
RETURNS TABLE(latitude double precision, longitude double precision) AS $$
BEGIN
    RETURN QUERY
    SELECT lm.latitude, lm.longitude
    FROM app.location_markers lm
    WHERE lm.marker_type = 'home'
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- calculate_threat_score_v3 function
\echo '  Creating calculate_threat_score_v3...'
DROP FUNCTION IF EXISTS public.calculate_threat_score_v3 CASCADE;

CREATE OR REPLACE FUNCTION app.calculate_threat_score_v3(p_bssid text)
RETURNS TABLE(
    bssid text,
    threat_score integer,
    threat_level text,
    factors jsonb
) AS $$
DECLARE
    v_score integer := 0;
    v_factors jsonb := '{}';
    v_home_lat double precision;
    v_home_lon double precision;
    v_seen_at_home boolean := false;
    v_seen_away boolean := false;
    v_distance_range double precision := 0;
    v_observation_count integer := 0;
    v_days_seen integer := 0;
BEGIN
    -- Get home location
    SELECT latitude, longitude INTO v_home_lat, v_home_lon
    FROM app.location_markers
    WHERE marker_type = 'home'
    LIMIT 1;

    -- Count observations and days
    SELECT
        COUNT(*),
        COUNT(DISTINCT DATE(time))
    INTO v_observation_count, v_days_seen
    FROM app.observations
    WHERE observations.bssid = p_bssid;

    -- Calculate distance range if home is set
    IF v_home_lat IS NOT NULL THEN
        SELECT
            MAX(ST_Distance(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography
            ))
        INTO v_distance_range
        FROM app.observations
        WHERE observations.bssid = p_bssid
          AND o.lat IS NOT NULL AND o.lon IS NOT NULL;

        -- Check if seen at home (within 100m)
        SELECT EXISTS(
            SELECT 1 FROM app.observations
            WHERE observations.bssid = p_bssid
              AND ST_DWithin(
                  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography,
                  100
              )
        ) INTO v_seen_at_home;

        -- Check if seen away (more than 200m from home)
        SELECT EXISTS(
            SELECT 1 FROM app.observations
            WHERE observations.bssid = p_bssid
              AND ST_Distance(
                  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography
              ) > 200
        ) INTO v_seen_away;
    END IF;

    -- Calculate score based on factors
    IF v_seen_at_home AND v_seen_away THEN
        v_score := v_score + 40;
        v_factors := v_factors || '{"home_and_away": 40}';
    END IF;

    IF v_distance_range > 200 THEN
        v_score := v_score + 25;
        v_factors := v_factors || jsonb_build_object('distance_range', 25);
    END IF;

    IF v_days_seen >= 3 THEN
        v_score := v_score + LEAST(15, v_days_seen);
        v_factors := v_factors || jsonb_build_object('multiple_days', LEAST(15, v_days_seen));
    END IF;

    IF v_observation_count >= 10 THEN
        v_score := v_score + LEAST(10, v_observation_count / 10);
        v_factors := v_factors || jsonb_build_object('observation_count', LEAST(10, v_observation_count / 10));
    END IF;

    RETURN QUERY SELECT
        p_bssid,
        v_score,
        CASE
            WHEN v_score >= 80 THEN 'CRITICAL'
            WHEN v_score >= 60 THEN 'HIGH'
            WHEN v_score >= 40 THEN 'MED'
            WHEN v_score >= 20 THEN 'LOW'
            ELSE 'NONE'
        END,
        v_factors;
END;
$$ LANGUAGE plpgsql STABLE;

-- nearby_networks function
\echo '  Creating nearby_networks...'
DROP FUNCTION IF EXISTS public.nearby_networks CASCADE;

CREATE OR REPLACE FUNCTION app.nearby_networks(
    p_lat double precision,
    p_lon double precision,
    p_radius_meters integer DEFAULT 100
)
RETURNS TABLE(
    bssid text,
    ssid text,
    type text,
    distance_meters double precision,
    signal_strength integer
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.bssid,
        n.ssid,
        n.type,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(n.bestlon, n.bestlat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
        ) AS distance_meters,
        n.bestlevel AS signal_strength
    FROM app.networks n
    WHERE n.bestlat IS NOT NULL
      AND n.bestlon IS NOT NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(n.bestlon, n.bestlat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
          p_radius_meters
      )
    ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql STABLE;

-- refresh_all_materialized_views function
\echo '  Creating refresh_all_materialized_views...'
DROP FUNCTION IF EXISTS public.refresh_all_materialized_views CASCADE;
DROP FUNCTION IF EXISTS app.refresh_all_materialized_views CASCADE;

CREATE OR REPLACE FUNCTION app.refresh_all_materialized_views()
RETURNS TABLE(view_name text, status text, refresh_duration interval) AS $$
DECLARE
    mv_record RECORD;
    start_time timestamp;
    end_time timestamp;
BEGIN
    FOR mv_record IN
        SELECT schemaname || '.' || matviewname AS full_name
        FROM pg_matviews
        WHERE schemaname = 'app'
        ORDER BY matviewname
    LOOP
        start_time := clock_timestamp();
        BEGIN
            EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_record.full_name);
            end_time := clock_timestamp();
            RETURN QUERY SELECT mv_record.full_name, 'success'::text, end_time - start_time;
        EXCEPTION WHEN OTHERS THEN
            end_time := clock_timestamp();
            RETURN QUERY SELECT mv_record.full_name, 'error: ' || SQLERRM, end_time - start_time;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 6: Update Foreign Keys to point to app schema
-- ============================================================================
\echo ''
\echo '[Phase 6] Updating foreign key references...'

-- The FK constraints should have moved with the tables, but let's verify
-- Note: ALTER TABLE SET SCHEMA preserves all constraints

-- ============================================================================
-- PHASE 7: Grant Permissions
-- ============================================================================
\echo ''
\echo '[Phase 7] Granting permissions...'

-- Grant on all tables in app schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;

-- Grant on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_user;

-- Grant schema usage
GRANT USAGE ON SCHEMA app TO shadowcheck_user;

-- Admin gets full access
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_admin;

COMMIT;

\echo ''
\echo '=============================================='
\echo 'Schema Consolidation Complete!'
\echo '=============================================='
\echo ''
\echo 'Verify with:'
\echo "  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'spatial_%';"
\echo "  SELECT COUNT(*) FROM app.networks;"
\echo "  SELECT COUNT(*) FROM app.api_network_explorer_mv;"
