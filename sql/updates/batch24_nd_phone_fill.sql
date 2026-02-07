-- Batch 24: Fill missing phone numbers for ND resident agencies (Minneapolis division)
-- Rules:
-- - Phone-only updates.
-- - Sets website to official Minneapolis Field Office page when missing, except Williston where we preserve its prior FBI press release link in website.
-- - Uses non-FBI sources where possible; marks source_status='unverified'.

BEGIN;

-- Bismarck, ND
UPDATE app.agency_offices ao SET
  phone = '(701) 250-4533',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/minneapolis/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 674
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Fargo, ND
UPDATE app.agency_offices ao SET
  phone = '(701) 293-2660',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/minneapolis/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 675
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Minot, ND
UPDATE app.agency_offices ao SET
  phone = '(701) 838-4485',
  website = COALESCE(NULLIF(BTRIM(ao.website), ''), 'https://www.fbi.gov/contact-us/field-offices/minneapolis/about'),
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 677
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Williston, ND (preserve existing FBI press release link in website; switch source_url to non-FBI listing)
UPDATE app.agency_offices ao SET
  phone = '(701) 609-5020',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/north-dakota/fbi-482639774',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 851
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

