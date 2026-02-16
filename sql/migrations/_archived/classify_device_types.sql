-- Add device type columns
ALTER TABLE app.networks_legacy 
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_manufacturer VARCHAR(100);

ALTER TABLE app.ap_locations
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS device_manufacturer VARCHAR(100);

-- Classify device types based on SSID patterns
UPDATE app.networks_legacy
SET device_type = CASE
  -- Mobile Devices
  WHEN ssid ~* 'iphone|ipad|ipod' THEN 'smartphone'
  WHEN ssid ~* 'galaxy|samsung.*phone' THEN 'smartphone'
  WHEN ssid ~* 'pixel|android' THEN 'smartphone'
  WHEN ssid ~* 'oneplus|xiaomi|huawei.*phone' THEN 'smartphone'
  
  -- Vehicles
  WHEN ssid ~* 'tesla|ford|chevy|chevrolet|gmc|buick|cadillac|dodge|jeep|ram' THEN 'vehicle'
  WHEN ssid ~* 'silverado|tahoe|equinox|malibu|traverse|cruze|volt' THEN 'vehicle'
  WHEN ssid ~* 'f-150|mustang|explorer' THEN 'vehicle'
  
  -- Printers
  WHEN ssid ~* 'hp.*print|canon.*print|epson|brother.*print' THEN 'printer'
  WHEN ssid ~* 'direct-.*-hp|direct-.*-canon' THEN 'printer'
  
  -- Smart Home / IoT
  WHEN ssid ~* 'ring-|nest-|ecobee|hue-|wemo' THEN 'iot_smart_home'
  WHEN ssid ~* 'alexa|echo-|google.*home' THEN 'smart_speaker'
  WHEN ssid ~* 'thermostat|doorbell|camera' THEN 'iot_smart_home'
  
  -- Audio Devices
  WHEN ssid ~* 'airpods|beats|bose|jbl|sony.*headphone|soundlink' THEN 'audio_device'
  WHEN ssid ~* 'speaker|soundbar' THEN 'audio_device'
  
  -- Streaming Devices
  WHEN ssid ~* 'chromecast|roku|firetv|appletv' THEN 'streaming_device'
  
  -- Computers
  WHEN ssid ~* 'desktop-|laptop-|macbook|thinkpad' THEN 'computer'
  WHEN ssid ~* '^[A-Z0-9]{8,15}$' AND type = 'BT' THEN 'computer'
  
  -- Gaming
  WHEN ssid ~* 'playstation|ps[345]|xbox|nintendo|switch' THEN 'gaming_console'
  
  -- Wearables
  WHEN ssid ~* 'watch|fitbit|garmin' THEN 'wearable'
  
  -- Network Infrastructure
  WHEN ssid ~* 'xfinity|att.*wifi|verizon.*wifi|tmobile|spectrum' THEN 'isp_hotspot'
  WHEN ssid ~* 'netgear|linksys|asus.*router|tplink' THEN 'router'
  
  -- Default based on type
  WHEN type = 'BT' OR type = 'BLE' THEN 'bluetooth_device'
  WHEN type = 'WIFI' THEN 'wifi_access_point'
  
  ELSE 'unknown'
END,
device_manufacturer = CASE
  -- Apple
  WHEN ssid ~* 'iphone|ipad|ipod|airpods|macbook|appletv' THEN 'Apple'
  WHEN bssid ~* '^(AC:DE:48|F0:18:98|A4:83:E7|00:25:00|00:26:BB)' THEN 'Apple'
  
  -- Samsung
  WHEN ssid ~* 'galaxy|samsung' THEN 'Samsung'
  WHEN bssid ~* '^(E8:50:8B|34:C3:AC|00:12:FB)' THEN 'Samsung'
  
  -- Google
  WHEN ssid ~* 'pixel|chromecast|google.*home' THEN 'Google'
  
  -- Amazon
  WHEN ssid ~* 'echo|alexa|firetv|kindle' THEN 'Amazon'
  
  -- Vehicle Manufacturers
  WHEN ssid ~* 'tesla' THEN 'Tesla'
  WHEN ssid ~* 'ford|f-150|mustang' THEN 'Ford'
  WHEN ssid ~* 'chevy|chevrolet|silverado|tahoe|equinox|malibu|traverse|cruze|volt' THEN 'Chevrolet'
  WHEN ssid ~* 'gmc' THEN 'GMC'
  WHEN ssid ~* 'buick' THEN 'Buick'
  WHEN ssid ~* 'cadillac' THEN 'Cadillac'
  WHEN ssid ~* 'dodge|jeep|ram' THEN 'Stellantis'
  
  -- Audio
  WHEN ssid ~* 'bose' THEN 'Bose'
  WHEN ssid ~* 'jbl' THEN 'JBL'
  WHEN ssid ~* 'sony' THEN 'Sony'
  WHEN ssid ~* 'beats' THEN 'Beats'
  
  -- Printers
  WHEN ssid ~* 'hp.*print|direct-.*-hp' THEN 'HP'
  WHEN ssid ~* 'canon' THEN 'Canon'
  WHEN ssid ~* 'epson' THEN 'Epson'
  WHEN ssid ~* 'brother' THEN 'Brother'
  
  -- Smart Home
  WHEN ssid ~* 'ring-' THEN 'Ring'
  WHEN ssid ~* 'nest-' THEN 'Google Nest'
  
  -- ISPs
  WHEN ssid ~* 'xfinity' THEN 'Comcast'
  WHEN ssid ~* 'att.*wifi' THEN 'AT&T'
  WHEN ssid ~* 'verizon' THEN 'Verizon'
  WHEN ssid ~* 'tmobile|t-mobile' THEN 'T-Mobile'
  WHEN ssid ~* 'spectrum' THEN 'Charter'
  
  ELSE NULL
END
WHERE device_type IS NULL;

-- Sync to ap_locations
UPDATE app.ap_locations a
SET 
  device_type = n.device_type,
  device_manufacturer = n.device_manufacturer
FROM app.networks_legacy n
WHERE a.bssid = n.bssid
  AND n.device_type IS NOT NULL;

-- Summary statistics
SELECT 
  device_type,
  COUNT(*) as count,
  COUNT(DISTINCT device_manufacturer) as manufacturers,
  ARRAY_AGG(DISTINCT device_manufacturer) FILTER (WHERE device_manufacturer IS NOT NULL) as brands
FROM app.networks_legacy
WHERE device_type != 'unknown'
GROUP BY device_type
ORDER BY count DESC
LIMIT 20;
