-- Extract potential business names from SSIDs
UPDATE app.networks_legacy
SET venue_name = CASE
  -- Common business patterns
  WHEN ssid ~* 'starbucks|sbux' THEN 'Starbucks'
  WHEN ssid ~* 'mcdonalds|mcd' THEN 'McDonalds'
  WHEN ssid ~* 'walmart' THEN 'Walmart'
  WHEN ssid ~* 'target' THEN 'Target'
  WHEN ssid ~* 'hotel|inn|motel' THEN REGEXP_REPLACE(ssid, '[_-]', ' ', 'g')
  WHEN ssid ~* 'restaurant|cafe|coffee|pizza|burger' THEN REGEXP_REPLACE(ssid, '[_-]', ' ', 'g')
  WHEN ssid ~* 'hospital|clinic|medical' THEN REGEXP_REPLACE(ssid, '[_-]', ' ', 'g')
  WHEN ssid ~* 'library|museum|theater' THEN REGEXP_REPLACE(ssid, '[_-]', ' ', 'g')
  WHEN ssid ~* 'airport|station' THEN REGEXP_REPLACE(ssid, '[_-]', ' ', 'g')
  -- Generic business indicators (Guest, Public, etc)
  WHEN ssid ~* '^[A-Z][a-z]+\s*(Guest|Public|WiFi|Free)$' THEN SPLIT_PART(ssid, ' ', 1)
  ELSE NULL
END,
venue_category = CASE
  WHEN ssid ~* 'starbucks|coffee|cafe' THEN 'cafe'
  WHEN ssid ~* 'mcdonalds|burger|pizza|restaurant' THEN 'restaurant'
  WHEN ssid ~* 'walmart|target' THEN 'retail'
  WHEN ssid ~* 'hotel|inn|motel' THEN 'lodging'
  WHEN ssid ~* 'hospital|clinic|medical' THEN 'healthcare'
  WHEN ssid ~* 'library|museum' THEN 'cultural'
  WHEN ssid ~* 'airport|station' THEN 'transportation'
  ELSE NULL
END
WHERE venue_name IS NULL 
  AND ssid IS NOT NULL
  AND is_mobile_network = FALSE;

-- Summary
SELECT 
  venue_category,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT venue_name) FILTER (WHERE venue_name IS NOT NULL) as examples
FROM app.networks_legacy
WHERE venue_name IS NOT NULL
GROUP BY venue_category
ORDER BY count DESC;
