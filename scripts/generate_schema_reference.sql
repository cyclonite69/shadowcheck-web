-- Generate Complete Schema Reference
-- Usage: psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f scripts/generate_schema_reference.sql > docs/SCHEMA_REFERENCE.txt

\pset pager off

\echo === ShadowCheck Database Schema Reference ===
\echo
\echo Generated: 
SELECT NOW();
\echo

\echo === Tables in app schema ===
\echo

SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('app.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'app'
ORDER BY tablename;

\echo
\echo === Table Structures ===
\echo

\d app.observations
\echo
\d app.networks
\echo
\d app.network_threat_scores
\echo
\d app.network_tags
\echo
\d app.wigle_v3_observations
\echo
\d app.radio_manufacturers
\echo
\d app.location_markers
\echo
\d app.api_network_explorer_mv
\echo

\echo === Complete ===
