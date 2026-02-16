-- Add trilateration columns to locations_legacy
ALTER TABLE app.locations_legacy 
ADD COLUMN IF NOT EXISTS trilat_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS trilat_lon DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS trilat_confidence REAL,
ADD COLUMN IF NOT EXISTS trilat_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS trilat_address TEXT,
ADD COLUMN IF NOT EXISTS is_mobile_network BOOLEAN DEFAULT FALSE;

-- Create AP location summary table
CREATE TABLE IF NOT EXISTS app.ap_locations (
  bssid TEXT PRIMARY KEY,
  ssid TEXT,
  observation_count INTEGER,
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  centroid_lat DOUBLE PRECISION,
  centroid_lon DOUBLE PRECISION,
  max_distance_m REAL,
  is_mobile BOOLEAN,
  confidence_score REAL,
  trilat_address TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Populate AP locations with clustering
INSERT INTO app.ap_locations (
  bssid, ssid, observation_count, first_seen, last_seen,
  centroid_lat, centroid_lon, max_distance_m, is_mobile, confidence_score
)
SELECT 
  bssid,
  ssid,
  COUNT(*) as observation_count,
  MIN(TO_TIMESTAMP(time/1000)) as first_seen,
  MAX(TO_TIMESTAMP(time/1000)) as last_seen,
  AVG(lat) as centroid_lat,
  AVG(lon) as centroid_lon,
  ST_Distance(
    ST_MakePoint(MIN(lon), MIN(lat))::geography,
    ST_MakePoint(MAX(lon), MAX(lat))::geography
  ) as max_distance_m,
  CASE 
    WHEN ST_Distance(
      ST_MakePoint(MIN(lon), MIN(lat))::geography,
      ST_MakePoint(MAX(lon), MAX(lat))::geography
    ) > 100 THEN TRUE
    ELSE FALSE
  END as is_mobile,
  CASE 
    WHEN COUNT(*) < 3 THEN 0.1
    WHEN ST_Distance(
      ST_MakePoint(MIN(lon), MIN(lat))::geography,
      ST_MakePoint(MAX(lon), MAX(lat))::geography
    ) > 1000 THEN 0.2
    WHEN ST_Distance(
      ST_MakePoint(MIN(lon), MIN(lat))::geography,
      ST_MakePoint(MAX(lon), MAX(lat))::geography
    ) > 100 THEN 0.5
    ELSE 0.9
  END as confidence_score
FROM app.locations_legacy
WHERE lat IS NOT NULL AND lon IS NOT NULL
GROUP BY bssid, ssid
ON CONFLICT (bssid) DO UPDATE SET
  observation_count = EXCLUDED.observation_count,
  last_seen = EXCLUDED.last_seen,
  centroid_lat = EXCLUDED.centroid_lat,
  centroid_lon = EXCLUDED.centroid_lon,
  max_distance_m = EXCLUDED.max_distance_m,
  is_mobile = EXCLUDED.is_mobile,
  confidence_score = EXCLUDED.confidence_score,
  updated_at = NOW();

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_ap_locations_mobile ON app.ap_locations(is_mobile);
CREATE INDEX IF NOT EXISTS idx_ap_locations_confidence ON app.ap_locations(confidence_score);

-- Mark mobile networks in locations_legacy
UPDATE app.locations_legacy l
SET is_mobile_network = a.is_mobile
FROM app.ap_locations a
WHERE l.bssid = a.bssid;

-- Update trilateration coordinates for static APs
UPDATE app.locations_legacy l
SET 
  trilat_lat = a.centroid_lat,
  trilat_lon = a.centroid_lon,
  trilat_confidence = a.confidence_score,
  trilat_method = 'centroid'
FROM app.ap_locations a
WHERE l.bssid = a.bssid 
  AND a.is_mobile = FALSE 
  AND a.confidence_score > 0.5;

-- Summary
SELECT 
  COUNT(*) as total_aps,
  SUM(CASE WHEN is_mobile THEN 1 ELSE 0 END) as mobile_aps,
  SUM(CASE WHEN is_mobile = FALSE THEN 1 ELSE 0 END) as static_aps,
  AVG(observation_count) as avg_observations,
  AVG(CASE WHEN is_mobile = FALSE THEN confidence_score END) as avg_static_confidence
FROM app.ap_locations;
