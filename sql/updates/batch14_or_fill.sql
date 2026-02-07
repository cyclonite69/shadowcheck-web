-- Batch 14: Fill missing address/phone for OR resident agencies (Portland division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank (except phone-only rows).
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (MapQuest); marks source_status='unverified'.

BEGIN;

-- Bend, OR
UPDATE app.agency_offices ao SET
  address_line1 = '730 SW Bonnett Way',
  postal_code = '97702',
  phone = '(541) 389-1202',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oregon/federal-bureau-of-investigation-357480210',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 767
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Medford, OR
UPDATE app.agency_offices ao SET
  address_line1 = '300 Crater Lake Ave',
  postal_code = '97504',
  phone = '(541) 773-2942',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oregon/federal-bureau-of-investigation-355123882',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 769
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Pendleton, OR
UPDATE app.agency_offices ao SET
  address_line1 = '116 S Main St',
  address_line2 = 'Ste 7',
  postal_code = '97801',
  phone = '(541) 276-0112',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oregon/federal-bureau-of-investigation-12497687',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 770
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Salem, OR
UPDATE app.agency_offices ao SET
  address_line1 = '2601 25th St SE',
  address_line2 = 'Ste 300',
  postal_code = '97302',
  phone = '(503) 362-6601',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oregon/federal-bureau-of-investigation-357759281',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 771
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Eugene, OR (phone-only; address already present from govinfo FR list)
UPDATE app.agency_offices ao SET
  phone = '(541) 343-5222',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oregon/federal-bureau-of-investigation-284466766',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 768
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

-- Portland, OR (resident agency record; phone-only)
UPDATE app.agency_offices ao SET
  phone = '(503) 224-4181',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oregon/fbi-458766673',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 860
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;

