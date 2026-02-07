-- Batch 17: Fill missing addresses for WI resident agencies (Milwaukee division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources; marks source_status='unverified'.

BEGIN;

-- Eau Claire, WI
UPDATE app.agency_offices ao SET
  address_line1 = '1710 Brackett Ave',
  address_line2 = 'Ste 211',
  postal_code = '54701',
  phone = '(715) 834-9010',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/eau-claire-wi-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 663
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Green Bay, WI
UPDATE app.agency_offices ao SET
  address_line1 = '2918 Walker Ct',
  postal_code = '54311',
  phone = '(920) 435-3141',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/green-bay-wi-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 664
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- La Crosse, WI
UPDATE app.agency_offices ao SET
  address_line1 = '222 3rd St N',
  postal_code = '54601',
  phone = '(608) 784-0601',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/la-crosse-wi-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 665
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Madison, WI
UPDATE app.agency_offices ao SET
  address_line1 = '5950 Research Park Blvd',
  postal_code = '53719',
  phone = '(608) 273-1220',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/madison-wi-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 666
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Wausau, WI
UPDATE app.agency_offices ao SET
  address_line1 = '2105 Stewart Ave',
  postal_code = '54401',
  phone = '(715) 845-2785',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/wausau-wi-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 667
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

