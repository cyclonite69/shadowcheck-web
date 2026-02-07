-- Batch 18: KS resident agencies - fix invalid addresses + fill phones (Kansas City division)
-- Notes:
-- - Several KS records had non-deliverable addresses (Smarty returned no candidates).
-- - Here we overwrite those specific known-bad addresses (matched by current value),
--   and fill phone numbers using non-FBI sources.
-- - Preserves existing official link by copying prior source_url into website when website is blank.

BEGIN;

-- Garden City, KS (replace old address; fill phone)
UPDATE app.agency_offices ao SET
  address_line1 = '2501 N Campus Dr',
  address_line2 = NULL,
  postal_code = '67846',
  phone = '(620) 276-8181',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/kansas/fbi-491165341',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 618
  AND (
    ao.address_line1 IS NULL
    OR BTRIM(ao.address_line1) = ''
    OR ao.address_line1 = '110 E Spruce St'
  );

-- Manhattan, KS (replace old address; fill phone)
UPDATE app.agency_offices ao SET
  address_line1 = '2200 Kimball Ave',
  address_line2 = NULL,
  postal_code = '66502',
  phone = '(785) 539-5211',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/kansas/fbi-459132463',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 619
  AND (
    ao.address_line1 IS NULL
    OR BTRIM(ao.address_line1) = ''
    OR ao.address_line1 = '503 McCall Rd'
  );

-- Topeka, KS (replace old address; fill phone)
UPDATE app.agency_offices ao SET
  address_line1 = '215 SE 7th St',
  address_line2 = NULL,
  postal_code = '66603',
  phone = '(785) 232-5856',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/kansas/fbi-299374683',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 620
  AND (
    ao.address_line1 IS NULL
    OR BTRIM(ao.address_line1) = ''
    OR ao.address_line1 = '600 SW 5th Ave'
  );

-- Wichita, KS (phone-only)
UPDATE app.agency_offices ao SET
  phone = '(316) 262-0600',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/kansas/fbi-498768880',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 621
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

