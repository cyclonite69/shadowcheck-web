-- 1. Track a specific device's complete journey
CREATE OR REPLACE FUNCTION app.get_device_journey(target_bssid TEXT)
RETURNS TABLE (
  device_uuid UUID,
  observed_at TIMESTAMP,
  address TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  velocity_kmh REAL,
  distance_m REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dm.device_uuid,
    dm.observed_at,
    dm.address,
    dm.lat,
    dm.lon,
    dm.velocity_kmh,
    dm.distance_from_previous_m
  FROM app.device_movements dm
  JOIN app.tracked_devices td ON dm.device_uuid = td.device_uuid
  WHERE td.bssid = target_bssid
  ORDER BY dm.observed_at;
END;
$$ LANGUAGE plpgsql;

-- 2. Find devices that visited multiple sensitive locations
SELECT 
  td.device_uuid,
  td.bssid,
  td.ssid,
  td.device_type,
  td.device_manufacturer,
  COUNT(DISTINCT dm.address) as locations_visited,
  ARRAY_AGG(DISTINCT dm.address ORDER BY dm.address) as addresses,
  td.movement_pattern,
  td.risk_score
FROM app.tracked_devices td
JOIN app.device_movements dm ON td.device_uuid = dm.device_uuid
WHERE dm.address ~* 'government|police|courthouse|city hall|federal'
GROUP BY td.device_uuid, td.bssid, td.ssid, td.device_type, td.device_manufacturer, td.movement_pattern, td.risk_score
HAVING COUNT(DISTINCT dm.address) > 2
ORDER BY locations_visited DESC
LIMIT 20;

-- 3. Identify co-located devices (devices seen together frequently)
WITH device_locations AS (
  SELECT 
    device_uuid,
    address,
    DATE_TRUNC('hour', observed_at) as time_bucket
  FROM app.device_movements
  WHERE address IS NOT NULL
)
SELECT 
  d1.device_uuid as device1,
  d2.device_uuid as device2,
  t1.bssid as bssid1,
  t2.bssid as bssid2,
  t1.ssid as ssid1,
  t2.ssid as ssid2,
  COUNT(*) as times_seen_together,
  ARRAY_AGG(DISTINCT d1.address) as shared_locations
FROM device_locations d1
JOIN device_locations d2 ON 
  d1.address = d2.address 
  AND d1.time_bucket = d2.time_bucket
  AND d1.device_uuid < d2.device_uuid
JOIN app.tracked_devices t1 ON d1.device_uuid = t1.device_uuid
JOIN app.tracked_devices t2 ON d2.device_uuid = t2.device_uuid
GROUP BY d1.device_uuid, d2.device_uuid, t1.bssid, t2.bssid, t1.ssid, t2.ssid
HAVING COUNT(*) > 5
ORDER BY times_seen_together DESC
LIMIT 20;

-- 4. Find fast-moving devices (potential vehicles or surveillance)
SELECT 
  td.device_uuid,
  td.bssid,
  td.ssid,
  td.device_type,
  td.device_manufacturer,
  MAX(dm.velocity_kmh) as max_speed_kmh,
  AVG(dm.velocity_kmh) FILTER (WHERE dm.velocity_kmh > 0) as avg_speed_kmh,
  COUNT(*) as observations,
  td.movement_pattern
FROM app.tracked_devices td
JOIN app.device_movements dm ON td.device_uuid = dm.device_uuid
WHERE dm.velocity_kmh > 10
GROUP BY td.device_uuid, td.bssid, td.ssid, td.device_type, td.device_manufacturer, td.movement_pattern
ORDER BY max_speed_kmh DESC
LIMIT 30;

-- 5. Detect anomalous patterns (devices that changed behavior)
WITH device_patterns AS (
  SELECT 
    device_uuid,
    DATE_TRUNC('day', observed_at) as day,
    COUNT(DISTINCT address) as daily_locations,
    AVG(velocity_kmh) FILTER (WHERE velocity_kmh > 0) as avg_velocity
  FROM app.device_movements
  GROUP BY device_uuid, DATE_TRUNC('day', observed_at)
)
SELECT 
  td.device_uuid,
  td.bssid,
  td.ssid,
  td.device_type,
  STDDEV(dp.daily_locations) as location_variance,
  STDDEV(dp.avg_velocity) as velocity_variance,
  AVG(dp.daily_locations) as avg_daily_locations
FROM app.tracked_devices td
JOIN device_patterns dp ON td.device_uuid = dp.device_uuid
GROUP BY td.device_uuid, td.bssid, td.ssid, td.device_type
HAVING STDDEV(dp.daily_locations) > 5 OR STDDEV(dp.avg_velocity) > 20
ORDER BY location_variance DESC
LIMIT 20;

-- 6. Timeline of device at specific location
SELECT 
  td.device_uuid,
  td.bssid,
  td.ssid,
  td.device_type,
  dm.observed_at,
  dm.address,
  dm.signal_strength,
  dm.velocity_kmh
FROM app.tracked_devices td
JOIN app.device_movements dm ON td.device_uuid = dm.device_uuid
WHERE dm.address LIKE '%Saginaw Street%'
ORDER BY dm.observed_at DESC
LIMIT 50;
