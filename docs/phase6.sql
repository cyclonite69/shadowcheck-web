\pset pager off
\set ON_ERROR_STOP on

-- Phase 6: harden + automate (bounded refresh)
SET application_name = 'shadowcheck_phase6_setup';
SET work_mem = '128MB';
SET maintenance_work_mem = '256MB';
SET enable_nestloop = off;
SET enable_hashagg = off;
SET jit = off;

-- Ensure MV indexes for merge-join friendliness
CREATE UNIQUE INDEX IF NOT EXISTS api_network_latest_mv_bssid_uidx
  ON api_network_latest_mv (bssid);
CREATE INDEX IF NOT EXISTS api_network_latest_mv_bssid_time_idx
  ON api_network_latest_mv (bssid, time DESC);
CREATE UNIQUE INDEX IF NOT EXISTS api_network_rollup_mv_bssid_uidx
  ON api_network_rollup_mv (bssid);

-- Merge-join friendly explorer view
DROP VIEW IF EXISTS api_network_explorer;
CREATE VIEW api_network_explorer AS
SELECT
  l.bssid,
  COALESCE(NULLIF(TRIM(l.ssid), ''), '(hidden)') AS ssid,
  l.time AS observed_at,
  l.lat, l.lon,
  l.accuracy AS accuracy_meters,
  l.level AS signal,
  l.radio_frequency AS frequency,
  l.radio_capabilities AS capabilities,
  r.obs_count,
  r.first_observed_at,
  r.last_observed_at,
  r.unique_days,
  r.unique_locations,
  r.avg_signal,
  r.min_signal,
  r.max_signal
FROM (
  SELECT * FROM api_network_latest_mv ORDER BY bssid
) l
JOIN (
  SELECT * FROM api_network_rollup_mv ORDER BY bssid
) r USING (bssid);

-- Safe refresh function with observability
CREATE OR REPLACE FUNCTION refresh_api_network_mvs()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  db_oid oid;
  before_bytes bigint;
  after_bytes bigint;
  before_files bigint;
  after_files bigint;
  stage_start timestamptz;
  stage_ms numeric;
BEGIN
  PERFORM set_config('application_name', 'shadowcheck_phase6_refresh', true);
  PERFORM set_config('work_mem', '128MB', true);
  PERFORM set_config('maintenance_work_mem', '256MB', true);
  PERFORM set_config('enable_nestloop', 'off', true);
  PERFORM set_config('enable_hashagg', 'off', true);
  PERFORM set_config('jit', 'off', true);

  SELECT oid INTO db_oid FROM pg_database WHERE datname = current_database();

  SELECT temp_bytes, temp_files
  INTO before_bytes, before_files
  FROM pg_stat_database
  WHERE datid = db_oid;

  stage_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW api_network_latest_mv;
  stage_ms := EXTRACT(EPOCH FROM clock_timestamp() - stage_start) * 1000;

  SELECT temp_bytes, temp_files
  INTO after_bytes, after_files
  FROM pg_stat_database
  WHERE datid = db_oid;

  IF after_bytes > before_bytes THEN
    RAISE EXCEPTION 'temp_bytes increased during latest_mv refresh: before %, after %',
      before_bytes, after_bytes;
  END IF;

  RAISE NOTICE 'latest_mv refresh ms=%, temp_files_delta=%, temp_bytes_delta=%',
    stage_ms, after_files - before_files, after_bytes - before_bytes;

  before_bytes := after_bytes;
  before_files := after_files;

  stage_start := clock_timestamp();
  REFRESH MATERIALIZED VIEW api_network_rollup_mv;
  stage_ms := EXTRACT(EPOCH FROM clock_timestamp() - stage_start) * 1000;

  SELECT temp_bytes, temp_files
  INTO after_bytes, after_files
  FROM pg_stat_database
  WHERE datid = db_oid;

  IF after_bytes > before_bytes THEN
    RAISE EXCEPTION 'temp_bytes increased during rollup_mv refresh: before %, after %',
      before_bytes, after_bytes;
  END IF;

  RAISE NOTICE 'rollup_mv refresh ms=%, temp_files_delta=%, temp_bytes_delta=%',
    stage_ms, after_files - before_files, after_bytes - before_bytes;
END;
$$;

-- TODO: incremental strategy
-- TODO: delta-based refresh keyed by updated BSSIDs
-- TODO: time-windowed refresh (e.g., last N days)
-- TODO: partition-aware refresh for observations

-- EXPLAIN summaries (2025-12-22)
-- latest_mv: Index Scan + Incremental Sort + Unique + Limit; 79.163 ms; no temp spill
-- rollup_mv: Merge Join + Incremental Sort + GroupAggregate; 145.430 ms; no seq scan on observations
-- explorer: Merge Join via bssid indexes; 29.173 ms; hashjoin disabled locally for validation

-- EXPLAIN (ANALYZE, BUFFERS) for MV definitions
EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT ON (bssid)
  bssid,
  ssid,
  lat,
  lon,
  level,
  accuracy,
  time,
  radio_frequency,
  radio_capabilities,
  geom,
  altitude
FROM public.observations
WHERE geom IS NOT NULL
  AND bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  AND time >= '2000-01-01 UTC'
ORDER BY bssid, time DESC
LIMIT 20000;

EXPLAIN (ANALYZE, BUFFERS)
SELECT
  o.bssid,
  COUNT(*)                   AS obs_count,
  MIN(o.time)                AS first_observed_at,
  MAX(o.time)                AS last_observed_at,
  COUNT(DISTINCT DATE(o.time)) AS unique_days,
  COUNT(DISTINCT o.geom)     AS unique_locations,
  AVG(o.level)               AS avg_signal,
  MIN(o.level)               AS min_signal,
  MAX(o.level)               AS max_signal
FROM public.observations o
JOIN (
  SELECT bssid
  FROM api_network_latest_mv
  ORDER BY bssid
) l ON l.bssid = o.bssid
WHERE o.geom IS NOT NULL
GROUP BY o.bssid;

BEGIN;
SET LOCAL enable_hashjoin = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM api_network_explorer;
ROLLBACK;

-- Validation queries
SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_latest_mv;

SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_rollup_mv;

SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_explorer;
