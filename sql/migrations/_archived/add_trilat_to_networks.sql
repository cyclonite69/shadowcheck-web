-- Add trilateration columns to networks_legacy
ALTER TABLE app.networks_legacy 
ADD COLUMN IF NOT EXISTS trilat_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS trilat_lon DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS trilat_confidence REAL,
ADD COLUMN IF NOT EXISTS trilat_address TEXT,
ADD COLUMN IF NOT EXISTS is_mobile_network BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS observation_count INTEGER;

-- Populate from ap_locations
UPDATE app.networks_legacy n
SET 
  trilat_lat = a.centroid_lat,
  trilat_lon = a.centroid_lon,
  trilat_confidence = a.confidence_score,
  trilat_address = a.trilat_address,
  is_mobile_network = a.is_mobile,
  observation_count = a.observation_count
FROM app.ap_locations a
WHERE n.bssid = a.bssid;

-- Summary
SELECT 
  COUNT(*) as total_networks,
  COUNT(trilat_lat) as with_trilat,
  COUNT(trilat_address) as with_address,
  SUM(CASE WHEN is_mobile_network THEN 1 ELSE 0 END) as mobile_networks
FROM app.networks_legacy;
