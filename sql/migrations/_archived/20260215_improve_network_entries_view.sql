-- Improve network_entries view with real altitude aggregates
-- Replaces hardcoded zeros with actual values from observations table
-- Adds altitude range filtering (-500 to 10000m) to reject GPS garbage
--
-- Run as: docker exec -i shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db < this_file.sql

-- Drop existing view
DROP VIEW IF EXISTS app.network_entries CASCADE;

-- View with real observation aggregates including altitude
CREATE OR REPLACE VIEW app.network_entries AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.capabilities AS security,
    n.service,
    n.rcois,
    n.mfgrid,
    n.lasttime_ms,
    n.lastlat,
    n.lastlon,
    n.bestlevel AS signal,
    n.bestlat AS lat,
    n.bestlon AS lon,
    -- Observation aggregates
    COUNT(o.id) AS observations,
    MIN(o.time) AS first_seen,
    MAX(o.time) AS last_seen,
    MAX(o.time) AS observed_at,
    MAX(o.accuracy) AS accuracy_meters,
    -- Altitude stats (filter -500 to 10000m to reject GPS garbage)
    AVG(CASE WHEN o.altitude BETWEEN -500 AND 10000 THEN o.altitude END) AS altitude_m,
    MIN(CASE WHEN o.altitude BETWEEN -500 AND 10000 THEN o.altitude END) AS min_altitude_m,
    MAX(CASE WHEN o.altitude BETWEEN -500 AND 10000 THEN o.altitude END) AS max_altitude_m,
    NULL::double precision AS altitude_accuracy_m,
    COALESCE(
        MAX(CASE WHEN o.altitude BETWEEN -500 AND 10000 THEN o.altitude END) -
        MIN(CASE WHEN o.altitude BETWEEN -500 AND 10000 THEN o.altitude END),
        0
    ) AS altitude_span_m,
    0::double precision AS max_distance_meters,
    -- Correlated subqueries for most-recent values
    (SELECT altitude FROM app.observations WHERE bssid = n.bssid AND altitude BETWEEN -500 AND 10000 ORDER BY time DESC LIMIT 1) AS last_altitude_m,
    (SELECT accuracy FROM app.observations WHERE bssid = n.bssid ORDER BY time DESC LIMIT 1) AS last_accuracy_m,
    -- Other aggregates
    NULL::integer AS channel,
    NULL::text AS wps,
    NULL::text AS battery,
    NULL::text AS auth,
    COUNT(DISTINCT DATE(o.time)) AS unique_days,
    COUNT(DISTINCT (ROUND(o.lat::numeric, 3) || ',' || ROUND(o.lon::numeric, 3))) AS unique_locations,
    false AS is_sentinel,
    LEFT(REPLACE(n.bssid, ':', ''), 6) AS oui,
    NULL::text[] AS insecure_flags,
    NULL::text[] AS security_flags,
    COUNT(DISTINCT o.source_tag) AS unique_source_count,
    AVG(o.level) AS avg_signal,
    MIN(o.level) AS min_signal,
    MAX(o.level) AS max_signal
FROM app.networks n
LEFT JOIN app.observations o ON o.bssid = n.bssid
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.capabilities, n.service,
         n.rcois, n.mfgrid, n.lasttime_ms, n.lastlat, n.lastlon,
         n.bestlevel, n.bestlat, n.bestlon;

-- Grant read access
GRANT SELECT ON app.network_entries TO shadowcheck_user;
GRANT SELECT ON app.network_entries TO shadowcheck_admin;
