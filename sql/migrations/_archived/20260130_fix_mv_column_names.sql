-- ============================================================================
-- Fix Materialized View Column Names
-- Update column aliases to match application code expectations
-- ============================================================================
-- Date: 2026-01-30
-- Author: Claude Code
--
-- EXECUTION:
--   docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db < this_file.sql
-- ============================================================================

\echo 'Fixing materialized view column names...'

BEGIN;

-- Drop and recreate api_network_explorer_mv with correct column names
\echo '  Recreating api_network_explorer_mv with correct column names...'
DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv CASCADE;

CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
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
    -- Additional columns needed by the application
    COUNT(o.id) AS observations,
    COUNT(DISTINCT DATE(o.time)) AS unique_days,
    COUNT(DISTINCT (ROUND(o.lat::numeric, 3) || ',' || ROUND(o.lon::numeric, 3))) AS unique_locations,
    MAX(o.accuracy) AS accuracy_meters,
    MIN(o.time) AS first_seen,
    MAX(o.time) AS last_seen,
    COALESCE(ts.final_threat_score, 0) AS threat_score,
    COALESCE(ts.final_threat_level, 'NONE') AS threat_level,
    ts.model_version,
    -- Distance calculations
    COALESCE(
        ST_Distance(
            ST_SetSRID(ST_MakePoint(n.bestlon, n.bestlat), 4326)::geography,
            (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
             FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
        ) / 1000.0,
        0
    ) AS distance_from_home_km,
    MAX(o.level) - MIN(o.level) AS max_distance_meters
FROM app.networks n
LEFT JOIN app.network_tags t ON n.bssid = t.bssid
LEFT JOIN app.observations o ON n.bssid = o.bssid
LEFT JOIN app.network_threat_scores ts ON n.bssid = ts.bssid
WHERE n.bestlat IS NOT NULL AND n.bestlon IS NOT NULL
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.bestlevel, n.bestlat, n.bestlon,
         n.lasttime_ms, n.capabilities, t.threat_tag, ts.final_threat_score,
         ts.final_threat_level, ts.model_version;

CREATE UNIQUE INDEX idx_api_network_explorer_mv_bssid ON app.api_network_explorer_mv(bssid);
CREATE INDEX idx_api_network_explorer_mv_type ON app.api_network_explorer_mv(type);
CREATE INDEX idx_api_network_explorer_mv_observed_at ON app.api_network_explorer_mv(observed_at DESC);
CREATE INDEX idx_api_network_explorer_mv_threat ON app.api_network_explorer_mv(threat_score DESC);

-- Recreate api_network_explorer view with correct columns
\echo '  Recreating api_network_explorer view...'
DROP VIEW IF EXISTS app.api_network_explorer CASCADE;

CREATE OR REPLACE VIEW app.api_network_explorer AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.bestlevel AS signal,
    n.bestlat AS lat,
    n.bestlon AS lon,
    n.lasttime_ms AS observed_at,
    n.capabilities AS security,
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

COMMIT;

\echo 'MV column names fixed successfully!'
\echo 'Run: SELECT * FROM app.refresh_all_materialized_views(); to refresh data'
