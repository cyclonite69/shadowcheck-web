-- ============================================================================
-- PHASE 3: DATABASE USAGE AUDIT
-- ShadowCheck Database Forensic Analysis
-- Generated: 2025-12-20
-- ============================================================================
--
-- Purpose: Identify database objects that have NEVER been accessed
--
-- Method: Query PostgreSQL statistics catalogs (pg_stat_*)
--
-- IMPORTANT: This is a READ-ONLY analysis - no modifications
--
-- NOTE: Statistics reset on database restart. For production accuracy,
--       run this query on a database with at least 7 days of uptime.
--
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo 'PHASE 3: DATABASE USAGE AUDIT'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- 1. TABLES WITH ZERO SCANS (never queried)
-- ============================================================================
\echo '1. TABLES NEVER SCANNED (seq_scan = 0 AND idx_scan = 0):'
\echo ''

SELECT
  schemaname,
  relname AS tablename,
  schemaname || '.' || relname AS full_name,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS size,
  n_live_tup AS row_count,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'app')
  AND seq_scan = 0
  AND COALESCE(idx_scan, 0) = 0
ORDER BY pg_total_relation_size(schemaname || '.' || relname) DESC;

\echo ''

-- ============================================================================
-- 2. TABLES WITH VERY LOW USAGE (scanned < 10 times total)
-- ============================================================================
\echo '2. TABLES WITH VERY LOW USAGE (< 10 total scans):'
\echo ''

SELECT
  schemaname,
  relname AS tablename,
  schemaname || '.' || relname AS full_name,
  seq_scan,
  COALESCE(idx_scan, 0) AS idx_scan,
  seq_scan + COALESCE(idx_scan, 0) AS total_scans,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS size,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'app')
  AND (seq_scan + COALESCE(idx_scan, 0)) < 10
  AND (seq_scan + COALESCE(idx_scan, 0)) > 0
ORDER BY (seq_scan + COALESCE(idx_scan, 0)) ASC,
         pg_total_relation_size(schemaname || '.' || relname) DESC;

\echo ''

-- ============================================================================
-- 3. INDEXES NEVER USED (idx_scan = 0)
-- ============================================================================
\echo '3. INDEXES NEVER USED:'
\echo ''

SELECT
  schemaname,
  relname AS tablename,
  indexrelname AS indexname,
  schemaname || '.' || indexrelname AS full_name,
  pg_size_pretty(pg_relation_size(schemaname || '.' || indexrelname)) AS size,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'app')
  AND idx_scan = 0
  -- Exclude primary key and unique constraints (may be used for integrity only)
  AND indexrelname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(schemaname || '.' || indexrelname) DESC;

\echo ''

-- ============================================================================
-- 4. VIEWS (check if backing tables are used)
-- ============================================================================
\echo '4. ALL VIEWS IN public/app SCHEMAS:'
\echo '   (Note: pg_stat_user_tables does not track view access,'
\echo '    so we check if the view definition references active tables)'
\echo ''

SELECT
  schemaname,
  viewname,
  schemaname || '.' || viewname AS full_name,
  definition
FROM pg_views
WHERE schemaname IN ('public', 'app')
ORDER BY schemaname, viewname;

\echo ''

-- ============================================================================
-- 5. MATERIALIZED VIEWS (check last refresh)
-- ============================================================================
\echo '5. MATERIALIZED VIEWS (usage stats):'
\echo ''

SELECT
  st.schemaname,
  st.relname AS matviewname,
  st.schemaname || '.' || st.relname AS full_name,
  st.seq_scan,
  st.idx_scan,
  st.n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(st.schemaname || '.' || st.relname)) AS size,
  st.last_vacuum,
  st.last_autovacuum
FROM pg_stat_user_tables st
JOIN pg_class c ON c.relname = st.relname AND c.relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = st.schemaname
)
WHERE st.schemaname IN ('public', 'app')
  AND c.relkind = 'm'  -- materialized view
ORDER BY st.schemaname, st.relname;

\echo ''

-- ============================================================================
-- 6. FUNCTIONS NEVER CALLED (calls = 0)
-- ============================================================================
\echo '6. FUNCTIONS NEVER CALLED:'
\echo ''

SELECT
  schemaname,
  funcname,
  schemaname || '.' || funcname AS full_name,
  calls,
  total_time,
  self_time
FROM pg_stat_user_functions
WHERE schemaname IN ('public', 'app')
  AND calls = 0
ORDER BY schemaname, funcname;

\echo ''

-- ============================================================================
-- 7. ALL FUNCTIONS (including usage stats)
-- ============================================================================
\echo '7. ALL FUNCTIONS (with call counts):'
\echo ''

SELECT
  schemaname,
  funcname,
  schemaname || '.' || funcname AS full_name,
  calls,
  ROUND(total_time::numeric, 2) AS total_time_ms,
  ROUND(self_time::numeric, 2) AS self_time_ms
FROM pg_stat_user_functions
WHERE schemaname IN ('public', 'app')
ORDER BY calls DESC, total_time DESC;

\echo ''

-- ============================================================================
-- 8. SEQUENCES (check if used)
-- ============================================================================
\echo '8. SEQUENCES (all in public/app):'
\echo ''

SELECT
  schemaname,
  sequencename,
  schemaname || '.' || sequencename AS full_name,
  last_value,
  start_value,
  increment_by,
  max_value,
  min_value,
  cache_size,
  cycle,
  is_called
FROM pg_sequences
WHERE schemaname IN ('public', 'app')
ORDER BY schemaname, sequencename;

\echo ''

-- ============================================================================
-- 9. TABLES WITH DATA BUT NO RECENT MODIFICATIONS
-- ============================================================================
\echo '9. TABLES WITH DATA BUT NO WRITES (n_tup_ins = 0, n_tup_upd = 0, n_tup_del = 0):'
\echo ''

SELECT
  schemaname,
  relname AS tablename,
  schemaname || '.' || relname AS full_name,
  n_live_tup AS row_count,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  seq_scan,
  COALESCE(idx_scan, 0) AS idx_scan,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || relname)) AS size
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'app')
  AND n_live_tup > 0
  AND n_tup_ins = 0
  AND n_tup_upd = 0
  AND n_tup_del = 0
ORDER BY n_live_tup DESC;

\echo ''

-- ============================================================================
-- 10. SUMMARY STATISTICS
-- ============================================================================
\echo '10. SUMMARY STATISTICS:'
\echo ''

-- Count of objects by type
SELECT
  'TABLES' AS object_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE seq_scan = 0 AND COALESCE(idx_scan, 0) = 0) AS never_scanned,
  COUNT(*) FILTER (WHERE seq_scan + COALESCE(idx_scan, 0) < 10 AND seq_scan + COALESCE(idx_scan, 0) > 0) AS low_usage
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'app')

UNION ALL

SELECT
  'INDEXES' AS object_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE idx_scan = 0) AS never_scanned,
  COUNT(*) FILTER (WHERE idx_scan < 10 AND idx_scan > 0) AS low_usage
FROM pg_stat_user_indexes
WHERE schemaname IN ('public', 'app')
  AND indexrelname NOT LIKE '%_pkey'

UNION ALL

SELECT
  'VIEWS' AS object_type,
  COUNT(*) AS total_count,
  0 AS never_scanned,  -- Cannot track view access
  0 AS low_usage
FROM pg_views
WHERE schemaname IN ('public', 'app')

UNION ALL

SELECT
  'MATERIALIZED VIEWS' AS object_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE st.seq_scan = 0 AND COALESCE(st.idx_scan, 0) = 0) AS never_scanned,
  COUNT(*) FILTER (WHERE st.seq_scan + COALESCE(st.idx_scan, 0) < 10 AND st.seq_scan + COALESCE(st.idx_scan, 0) > 0) AS low_usage
FROM pg_stat_user_tables st
JOIN pg_class c ON c.relname = st.relname AND c.relnamespace = (
  SELECT oid FROM pg_namespace WHERE nspname = st.schemaname
)
WHERE st.schemaname IN ('public', 'app')
  AND c.relkind = 'm'

UNION ALL

SELECT
  'FUNCTIONS' AS object_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE calls = 0) AS never_scanned,
  COUNT(*) FILTER (WHERE calls < 10 AND calls > 0) AS low_usage
FROM pg_stat_user_functions
WHERE schemaname IN ('public', 'app')

ORDER BY object_type;

\echo ''

-- ============================================================================
-- 11. DISK SPACE USAGE BY SCHEMA
-- ============================================================================
\echo '11. DISK SPACE USAGE BY SCHEMA:'
\echo ''

SELECT
  schemaname,
  SUM(pg_total_relation_size(schemaname || '.' || tablename)) AS total_bytes,
  pg_size_pretty(SUM(pg_total_relation_size(schemaname || '.' || tablename))) AS total_size,
  COUNT(*) AS table_count
FROM pg_tables
WHERE schemaname IN ('public', 'app')
GROUP BY schemaname
ORDER BY total_bytes DESC;

\echo ''

-- ============================================================================
-- 12. LARGEST UNUSED OBJECTS (by size)
-- ============================================================================
\echo '12. LARGEST OBJECTS WITH ZERO USAGE:'
\echo ''

WITH unused_objects AS (
  -- Unused tables
  SELECT
    'TABLE' AS object_type,
    schemaname,
    relname AS object_name,
    schemaname || '.' || relname AS full_name,
    pg_total_relation_size(schemaname || '.' || relname) AS size_bytes,
    'seq_scan=0, idx_scan=0' AS reason
  FROM pg_stat_user_tables
  WHERE schemaname IN ('public', 'app')
    AND seq_scan = 0
    AND COALESCE(idx_scan, 0) = 0

  UNION ALL

  -- Unused indexes
  SELECT
    'INDEX' AS object_type,
    schemaname,
    indexrelname AS object_name,
    schemaname || '.' || indexrelname AS full_name,
    pg_relation_size(schemaname || '.' || indexrelname) AS size_bytes,
    'idx_scan=0' AS reason
  FROM pg_stat_user_indexes
  WHERE schemaname IN ('public', 'app')
    AND idx_scan = 0
    AND indexrelname NOT LIKE '%_pkey'
)
SELECT
  object_type,
  schemaname,
  object_name,
  full_name,
  pg_size_pretty(size_bytes) AS size,
  reason
FROM unused_objects
WHERE size_bytes > 0
ORDER BY size_bytes DESC
LIMIT 20;

\echo ''
\echo '============================================================================'
\echo 'END PHASE 3: DATABASE USAGE AUDIT'
\echo '============================================================================'
\echo ''
\echo 'IMPORTANT NOTES:'
\echo '  - Statistics are reset on database restart'
\echo '  - View access is not tracked (only underlying table access)'
\echo '  - Zero usage may indicate:'
\echo '    1. Legacy/unused object (safe to drop)'
\echo '    2. Recently created object (not yet used)'
\echo '    3. Database recently restarted (statistics cleared)'
\echo ''
\echo 'NEXT STEP: Cross-reference with Phase 2 dependency analysis'
\echo '============================================================================'
