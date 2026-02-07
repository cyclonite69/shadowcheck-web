-- Batch 11: Fill missing addresses for LA resident agencies (New Orleans division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources; marks source_status='unverified'.

BEGIN;

-- Alexandria, LA
UPDATE app.agency_offices ao SET
  address_line1 = '300 Jackson St',
  postal_code = '71301',
  phone = '(318) 443-5097',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/la-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 709
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Baton Rouge, LA
UPDATE app.agency_offices ao SET
  address_line1 = '9100 Bluebonnet Centre Blvd',
  postal_code = '70809',
  phone = '(225) 291-5159',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/baton-rouge-la-fbi-office-258642/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 710
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Lafayette, LA
UPDATE app.agency_offices ao SET
  address_line1 = '102 Versailles Blvd',
  postal_code = '70501',
  phone = '(337) 233-2164',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/la-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 711
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Lake Charles, LA
UPDATE app.agency_offices ao SET
  address_line1 = '1 Lakeshore Dr',
  postal_code = '70629',
  phone = '(337) 433-6353',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/calcasieu-parish-county-la-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 712
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Monroe, LA
UPDATE app.agency_offices ao SET
  address_line1 = '300 Washington St',
  postal_code = '71201',
  phone = '(318) 387-0773',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/monroe-la-fbi-office-718181/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 713
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Shreveport, LA
UPDATE app.agency_offices ao SET
  address_line1 = '920 Pierremont Rd',
  postal_code = '71106',
  phone = '(318) 861-1890',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/shreveport-la-fbi-office-718283/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 714
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

