-- Batch 7: Fill missing addresses for NC resident agencies (Charlotte division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (Yellow Pages, Manta, CMAC, MapQuest); marks source_status='unverified'.

BEGIN;

-- Asheville, NC
UPDATE app.agency_offices ao SET
  address_line1 = '151 Patton Ave',
  address_line2 = 'Ste 261',
  postal_code = '28801',
  phone = '(828) 253-1643',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/north-carolina/federal-bureau-of-investigation-342815603',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 514
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Fayetteville, NC
UPDATE app.agency_offices ao SET
  address_line1 = '4200 Morganton Rd',
  postal_code = '28314',
  phone = '(910) 860-5000',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://government-offices.cmac.ws/fayetteville-resident-agency/134/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 515
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Greensboro, NC
UPDATE app.agency_offices ao SET
  address_line1 = '1801 Stanley Rd',
  address_line2 = '#400',
  postal_code = '27407',
  phone = '(336) 855-7770',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.manta.com/c/mt62ty4/federal-bureau-of-investigation',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 516
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Greenville, NC
UPDATE app.agency_offices ao SET
  address_line1 = '1017 WH Smith Blvd',
  address_line2 = 'Ste B',
  postal_code = '27834',
  phone = '(252) 353-3140',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/greenville-nc/mip/federal-bureau-of-investigation-533181790',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 517
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Hickory, NC
UPDATE app.agency_offices ao SET
  address_line1 = '4355 Cloninger Mill Rd',
  postal_code = '28602',
  phone = '(828) 323-2911',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/hickory-nc/mip/federal-bureau-of-investigation-520721702',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 518
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Raleigh, NC
UPDATE app.agency_offices ao SET
  address_line1 = '5511 Capital Center Dr',
  address_line2 = 'Ste 460',
  postal_code = '27606',
  phone = '(919) 233-7701',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/raleigh-nc/mip/federal-bureau-of-investigation-545199139',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 520
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Wilmington, NC
UPDATE app.agency_offices ao SET
  address_line1 = '2250 Shipyard Blvd',
  address_line2 = 'Ste 2',
  postal_code = '28403',
  phone = '(910) 791-9393',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/wilmington-nc/mip/federal-bureau-of-investigation-527654401',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 521
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

