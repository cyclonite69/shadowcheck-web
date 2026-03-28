-- ============================================================================
-- SHADOWCHECK DATABASE CLEANUP SCRIPT (2026-03-28)
-- ============================================================================
-- 
-- ⚠️  WARNING: This script drops database objects.
-- 
-- 1. Ensure a full backup exists (scripts/db-backup-commands.sh)
-- 2. Run this in a transaction first: BEGIN; ... ROLLBACK;
-- 3. Only COMMIT once verified.
--
-- Reclaims estimated: ~350 MB
-- ============================================================================

BEGIN;

\echo '--- Cleaning up redundant Public schema tables ---'
DROP TABLE IF EXISTS public.kismet_packets CASCADE;
DROP TABLE IF EXISTS public.kismet_devices CASCADE;
DROP TABLE IF EXISTS public.kismet_alerts CASCADE;
DROP TABLE IF EXISTS public.kismet_data CASCADE;
DROP TABLE IF EXISTS public.kismet_datasources CASCADE;
DROP TABLE IF EXISTS public.kismet_messages CASCADE;
DROP TABLE IF EXISTS public.kismet_snapshots CASCADE;

\echo '--- Cleaning up unused App schema objects ---'
DROP TABLE IF EXISTS app.network_sibling_baseline CASCADE;
DROP TABLE IF EXISTS app.ssid_history CASCADE;
DROP TABLE IF EXISTS app.threat_scores_cache CASCADE;
DROP TABLE IF EXISTS app.staging_routes CASCADE;
DROP TABLE IF EXISTS app.staging_locations_all_raw CASCADE;

\echo '--- Cleaning up unused Views ---'
DROP VIEW IF EXISTS app.network_sibling_pairs_filtered CASCADE;
DROP VIEW IF EXISTS app.v_real_access_points CASCADE;
DROP VIEW IF EXISTS app.network_summary_with_notes CASCADE;
DROP TABLE IF EXISTS app.api_mv_refresh_state CASCADE;

\echo '--- Cleaning up redundant Indexes on app.observations ---'
-- These are confirmed redundant or identical to other more used indexes
DROP INDEX IF EXISTS app.idx_observations_bssid_time_desc;
DROP INDEX IF EXISTS app.idx_observations_bssid_time;
DROP INDEX IF EXISTS app.idx_obs_time_lat_lon;

\echo '--- Cleaning up redundant Indexes on app.networks ---'
DROP INDEX IF EXISTS app.idx_networks_bssid_covering;

\echo '============================================================================'
\echo 'CLEANUP COMPLETE (Transaction is OPEN)'
\echo '============================================================================'
\echo 'Run COMMIT; to apply changes or ROLLBACK; to undo.'
\echo '============================================================================'
