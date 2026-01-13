\pset pager off
\set ON_ERROR_STOP on
\set batch_limit 20000

-- Safety settings
SET application_name = 'shadowcheck_phase5_mv';
SET work_mem = '128MB';
SET maintenance_work_mem = '256MB';
SET enable_nestloop = off;
SET enable_hashagg = off;
SET jit = off;

-- Latest per BSSID (bounded)
DROP MATERIALIZED VIEW IF EXISTS api_network_latest_mv;
CREATE MATERIALIZED VIEW api_network_latest_mv AS
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
LIMIT :batch_limit;

CREATE UNIQUE INDEX api_network_latest_mv_bssid_uidx
  ON api_network_latest_mv (bssid);
CREATE INDEX api_network_latest_mv_bssid_time_idx
  ON api_network_latest_mv (bssid, time DESC);

-- Rollup only for BSSIDs in latest MV (bounded)
DROP MATERIALIZED VIEW IF EXISTS api_network_rollup_mv;
CREATE MATERIALIZED VIEW api_network_rollup_mv AS
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

CREATE UNIQUE INDEX api_network_rollup_mv_bssid_uidx
  ON api_network_rollup_mv (bssid);

-- Final explorer view
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
FROM api_network_latest_mv l
JOIN api_network_rollup_mv r USING (bssid);

-- EXPLAIN plans for MV definitions
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
LIMIT :batch_limit;

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

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM api_network_explorer;

-- Validation queries
SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_latest_mv;

SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_rollup_mv;

SELECT COUNT(*) AS rows, COUNT(DISTINCT bssid) AS distinct_bssid
FROM api_network_explorer;
