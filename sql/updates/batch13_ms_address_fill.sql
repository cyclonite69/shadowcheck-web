-- Batch 13: Fill missing addresses for MS resident agencies (Jackson division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Columbus, MS
UPDATE app.agency_offices ao SET
  address_line1 = '2508 Bluecutt Rd',
  postal_code = '39705',
  phone = '(662) 327-4868',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/mississippi/federal-bureau-of-investigation-352202977',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 603
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Gulfport, MS
UPDATE app.agency_offices ao SET
  address_line1 = '9241 Three Rivers Rd',
  postal_code = '39503',
  phone = '(228) 896-6163',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/mississippi/federal-bureau-of-investigation-428000970',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 604
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Hattiesburg, MS
UPDATE app.agency_offices ao SET
  address_line1 = '6553 US Highway 98',
  address_line2 = 'Ste 107',
  postal_code = '39402',
  phone = '(601) 261-3300',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/mississippi/federal-bureau-of-investigation-22385190',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 605
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Oxford, MS
UPDATE app.agency_offices ao SET
  address_line1 = '3800 Jackson Ave W',
  postal_code = '38655',
  phone = '(662) 234-3404',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/mississippi/federal-bureau-of-investigation-421031660',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 606
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Pascagoula, MS
UPDATE app.agency_offices ao SET
  address_line1 = '103 N Pascagoula St',
  address_line2 = 'Ste 200',
  postal_code = '39567',
  phone = '(228) 762-0735',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/mississippi/federal-bureau-of-investigation-439728241',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 607
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Southaven, MS
UPDATE app.agency_offices ao SET
  address_line1 = '71 Goodman Rd E',
  postal_code = '38671',
  phone = '(662) 349-3235',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/mississippi/federal-bureau-of-investigation-423612242',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 608
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

