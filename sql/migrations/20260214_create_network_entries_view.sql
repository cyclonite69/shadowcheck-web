-- Create network_entries view
-- Maps app.networks columns to the names expected by the API
-- Required by /api/networks endpoint
--
-- Run as: docker exec -i shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db < this_file.sql

-- Drop if exists (idempotent)
DROP MATERIALIZED VIEW IF EXISTS app.network_entries CASCADE;
DROP VIEW IF EXISTS app.network_entries CASCADE;

-- Simple view mapping networks columns to API-expected names
-- Observation aggregates come from a pre-computed stats table or are approximated
CREATE OR REPLACE VIEW app.network_entries AS
SELECT
    n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.capabilities AS security,
    n.bestlevel AS signal,
    n.bestlat AS lat,
    n.bestlon AS lon,
    to_timestamp(n.lasttime_ms / 1000.0) AS last_seen,
    to_timestamp(n.lasttime_ms / 1000.0) AS first_seen,
    to_timestamp(n.lasttime_ms / 1000.0) AS observed_at,
    1 AS observations,
    0::double precision AS accuracy_meters,
    NULL::integer AS channel,
    NULL::text AS wps,
    NULL::text AS battery,
    NULL::text AS auth,
    0::double precision AS altitude_m,
    0::double precision AS min_altitude_m,
    0::double precision AS max_altitude_m,
    0::double precision AS altitude_accuracy_m,
    0::double precision AS altitude_span_m,
    0::double precision AS max_distance_meters,
    0::double precision AS last_altitude_m,
    1 AS unique_days,
    1 AS unique_locations,
    false AS is_sentinel,
    LEFT(REPLACE(n.bssid, ':', ''), 6) AS oui,
    NULL::text[] AS insecure_flags,
    NULL::text[] AS security_flags
FROM app.networks n;

-- Grant read access
GRANT SELECT ON app.network_entries TO shadowcheck_user;
GRANT SELECT ON app.network_entries TO shadowcheck_admin;
