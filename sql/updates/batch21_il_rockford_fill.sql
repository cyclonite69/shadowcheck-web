-- Batch 21: Fill missing address/phone for IL resident agency Rockford (Chicago division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI source (MapQuest); marks source_status='unverified'.

BEGIN;

-- Rockford, IL (listed in Machesney Park, IL)
UPDATE app.agency_offices ao SET
  address_line1 = '9024 N 2nd St',
  city = 'Machesney Park',
  postal_code = '61115',
  phone = '(815) 398-3341',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/illinois/federal-bureau-of-investigation-350880479',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 525
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

