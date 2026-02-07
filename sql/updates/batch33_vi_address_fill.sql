-- Batch 33: Fill missing addresses for VI resident agencies (non-FBI sources)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- St. Croix (Christiansted, VI)
UPDATE app.agency_offices ao SET
  address_line1 = '5500 Estate Golden Rock',
  postal_code = '00820',
  phone = '(340) 778-5900',
  city = 'Christiansted',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/virgin-islands/federal-bureau-of-investigation-414480712',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 813
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- St. Thomas, VI
UPDATE app.agency_offices ao SET
  address_line1 = '9601 Estate Thomas',
  postal_code = '00802',
  phone = '(340) 776-3560',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/virgin-islands/federal-bureau-of-investigation-303067390',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 814
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

