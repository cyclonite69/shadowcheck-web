#!/bin/bash
set -euo pipefail
# Apply the two new migrations manually
# Run on AWS instance: bash apply-new-migrations.sh

echo "Applying new migrations..."

docker exec shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db <<'EOF'
-- Drop uppercase SSID triggers
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_networks ON app.networks;
DROP TRIGGER IF EXISTS trigger_uppercase_ssid ON public.access_points;
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_observations ON public.observations;
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_history ON public.ssid_history;
DROP FUNCTION IF EXISTS app.uppercase_ssid_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.uppercase_ssid_trigger() CASCADE;

-- Track this migration
INSERT INTO app.schema_migrations (filename) VALUES ('20260214_drop_uppercase_ssid_triggers.sql')
ON CONFLICT (filename) DO NOTHING;

-- Recreate network_entries view (already done in previous migration, but ensure it's correct)
DROP MATERIALIZED VIEW IF EXISTS app.network_entries CASCADE;
DROP VIEW IF EXISTS app.network_entries CASCADE;

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
    COALESCE(MIN(o.time), to_timestamp(n.lasttime_ms / 1000.0)) AS first_seen,
    to_timestamp(n.lasttime_ms / 1000.0) AS observed_at,
    COUNT(o.id) AS observations,
    MAX(o.accuracy) AS accuracy_meters,
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
    COUNT(DISTINCT DATE(o.time)) AS unique_days,
    COUNT(DISTINCT (ROUND(o.lat::numeric, 3) || ',' || ROUND(o.lon::numeric, 3))) AS unique_locations,
    false AS is_sentinel,
    LEFT(REPLACE(n.bssid, ':', ''), 6) AS oui,
    NULL::text[] AS insecure_flags,
    NULL::text[] AS security_flags,
    COUNT(DISTINCT o.source_type) AS unique_source_count,
    AVG(o.level) AS avg_signal,
    MIN(o.level) AS min_signal,
    MAX(o.level) AS max_signal
FROM app.networks n
LEFT JOIN app.observations o ON o.bssid = n.bssid
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.capabilities, n.bestlevel, n.bestlat, n.bestlon, n.lasttime_ms;

GRANT SELECT ON app.network_entries TO shadowcheck_user;
GRANT SELECT ON app.network_entries TO shadowcheck_admin;

SELECT 'network_entries view created' AS status;
EOF

echo "Done! Migrations applied."
