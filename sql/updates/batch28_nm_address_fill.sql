-- Batch 28: Fill missing addresses for NM resident agencies (non-FBI sources)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Farmington, NM
UPDATE app.agency_offices ao SET
  address_line1 = '650 W Main St',
  address_line2 = 'Bldg A',
  postal_code = '87401',
  phone = '(505) 326-5584',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-mexico/federal-bureau-of-investigation-284152890',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 453
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Gallup, NM
UPDATE app.agency_offices ao SET
  address_line1 = '208 W Coal Ave',
  postal_code = '87301',
  phone = '(505) 726-6000',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-mexico/federal-bureau-of-investigation-359432135',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 454
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Roswell, NM
UPDATE app.agency_offices ao SET
  address_line1 = '400 N Pennsylvania Ave',
  address_line2 = 'Ste 1260',
  postal_code = '88201',
  phone = '(575) 622-6001',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-mexico/federal-bureau-of-investigation-347083329',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 456
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

