\pset pager off
\set ON_ERROR_STOP on

-- Phase 10: full-history MVs + proof queries (delta temp checks)

CREATE OR REPLACE FUNCTION public.get_home_location()
RETURNS TABLE(home_lon double precision, home_lat double precision)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  IF to_regclass('public.location_markers') IS NULL THEN
    RETURN QUERY SELECT NULL::double precision, NULL::double precision;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ST_X(location::geometry),
    ST_Y(location::geometry)
  FROM public.location_markers
  WHERE marker_type = 'home'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::double precision, NULL::double precision;
  END IF;
END;
$$;

DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_full_mv;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_rollup_full_mv;
DROP MATERIALIZED VIEW IF EXISTS public.api_network_latest_full_mv;

CREATE MATERIALIZED VIEW public.api_network_latest_full_mv AS
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
WITH NO DATA;

CREATE MATERIALIZED VIEW public.api_network_rollup_full_mv AS
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
  FROM public.api_network_latest_full_mv
  ORDER BY bssid
) l ON l.bssid = o.bssid
WHERE o.geom IS NOT NULL
GROUP BY o.bssid
WITH NO DATA;

CREATE MATERIALIZED VIEW public.api_network_explorer_full_mv AS
SELECT
  l.bssid,
  COALESCE(NULLIF(TRIM(l.ssid), ''), '(hidden)') AS ssid,
  l.time AS observed_at,
  l.lat,
  l.lon,
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
  r.max_signal,
  (l.level > -50) AS threat,
  CASE
    WHEN home.home_lat IS NOT NULL
      AND home.home_lon IS NOT NULL
      AND l.lat IS NOT NULL
      AND l.lon IS NOT NULL
    THEN ST_Distance(
      ST_SetSRID(ST_MakePoint(home.home_lon, home.home_lat), 4326)::geography,
      ST_SetSRID(ST_MakePoint(l.lon, l.lat), 4326)::geography
    ) / 1000.0
    ELSE NULL
  END AS distance_from_home_km
FROM public.api_network_latest_full_mv l
JOIN public.api_network_rollup_full_mv r USING (bssid)
CROSS JOIN LATERAL (SELECT * FROM public.get_home_location()) home
WITH NO DATA;

SELECT pg_stat_reset();
SELECT now() AS ts, temp_files, pg_size_pretty(temp_bytes)
FROM pg_stat_database
WHERE datname = current_database();

BEGIN;
SET LOCAL application_name = 'shadowcheck_phase10_refresh_full';
SET LOCAL work_mem = '128MB';
SET LOCAL maintenance_work_mem = '256MB';
SET LOCAL temp_file_limit = '10GB';
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_hashagg = off;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_seqscan = off;
SET LOCAL jit = off;
REFRESH MATERIALIZED VIEW public.api_network_latest_full_mv;
COMMIT;

SELECT now() AS ts, temp_files, pg_size_pretty(temp_bytes)
FROM pg_stat_database
WHERE datname = current_database();

BEGIN;
SET LOCAL application_name = 'shadowcheck_phase10_refresh_full';
SET LOCAL work_mem = '128MB';
SET LOCAL maintenance_work_mem = '256MB';
SET LOCAL temp_file_limit = '10GB';
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_hashagg = off;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_seqscan = off;
SET LOCAL jit = off;
REFRESH MATERIALIZED VIEW public.api_network_rollup_full_mv;
COMMIT;

SELECT now() AS ts, temp_files, pg_size_pretty(temp_bytes)
FROM pg_stat_database
WHERE datname = current_database();

BEGIN;
SET LOCAL application_name = 'shadowcheck_phase10_refresh_full';
SET LOCAL work_mem = '128MB';
SET LOCAL maintenance_work_mem = '256MB';
SET LOCAL temp_file_limit = '10GB';
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_hashagg = off;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_seqscan = off;
SET LOCAL jit = off;
REFRESH MATERIALIZED VIEW public.api_network_explorer_full_mv;
COMMIT;

SELECT now() AS ts, temp_files, pg_size_pretty(temp_bytes)
FROM pg_stat_database
WHERE datname = current_database();

-- Base indexes
CREATE UNIQUE INDEX IF NOT EXISTS api_network_latest_full_mv_bssid_uidx
  ON public.api_network_latest_full_mv (bssid);
CREATE UNIQUE INDEX IF NOT EXISTS api_network_rollup_full_mv_bssid_uidx
  ON public.api_network_rollup_full_mv (bssid);
CREATE UNIQUE INDEX IF NOT EXISTS api_network_explorer_full_mv_bssid_uidx
  ON public.api_network_explorer_full_mv (bssid);

-- Filter support
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_threat_last_seen_idx
  ON public.api_network_explorer_full_mv (threat, last_observed_at, bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_last_seen_idx
  ON public.api_network_explorer_full_mv (last_observed_at, bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_distance_idx
  ON public.api_network_explorer_full_mv (distance_from_home_km, bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_signal_idx
  ON public.api_network_explorer_full_mv (signal, bssid);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_obs_count_idx
  ON public.api_network_explorer_full_mv (obs_count, bssid);
CREATE INDEX IF NOT EXISTS api_net_full_ssid_lc_bssid_idx
  ON public.api_network_explorer_full_mv ((lower(ssid)) text_pattern_ops, bssid);

-- Sort support
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_last_seen_sort_idx
  ON public.api_network_explorer_full_mv (last_observed_at DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_ssid_sort_idx
  ON public.api_network_explorer_full_mv (lower(ssid) ASC, bssid ASC);
CREATE INDEX IF NOT EXISTS api_net_full_signal_desc_bssid_desc_idx
  ON public.api_network_explorer_full_mv (signal DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_obs_count_sort_idx
  ON public.api_network_explorer_full_mv (obs_count DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_distance_sort_idx
  ON public.api_network_explorer_full_mv (distance_from_home_km ASC, bssid ASC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_bssid_sort_idx
  ON public.api_network_explorer_full_mv (bssid ASC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_frequency_sort_idx
  ON public.api_network_explorer_full_mv (frequency DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_accuracy_sort_idx
  ON public.api_network_explorer_full_mv (accuracy_meters DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_first_seen_sort_idx
  ON public.api_network_explorer_full_mv (first_observed_at DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_avg_signal_sort_idx
  ON public.api_network_explorer_full_mv (avg_signal DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_min_signal_sort_idx
  ON public.api_network_explorer_full_mv (min_signal DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_max_signal_sort_idx
  ON public.api_network_explorer_full_mv (max_signal DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_unique_days_sort_idx
  ON public.api_network_explorer_full_mv (unique_days DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_unique_locations_sort_idx
  ON public.api_network_explorer_full_mv (unique_locations DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_observed_at_sort_idx
  ON public.api_network_explorer_full_mv (observed_at DESC, bssid DESC);
CREATE INDEX IF NOT EXISTS api_network_explorer_full_mv_threat_sort_idx
  ON public.api_network_explorer_full_mv (threat DESC, bssid DESC);

-- Proof harness (delta temp checks)
BEGIN;
SET LOCAL work_mem = '128MB';
SET LOCAL temp_file_limit = '10GB';
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_hashagg = off;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_seqscan = off;
SET LOCAL enable_bitmapscan = off;
SET LOCAL jit = off;

CREATE TEMP TABLE proof_stats (
  label text,
  temp_files bigint,
  temp_bytes bigint
);

-- Filters (single)
INSERT INTO proof_stats
SELECT 'threat_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE threat = true
ORDER BY last_observed_at DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'threat_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'last_seen_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE last_observed_at >= now() - interval '30 days'
ORDER BY last_observed_at DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'last_seen_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'distance_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE distance_from_home_km <= 5
ORDER BY distance_from_home_km ASC, bssid ASC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'distance_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'signal_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE signal >= -70
ORDER BY signal DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'signal_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'obs_count_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE obs_count >= 10
ORDER BY obs_count DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'obs_count_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'ssid_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE lower(ssid) >= 'home'
  AND lower(ssid) < 'home{'
ORDER BY lower(ssid) ASC, bssid ASC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'ssid_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

-- Sorts (single)
INSERT INTO proof_stats
SELECT 'sort_last_seen_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
ORDER BY last_observed_at DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'sort_last_seen_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'sort_ssid_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
ORDER BY lower(ssid) ASC, bssid ASC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'sort_ssid_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'sort_signal_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
ORDER BY signal DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'sort_signal_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'sort_obs_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
ORDER BY obs_count DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'sort_obs_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'sort_distance_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
ORDER BY distance_from_home_km ASC, bssid ASC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'sort_distance_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

-- Common combinations
INSERT INTO proof_stats
SELECT 'combo_threat_last_seen_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE threat = true
  AND last_observed_at >= now() - interval '7 days'
ORDER BY last_observed_at DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'combo_threat_last_seen_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

INSERT INTO proof_stats
SELECT 'combo_signal_obs_before', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.api_network_explorer_full_mv
WHERE signal BETWEEN -80 AND -40
  AND obs_count >= 5
ORDER BY signal DESC, bssid DESC
LIMIT 200 OFFSET 0;
INSERT INTO proof_stats
SELECT 'combo_signal_obs_after', temp_files, temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

DO $$
DECLARE
  before_files bigint;
  after_files bigint;
  before_bytes bigint;
  after_bytes bigint;
  pair record;
BEGIN
  FOR pair IN
    SELECT
      regexp_replace(label, '_before$', '') AS base_label
    FROM proof_stats
    WHERE label LIKE '%_before'
  LOOP
    SELECT temp_files, temp_bytes
    INTO before_files, before_bytes
    FROM proof_stats
    WHERE label = pair.base_label || '_before';

    SELECT temp_files, temp_bytes
    INTO after_files, after_bytes
    FROM proof_stats
    WHERE label = pair.base_label || '_after';

    IF after_files - before_files <> 0 OR after_bytes - before_bytes <> 0 THEN
      RAISE EXCEPTION 'temp delta nonzero for %, files %, bytes %',
        pair.base_label,
        after_files - before_files,
        after_bytes - before_bytes;
    END IF;
  END LOOP;
END;
$$;

ROLLBACK;

SELECT now() AS ts, temp_files, pg_size_pretty(temp_bytes)
FROM pg_stat_database
WHERE datname = current_database();
