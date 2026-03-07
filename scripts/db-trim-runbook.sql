-- ============================================================================
-- ShadowCheck DB Trim Runbook (Review-First)
-- ============================================================================
-- Purpose:
--   Provide one operational script for pre-checks, phased cleanup SQL, and
--   post-check validation. This script is SAFE by default:
--   - It performs read-only checks automatically
--   - Potentially destructive statements are included but commented out
--
-- Usage:
--   psql -U shadowcheck_admin -d shadowcheck_db -f scripts/db-trim-runbook.sql
--
-- Operator Flow:
--   1) Run this script and review outputs
--   2) Execute Phase 1 DROP statements manually (safe set)
--   3) Re-run post-check section
--   4) Only then proceed to investigate/high-risk phases
-- ============================================================================

\pset pager off
\timing on

\echo ''
\echo '======================================================================='
\echo '0) BASELINE SNAPSHOT (READ-ONLY)'
\echo '======================================================================='

SELECT NOW() AS snapshot_time_utc;

SELECT
  pg_size_pretty(pg_database_size(current_database())) AS database_size,
  current_database() AS database_name;

SELECT
  schemaname,
  relname AS object_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'i' THEN 'index'
    WHEN 'm' THEN 'matview'
    WHEN 'v' THEN 'view'
    ELSE c.relkind::text
  END AS object_type,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_stat_user_tables st ON st.relid = c.oid
WHERE n.nspname = 'app'
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 20;

\echo ''
\echo '======================================================================='
\echo '1) TARGET OBJECT INVENTORY + USAGE'
\echo '======================================================================='

\echo '1A) Candidate materialized views'
SELECT
  st.schemaname,
  st.relname AS matview_name,
  st.seq_scan,
  COALESCE(st.idx_scan, 0) AS idx_scan,
  st.n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(st.relid)) AS total_size
FROM pg_stat_user_tables st
JOIN pg_class c ON c.oid = st.relid
WHERE st.schemaname = 'app'
  AND c.relkind = 'm'
  AND st.relname IN (
    'mv_network_timeline',
    'agency_offices_summary',
    'analytics_summary_mv',
    'api_network_latest_mv'
  )
ORDER BY st.relname;

\echo '1B) Candidate indexes'
SELECT
  i.schemaname,
  i.relname AS table_name,
  i.indexrelname AS index_name,
  i.idx_scan,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size
FROM pg_stat_user_indexes i
WHERE i.schemaname = 'app'
  AND (
    i.indexrelname IN (
      'obs_bssid_time_asc_idx',
      'obs_bssid_time_desc_idx',
      'idx_obs_geom_gist',
      'idx_observations_geom_gist',
      'obs_geom_gix',
      'idx_observations_v2_geom'
    )
    OR i.indexrelname LIKE 'obs\_%\_geom%' ESCAPE '\'
  )
ORDER BY pg_relation_size(i.indexrelid) DESC;

\echo '1C) Constraints tied to observations natural uniqueness'
SELECT
  conname,
  conrelid::regclass AS table_name,
  contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('observations_v2_natural_uniq', 'observations_natural_uniq')
ORDER BY conname;

\echo ''
\echo '======================================================================='
\echo '2) DEPENDENCY CHECKS (READ-ONLY)'
\echo '======================================================================='

\echo '2A) What depends on target materialized views'
WITH targets AS (
  SELECT c.oid, n.nspname, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'app'
    AND c.relname IN (
      'mv_network_timeline',
      'agency_offices_summary',
      'analytics_summary_mv',
      'api_network_latest_mv'
    )
)
SELECT
  t.nspname || '.' || t.relname AS target_object,
  d.classid::regclass AS dep_catalog,
  d.objid,
  d.refclassid::regclass AS ref_catalog,
  d.deptype
FROM pg_depend d
JOIN targets t ON t.oid = d.refobjid
ORDER BY target_object, dep_catalog::text, d.objid;

\echo '2B) Check if target objects exist in schema catalogs'
SELECT n.nspname, c.relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'app'
  AND c.relname IN (
    'mv_network_timeline',
    'agency_offices_summary',
    'analytics_summary_mv',
    'api_network_latest_mv'
  )
ORDER BY c.relname;

\echo ''
\echo '======================================================================='
\echo '3) PHASE 1 (SAFE SET) DROP STATEMENTS'
\echo '======================================================================='
\echo 'Review outputs above first, then run these manually if approved.'
\echo ''
\echo '-- SAFE CANDIDATE INDEX DROPS'
\echo 'DROP INDEX IF EXISTS app.obs_bssid_time_asc_idx;'
\echo 'DROP INDEX IF EXISTS app.obs_bssid_time_desc_idx;'
\echo ''
\echo '-- SAFE CANDIDATE MATERIALIZED VIEW DROPS (CURRENT CODE SCAN BASIS)'
\echo 'DROP MATERIALIZED VIEW IF EXISTS app.api_network_latest_mv;'
\echo 'DROP MATERIALIZED VIEW IF EXISTS app.agency_offices_summary;'
\echo 'DROP MATERIALIZED VIEW IF EXISTS app.mv_network_timeline;'

-- Uncomment manually ONLY when approved:
-- DROP INDEX IF EXISTS app.obs_bssid_time_asc_idx;
-- DROP INDEX IF EXISTS app.obs_bssid_time_desc_idx;
-- DROP MATERIALIZED VIEW IF EXISTS app.api_network_latest_mv;
-- DROP MATERIALIZED VIEW IF EXISTS app.agency_offices_summary;
-- DROP MATERIALIZED VIEW IF EXISTS app.mv_network_timeline;

\echo ''
\echo '======================================================================='
\echo '4) PHASE 2 (INVESTIGATE FIRST) - DO NOT DROP BLIND'
\echo '======================================================================='

\echo '4A) Geospatial index usage inspection'
SELECT
  i.indexrelname AS index_name,
  i.idx_scan,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size
FROM pg_stat_user_indexes i
WHERE i.schemaname = 'app'
  AND i.indexrelname IN (
    'idx_obs_geom_gist',
    'idx_observations_geom_gist',
    'obs_geom_gix',
    'idx_observations_v2_geom'
  )
ORDER BY i.indexrelname;

\echo ''
\echo '4B) EXPLAIN stubs to run manually (copy/paste one at a time):'
\echo 'EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM app.observations o'
\echo ' WHERE o.geom IS NOT NULL'
\echo '   AND ST_DWithin(o.geom::geography, ST_SetSRID(ST_MakePoint(-83.696, 43.023), 4326)::geography, 1000)'
\echo ' ORDER BY o.time DESC LIMIT 500;'
\echo ''
\echo 'EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM app.observations o'
\echo ' WHERE o.bssid = ''AA:BB:CC:DD:EE:FF'''
\echo ' ORDER BY o.time DESC LIMIT 500;'

\echo ''
\echo '4C) Analytics MV reference warning'
\echo 'analytics_summary_mv has code references and should be removed only after code cleanup.'

-- Investigate-only placeholders (commented):
-- DROP INDEX IF EXISTS app.idx_obs_geom_gist;
-- DROP INDEX IF EXISTS app.idx_observations_geom_gist;
-- DROP INDEX IF EXISTS app.obs_geom_gix;
-- DROP INDEX IF EXISTS app.idx_observations_v2_geom;
-- DROP MATERIALIZED VIEW IF EXISTS app.analytics_summary_mv;

\echo ''
\echo '======================================================================='
\echo '5) PHASE 3 (LEGACY / HIGH-RISK) - APPROVAL REQUIRED'
\echo '======================================================================='

\echo '5A) Legacy table usage checks'
SELECT
  schemaname,
  relname,
  seq_scan,
  COALESCE(idx_scan, 0) AS idx_scan,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE schemaname = 'app'
  AND relname IN ('observations_legacy', 'access_points_legacy')
ORDER BY relname;

\echo '5B) Constraint safety checks'
SELECT
  conname,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('observations_v2_natural_uniq', 'observations_natural_uniq')
ORDER BY conname;

-- High-risk placeholders (commented):
-- ALTER TABLE app.observations DROP CONSTRAINT observations_v2_natural_uniq; -- NOT RECOMMENDED
-- ALTER TABLE app.observations_legacy DROP CONSTRAINT observations_natural_uniq;
-- DROP TABLE IF EXISTS app.observations_legacy CASCADE;
-- DROP TABLE IF EXISTS app.access_points_legacy CASCADE;

\echo ''
\echo '======================================================================='
\echo '6) POST-CHECKS (RUN AFTER EACH PHASE)'
\echo '======================================================================='

SELECT
  pg_size_pretty(pg_database_size(current_database())) AS database_size_after,
  current_database() AS database_name;

SELECT
  i.schemaname,
  i.relname AS table_name,
  i.indexrelname AS index_name,
  i.idx_scan,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size
FROM pg_stat_user_indexes i
WHERE i.schemaname = 'app'
  AND i.indexrelname IN (
    'obs_bssid_time_asc_idx',
    'obs_bssid_time_desc_idx',
    'idx_obs_geom_gist',
    'idx_observations_geom_gist',
    'obs_geom_gix',
    'idx_observations_v2_geom'
  )
ORDER BY i.indexrelname;

SELECT
  n.nspname,
  c.relname,
  c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'app'
  AND c.relname IN (
    'mv_network_timeline',
    'agency_offices_summary',
    'analytics_summary_mv',
    'api_network_latest_mv'
  )
ORDER BY c.relname;

\echo ''
\echo 'Runbook complete. No DROP executed unless you manually uncommented statements.'
\echo ''
