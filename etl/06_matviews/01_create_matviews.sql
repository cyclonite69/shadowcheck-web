\echo 'Create materialized views for explorer'

-- Latest observation per BSSID (fast detail lookups)
DROP MATERIALIZED VIEW IF EXISTS mv_network_latest;
CREATE MATERIALIZED VIEW mv_network_latest AS
SELECT DISTINCT ON (o.bssid)
  o.bssid,
  o.device_id,
  o.source_tag,
  o.observed_at,
  o.ssid,
  o.level,
  o.lat,
  o.lon,
  o.geom,
  o.mfgrid,
  o.external
FROM observations o
ORDER BY o.bssid, o.observed_at DESC;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_network_latest_bssid ON mv_network_latest (bssid);
CREATE INDEX IF NOT EXISTS idx_mv_network_latest_observed_at ON mv_network_latest (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mv_network_latest_geom ON mv_network_latest USING GIST (geom);

-- Hourly timeline aggregates per BSSID
DROP MATERIALIZED VIEW IF EXISTS mv_network_timeline;
CREATE MATERIALIZED VIEW mv_network_timeline AS
SELECT
  o.bssid,
  date_trunc('hour', o.observed_at) AS bucket,
  COUNT(*) AS obs_count,
  AVG(o.level) AS avg_level,
  MIN(o.level) AS min_level,
  MAX(o.level) AS max_level
FROM observations o
GROUP BY o.bssid, date_trunc('hour', o.observed_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_network_timeline_bssid_bucket ON mv_network_timeline (bssid, bucket);

-- Heatmap tiles using a 0.01° grid (~1.1 km at equator; adjust as needed)
DROP MATERIALIZED VIEW IF EXISTS mv_heatmap_tiles;
CREATE MATERIALIZED VIEW mv_heatmap_tiles AS
SELECT
  ST_SnapToGrid(o.geom, 0.01, 0.01) AS tile_geom,
  COUNT(*) AS obs_count,
  AVG(o.level) AS avg_level,
  MIN(o.level) AS min_level,
  MAX(o.level) AS max_level,
  MIN(o.observed_at) AS first_seen,
  MAX(o.observed_at) AS last_seen
FROM observations o
GROUP BY ST_SnapToGrid(o.geom, 0.01, 0.01);
CREATE INDEX IF NOT EXISTS idx_mv_heatmap_tiles_geom ON mv_heatmap_tiles USING GIST (tile_geom);

-- Device travel routes as ordered linestrings
DROP MATERIALIZED VIEW IF EXISTS mv_device_routes;
CREATE MATERIALIZED VIEW mv_device_routes AS
SELECT
  o.device_id,
  COUNT(*) AS point_count,
  MIN(o.observed_at) AS start_at,
  MAX(o.observed_at) AS end_at,
  ST_MakeLine(o.geom ORDER BY o.observed_at) AS route_geom
FROM observations o
GROUP BY o.device_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_device_routes_device ON mv_device_routes (device_id);
CREATE INDEX IF NOT EXISTS idx_mv_device_routes_geom ON mv_device_routes USING GIST (route_geom);
