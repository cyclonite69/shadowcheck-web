-- ============================================================================
-- Fix max_distance_meters Calculation in Materialized View
-- Corrects the bug where signal level difference was used instead of
-- geographic distance between observations
-- ============================================================================
-- Date: 2026-01-30
-- Author: Claude Code
--
-- BUG: Previous version calculated MAX(o.level) - MIN(o.level) which gives
--      signal strength difference in dBm, NOT distance in meters.
--
-- FIX: Use PostGIS ST_Distance() to calculate actual geographic distance
--      between the first observation and all subsequent observations.
--
-- EXECUTION:
--   docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db < sql/migrations/20260130_fix_max_distance_meters.sql
-- ============================================================================

\echo 'Fixing max_distance_meters calculation in materialized view...'

BEGIN;

-- Drop and recreate with correct distance calculation
\echo '  Dropping existing materialized view...'
DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv CASCADE;

\echo '  Creating materialized view with correct PostGIS distance calculation...'
CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
WITH
-- Get the first observation location per BSSID (for distance calculation)
first_obs AS (
    SELECT DISTINCT ON (bssid)
        bssid,
        ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS first_geom
    FROM app.observations
    WHERE lat IS NOT NULL
      AND lon IS NOT NULL
      AND time >= '2000-01-01 00:00:00+00'::timestamptz
    ORDER BY bssid, time ASC
),
-- Calculate max distance from first observation to any other observation
distance_metrics AS (
    SELECT
        o.bssid,
        MAX(
            ST_Distance(
                fo.first_geom::geography,
                ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography
            )
        ) AS max_distance_meters
    FROM app.observations o
    INNER JOIN first_obs fo ON fo.bssid = o.bssid
    WHERE o.lat IS NOT NULL
      AND o.lon IS NOT NULL
      AND o.time >= '2000-01-01 00:00:00+00'::timestamptz
    GROUP BY o.bssid
)
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.bestlevel AS signal,
    n.bestlat AS lat,
    n.bestlon AS lon,
    to_timestamp(n.lasttime_ms / 1000.0) AS observed_at,
    n.capabilities AS security,
    COALESCE(t.threat_tag, 'untagged') AS tag_type,
    -- Observation metrics
    COUNT(o.id) AS observations,
    COUNT(DISTINCT DATE(o.time)) AS unique_days,
    COUNT(DISTINCT (ROUND(o.lat::numeric, 3) || ',' || ROUND(o.lon::numeric, 3))) AS unique_locations,
    MAX(o.accuracy) AS accuracy_meters,
    MIN(o.time) AS first_seen,
    MAX(o.time) AS last_seen,
    -- Threat scoring
    COALESCE(ts.final_threat_score, 0) AS threat_score,
    COALESCE(ts.final_threat_level, 'NONE') AS threat_level,
    ts.model_version,
    -- Distance from home calculation
    COALESCE(
        ST_Distance(
            ST_SetSRID(ST_MakePoint(n.bestlon, n.bestlat), 4326)::geography,
            (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
             FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
        ) / 1000.0,
        0
    ) AS distance_from_home_km,
    -- FIXED: Use actual PostGIS distance calculation instead of signal level difference
    COALESCE(dm.max_distance_meters, 0) AS max_distance_meters
FROM app.networks n
LEFT JOIN app.network_tags t ON n.bssid = t.bssid
LEFT JOIN app.observations o ON n.bssid = o.bssid
LEFT JOIN app.network_threat_scores ts ON n.bssid = ts.bssid
LEFT JOIN distance_metrics dm ON dm.bssid = n.bssid
WHERE n.bestlat IS NOT NULL AND n.bestlon IS NOT NULL
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.bestlevel, n.bestlat, n.bestlon,
         n.lasttime_ms, n.capabilities, t.threat_tag, ts.final_threat_score,
         ts.final_threat_level, ts.model_version, dm.max_distance_meters;

-- Recreate indexes
\echo '  Creating indexes...'
CREATE UNIQUE INDEX idx_api_network_explorer_mv_bssid ON app.api_network_explorer_mv(bssid);
CREATE INDEX idx_api_network_explorer_mv_type ON app.api_network_explorer_mv(type);
CREATE INDEX idx_api_network_explorer_mv_observed_at ON app.api_network_explorer_mv(observed_at DESC);
CREATE INDEX idx_api_network_explorer_mv_threat ON app.api_network_explorer_mv(threat_score DESC);
CREATE INDEX idx_api_network_explorer_mv_max_distance ON app.api_network_explorer_mv(max_distance_meters DESC);

COMMIT;

\echo 'max_distance_meters calculation fixed!'
\echo ''
\echo 'Now refresh the materialized view to recalculate distances:'
\echo '  SELECT * FROM app.refresh_all_materialized_views();'
\echo ''
\echo 'Or refresh just this view:'
\echo '  REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv;'
