-- Detect networks that appear together at multiple locations (tracking device clusters)
-- This identifies devices that travel together, indicating coordinated tracking

WITH network_locations AS (
  SELECT 
    bssid,
    time,
    ST_SnapToGrid(ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geometry, 0.001) as location_grid,
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography as location
  FROM app.locations_legacy
  WHERE lat IS NOT NULL 
    AND lon IS NOT NULL
    AND time >= (EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days') * 1000)::bigint
),
-- Find networks seen at the same time and place
colocation_pairs AS (
  SELECT 
    n1.bssid as bssid1,
    n2.bssid as bssid2,
    COUNT(DISTINCT n1.location_grid) as shared_locations,
    MIN(n1.time) as first_seen_together,
    MAX(n1.time) as last_seen_together
  FROM network_locations n1
  JOIN network_locations n2 ON 
    n1.location_grid = n2.location_grid
    AND ABS(n1.time - n2.time) < 60000  -- Within 1 minute
    AND n1.bssid < n2.bssid  -- Avoid duplicates
  GROUP BY n1.bssid, n2.bssid
  HAVING COUNT(DISTINCT n1.location_grid) >= 3  -- Seen together at 3+ locations
),
-- Calculate colocation score for each network
colocation_scores AS (
  SELECT 
    bssid1 as bssid,
    COUNT(DISTINCT bssid2) as companion_networks,
    MAX(shared_locations) as max_shared_locations,
    AVG(shared_locations) as avg_shared_locations
  FROM colocation_pairs
  GROUP BY bssid1
  UNION ALL
  SELECT 
    bssid2 as bssid,
    COUNT(DISTINCT bssid1) as companion_networks,
    MAX(shared_locations) as max_shared_locations,
    AVG(shared_locations) as avg_shared_locations
  FROM colocation_pairs
  GROUP BY bssid2
)
SELECT 
  cs.bssid,
  n.ssid,
  n.type,
  cs.companion_networks,
  cs.max_shared_locations,
  ROUND(cs.avg_shared_locations::numeric, 1) as avg_shared_locations,
  -- Colocation threat score (0-50 points)
  LEAST(50, cs.companion_networks * 10 + cs.max_shared_locations * 5) as colocation_score
FROM colocation_scores cs
JOIN app.networks_legacy n ON cs.bssid = n.bssid
ORDER BY colocation_score DESC, companion_networks DESC
LIMIT 50;
