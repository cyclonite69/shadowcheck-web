-- ============================================================================
-- PHASE 5: DATABASE CLEANUP - DROP SCRIPT
-- ShadowCheck Database Forensic Cleanup
-- Generated: 2025-12-20
-- ============================================================================
--
-- ⚠️  CRITICAL WARNINGS ⚠️
--
-- 1. This script is for REVIEW ONLY - DO NOT EXECUTE without explicit approval
-- 2. BACKUP MUST BE COMPLETED before running this script (see db-backup-commands.sh)
-- 3. Review Phase 4 classification (db-object-classification.md) before proceeding
-- 4. Test in non-production environment first
-- 5. This script is wrapped in a transaction - can ROLLBACK if issues arise
--
-- ============================================================================
--
-- ESTIMATED SPACE RECLAMATION:
--   Priority 1 (Safe to drop): ~196 MB (indexes only)
--   Priority 2 (After investigation): ~200+ MB (legacy tables + indexes)
--   TOTAL POTENTIAL: ~400 MB
--
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo 'PHASE 5: DATABASE CLEANUP - DROP SCRIPT'
\echo '============================================================================'
\echo ''
\echo 'WARNING: This script will DROP database objects.'
\echo 'Backup must be completed before proceeding.'
\echo ''
\echo 'Press Ctrl+C to abort, or wait 10 seconds to continue...'
\echo ''

-- Uncomment to add delay (requires psql)
-- \! sleep 10

-- ============================================================================
-- TRANSACTION START
-- ============================================================================
BEGIN;

\echo ''
\echo '============================================================================'
\echo 'TRANSACTION STARTED - All changes can be rolled back with ROLLBACK;'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- PRIORITY 1: SAFE TO DROP (High Impact, Zero Risk)
-- Estimated space reclaimed: ~196 MB
-- ============================================================================

\echo ''
\echo '------------------------------------------------------------'
\echo 'PRIORITY 1: SAFE TO DROP - Legacy Table Indexes'
\echo '------------------------------------------------------------'
\echo ''

-- ----------------------------------------------------------------------------
-- 1.1 VERIFY observations_legacy IS UNUSED
-- ----------------------------------------------------------------------------
\echo '1.1 Verifying observations_legacy table usage...'

DO $$
DECLARE
  v_seq_scan bigint;
  v_idx_scan bigint;
  v_n_tup_ins bigint;
  v_n_tup_upd bigint;
  v_n_tup_del bigint;
BEGIN
  -- Check table statistics
  SELECT
    COALESCE(seq_scan, 0),
    COALESCE(idx_scan, 0),
    COALESCE(n_tup_ins, 0),
    COALESCE(n_tup_upd, 0),
    COALESCE(n_tup_del, 0)
  INTO v_seq_scan, v_idx_scan, v_n_tup_ins, v_n_tup_upd, v_n_tup_del
  FROM pg_stat_user_tables
  WHERE schemaname = 'public' AND relname = 'observations_legacy';

  RAISE NOTICE 'observations_legacy stats: seq_scan=%, idx_scan=%, inserts=%, updates=%, deletes=%',
    v_seq_scan, v_idx_scan, v_n_tup_ins, v_n_tup_upd, v_n_tup_del;

  IF v_seq_scan > 0 OR v_idx_scan > 0 OR v_n_tup_ins > 0 OR v_n_tup_upd > 0 OR v_n_tup_del > 0 THEN
    RAISE EXCEPTION 'observations_legacy has activity - ABORTING DROP';
  END IF;

  RAISE NOTICE '✓ observations_legacy is confirmed unused';
END $$;

\echo ''
\echo '1.2 Dropping indexes on observations_legacy...'

-- idx_observations_geom (45 MB)
DROP INDEX IF EXISTS public.idx_observations_geom;
\echo '  ✓ Dropped idx_observations_geom (45 MB)'

-- Rollback command (save for reference):
-- CREATE INDEX idx_observations_geom ON public.observations_legacy USING gist (geom);

-- idx_observations_bssid (20 MB)
DROP INDEX IF EXISTS public.idx_observations_bssid;
\echo '  ✓ Dropped idx_observations_bssid (20 MB)'

-- Rollback: CREATE INDEX idx_observations_bssid ON public.observations_legacy (bssid);

-- idx_observations_time (16 MB)
DROP INDEX IF EXISTS public.idx_observations_time;
\echo '  ✓ Dropped idx_observations_time (16 MB)'

-- Rollback: CREATE INDEX idx_observations_time ON public.observations_legacy (time);

-- idx_observations_time_brin (32 KB)
DROP INDEX IF EXISTS public.idx_observations_time_brin;
\echo '  ✓ Dropped idx_observations_time_brin (32 KB)'

-- Rollback: CREATE INDEX idx_observations_time_brin ON public.observations_legacy USING brin (time);

\echo ''
\echo 'Subtotal reclaimed: ~81 MB (observations_legacy indexes)'
\echo ''

-- ----------------------------------------------------------------------------
-- 1.3 DROP STAGING TABLE INDEXES
-- ----------------------------------------------------------------------------
\echo '1.3 Dropping staging table indexes...'

-- idx_raw_locations_natural_key (115 MB)
DROP INDEX IF EXISTS public.idx_raw_locations_natural_key;
\echo '  ✓ Dropped idx_raw_locations_natural_key (115 MB)'

-- Rollback: CREATE INDEX idx_raw_locations_natural_key ON public.staging_locations_all_raw (device_id, time, bssid);

\echo ''
\echo 'Subtotal reclaimed: ~115 MB (staging indexes)'
\echo ''

\echo '------------------------------------------------------------'
\echo 'PRIORITY 1 COMPLETE: ~196 MB reclaimed'
\echo '------------------------------------------------------------'
\echo ''

-- ============================================================================
-- PRIORITY 2: INVESTIGATE THEN DROP (Requires Validation)
-- Estimated space reclaimed: ~200+ MB
-- ============================================================================

\echo ''
\echo '------------------------------------------------------------'
\echo 'PRIORITY 2: INVESTIGATE THEN DROP'
\echo '------------------------------------------------------------'
\echo ''
\echo 'MANUAL REVIEW REQUIRED - Uncomment sections after validation'
\echo ''

-- ----------------------------------------------------------------------------
-- 2.1 DROP ENTIRE observations_legacy TABLE (Optional)
-- ----------------------------------------------------------------------------
\echo '2.1 observations_legacy table drop (COMMENTED OUT)...'

/*
-- VALIDATION: Check row counts
SELECT
  'observations_legacy' AS table_name,
  COUNT(*) AS row_count,
  pg_size_pretty(pg_total_relation_size('public.observations_legacy')) AS total_size
FROM public.observations_legacy
UNION ALL
SELECT
  'observations (current)' AS table_name,
  COUNT(*) AS row_count,
  pg_size_pretty(pg_total_relation_size('public.observations')) AS total_size
FROM public.observations;

-- If observations table has all data, uncomment below:
-- DROP TABLE IF EXISTS public.observations_legacy CASCADE;
-- \echo '  ✓ Dropped observations_legacy table (~150+ MB)'

-- Rollback: Restore from backup
-- gunzip -c backups/db_forensic_TIMESTAMP/shadowcheck_full_TIMESTAMP.sql.gz | \
--   psql -U shadowcheck_user -d shadowcheck_db
*/

\echo '  (SKIPPED - uncomment to execute)'
\echo ''

-- ----------------------------------------------------------------------------
-- 2.2 DROP access_points_legacy TABLE (Optional)
-- ----------------------------------------------------------------------------
\echo '2.2 access_points_legacy table drop (COMMENTED OUT)...'

/*
-- VALIDATION: Check row counts
SELECT
  'access_points_legacy' AS table_name,
  COUNT(*) AS row_count,
  pg_size_pretty(pg_total_relation_size('public.access_points_legacy')) AS total_size
FROM public.access_points_legacy
UNION ALL
SELECT
  'access_points (current)' AS table_name,
  COUNT(*) AS row_count,
  pg_size_pretty(pg_total_relation_size('public.access_points')) AS total_size
FROM public.access_points;

-- If access_points has all data, uncomment below:
-- DROP TABLE IF EXISTS public.access_points_legacy CASCADE;
-- \echo '  ✓ Dropped access_points_legacy table (~29 MB)'

-- Rollback: Restore from backup
*/

\echo '  (SKIPPED - uncomment to execute)'
\echo ''

-- ----------------------------------------------------------------------------
-- 2.3 DROP DUPLICATE GEOSPATIAL INDEXES (After Query Plan Analysis)
-- ----------------------------------------------------------------------------
\echo '2.3 Duplicate geospatial indexes (COMMENTED OUT)...'

/*
-- VALIDATION: Check which index is used
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.observations
WHERE geom IS NOT NULL
  AND ST_DWithin(
    geom::geography,
    ST_SetSRID(ST_MakePoint(-83.696, 43.023), 4326)::geography,
    1000
  )
LIMIT 100;

-- If idx_obs_geom_gist is used, drop idx_observations_v2_geom:
-- DROP INDEX IF EXISTS public.idx_observations_v2_geom;
-- \echo '  ✓ Dropped idx_observations_v2_geom (22 MB)'

-- If idx_observations_v2_geom is used, drop idx_obs_geom_gist:
-- DROP INDEX IF EXISTS public.idx_obs_geom_gist;
-- \echo '  ✓ Dropped idx_obs_geom_gist (22 MB)'

-- Rollback:
-- CREATE INDEX idx_observations_v2_geom ON public.observations USING gist (geom);
-- CREATE INDEX idx_obs_geom_gist ON public.observations USING gist (geom);
*/

\echo '  (SKIPPED - query plan analysis required)'
\echo ''

-- ----------------------------------------------------------------------------
-- 2.4 DROP UNUSED MATERIALIZED VIEW INDEXES (After Refresh)
-- ----------------------------------------------------------------------------
\echo '2.4 Unused materialized view indexes (COMMENTED OUT)...'

/*
-- VALIDATION: Refresh materialized views first
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_network_timeline;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_heatmap_tiles;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_device_routes;

-- After refresh, check if indexes are used
-- If still zero usage after API calls, consider dropping:

-- DROP INDEX IF EXISTS public.idx_mv_network_timeline_bssid_bucket;  -- 16 MB
-- DROP INDEX IF EXISTS public.idx_mv_network_latest_geom;             -- 6.8 MB
-- DROP INDEX IF EXISTS public.idx_mv_network_latest_observed_at;      -- 3 MB

-- Rollback:
-- CREATE INDEX idx_mv_network_timeline_bssid_bucket ON public.mv_network_timeline (bssid, bucket);
-- CREATE INDEX idx_mv_network_latest_geom ON public.mv_network_latest USING gist (geom);
-- CREATE INDEX idx_mv_network_latest_observed_at ON public.mv_network_latest (observed_at);
*/

\echo '  (SKIPPED - requires matview refresh and testing)'
\echo ''

\echo '------------------------------------------------------------'
\echo 'PRIORITY 2 REVIEW REQUIRED: Uncomment sections to execute'
\echo '------------------------------------------------------------'
\echo ''

-- ============================================================================
-- PRIORITY 3: NEVER DROP (DO NOT UNCOMMENT)
-- ============================================================================

\echo ''
\echo '------------------------------------------------------------'
\echo 'PRIORITY 3: PROTECTED OBJECTS (NEVER DROP)'
\echo '------------------------------------------------------------'
\echo ''
\echo 'The following objects are CRITICAL and must NEVER be dropped:'
\echo ''
\echo '  VIEWS:'
\echo '    - api_network_explorer (PRIMARY API ENDPOINT)'
\echo ''
\echo '  MATERIALIZED VIEWS:'
\echo '    - mv_network_timeline (ACTIVE API: /api/explorer/timeline/:bssid)'
\echo '    - mv_heatmap_tiles (ACTIVE API: /api/explorer/heatmap)'
\echo '    - mv_device_routes (ACTIVE API: /api/explorer/routes)'
\echo ''
\echo '  TABLES:'
\echo '    - observations (PRIMARY DATA SOURCE)'
\echo '    - access_points (CORE METADATA)'
\echo '    - app.radio_manufacturers (OUI ENRICHMENT)'
\echo '    - app.networks (THREAT API)'
\echo '    - app.network_tags (USER TAGGING)'
\echo '    - app.location_markers (HOME LOCATION)'
\echo ''
\echo '  INDEXES:'
\echo '    - All primary keys (*_pkey)'
\echo '    - All unique constraints'
\echo '    - idx_observations_bssid_time (PRIMARY ACCESS PATH)'
\echo '    - idx_access_points_bssid (JOIN OPTIMIZATION)'
\echo ''
\echo '------------------------------------------------------------'
\echo ''

-- ============================================================================
-- TRANSACTION END
-- ============================================================================

\echo ''
\echo '============================================================================'
\echo 'DROP SCRIPT COMPLETE'
\echo '============================================================================'
\echo ''
\echo 'Objects dropped in this transaction:'
\echo '  - 4 indexes on observations_legacy (~81 MB)'
\echo '  - 1 index on staging_locations_all_raw (~115 MB)'
\echo ''
\echo 'Total space reclaimed: ~196 MB'
\echo ''
\echo 'NEXT STEPS:'
\echo '  1. Review dropped objects above'
\echo '  2. Test application functionality'
\echo '  3. If all OK, run: COMMIT;'
\echo '  4. If issues found, run: ROLLBACK;'
\echo ''
\echo 'For Priority 2 objects (legacy tables, duplicate indexes):'
\echo '  1. Uncomment validation queries'
\echo '  2. Verify results'
\echo '  3. Uncomment DROP statements'
\echo '  4. Re-run this script'
\echo ''
\echo '============================================================================'
\echo ''

-- ============================================================================
-- FINAL DECISION POINT
-- ============================================================================

\echo 'Transaction is OPEN. Choose action:'
\echo ''
\echo '  COMMIT;   -- Permanently apply changes'
\echo '  ROLLBACK; -- Undo all changes'
\echo ''

-- DO NOT AUTO-COMMIT
-- User must explicitly run COMMIT or ROLLBACK
