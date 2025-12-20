-- ============================================================================
-- PHASE 2: API → DATABASE DEPENDENCY TRACE
-- ShadowCheck Database Forensic Analysis
-- Generated: 2025-12-20
-- ============================================================================
--
-- Purpose: Identify EXACTLY what database objects are used by live APIs
--
-- Method: Cross-reference code analysis with PostgreSQL system catalogs
--
-- IMPORTANT: This is a READ-ONLY analysis - no modifications
--
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo 'PHASE 2: API → DATABASE DEPENDENCY TRACE'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- 1. PRIMARY API ENDPOINT: /api/explorer/networks-v2
-- ============================================================================
\echo '1. PRIMARY ENDPOINT: /api/explorer/networks-v2'
\echo '   Route: src/api/routes/v1/explorer.js (line 293)'
\echo '   Query: SELECT * FROM public.api_network_explorer'
\echo ''

-- Trace dependencies of api_network_explorer view
\echo 'Dependencies of public.api_network_explorer:'
SELECT
  'public.api_network_explorer' AS source_object,
  'VIEW' AS source_type,
  dependent_ns.nspname || '.' || dependent_view.relname AS depends_on,
  CASE dependent_view.relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
    WHEN 'f' THEN 'FOREIGN TABLE'
  END AS object_type
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class AS source_view ON pg_depend.refobjid = source_view.oid
JOIN pg_namespace dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
JOIN pg_namespace source_ns ON source_view.relnamespace = source_ns.oid
WHERE source_ns.nspname = 'public'
  AND source_view.relname = 'api_network_explorer'
  AND source_view.relkind = 'v'
ORDER BY depends_on;

\echo ''

-- ============================================================================
-- 2. VIEW DEFINITION ANALYSIS
-- ============================================================================
\echo '2. VIEW DEFINITION: public.api_network_explorer'
SELECT pg_get_viewdef('public.api_network_explorer', true) AS view_definition;

\echo ''

-- ============================================================================
-- 3. ALL TABLES REFERENCED BY api_network_explorer
-- ============================================================================
\echo '3. TABLES used by api_network_explorer (direct + CTE):'
-- This captures tables mentioned in the view definition
WITH RECURSIVE view_deps AS (
  SELECT
    'public.api_network_explorer'::text AS view_name,
    d.refobjid AS dep_oid,
    c.relname,
    n.nspname,
    c.relkind
  FROM pg_class v
  JOIN pg_namespace vn ON v.relnamespace = vn.oid
  JOIN pg_depend d ON d.objid = v.oid
  JOIN pg_class c ON c.oid = d.refobjid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE vn.nspname = 'public'
    AND v.relname = 'api_network_explorer'
    AND v.relkind = 'v'
    AND c.relkind IN ('r', 'v', 'm')  -- tables, views, mat views
)
SELECT
  nspname || '.' || relname AS table_name,
  CASE relkind
    WHEN 'r' THEN 'TABLE'
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END AS object_type
FROM view_deps
ORDER BY nspname, relname;

\echo ''

-- ============================================================================
-- 4. FUNCTIONS CALLED BY api_network_explorer
-- ============================================================================
\echo '4. FUNCTIONS used by api_network_explorer:'
SELECT DISTINCT
  n.nspname || '.' || p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_depend d ON d.refobjid = p.oid
WHERE d.objid = 'public.api_network_explorer'::regclass::oid
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY function_name;

\echo ''

-- ============================================================================
-- 5. OTHER ACTIVE API ENDPOINTS (code analysis results)
-- ============================================================================
\echo '5. OTHER ACTIVE ENDPOINTS (from code analysis):'
\echo '   /api/networks/observations/:bssid'
\echo '     → SELECT FROM public.observations WHERE bssid = $1'
\echo ''
\echo '   /api/explorer/timeline/:bssid'
\echo '     → SELECT FROM mv_network_timeline WHERE bssid = $1'
\echo ''
\echo '   /api/explorer/heatmap'
\echo '     → SELECT FROM mv_heatmap_tiles'
\echo ''
\echo '   /api/explorer/routes'
\echo '     → SELECT FROM mv_device_routes'
\echo ''
\echo '   /api/threats/*'
\echo '     → SELECT FROM app.observations, app.networks, app.network_tags'
\echo '     → SELECT FROM app.location_markers (home location)'
\echo ''
\echo '   /api/networks/*'
\echo '     → SELECT FROM app.networks, app.observations'
\echo ''

-- ============================================================================
-- 6. COMPLETE LIST OF ACTIVELY USED OBJECTS
-- ============================================================================
\echo '6. ACTIVELY USED DATABASE OBJECTS:'
\echo ''
\echo 'VIEWS:'
SELECT
  schemaname || '.' || viewname AS view_name,
  'ACTIVE' AS status
FROM pg_views
WHERE schemaname IN ('public', 'app')
  AND viewname IN ('api_network_explorer')
ORDER BY schemaname, viewname;

\echo ''
\echo 'MATERIALIZED VIEWS:'
SELECT
  schemaname || '.' || matviewname AS matview_name,
  'ACTIVE (via /api/explorer/*)' AS status
FROM pg_matviews
WHERE schemaname IN ('public', 'app')
  AND matviewname IN ('mv_network_timeline', 'mv_heatmap_tiles', 'mv_device_routes', 'mv_network_latest')
ORDER BY schemaname, matviewname;

\echo ''
\echo 'TABLES:'
SELECT
  schemaname || '.' || tablename AS table_name,
  'ACTIVE' AS status
FROM pg_tables
WHERE schemaname IN ('public', 'app')
  AND tablename IN (
    'observations',
    'access_points',
    'networks',
    'network_tags',
    'location_markers',
    'radio_manufacturers',
    'wigle_networks_enriched'
  )
ORDER BY schemaname, tablename;

\echo ''
\echo '============================================================================'
\echo 'DEPENDENCY GRAPH SUMMARY'
\echo '============================================================================'
\echo ''
\echo 'API Endpoint: GET /api/explorer/networks-v2'
\echo '  └─> VIEW: public.api_network_explorer'
\echo '       ├─> TABLE: public.observations'
\echo '       ├─> TABLE: public.access_points'
\echo '       └─> TABLE: app.radio_manufacturers'
\echo ''
\echo 'API Endpoint: GET /api/networks/observations/:bssid'
\echo '  └─> TABLE: public.observations'
\echo ''
\echo 'API Endpoint: GET /api/explorer/timeline/:bssid'
\echo '  └─> MATERIALIZED VIEW: mv_network_timeline'
\echo '       └─> TABLE: public.observations'
\echo ''
\echo 'API Endpoint: GET /api/explorer/heatmap'
\echo '  └─> MATERIALIZED VIEW: mv_heatmap_tiles'
\echo '       └─> TABLE: public.observations'
\echo ''
\echo 'API Endpoint: GET /api/explorer/routes'
\echo '  └─> MATERIALIZED VIEW: mv_device_routes'
\echo '       └─> TABLE: public.observations'
\echo ''
\echo 'API Endpoint: GET /api/threats/*'
\echo '  └─> TABLE: app.observations'
\echo '  └─> TABLE: app.networks'
\echo '  └─> TABLE: app.network_tags'
\echo '  └─> TABLE: app.location_markers'
\echo ''
\echo '============================================================================'
\echo 'END PHASE 2'
\echo '============================================================================'
