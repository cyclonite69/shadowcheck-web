\pset pager off
\set ON_ERROR_STOP on
\set delta_limit 500

-- Phase 7: incremental refresh strategy (index-driven)
SET application_name = 'shadowcheck_phase7_setup';
SET work_mem = '128MB';
SET maintenance_work_mem = '256MB';
SET temp_file_limit = '10GB';
SET enable_hashjoin = off;
SET enable_hashagg = off;
SET enable_mergejoin = on;
SET enable_nestloop = off;
SET jit = off;

-- Index support for time- and bssid-driven access
CREATE INDEX IF NOT EXISTS obs_time_idx
  ON public.observations ("time" DESC);
CREATE INDEX IF NOT EXISTS idx_observations_bssid_time_desc
  ON public.observations (bssid, "time" DESC);

-- Refresh state (single row)
CREATE TABLE IF NOT EXISTS api_mv_refresh_state (
  id smallint PRIMARY KEY DEFAULT 1,
  last_refresh_ts timestamptz NOT NULL,
  last_refresh_id bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);

INSERT INTO api_mv_refresh_state (id, last_refresh_ts)
VALUES (1, now())
ON CONFLICT (id) DO UPDATE
SET updated_at = now();

-- Incremental cache tables (MV-like; updatable)
CREATE TABLE IF NOT EXISTS api_network_latest_delta (
  bssid text PRIMARY KEY,
  ssid text,
  lat double precision,
  lon double precision,
  level integer,
  accuracy double precision,
  time timestamptz,
  radio_frequency integer,
  radio_capabilities text,
  geom geometry,
  altitude double precision
);

CREATE TABLE IF NOT EXISTS api_network_rollup_delta (
  bssid text PRIMARY KEY,
  obs_count bigint,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  unique_days bigint,
  unique_locations bigint,
  avg_signal double precision,
  min_signal integer,
  max_signal integer
);

CREATE OR REPLACE VIEW api_network_explorer_delta AS
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
FROM api_network_latest_delta l
JOIN api_network_rollup_delta r USING (bssid);

-- Helper: delta bssids since last_refresh_ts (index-driven)
CREATE OR REPLACE FUNCTION api_network_delta_bssids(
  _since timestamptz,
  _limit integer,
  _safety_skew interval DEFAULT '1 hour'
) RETURNS TABLE (bssid text, last_seen timestamptz)
LANGUAGE sql STABLE
AS $$
  SELECT
    o.bssid,
    MAX(o.time) AS last_seen
  FROM public.observations o
  WHERE o.time >= (_since - _safety_skew)
    AND o.geom IS NOT NULL
  GROUP BY o.bssid
  ORDER BY MAX(o.time) DESC
  LIMIT _limit;
$$;

-- Incremental refresh (index-driven, no seq scan/hash join)
CREATE OR REPLACE FUNCTION refresh_api_network_mvs_delta(
  max_bssids bigint DEFAULT 20000
) RETURNS void
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
  last_ts timestamptz;
  delta_count integer;
  safety_skew interval := '01:00:00'::interval;
BEGIN
  PERFORM set_config('application_name', 'shadowcheck_phase7_delta', true);
  PERFORM set_config('work_mem', '128MB', true);
  PERFORM set_config('maintenance_work_mem', '256MB', true);
  PERFORM set_config('temp_file_limit', '10GB', true);
  PERFORM set_config('enable_hashjoin', 'off', true);
  PERFORM set_config('enable_hashagg', 'off', true);
  PERFORM set_config('enable_mergejoin', 'on', true);
  PERFORM set_config('enable_nestloop', 'off', true);
  PERFORM set_config('enable_seqscan', 'off', true);
  PERFORM set_config('jit', 'off', true);

  SELECT oid INTO db_oid FROM pg_database WHERE datname = current_database();

  SELECT last_refresh_ts INTO last_ts
  FROM api_mv_refresh_state
  WHERE id = 1;

  CREATE TEMP TABLE delta_bssids (
    bssid text PRIMARY KEY,
    last_seen timestamptz
  ) ON COMMIT DROP;

  SELECT temp_bytes, temp_files
  INTO before_bytes, before_files
  FROM pg_stat_database
  WHERE datid = db_oid;

  stage_start := clock_timestamp();
  INSERT INTO delta_bssids (bssid, last_seen)
  SELECT bssid, last_seen
  FROM api_network_delta_bssids(last_ts, max_bssids::integer, safety_skew)
  ORDER BY bssid;
  GET DIAGNOSTICS delta_count = ROW_COUNT;
  stage_ms := EXTRACT(EPOCH FROM clock_timestamp() - stage_start) * 1000;

  SELECT temp_bytes, temp_files
  INTO after_bytes, after_files
  FROM pg_stat_database
  WHERE datid = db_oid;

  IF after_bytes > before_bytes THEN
    RAISE EXCEPTION 'temp_bytes increased during delta selection: before %, after %',
      before_bytes, after_bytes;
  END IF;

  RAISE NOTICE 'delta selection ms=%, rows=%, temp_files_delta=%, temp_bytes_delta=%',
    stage_ms, delta_count, after_files - before_files, after_bytes - before_bytes;

  IF delta_count = 0 THEN
    UPDATE api_mv_refresh_state
    SET last_refresh_ts = now(),
        last_refresh_id = last_refresh_id + 1,
        updated_at = now()
    WHERE id = 1;
    RETURN;
  END IF;

  before_bytes := after_bytes;
  before_files := after_files;

  stage_start := clock_timestamp();
  DELETE FROM api_network_latest_delta
  WHERE bssid IN (SELECT bssid FROM delta_bssids);

  INSERT INTO api_network_latest_delta (
    bssid, ssid, lat, lon, level, accuracy, time,
    radio_frequency, radio_capabilities, geom, altitude
  )
  SELECT DISTINCT ON (o.bssid)
    o.bssid,
    o.ssid,
    o.lat,
    o.lon,
    o.level,
    o.accuracy,
    o.time,
    o.radio_frequency,
    o.radio_capabilities::text,
    o.geom,
    o.altitude
  FROM public.observations o
  JOIN delta_bssids d ON d.bssid = o.bssid
  WHERE o.geom IS NOT NULL
    AND o.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
    AND o.time >= '2000-01-01 UTC'
  ORDER BY o.bssid, o.time DESC;
  stage_ms := EXTRACT(EPOCH FROM clock_timestamp() - stage_start) * 1000;

  SELECT temp_bytes, temp_files
  INTO after_bytes, after_files
  FROM pg_stat_database
  WHERE datid = db_oid;

  IF after_bytes > before_bytes THEN
    RAISE EXCEPTION 'temp_bytes increased during latest_delta refresh: before %, after %',
      before_bytes, after_bytes;
  END IF;

  RAISE NOTICE 'latest_delta refresh ms=%, temp_files_delta=%, temp_bytes_delta=%',
    stage_ms, after_files - before_files, after_bytes - before_bytes;

  before_bytes := after_bytes;
  before_files := after_files;

  stage_start := clock_timestamp();
  DELETE FROM api_network_rollup_delta
  WHERE bssid IN (SELECT bssid FROM delta_bssids);

  INSERT INTO api_network_rollup_delta (
    bssid,
    obs_count,
    first_observed_at,
    last_observed_at,
    unique_days,
    unique_locations,
    avg_signal,
    min_signal,
    max_signal
  )
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
  JOIN delta_bssids d ON d.bssid = o.bssid
  WHERE o.geom IS NOT NULL
  GROUP BY o.bssid;
  stage_ms := EXTRACT(EPOCH FROM clock_timestamp() - stage_start) * 1000;

  SELECT temp_bytes, temp_files
  INTO after_bytes, after_files
  FROM pg_stat_database
  WHERE datid = db_oid;

  IF after_bytes > before_bytes THEN
    RAISE EXCEPTION 'temp_bytes increased during rollup_delta refresh: before %, after %',
      before_bytes, after_bytes;
  END IF;

  RAISE NOTICE 'rollup_delta refresh ms=%, temp_files_delta=%, temp_bytes_delta=%',
    stage_ms, after_files - before_files, after_bytes - before_bytes;

  UPDATE api_mv_refresh_state
  SET last_refresh_ts = now(),
      last_refresh_id = last_refresh_id + 1,
      updated_at = now()
  WHERE id = 1;
END;
$$;

-- TODO: replace delta tables with MV when partial refresh exists
-- TODO: delta refresh by time window or CDC with watermark
-- TODO: partition observations by time for faster delta selection

-- EXPLAIN (ANALYZE, BUFFERS, SETTINGS, VERBOSE) with small delta sample
BEGIN;
SET LOCAL work_mem = '128MB';
SET LOCAL temp_file_limit = '10GB';
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_hashagg = off;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_seqscan = off;
SET LOCAL jit = off;

SELECT temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

EXPLAIN (ANALYZE, BUFFERS, SETTINGS, VERBOSE)
SELECT bssid, last_seen
FROM api_network_delta_bssids(now(), :delta_limit, '1 hour');

SELECT temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

EXPLAIN (ANALYZE, BUFFERS, SETTINGS, VERBOSE)
WITH delta_bssids AS (
  SELECT bssid
  FROM api_network_delta_bssids(now(), :delta_limit, '1 hour')
)
SELECT DISTINCT ON (o.bssid)
  o.bssid,
  o.ssid,
  o.lat,
  o.lon,
  o.level,
  o.accuracy,
  o.time,
  o.radio_frequency,
  o.radio_capabilities,
  o.geom,
  o.altitude
FROM public.observations o
JOIN delta_bssids d ON d.bssid = o.bssid
WHERE o.geom IS NOT NULL
  AND o.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  AND o.time >= '2000-01-01 UTC'
ORDER BY o.bssid, o.time DESC;

SELECT temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

EXPLAIN (ANALYZE, BUFFERS, SETTINGS, VERBOSE)
WITH delta_bssids AS (
  SELECT bssid
  FROM api_network_delta_bssids(now(), :delta_limit, '1 hour')
)
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
JOIN delta_bssids d ON d.bssid = o.bssid
WHERE o.geom IS NOT NULL
GROUP BY o.bssid;

SELECT temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

ROLLBACK;

-- Validation queries
SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_latest_delta;

SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_rollup_delta;

SELECT COUNT(*) AS dup_bssids
FROM (
  SELECT bssid
  FROM api_network_latest_delta
  GROUP BY bssid
  HAVING COUNT(*) > 1
) t;

SELECT COUNT(*) AS dup_bssids
FROM (
  SELECT bssid
  FROM api_network_rollup_delta
  GROUP BY bssid
  HAVING COUNT(*) > 1
) t;

SELECT l.bssid, l.time AS latest_time, r.last_observed_at
FROM api_network_latest_delta l
JOIN api_network_rollup_delta r USING (bssid)
ORDER BY l.time DESC
LIMIT 10;
