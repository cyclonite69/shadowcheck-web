-- Batch 2: Fill missing addresses for OK resident agencies
-- ONLY updates where address_line1 IS NULL or empty.
-- Sources: public directory listings (MapQuest, Yellow Pages, Yahoo Local).
-- All public directory data is marked source_status = 'unverified'.

BEGIN;

-- Ardmore, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '2007 N Commerce St',
  address_line2 = 'Ste 230',
  postal_code = '73401',
  phone = '(580) 223-2018',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oklahoma/federal-bureau-investigation-351481951',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 718
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Durant, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '201 N 3rd Ave',
  postal_code = '74701',
  phone = '(580) 924-4382',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oklahoma/federal-bureau-of-investigation-42854212',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 719
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Lawton, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '420 SW 5th St',
  address_line2 = 'Rm 303',
  postal_code = '73501',
  phone = '(580) 353-3090',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oklahoma/federal-bureau-of-investigation-355384874',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 721
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Muskogee, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '120 S Edmond Pl',
  address_line2 = 'Ste 200',
  postal_code = '74403',
  phone = '(918) 687-7500',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://local.yahoo.com/info-18571363-federal-bureau-of-investigation-muskogee',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 722
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Norman, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '1818 W Lindsey St',
  postal_code = '73069',
  phone = '(405) 364-5137',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/norman-ok/fbi-office',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 723
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Stillwater, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '1339 S Western Rd',
  postal_code = '74074',
  phone = '(405) 372-1645',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/stillwater-ok/fbi',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 724
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Tulsa, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '8023 E 63rd Pl',
  address_line2 = 'Ste 400',
  postal_code = '74133',
  phone = '(918) 664-3300',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oklahoma/federal-bureau-of-investigation-276456318',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 725
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Woodward, OK (resident agency)
UPDATE app.agency_offices ao SET
  address_line1 = '2220 Oklahoma Ave',
  postal_code = '73801',
  phone = '(580) 256-5711',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/oklahoma/federal-bureau-investigation-355508745',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 726
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

