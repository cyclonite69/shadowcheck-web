-- Batch 23: Fill missing phone numbers for MN resident agencies (Minneapolis division)
-- Rules:
-- - Phone-only updates.
-- - Sets website to official Minneapolis Field Office page when missing.
-- - Uses non-FBI sources; marks source_status='unverified'.

BEGIN;

-- Duluth, MN
UPDATE app.agency_offices ao SET
  phone = '(218) 720-3884',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/minneapolis/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 670
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Mankato, MN
UPDATE app.agency_offices ao SET
  phone = '(507) 625-0500',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/minneapolis/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 671
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Rochester, MN
UPDATE app.agency_offices ao SET
  phone = '(507) 288-6800',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/minneapolis/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 672
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Saint Cloud, MN
UPDATE app.agency_offices ao SET
  phone = '(320) 253-2040',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/minneapolis/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 673
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

