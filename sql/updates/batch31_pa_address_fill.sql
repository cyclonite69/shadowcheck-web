-- Batch 31: Fill missing addresses for PA resident agencies (non-FBI sources)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.
--
-- Note: Some PA resident agencies are named by region; city is updated to match the sourced mailing address.

BEGIN;

-- Laurel Highlands (Somerset, PA)
UPDATE app.agency_offices ao SET
  address_line1 = '145 N Center Ave',
  postal_code = '15501',
  phone = '(814) 443-1054',
  city = 'Somerset',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/pennsylvania/federal-bureau-of-investigation-265317006',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 758
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Mon Valley (Brownsville, PA)
UPDATE app.agency_offices ao SET
  address_line1 = '500 Market St',
  postal_code = '15417',
  phone = '(724) 785-2107',
  city = 'Brownsville',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/pennsylvania/federal-bureau-of-investigation-23755318',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 759
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- New Castle, PA
UPDATE app.agency_offices ao SET
  address_line1 = '820 W Washington St',
  postal_code = '16101',
  phone = '(724) 656-5111',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/pennsylvania/federal-bureau-of-investigation-272299049',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 760
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

