-- Remove duplicate observations (keep only one per BSSID/time/location)
-- This removes the suspicious batch import duplicates

BEGIN;

-- Create temp table with unique observations to keep
CREATE TEMP TABLE observations_to_keep AS
SELECT DISTINCT ON (bssid, time, lat, lon, accuracy)
  unified_id
FROM app.locations_legacy
WHERE lat IS NOT NULL 
  AND lon IS NOT NULL
ORDER BY bssid, time, lat, lon, accuracy, unified_id;

-- Count duplicates before deletion
SELECT 
  COUNT(*) as total_observations,
  COUNT(DISTINCT (bssid, time, lat, lon, accuracy)) as unique_observations,
  COUNT(*) - COUNT(DISTINCT (bssid, time, lat, lon, accuracy)) as duplicates_to_remove
FROM app.locations_legacy
WHERE lat IS NOT NULL AND lon IS NOT NULL;

-- Delete duplicates (keep only the ones in our temp table)
DELETE FROM app.locations_legacy
WHERE unified_id NOT IN (SELECT unified_id FROM observations_to_keep)
  AND lat IS NOT NULL 
  AND lon IS NOT NULL;

-- Show results
SELECT 
  COUNT(*) as remaining_observations
FROM app.locations_legacy
WHERE lat IS NOT NULL AND lon IS NOT NULL;

COMMIT;

-- Vacuum to reclaim space
VACUUM ANALYZE app.locations_legacy;
