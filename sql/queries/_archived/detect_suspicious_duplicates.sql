-- Detect suspicious observations with identical time/location/accuracy
-- These may indicate GPS glitches or data corruption

WITH duplicate_observations AS (
  SELECT 
    time,
    lat,
    lon,
    accuracy,
    COUNT(*) as observation_count,
    COUNT(DISTINCT bssid) as unique_networks,
    ARRAY_AGG(DISTINCT bssid) as bssids
  FROM app.locations_legacy
  WHERE lat IS NOT NULL 
    AND lon IS NOT NULL
    AND time >= (EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days') * 1000)::bigint
  GROUP BY time, lat, lon, accuracy
  HAVING COUNT(*) >= 5  -- 5+ observations at exact same time/place
)
SELECT 
  to_timestamp(time / 1000.0) as timestamp,
  lat,
  lon,
  accuracy,
  observation_count,
  unique_networks,
  bssids
FROM duplicate_observations
ORDER BY observation_count DESC, time DESC
LIMIT 100;
