\set ON_ERROR_STOP on
\set QUIET 1
\set sqlite_path :ENV:SQLITE_PATH
\set QUIET 0

-- DEPRECATED:
-- This helper preserves an old manual rebuild flow that references the legacy
-- incremental migration path below. Prefer the canonical ETL + migration
-- entrypoints under etl/ and sql/run-migrations.sh for current operations.

-- WHY: Tag rebuild session for pg_stat_statements attribution.
SET application_name = 'shadowcheck_rebuild';

-- WHY: Enable statement timing in this rebuild session for observability.
SET log_min_duration_statement = 200;

-- WHY: Ensure pg_stat_statements is available for query observability.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ==========================================================================
-- PHASE 0 — RESET (optional)
-- ==========================================================================
DROP VIEW IF EXISTS public.api_network_explorer CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv;

-- ==========================================================================
-- PHASE 1 — INGEST (RAW TRUTH)
-- ==========================================================================
\ir sql/migrations/00_init_schema.sql
\ir sql/migrations/01_create_import_schema.sql
\ir sql/migrations/01_add_minimum_required_columns.sql
\ir sql/migrations/02_create_mvs_and_imports_table.sql
\ir sql/migrations/03_fix_location_markers_schema.sql
\ir sql/migrations/100_enforce_uppercase_ssid_public.sql
\ir sql/migrations/101_enforce_uppercase_bssid.sql

-- WHY: Raw ingest from SQLite is handled by the canonical importer.
\if :{?sqlite_path}
\! npx tsx etl/load/sqlite-import.ts :'sqlite_path'
\endif

-- ==========================================================================
-- PHASE 2 — ETL NORMALIZATION
-- ==========================================================================
\ir sql/migrations/create_uuid_tracking.sql
\ir sql/migrations/create_tracking_dashboard.sql
\ir sql/migrations/create_network_aggregation_triggers.sql
\ir sql/migrations/create_trilateration_trigger.sql
\ir sql/migrations/add_performance_indexes.sql
\ir sql/migrations/migrate_network_tags_v2.sql

-- ==========================================================================
-- PHASE 3 — MORPH (DERIVED INTELLIGENCE)
-- ==========================================================================
\ir sql/migrations/20251221_create_api_network_explorer_mv.sql

-- ==========================================================================
-- PHASE 4 — PRESENTATION
-- ==========================================================================
REFRESH MATERIALIZED VIEW CONCURRENTLY public.api_network_explorer_mv;

-- ==========================================================================
-- VERIFY
-- ==========================================================================
SELECT COUNT(*) AS access_points_count FROM public.access_points;
SELECT COUNT(*) AS explorer_mv_count FROM public.api_network_explorer_mv;

SELECT 1
FROM public.api_network_explorer_mv
GROUP BY bssid
HAVING COUNT(*) > 1
LIMIT 1;
