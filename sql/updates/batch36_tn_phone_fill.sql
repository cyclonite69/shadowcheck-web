-- Batch 36: Fill missing phone for Nashville, TN entry (non-FBI source)
-- Rules:
-- - Only updates where phone is NULL/blank.
-- - Uses non-FBI source (MapQuest); marks source_status='unverified'.

BEGIN;

UPDATE app.agency_offices ao SET
  phone = '(615) 244-0322',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/tennessee/federal-bureau-of-investigation-299391390',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 852
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

