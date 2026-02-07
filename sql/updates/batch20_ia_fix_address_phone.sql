-- Batch 20: IA resident agencies - fix non-deliverable addresses (Omaha division)
-- Notes:
-- - Cedar Rapids + Des Moines addresses were not validating in Smarty; update to deliverable street addresses.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.
-- - Preserves existing official link by copying prior source_url into website when website is blank.

BEGIN;

-- Cedar Rapids, IA
UPDATE app.agency_offices ao SET
  address_line1 = '111 7th Ave SE',
  address_line2 = 'Ste 1600',
  city = 'Cedar Rapids',
  postal_code = '52401',
  phone = COALESCE(NULLIF(BTRIM(ao.phone), ''), '(319) 363-5900'),
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/iowa/federal-bureau-investigation-338567105',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 731
  AND (ao.address_line1 = '116 27th Ave SW' OR ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Des Moines, IA
UPDATE app.agency_offices ao SET
  address_line1 = '1000 Walnut St',
  address_line2 = 'Ste 2601',
  city = 'Des Moines',
  postal_code = '50309',
  phone = COALESCE(NULLIF(BTRIM(ao.phone), ''), '(515) 223-1400'),
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/iowa/federal-bureau-investigation-425559594',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 732
  AND (ao.address_line1 = '1201 Walnut' OR ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

