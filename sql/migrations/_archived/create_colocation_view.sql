-- Create materialized view for co-location analysis
-- This pre-computes expensive joins and can be refreshed periodically

DROP MATERIALIZED VIEW IF EXISTS app.network_colocation_scores CASCADE;

CREATE MATERIALIZED VIEW app.network_colocation_scores AS
WITH network_locations AS (
  SELECT 
    bssid,
    time,
    ST_SnapToGrid(ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geometry, 0.001) as location_grid,
    time / 60000 as time_bucket  -- 1-minute buckets
  FROM app.locations_legacy
  WHERE lat IS NOT NULL 
    AND lon IS NOT NULL
    AND (accuracy IS NULL OR accuracy <= 100)
    AND time >= (EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days') * 1000)::bigint
),
colocation_pairs AS (
  SELECT 
    n1.bssid,
    COUNT(DISTINCT n2.bssid) as companion_count,
    COUNT(DISTINCT n1.location_grid) as shared_location_count
  FROM network_locations n1
  JOIN network_locations n2 ON 
    n1.location_grid = n2.location_grid
    AND n1.time_bucket = n2.time_bucket
    AND n1.bssid < n2.bssid
  GROUP BY n1.bssid
  HAVING COUNT(DISTINCT n2.bssid) >= 1 
    AND COUNT(DISTINCT n1.location_grid) >= 3
)
SELECT 
  bssid,
  companion_count,
  shared_location_count,
  -- Co-location score (0-30 points)
  LEAST(30, 
    CASE WHEN companion_count >= 3 THEN 30
         WHEN companion_count >= 2 THEN 20
         WHEN companion_count >= 1 THEN 10
         ELSE 0 END
  ) as colocation_score,
  NOW() as computed_at
FROM colocation_pairs
UNION ALL
SELECT 
  n2.bssid,
  COUNT(DISTINCT n1.bssid) as companion_count,
  COUNT(DISTINCT n1.location_grid) as shared_location_count,
  LEAST(30, 
    CASE WHEN COUNT(DISTINCT n1.bssid) >= 3 THEN 30
         WHEN COUNT(DISTINCT n1.bssid) >= 2 THEN 20
         WHEN COUNT(DISTINCT n1.bssid) >= 1 THEN 10
         ELSE 0 END
  ) as colocation_score,
  NOW() as computed_at
FROM network_locations n1
JOIN network_locations n2 ON 
  n1.location_grid = n2.location_grid
  AND n1.time_bucket = n2.time_bucket
  AND n1.bssid < n2.bssid
GROUP BY n2.bssid
HAVING COUNT(DISTINCT n1.bssid) >= 1 
  AND COUNT(DISTINCT n1.location_grid) >= 3;

-- Create index for fast lookups
CREATE INDEX idx_colocation_bssid ON app.network_colocation_scores(bssid);

-- Refresh function (call this periodically via cron or trigger)
CREATE OR REPLACE FUNCTION app.refresh_colocation_scores()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY app.network_colocation_scores;
END;
$$ LANGUAGE plpgsql;

-- Initial refresh
REFRESH MATERIALIZED VIEW app.network_colocation_scores;
