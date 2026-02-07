-- Batch 9: Fill missing addresses for MT resident agencies (Billings division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank (except Great Falls: phone-only).
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Bozeman, MT
UPDATE app.agency_offices ao SET
  address_line1 = '10 E Babcock St',
  address_line2 = 'Ste 10',
  postal_code = '59715',
  phone = '(406) 522-1871',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-269209458',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 485
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Glasgow, MT
UPDATE app.agency_offices ao SET
  address_line1 = '126 5th St S',
  address_line2 = 'Ste 302',
  postal_code = '59230',
  phone = '(406) 228-9660',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-350948099',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 486
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Great Falls, MT (phone-only)
UPDATE app.agency_offices ao SET
  phone = '(406) 771-5300',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-267425476',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 487
  AND (NULLIF(BTRIM(ao.phone), '') IS NULL);

-- Helena, MT
UPDATE app.agency_offices ao SET
  address_line1 = '1200 N Last Chance Gulch',
  postal_code = '59601',
  phone = '(406) 441-5110',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-398030245',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 488
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Kalispell, MT
UPDATE app.agency_offices ao SET
  address_line1 = '600 S Main St',
  address_line2 = 'Ste 3',
  postal_code = '59901',
  phone = '(406) 758-7400',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-350881678',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 489
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Missoula, MT
UPDATE app.agency_offices ao SET
  address_line1 = '200 W Broadway St',
  address_line2 = 'Rm 228',
  postal_code = '59802',
  phone = '(406) 329-7000',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-302033722',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 490
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Shelby, MT
UPDATE app.agency_offices ao SET
  address_line1 = '401 1st St S',
  postal_code = '59474',
  phone = '(406) 434-5624',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-267425210',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 491
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Havre, MT (record currently labeled "Top Havre")
UPDATE app.agency_offices ao SET
  address_line1 = '205 3rd Ave',
  address_line2 = 'Ste 201',
  city = CASE WHEN ao.city = 'Top Havre' THEN 'Havre' ELSE ao.city END,
  postal_code = '59501',
  phone = '(406) 265-7100',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/montana/federal-bureau-of-investigation-21873898',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 492
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

