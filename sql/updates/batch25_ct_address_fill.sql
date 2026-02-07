-- Batch 25: Fill missing addresses for CT resident agencies (New Haven division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Bridgeport, CT
UPDATE app.agency_offices ao SET
  address_line1 = '915 Lafayette Blvd',
  postal_code = '06604',
  phone = '(203) 382-9321',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/connecticut/federal-bureau-of-investigation-268744584',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 704
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Meriden, CT
UPDATE app.agency_offices ao SET
  address_line1 = '147 N Broad St',
  postal_code = '06450',
  phone = '(203) 238-9001',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/connecticut/federal-bureau-of-investigation-365923412',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 705
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- New London, CT
UPDATE app.agency_offices ao SET
  address_line1 = '2 Union St',
  postal_code = '06320',
  phone = '(860) 442-4332',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/connecticut/federal-bureau-of-investigation-269188591',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 706
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

