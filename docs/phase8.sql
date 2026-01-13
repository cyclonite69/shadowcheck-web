\pset pager off
\set ON_ERROR_STOP on
\set sample_limit 1000
\set backfill_window '7 days'

-- Phase 8: delta correctness verification vs full refresh
BEGIN;
SET LOCAL application_name = 'shadowcheck_phase8_verify';
SET LOCAL work_mem = '128MB';
SET LOCAL maintenance_work_mem = '256MB';
SET LOCAL temp_file_limit = '10GB';
SET LOCAL enable_hashjoin = off;
SET LOCAL enable_hashagg = off;
SET LOCAL enable_mergejoin = on;
SET LOCAL enable_nestloop = off;
SET LOCAL enable_seqscan = off;
SET LOCAL jit = off;

SELECT pg_stat_reset();

-- Backup refresh state and force a verification window
CREATE TEMP TABLE refresh_state_backup ON COMMIT DROP AS
SELECT last_refresh_ts, last_refresh_id
FROM api_mv_refresh_state
WHERE id = 1;

UPDATE api_mv_refresh_state
SET last_refresh_ts = now() - interval :'backfill_window',
    updated_at = now()
WHERE id = 1;

-- Refresh delta tables for the verification window
SELECT refresh_api_network_mvs_delta(:sample_limit::bigint);

-- Sample BSSIDs from refreshed delta table
CREATE TEMP TABLE sample_bssids (bssid text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO sample_bssids (bssid)
SELECT bssid
FROM api_network_latest_delta
ORDER BY bssid
LIMIT :sample_limit;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM sample_bssids) = 0 THEN
    RAISE EXCEPTION 'Phase 8: no delta BSSIDs found for verification window';
  END IF;
END;
$$;

-- Full recompute (latest) for sample
CREATE TEMP TABLE full_latest_sample ON COMMIT DROP AS
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
JOIN sample_bssids s ON s.bssid = o.bssid
WHERE o.geom IS NOT NULL
  AND o.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  AND o.time >= '2000-01-01 UTC'
ORDER BY o.bssid, o.time DESC;

-- Full recompute (rollup) for sample
CREATE TEMP TABLE full_rollup_sample ON COMMIT DROP AS
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
JOIN sample_bssids s ON s.bssid = o.bssid
WHERE o.geom IS NOT NULL
GROUP BY o.bssid;

-- Delta snapshots for sample
CREATE TEMP TABLE delta_latest_sample ON COMMIT DROP AS
SELECT l.*
FROM api_network_latest_delta l
JOIN sample_bssids s USING (bssid)
ORDER BY bssid;

CREATE TEMP TABLE delta_rollup_sample ON COMMIT DROP AS
SELECT r.*
FROM api_network_rollup_delta r
JOIN sample_bssids s USING (bssid)
ORDER BY bssid;

-- EXPLAIN checkpoints (no seq scan, no hash join)
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, VERBOSE)
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
JOIN sample_bssids s ON s.bssid = o.bssid
WHERE o.geom IS NOT NULL
  AND o.bssid NOT IN ('00:00:00:00:00:00', 'FF:FF:FF:FF:FF:FF')
  AND o.time >= '2000-01-01 UTC'
ORDER BY o.bssid, o.time DESC;

EXPLAIN (ANALYZE, BUFFERS, SETTINGS, VERBOSE)
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
JOIN sample_bssids s ON s.bssid = o.bssid
WHERE o.geom IS NOT NULL
GROUP BY o.bssid;

-- Validation: exact match counts
CREATE TEMP TABLE latest_mismatch_bssids ON COMMIT DROP AS
SELECT f.bssid
FROM full_latest_sample f
FULL JOIN delta_latest_sample d USING (bssid)
WHERE (f.bssid IS NULL OR d.bssid IS NULL)
   OR f.ssid IS DISTINCT FROM d.ssid
   OR f.lat IS DISTINCT FROM d.lat
   OR f.lon IS DISTINCT FROM d.lon
   OR f.level IS DISTINCT FROM d.level
   OR f.accuracy IS DISTINCT FROM d.accuracy
   OR f.time IS DISTINCT FROM d.time
   OR f.radio_frequency IS DISTINCT FROM d.radio_frequency
   OR f.radio_capabilities::text IS DISTINCT FROM d.radio_capabilities::text
   OR f.geom IS DISTINCT FROM d.geom
   OR f.altitude IS DISTINCT FROM d.altitude;

CREATE TEMP TABLE rollup_mismatch_bssids ON COMMIT DROP AS
SELECT f.bssid
FROM full_rollup_sample f
FULL JOIN delta_rollup_sample d USING (bssid)
WHERE (f.bssid IS NULL OR d.bssid IS NULL)
   OR f.obs_count IS DISTINCT FROM d.obs_count
   OR f.first_observed_at IS DISTINCT FROM d.first_observed_at
   OR f.last_observed_at IS DISTINCT FROM d.last_observed_at
   OR f.unique_days IS DISTINCT FROM d.unique_days
   OR f.unique_locations IS DISTINCT FROM d.unique_locations
   OR f.avg_signal IS DISTINCT FROM d.avg_signal
   OR f.min_signal IS DISTINCT FROM d.min_signal
   OR f.max_signal IS DISTINCT FROM d.max_signal;

SELECT COUNT(*) AS latest_mismatch
FROM latest_mismatch_bssids;

SELECT COUNT(*) AS rollup_mismatch
FROM rollup_mismatch_bssids;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM latest_mismatch_bssids) > 0 THEN
    RAISE EXCEPTION 'Phase 8: latest mismatch detected';
  END IF;
  IF (SELECT COUNT(*) FROM rollup_mismatch_bssids) > 0 THEN
    RAISE EXCEPTION 'Phase 8: rollup mismatch detected';
  END IF;
END;
$$;

-- Restore refresh state
UPDATE api_mv_refresh_state
SET last_refresh_ts = b.last_refresh_ts,
    last_refresh_id = b.last_refresh_id,
    updated_at = now()
FROM refresh_state_backup b
WHERE id = 1;

SELECT now() AS ts, temp_files, pg_size_pretty(temp_bytes)
FROM pg_stat_database
WHERE datname = current_database();

ROLLBACK;
