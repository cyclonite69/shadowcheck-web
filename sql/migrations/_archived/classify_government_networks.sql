-- Classify government networks based on SSID patterns
UPDATE app.networks_legacy
SET 
  venue_category = 'government',
  context_type = 'government_facility',
  venue_name = CASE
    -- State of Michigan
    WHEN ssid ~* 'SOM|state.*michigan' THEN 'State of Michigan Office'
    
    -- Federal Government
    WHEN ssid ~* 'FBI|CIA|NSA|DHS|TSA|ATF' THEN 'Federal Government Facility'
    WHEN ssid ~* 'federal|fed.*gov' THEN 'Federal Office'
    
    -- City/County Government
    WHEN ssid ~* 'city.*hall|county.*gov|municipal' THEN 'Municipal Government Office'
    WHEN ssid ~* 'flint.*city|genesee.*county' THEN 'Local Government Office'
    
    -- Courts
    WHEN ssid ~* 'court|judicial' THEN 'Courthouse'
    
    -- Police/Fire
    WHEN ssid ~* 'police|sheriff|law.*enforcement' THEN 'Law Enforcement Facility'
    WHEN ssid ~* 'fire.*dept|fire.*station' THEN 'Fire Station'
    
    -- DMV/Secretary of State
    WHEN ssid ~* 'DMV|secretary.*state|SOS.*guest' THEN 'Secretary of State Office'
    
    -- Libraries (public)
    WHEN ssid ~* 'library.*public|public.*library' THEN 'Public Library'
    
    ELSE venue_name
  END
WHERE (
  ssid ~* 'SOM|state.*michigan|federal|fed.*gov|city.*hall|county.*gov|municipal|court|judicial|police|sheriff|fire.*dept|DMV|secretary.*state|library.*public'
  OR trilat_address ~* 'city hall|courthouse|police|fire station|government'
)
AND venue_category != 'government';

-- Summary
SELECT 
  venue_name,
  COUNT(*) as count,
  ARRAY_AGG(DISTINCT ssid) FILTER (WHERE ssid IS NOT NULL) as example_ssids
FROM app.networks_legacy
WHERE venue_category = 'government'
GROUP BY venue_name
ORDER BY count DESC;
