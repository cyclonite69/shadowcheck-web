-- Example contextual intelligence queries

-- 1. Find all vehicles at a specific address (potential surveillance)
-- SELECT bssid, ssid, device_manufacturer, observation_count, trilat_address
-- FROM app.networks_legacy
-- WHERE context_type = 'mobile_vehicle' 
--   AND trilat_address LIKE '%Saginaw Street%'
-- ORDER BY observation_count DESC;

-- 2. Identify potential surveillance devices (hidden SSIDs near sensitive locations)
SELECT 
  bssid,
  device_type,
  trilat_address,
  observation_count,
  context_confidence
FROM app.networks_legacy
WHERE context_type = 'potential_surveillance'
  AND trilat_address ~* 'government|police|courthouse|city hall'
ORDER BY observation_count DESC
LIMIT 20;

-- 3. Map retail WiFi coverage by brand
SELECT 
  device_manufacturer,
  COUNT(*) as locations,
  COUNT(DISTINCT trilat_address) as unique_addresses
FROM app.networks_legacy
WHERE context_type = 'retail' AND device_manufacturer IS NOT NULL
GROUP BY device_manufacturer
ORDER BY locations DESC;

-- 4. Track public transit routes (mobile networks)
SELECT 
  ssid,
  COUNT(DISTINCT trilat_address) as stops,
  MIN(trilat_address) as first_seen_at,
  MAX(trilat_address) as last_seen_at
FROM app.networks_legacy
WHERE context_type = 'public_transit'
GROUP BY ssid
ORDER BY stops DESC;

-- 5. Residential IoT device density by neighborhood
SELECT 
  SUBSTRING(trilat_address FROM '([^,]+), ([^,]+)$') as city,
  device_type,
  COUNT(*) as device_count
FROM app.networks_legacy
WHERE context_type = 'residential_iot'
GROUP BY city, device_type
ORDER BY device_count DESC;

-- 6. High-value targets (expensive devices in specific areas)
SELECT 
  device_manufacturer,
  device_type,
  trilat_address,
  ssid,
  observation_count
FROM app.networks_legacy
WHERE device_manufacturer IN ('Apple', 'Tesla', 'Cadillac')
  AND context_type IN ('personal_mobile_device', 'mobile_vehicle', 'residential')
  AND trilat_address IS NOT NULL
ORDER BY observation_count DESC
LIMIT 50;
