-- Batch 30: Fill missing addresses for NY resident agencies (non-FBI sources)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Corning, NY
UPDATE app.agency_offices ao SET
  address_line1 = '250 Denison Pkwy E',
  postal_code = '14830',
  phone = '(607) 936-6291',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-york/federal-bureau-of-investigation-379421790',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 510
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Jamestown, NY
UPDATE app.agency_offices ao SET
  address_line1 = '2 W 3rd St',
  postal_code = '14701',
  phone = '(716) 483-8201',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-york/federal-bureau-of-investigation-366066365',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 511
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Rochester, NY
UPDATE app.agency_offices ao SET
  address_line1 = '2255 S Clinton Ave',
  postal_code = '14618',
  phone = '(585) 271-1200',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-york/federal-bureau-of-investigation-5891839',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 512
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

