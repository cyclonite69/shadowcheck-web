-- Batch 22: Fill missing phone numbers for MA resident agencies (Boston division)
-- Rules:
-- - Phone-only updates.
-- - Sets website to official Boston Field Office page when missing (source_url remains non-FBI).
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Lakeville, MA
UPDATE app.agency_offices ao SET
  phone = '(508) 946-5677',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/boston/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 499
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Lowell, MA
UPDATE app.agency_offices ao SET
  phone = '(978) 459-1817',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/boston/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 500
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Springfield, MA
UPDATE app.agency_offices ao SET
  phone = '(413) 734-4302',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/boston/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 501
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Worcester, MA
UPDATE app.agency_offices ao SET
  phone = '(508) 752-0100',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/boston/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 502
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

