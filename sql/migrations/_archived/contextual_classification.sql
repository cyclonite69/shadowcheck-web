-- Add contextual classification columns
ALTER TABLE app.networks_legacy 
ADD COLUMN IF NOT EXISTS context_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS context_confidence REAL;

-- Contextual classification using address + SSID + device type + patterns
UPDATE app.networks_legacy
SET 
  context_type = CASE
    -- Hospitals/Medical (address + SSID patterns)
    WHEN trilat_address ~* 'hospital|medical center|clinic|health' 
         AND (ssid ~* 'patient|visitor|staff|medical|EMR|clinic' OR device_type = 'iot_smart_home')
    THEN 'healthcare_facility'
    
    -- Schools/Universities (address + SSID)
    WHEN trilat_address ~* 'school|university|college|education|academy'
         AND (ssid ~* 'student|faculty|library|lab|classroom' OR ssid ~* 'eduroam|campus')
    THEN 'educational_institution'
    
    -- Government Buildings (address + SSID)
    WHEN trilat_address ~* 'city hall|courthouse|police|fire station|government|municipal'
         AND (ssid ~* 'gov|public|city|county|state|police|fire|dept')
    THEN 'government_facility'
    
    -- Hotels (address + device patterns)
    WHEN trilat_address ~* 'hotel|inn|motel|resort|lodge'
         OR (venue_name ~* 'hotel|inn|motel' AND observation_count > 10)
    THEN 'lodging'
    
    -- Restaurants/Cafes (address + SSID)
    WHEN trilat_address ~* 'restaurant|cafe|coffee|diner|grill|pizza|burger'
         OR venue_category = 'restaurant' OR venue_category = 'cafe'
    THEN 'food_service'
    
    -- Retail Stores (address + SSID)
    WHEN trilat_address ~* 'mall|plaza|shopping|store|market|retail'
         OR (ssid ~* 'guest|customer|store|shop' AND trilat_address ~* 'street|avenue|road')
    THEN 'retail'
    
    -- Transportation Hubs (address + device type)
    WHEN trilat_address ~* 'airport|station|terminal|transit|depot'
         OR (ssid ~* 'airport|station|transit|bus|train' AND device_type != 'vehicle')
    THEN 'transportation_hub'
    
    -- Vehicles in Motion (mobile + vehicle type)
    WHEN is_mobile_network = TRUE AND device_type = 'vehicle'
    THEN 'mobile_vehicle'
    
    -- Public Transit (address pattern + SSID)
    WHEN ssid ~* 'bus|transit|mta|smartbus|metro' AND is_mobile_network = TRUE
    THEN 'public_transit'
    
    -- Residential (address + personal SSID patterns)
    WHEN trilat_address ~* 'street|avenue|drive|court|lane|road|way'
         AND trilat_address !~* 'mall|plaza|center|building|suite'
         AND (ssid ~* '^[A-Z][a-z]+wifi$|^[A-Z][a-z]+s?$' OR ssid ~* 'home|house|family')
         AND device_type IN ('router', 'wifi_access_point', 'unknown')
    THEN 'residential'
    
    -- Office Buildings (address + SSID patterns)
    WHEN trilat_address ~* 'suite|floor|building|tower|plaza|center'
         AND (ssid ~* 'corp|inc|llc|office|employee|staff|internal|secure')
    THEN 'commercial_office'
    
    -- Personal Mobile Devices (smartphone + personal names)
    WHEN device_type = 'smartphone' 
         AND (ssid ~* '^[A-Z][a-z]+''?s? (iPhone|Galaxy|Phone)' OR ssid ~* '^iPhone|^Galaxy')
    THEN 'personal_mobile_device'
    
    -- IoT/Smart Home in Residence
    WHEN device_type IN ('iot_smart_home', 'smart_speaker', 'streaming_device')
         AND trilat_address ~* 'street|avenue|drive|court'
         AND is_mobile_network = FALSE
    THEN 'residential_iot'
    
    -- Surveillance/Security Devices (hidden + IoT)
    WHEN (ssid IS NULL OR ssid = '') 
         AND device_type = 'iot_smart_home'
         AND observation_count < 5
    THEN 'potential_surveillance'
    
    -- Public WiFi Hotspots
    WHEN ssid ~* 'free|public|guest|open|wifi'
         AND device_type = 'isp_hotspot'
    THEN 'public_hotspot'
    
    ELSE NULL
  END,
  context_confidence = CASE
    -- High confidence: multiple matching signals
    WHEN (trilat_address IS NOT NULL AND venue_name IS NOT NULL AND device_type IS NOT NULL) THEN 0.9
    WHEN (trilat_address IS NOT NULL AND device_type IS NOT NULL) THEN 0.7
    WHEN (venue_name IS NOT NULL AND device_type IS NOT NULL) THEN 0.6
    WHEN trilat_address IS NOT NULL THEN 0.5
    WHEN device_type IS NOT NULL THEN 0.4
    ELSE 0.1
  END
WHERE context_type IS NULL;

-- Create materialized view for contextual insights
CREATE MATERIALIZED VIEW IF NOT EXISTS app.contextual_network_insights AS
SELECT 
  context_type,
  device_type,
  device_manufacturer,
  COUNT(*) as network_count,
  COUNT(DISTINCT SUBSTRING(trilat_address FROM '([^,]+), ([^,]+)$')) as unique_cities,
  AVG(observation_count) as avg_observations,
  AVG(context_confidence) as avg_confidence,
  ARRAY_AGG(DISTINCT venue_category) FILTER (WHERE venue_category IS NOT NULL) as venue_categories,
  ARRAY_AGG(DISTINCT device_manufacturer) FILTER (WHERE device_manufacturer IS NOT NULL) as manufacturers
FROM app.networks_legacy
WHERE context_type IS NOT NULL
GROUP BY context_type, device_type, device_manufacturer
ORDER BY network_count DESC;

-- Sync to ap_locations
UPDATE app.ap_locations a
SET context_type = n.context_type
FROM app.networks_legacy n
WHERE a.bssid = n.bssid AND n.context_type IS NOT NULL;

-- Summary by context type
SELECT 
  context_type,
  COUNT(*) as count,
  ROUND(AVG(context_confidence)::numeric, 2) as avg_confidence,
  COUNT(DISTINCT device_type) as device_types,
  ARRAY_AGG(DISTINCT device_type ORDER BY device_type) FILTER (WHERE device_type IS NOT NULL) as devices
FROM app.networks_legacy
WHERE context_type IS NOT NULL
GROUP BY context_type
ORDER BY count DESC;
