-- Batch 27: Fill missing addresses for MO resident agencies (non-FBI sources)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Cape Girardeau, MO
UPDATE app.agency_offices ao SET
  address_line1 = '339 Broadway St',
  address_line2 = 'Room 208',
  postal_code = '63701',
  phone = '(573) 335-2511',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/missouri/federal-bureau-of-investigation-323848277',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 838
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Kirksville, MO
UPDATE app.agency_offices ao SET
  address_line1 = '201 N Elson St',
  address_line2 = 'Ste 203',
  postal_code = '63501',
  phone = '(660) 665-6020',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/missouri/federal-bureau-of-investigation-413599017',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 839
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Rolla, MO
UPDATE app.agency_offices ao SET
  address_line1 = '901 N Pine St',
  postal_code = '65401',
  phone = '(573) 364-1100',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/missouri/federal-bureau-of-investigation-272638584',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 840
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

