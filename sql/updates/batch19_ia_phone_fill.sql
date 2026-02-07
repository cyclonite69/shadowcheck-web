-- Batch 19: Fill missing phone numbers for IA resident agencies (Omaha division)
-- Rules:
-- - Phone-only updates.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Cedar Rapids, IA (phone-only; refresh dead source_url)
UPDATE app.agency_offices ao SET
  phone = '(319) 363-5900',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/iowa/fbi-424008908',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 731
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Des Moines, IA (phone-only)
UPDATE app.agency_offices ao SET
  phone = '(515) 223-1400',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/iowa/federal-bureau-of-investigation-494142185',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 732
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

