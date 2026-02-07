-- Batch 8: Fill missing addresses for VA resident agencies (Richmond/Washington divisions)
-- Rules:
-- - Only updates where address_line1 is NULL/blank (except Northern Virginia RA: phone-only).
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest, Yellow Pages, RedBusBusinessDirectory); marks source_status='unverified'.

BEGIN;

-- Bristol, VA
UPDATE app.agency_offices ao SET
  address_line1 = '105 Executive Dr',
  postal_code = '24201',
  phone = '(276) 645-3500',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/bristol-va/mip/federal-bureau-of-investigation-11452293',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 774
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Charlottesville, VA
UPDATE app.agency_offices ao SET
  address_line1 = '945 E High St',
  postal_code = '22902',
  phone = '(434) 296-3000',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/virginia/federal-bureau-of-investigation-21668528',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 775
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Fredericksburg, VA
UPDATE app.agency_offices ao SET
  address_line1 = '700 Princess Anne St',
  postal_code = '22401',
  phone = '(540) 371-3321',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/virginia/fbi-412437310',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 776
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Lynchburg, VA
UPDATE app.agency_offices ao SET
  address_line1 = '1200 Main St',
  postal_code = '24504',
  phone = '(434) 847-1195',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/virginia/federal-bureau-of-investigation-5950224',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 777
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Roanoke, VA
UPDATE app.agency_offices ao SET
  address_line1 = '110 Franklin Rd SE',
  address_line2 = 'Ste 200',
  postal_code = '24011',
  phone = '(540) 857-2100',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/virginia/federal-bureau-of-investigation-11448332',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 778
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Winchester, VA
UPDATE app.agency_offices ao SET
  address_line1 = '39 W Cork St',
  postal_code = '22601',
  phone = '(540) 665-6441',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/virginia/federal-bureau-of-investigation-42984753',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 779
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Northern Virginia Resident Agency (phone-only)
UPDATE app.agency_offices ao SET
  phone = '(703) 365-9100',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.redbusbusinessdirectory.com/united-states/manassas/government/federal-bureau-of-investigation',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 850
  AND (NULLIF(BTRIM(ao.phone), '') IS NULL);

COMMIT;

