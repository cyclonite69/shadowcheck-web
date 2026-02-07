-- Batch 15: Fill missing addresses for SC resident agencies (Columbia division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources; marks source_status='unverified'.

BEGIN;

-- Aiken, SC
UPDATE app.agency_offices ao SET
  address_line1 = '211 York St NE',
  postal_code = '29801',
  phone = '(803) 648-0728',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/south-carolina/federal-bureau-of-investigation-351398921',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 543
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Florence, SC
UPDATE app.agency_offices ao SET
  address_line1 = '161 Dozier Blvd',
  address_line2 = 'Ste 150',
  postal_code = '29501',
  phone = '(843) 662-9363',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.thecountyoffice.com/florence-sc-fbi-office/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 545
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Greenville, SC
UPDATE app.agency_offices ao SET
  address_line1 = '15 S Main St',
  address_line2 = 'Ste 801',
  postal_code = '29601',
  phone = '(864) 232-3807',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/south-carolina/federal-bureau-of-investigation-351625113',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 546
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Hilton Head, SC (listed in Bluffton, SC)
UPDATE app.agency_offices ao SET
  address_line1 = '25 Clarks Summit Dr',
  address_line2 = 'Ste 200',
  city = 'Bluffton',
  postal_code = '29910',
  phone = '(843) 815-2180',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/south-carolina/federal-bureau-of-investigation-423201748',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 547
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Myrtle Beach, SC
UPDATE app.agency_offices ao SET
  address_line1 = '199 Village Center Blvd',
  address_line2 = 'Ste 210',
  postal_code = '29579',
  phone = '(843) 236-1919',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/south-carolina/fbi-430927443',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 548
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Rock Hill, SC
UPDATE app.agency_offices ao SET
  address_line1 = '452 Lakeshore Pkwy',
  postal_code = '29730',
  phone = '(803) 327-1151',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/south-carolina/federal-bureau-of-investigation-276330929',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 549
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

