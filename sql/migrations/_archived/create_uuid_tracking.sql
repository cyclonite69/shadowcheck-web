-- Create device tracking table with UUIDs
CREATE TABLE IF NOT EXISTS app.tracked_devices (
  device_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bssid TEXT UNIQUE NOT NULL,
  ssid TEXT,
  device_type VARCHAR(50),
  device_manufacturer VARCHAR(100),
  context_type VARCHAR(100),
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  total_observations INTEGER,
  unique_locations INTEGER,
  is_mobile BOOLEAN,
  movement_pattern TEXT,
  risk_score REAL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Populate from networks_legacy
INSERT INTO app.tracked_devices (
  bssid, ssid, device_type, device_manufacturer, context_type,
  first_seen, last_seen, total_observations, is_mobile
)
SELECT 
  bssid,
  ssid,
  device_type,
  device_manufacturer,
  context_type,
  first_seen,
  last_seen,
  observation_count,
  is_mobile_network
FROM app.networks_legacy
ON CONFLICT (bssid) DO UPDATE SET
  ssid = EXCLUDED.ssid,
  device_type = EXCLUDED.device_type,
  device_manufacturer = EXCLUDED.device_manufacturer,
  context_type = EXCLUDED.context_type,
  last_seen = EXCLUDED.last_seen,
  total_observations = EXCLUDED.total_observations,
  updated_at = NOW();

-- Create movement tracking table
CREATE TABLE IF NOT EXISTS app.device_movements (
  id BIGSERIAL PRIMARY KEY,
  device_uuid UUID REFERENCES app.tracked_devices(device_uuid),
  bssid TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  address TEXT,
  signal_strength INTEGER,
  observed_at TIMESTAMP,
  dwell_time_seconds INTEGER,
  distance_from_previous_m REAL,
  velocity_kmh REAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_movements_uuid ON app.device_movements(device_uuid);
CREATE INDEX IF NOT EXISTS idx_device_movements_time ON app.device_movements(observed_at);
CREATE INDEX IF NOT EXISTS idx_tracked_devices_type ON app.tracked_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_tracked_devices_mobile ON app.tracked_devices(is_mobile);

-- Populate movements from locations_legacy
INSERT INTO app.device_movements (device_uuid, bssid, lat, lon, address, signal_strength, observed_at)
SELECT 
  td.device_uuid,
  ll.bssid,
  ll.lat,
  ll.lon,
  ll.geocoded_address,
  ll.level,
  TO_TIMESTAMP(ll.time / 1000)
FROM app.locations_legacy ll
JOIN app.tracked_devices td ON ll.bssid = td.bssid
WHERE ll.lat IS NOT NULL AND ll.lon IS NOT NULL
ON CONFLICT DO NOTHING;

-- Calculate movement statistics
WITH movement_stats AS (
  SELECT 
    device_uuid,
    COUNT(DISTINCT address) as unique_locations,
    COUNT(*) as total_observations,
    MAX(observed_at) - MIN(observed_at) as time_span,
    ST_Distance(
      ST_MakePoint(MIN(lon), MIN(lat))::geography,
      ST_MakePoint(MAX(lon), MAX(lat))::geography
    ) as max_distance_m
  FROM app.device_movements
  GROUP BY device_uuid
)
UPDATE app.tracked_devices td
SET 
  unique_locations = ms.unique_locations,
  total_observations = ms.total_observations,
  movement_pattern = CASE
    WHEN ms.max_distance_m < 50 THEN 'stationary'
    WHEN ms.max_distance_m < 500 THEN 'local'
    WHEN ms.max_distance_m < 5000 THEN 'neighborhood'
    WHEN ms.max_distance_m < 50000 THEN 'city_wide'
    ELSE 'regional'
  END
FROM movement_stats ms
WHERE td.device_uuid = ms.device_uuid;

-- Calculate velocity and distance between observations
WITH ordered_movements AS (
  SELECT 
    id,
    device_uuid,
    lat,
    lon,
    observed_at,
    LAG(lat) OVER (PARTITION BY device_uuid ORDER BY observed_at) as prev_lat,
    LAG(lon) OVER (PARTITION BY device_uuid ORDER BY observed_at) as prev_lon,
    LAG(observed_at) OVER (PARTITION BY device_uuid ORDER BY observed_at) as prev_time
  FROM app.device_movements
)
UPDATE app.device_movements dm
SET 
  distance_from_previous_m = ST_Distance(
    ST_MakePoint(om.lon, om.lat)::geography,
    ST_MakePoint(om.prev_lon, om.prev_lat)::geography
  ),
  velocity_kmh = CASE 
    WHEN EXTRACT(EPOCH FROM (om.observed_at - om.prev_time)) > 0 THEN
      (ST_Distance(
        ST_MakePoint(om.lon, om.lat)::geography,
        ST_MakePoint(om.prev_lon, om.prev_lat)::geography
      ) / 1000.0) / (EXTRACT(EPOCH FROM (om.observed_at - om.prev_time)) / 3600.0)
    ELSE NULL
  END
FROM ordered_movements om
WHERE dm.id = om.id AND om.prev_lat IS NOT NULL;

-- Calculate risk scores
UPDATE app.tracked_devices
SET risk_score = (
  CASE WHEN device_type = 'potential_surveillance' THEN 0.8 ELSE 0.0 END +
  CASE WHEN movement_pattern = 'city_wide' AND device_type = 'vehicle' THEN 0.3 ELSE 0.0 END +
  CASE WHEN unique_locations > 50 AND is_mobile = TRUE THEN 0.4 ELSE 0.0 END +
  CASE WHEN ssid IS NULL OR ssid = '' THEN 0.3 ELSE 0.0 END +
  CASE WHEN device_type IN ('iot_smart_home', 'audio_device') AND is_mobile = TRUE THEN 0.5 ELSE 0.0 END
) / 5.0;

-- Summary statistics
SELECT 
  'Total tracked devices' as metric,
  COUNT(*)::text as value
FROM app.tracked_devices
UNION ALL
SELECT 
  'Total movement records',
  COUNT(*)::text
FROM app.device_movements
UNION ALL
SELECT 
  'Mobile devices',
  COUNT(*)::text
FROM app.tracked_devices WHERE is_mobile = TRUE
UNION ALL
SELECT 
  'High risk devices',
  COUNT(*)::text
FROM app.tracked_devices WHERE risk_score > 0.5;
