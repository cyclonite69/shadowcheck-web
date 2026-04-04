\set ON_ERROR_STOP on
\set QUIET 1
\set sqlite_path :ENV:SQLITE_PATH
\set QUIET 0

-- DEPRECATED:
-- This helper now delegates to the canonical migration runner. The previous
-- hardcoded incremental path recreated stale schema objects, including
-- access_points, and must not be used anymore.

-- WHY: Tag rebuild session for pg_stat_statements attribution.
SET application_name = 'shadowcheck_rebuild';

-- WHY: Enable statement timing in this rebuild session for observability.
SET log_min_duration_statement = 200;

-- WHY: Ensure pg_stat_statements is available for query observability.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

\echo 'Running canonical migrations via sql/run-migrations.sh'
\! MIGRATIONS_DIR=sql/migrations bash sql/run-migrations.sh

-- WHY: Raw ingest from SQLite is handled by the canonical importer.
\if :{?sqlite_path}
\! npx tsx etl/load/sqlite-import.ts :'sqlite_path'
\endif

\echo 'Refreshing current materialized views'
SELECT * FROM app.refresh_all_materialized_views();

-- ==========================================================================
-- VERIFY
-- ==========================================================================
SELECT COUNT(*) AS networks_count FROM app.networks;
SELECT COUNT(*) AS explorer_mv_count FROM app.api_network_explorer_mv;

SELECT 1
FROM app.api_network_explorer_mv
GROUP BY bssid
HAVING COUNT(*) > 1
LIMIT 1;
