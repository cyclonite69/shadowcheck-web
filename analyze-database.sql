-- Database Analysis Script for ShadowCheck
-- Analyzing all tables, views, materialized views and their columns

\echo '═══════════════════════════════════════════════════════'
\echo 'DATABASE STRUCTURE ANALYSIS'
\echo '═══════════════════════════════════════════════════════'
\echo ''

\echo '--- ALL TABLES ---'
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'tiger', 'topology')
ORDER BY schemaname, tablename;

\echo ''
\echo '--- ALL VIEWS ---'
SELECT schemaname, viewname
FROM pg_views
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'tiger', 'topology')
ORDER BY schemaname, viewname;

\echo ''
\echo '--- ALL MATERIALIZED VIEWS ---'
SELECT
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) AS size
FROM pg_matviews
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'tiger', 'topology')
ORDER BY schemaname, matviewname;

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'MATERIALIZED VIEW: mv_network_latest'
\echo '═══════════════════════════════════════════════════════'
\d+ public.mv_network_latest

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'MATERIALIZED VIEW: mv_network_timeline'
\echo '═══════════════════════════════════════════════════════'
\d+ public.mv_network_timeline

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'MATERIALIZED VIEW: mv_heatmap_tiles'
\echo '═══════════════════════════════════════════════════════'
\d+ public.mv_heatmap_tiles

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'MATERIALIZED VIEW: mv_device_routes'
\echo '═══════════════════════════════════════════════════════'
\d+ public.mv_device_routes

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'SAMPLE DATA FROM mv_network_latest (5 rows)'
\echo '═══════════════════════════════════════════════════════'
SELECT * FROM public.mv_network_latest LIMIT 5;

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo 'CURRENT KEPLER ENDPOINT QUERY'
\echo '═══════════════════════════════════════════════════════'
