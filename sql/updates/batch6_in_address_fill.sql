-- Batch 6: Fill missing addresses for IN resident agencies (Indianapolis division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Bloomington, IN
UPDATE app.agency_offices ao SET
  address_line1 = '924 W 17th St',
  address_line2 = 'Ste A',
  postal_code = '47404',
  phone = '(812) 332-9275',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-273573052',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 593
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Evansville, IN
UPDATE app.agency_offices ao SET
  address_line1 = '101 NW Martin Luther King Jr Blvd',
  address_line2 = 'Ste B',
  postal_code = '47708',
  phone = '(812) 423-4486',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-350609278',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 594
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Fort Wayne, IN
UPDATE app.agency_offices ao SET
  address_line1 = '200 E Main St',
  address_line2 = 'Ste 1010',
  postal_code = '46802',
  phone = '(260) 426-5331',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-352115808',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 595
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Lafayette, IN
UPDATE app.agency_offices ao SET
  address_line1 = '232 N 4th St',
  address_line2 = 'Ste 211',
  postal_code = '47901',
  phone = '(765) 423-5619',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-273549703',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 596
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Muncie, IN
UPDATE app.agency_offices ao SET
  address_line1 = '400 N High St',
  address_line2 = 'Ste 305',
  postal_code = '47305',
  phone = '(765) 282-1905',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-350894751',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 598
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- New Albany, IN
UPDATE app.agency_offices ao SET
  address_line1 = '121 W Spring St',
  postal_code = '47150',
  phone = '(812) 948-8002',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-277548780',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 599
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- South Bend, IN
UPDATE app.agency_offices ao SET
  address_line1 = '100 E Wayne St',
  address_line2 = 'Ste 310',
  postal_code = '46601',
  phone = '(574) 233-4488',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-274877566',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 600
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Terre Haute, IN
UPDATE app.agency_offices ao SET
  address_line1 = '30 N 7th St',
  address_line2 = 'Rm 202',
  postal_code = '47807',
  phone = '(812) 232-0993',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/indiana/federal-bureau-of-investigation-429285533',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 601
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

