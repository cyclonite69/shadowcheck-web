-- Batch 16: Fill missing addresses for NJ resident agencies (Newark + Philadelphia divisions)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources; marks source_status='unverified'.

BEGIN;

-- Franklin Township, NJ (listed in Franklin, NJ)
UPDATE app.agency_offices ao SET
  address_line1 = '100 Davidson Ave',
  city = 'Franklin',
  postal_code = '08873',
  phone = '(732) 469-7986',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/somerset-nj-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 699
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Garret Mountain, NJ (listed in Woodland Park, NJ)
UPDATE app.agency_offices ao SET
  address_line1 = '3 Garret Mountain Plz',
  address_line2 = 'Ste 404',
  city = 'Woodland Park',
  postal_code = '07424',
  phone = '(973) 684-6614',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-jersey/federal-bureau-investigation-447741773',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 700
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Red Bank, NJ
UPDATE app.agency_offices ao SET
  address_line1 = '331 Newman Springs Rd',
  postal_code = '07701',
  phone = '(732) 741-0006',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/red-bank-nj-fbi-office-185286/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 701
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- South Jersey (Cherry Hill, NJ)
UPDATE app.agency_offices ao SET
  address_line1 = '10 Melrose Ave',
  city = 'Cherry Hill',
  postal_code = '08003',
  phone = '(856) 795-9556',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/new-jersey/federal-bureau-of-investigation-422210984',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 746
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Trenton, NJ (listed in Hamilton, NJ)
UPDATE app.agency_offices ao SET
  address_line1 = '200 American Metro Blvd',
  city = 'Hamilton',
  postal_code = '08619',
  phone = '(609) 689-7999',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/trenton-nj-fbi-office-162592/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 702
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

