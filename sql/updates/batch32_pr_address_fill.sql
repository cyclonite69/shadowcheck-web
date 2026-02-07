-- Batch 32: Fill missing addresses for PR resident agencies (non-FBI sources)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Aguadilla, PR
UPDATE app.agency_offices ao SET
  address_line1 = '36B Ave Jose De Diego',
  postal_code = '00603',
  phone = '(787) 890-1111',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/puerto-rico/federal-bureau-of-investigation-303096305',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 810
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Humacao, PR
UPDATE app.agency_offices ao SET
  address_line1 = 'SR 3 KM 82.5',
  postal_code = '00791',
  phone = '(787) 850-6300',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/puerto-rico/federal-bureau-of-investigation-331093317',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 811
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Ponce, PR
UPDATE app.agency_offices ao SET
  address_line1 = '3487 Blvd Miguel A Pou',
  address_line2 = 'Ste 212',
  postal_code = '00730',
  phone = '(787) 848-8833',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/puerto-rico/federal-bureau-of-investigation-303067391',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 812
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

