-- Create behavioral profile view
CREATE MATERIALIZED VIEW IF NOT EXISTS app.device_behavioral_profiles AS
SELECT 
  td.device_uuid,
  td.bssid,
  td.ssid,
  td.device_type,
  td.device_manufacturer,
  td.context_type,
  td.movement_pattern,
  td.is_mobile,
  td.unique_locations,
  td.total_observations,
  td.first_seen,
  td.last_seen,
  td.last_seen - td.first_seen as tracking_duration,
  
  -- Movement statistics
  MAX(dm.velocity_kmh) as max_velocity_kmh,
  AVG(dm.velocity_kmh) FILTER (WHERE dm.velocity_kmh > 0) as avg_velocity_kmh,
  STDDEV(dm.velocity_kmh) FILTER (WHERE dm.velocity_kmh > 0) as velocity_stddev,
  
  -- Location patterns
  COUNT(DISTINCT DATE_TRUNC('day', dm.observed_at)) as active_days,
  COUNT(DISTINCT DATE_TRUNC('hour', dm.observed_at)) as active_hours,
  ARRAY_AGG(DISTINCT dm.address ORDER BY dm.address) FILTER (WHERE dm.address IS NOT NULL) as visited_addresses,
  
  -- Temporal patterns
  MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM dm.observed_at)) as most_active_hour,
  MODE() WITHIN GROUP (ORDER BY EXTRACT(DOW FROM dm.observed_at)) as most_active_day,
  
  -- Risk indicators
  COUNT(*) FILTER (WHERE dm.address ~* 'government|police|courthouse') as sensitive_location_visits,
  COUNT(*) FILTER (WHERE dm.velocity_kmh > 100) as high_speed_observations,
  BOOL_OR(td.ssid IS NULL OR td.ssid = '') as has_hidden_ssid,
  
  td.risk_score,
  NOW() as generated_at
FROM app.tracked_devices td
LEFT JOIN app.device_movements dm ON td.device_uuid = dm.device_uuid
GROUP BY 
  td.device_uuid, td.bssid, td.ssid, td.device_type, td.device_manufacturer,
  td.context_type, td.movement_pattern, td.is_mobile, td.unique_locations,
  td.total_observations, td.first_seen, td.last_seen, td.risk_score;

CREATE INDEX IF NOT EXISTS idx_behavioral_profiles_risk ON app.device_behavioral_profiles(risk_score);
CREATE INDEX IF NOT EXISTS idx_behavioral_profiles_type ON app.device_behavioral_profiles(device_type);

-- Create surveillance detection view
CREATE OR REPLACE VIEW app.potential_surveillance_devices AS
SELECT 
  dbp.*,
  CASE 
    WHEN dbp.has_hidden_ssid AND dbp.sensitive_location_visits > 0 THEN 'HIGH'
    WHEN dbp.device_type = 'iot_smart_home' AND dbp.is_mobile THEN 'HIGH'
    WHEN dbp.unique_locations > 20 AND dbp.has_hidden_ssid THEN 'MEDIUM'
    WHEN dbp.high_speed_observations > 5 AND dbp.device_type = 'unknown' THEN 'MEDIUM'
    ELSE 'LOW'
  END as threat_level,
  ARRAY[
    CASE WHEN dbp.has_hidden_ssid THEN 'Hidden SSID' END,
    CASE WHEN dbp.sensitive_location_visits > 0 THEN 'Sensitive Locations' END,
    CASE WHEN dbp.device_type = 'iot_smart_home' AND dbp.is_mobile THEN 'Mobile IoT' END,
    CASE WHEN dbp.high_speed_observations > 5 THEN 'High Speed' END,
    CASE WHEN dbp.unique_locations > 50 THEN 'Wide Coverage' END
  ] as threat_indicators
FROM app.device_behavioral_profiles dbp
WHERE 
  dbp.has_hidden_ssid 
  OR dbp.sensitive_location_visits > 0
  OR (dbp.device_type = 'iot_smart_home' AND dbp.is_mobile)
  OR dbp.high_speed_observations > 5
  OR dbp.unique_locations > 50;

-- Summary dashboard
SELECT 
  'Total Tracked Devices' as metric,
  COUNT(*)::text as value
FROM app.tracked_devices
UNION ALL
SELECT 
  'Mobile Devices',
  COUNT(*)::text
FROM app.tracked_devices WHERE is_mobile = TRUE
UNION ALL
SELECT 
  'Stationary Devices',
  COUNT(*)::text
FROM app.tracked_devices WHERE movement_pattern = 'stationary'
UNION ALL
SELECT 
  'City-Wide Trackers',
  COUNT(*)::text
FROM app.tracked_devices WHERE movement_pattern = 'city_wide'
UNION ALL
SELECT 
  'Potential Surveillance',
  COUNT(*)::text
FROM app.potential_surveillance_devices
UNION ALL
SELECT 
  'High Threat Devices',
  COUNT(*)::text
FROM app.potential_surveillance_devices WHERE threat_level = 'HIGH'
UNION ALL
SELECT 
  'Vehicles Tracked',
  COUNT(*)::text
FROM app.tracked_devices WHERE device_type = 'vehicle'
UNION ALL
SELECT 
  'Personal Devices',
  COUNT(*)::text
FROM app.tracked_devices WHERE device_type = 'smartphone';
