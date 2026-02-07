-- Batch 3: Fill missing addresses for MI resident agencies (Detroit division)
-- Rules:
-- - Only updates rows where address_line1 is NULL/blank (except Traverse City: phone-only).
-- - Preserves prior source_url by copying it into website when website is blank.
-- - Uses non-FBI public sources; marks source_status='unverified'.

BEGIN;

-- Bay City, MI
UPDATE app.agency_offices ao SET
  address_line1 = '122 Uptown Dr',
  address_line2 = 'Unit 201',
  postal_code = '48708',
  phone = '(989) 892-6525',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-353266616',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 575
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Grand Rapids, MI
UPDATE app.agency_offices ao SET
  address_line1 = '330 Ionia Ave NW',
  address_line2 = 'Ste 301',
  postal_code = '49503',
  phone = '(616) 458-1111',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-275468638',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 577
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Kalamazoo RA listing is in Portage, MI (physical address city)
UPDATE app.agency_offices ao SET
  address_line1 = '950 Trade Centre Way',
  address_line2 = 'Ste 215',
  city = CASE WHEN ao.city = 'Kalamazoo' THEN 'Portage' ELSE ao.city END,
  postal_code = '49002',
  phone = '(269) 349-9607',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-352703090',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 578
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Lansing RA listing is in East Lansing, MI (physical address city)
UPDATE app.agency_offices ao SET
  address_line1 = '2911 Eyde Pkwy',
  city = CASE WHEN ao.city = 'Lansing' THEN 'East Lansing' ELSE ao.city END,
  postal_code = '48823',
  phone = '(517) 336-8367',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/east-lansing-mi/mip/federal-bureau-of-investigation-476491295',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 579
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Macomb County RA listing is in Clinton Township, MI (physical address city)
UPDATE app.agency_offices ao SET
  address_line1 = '43965 Groesbeck Hwy',
  city = CASE WHEN ao.city = 'Macomb' THEN 'Clinton Township' ELSE ao.city END,
  postal_code = '48036',
  phone = '(586) 466-8882',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-326155190',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 580
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Marquette, MI
UPDATE app.agency_offices ao SET
  address_line1 = '1901 W Ridge St',
  address_line2 = 'Ste 2',
  postal_code = '49855',
  phone = '(906) 226-2058',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-353325938',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 581
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Oakland County RA listing is in Troy, MI (physical address city)
UPDATE app.agency_offices ao SET
  address_line1 = '4700 Investment Dr',
  city = CASE WHEN ao.city = 'Oakland' THEN 'Troy' ELSE ao.city END,
  postal_code = '48098',
  phone = '(248) 879-6090',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-326175991',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 582
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- St. Joseph, MI
UPDATE app.agency_offices ao SET
  address_line1 = '830 Pleasant St',
  address_line2 = 'Ste 402',
  postal_code = '49085',
  phone = '(269) 982-0390',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-326171803',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 583
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Traverse City, MI (phone-only enrichment; keep existing address)
UPDATE app.agency_offices ao SET
  address_line2 = CASE
    WHEN NULLIF(BTRIM(ao.address_line2), '') IS NULL THEN 'Ste 5500'
    ELSE ao.address_line2
  END,
  phone = '(231) 946-7201',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/michigan/federal-bureau-of-investigation-273271413',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 584
  AND (NULLIF(BTRIM(ao.phone), '') IS NULL);

COMMIT;

