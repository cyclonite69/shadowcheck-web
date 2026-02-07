-- Batch 12: Fill missing phone numbers for IL resident agencies (Springfield division)
-- Rules:
-- - Only updates where phone is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Champaign, IL
UPDATE app.agency_offices ao SET
  phone = '(217) 373-6785',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/illinois/federal-bureau-of-investigation-350875540',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 826
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Fairview Heights, IL
UPDATE app.agency_offices ao SET
  phone = '(618) 628-7171',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/illinois/federal-bureau-of-investigation-350885752',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 828
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Marion, IL
UPDATE app.agency_offices ao SET
  phone = '(618) 998-0680',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/illinois/federal-bureau-of-investigation-353379154',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 830
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Peoria, IL
UPDATE app.agency_offices ao SET
  phone = '(309) 671-7000',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/illinois/federal-bureau-of-investigation-379391169',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 832
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Quad Cities, IL
UPDATE app.agency_offices ao SET
  phone = '(309) 764-3322',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/illinois/federal-bureau-of-investigation-349833128',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 866
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

