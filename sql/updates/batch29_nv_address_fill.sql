-- Batch 29: Fill missing addresses for NV resident agencies (non-FBI sources)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.
--
-- Note: South Lake Tahoe is physically in CA; this batch corrects state='CA' to match the sourced address.

BEGIN;

-- Elko, NV
UPDATE app.agency_offices ao SET
  address_line1 = '345 W Idaho St',
  postal_code = '89801',
  phone = '(775) 753-6047',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/nevada/federal-bureau-of-investigation-354617866',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 627
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Reno, NV
UPDATE app.agency_offices ao SET
  address_line1 = '501 Ryland St',
  postal_code = '89502',
  phone = '(775) 828-8900',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/nevada/federal-bureau-of-investigation-281543075',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 628
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- South Lake Tahoe, CA (correcting state from NV)
UPDATE app.agency_offices ao SET
  address_line1 = '870 Emerald Bay Rd',
  postal_code = '96150',
  phone = '(530) 541-7180',
  state = 'CA',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/california/federal-bureau-of-investigation-433428126',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 629
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

