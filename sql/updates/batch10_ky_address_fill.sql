-- Batch 10: Fill missing addresses for KY resident agencies (Louisville division)
-- Rules:
-- - Only updates where address_line1 is NULL/blank.
-- - Preserves existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources; marks source_status='unverified'.

BEGIN;

-- Bowling Green, KY
UPDATE app.agency_offices ao SET
  address_line1 = '996 Wilkinson Trace',
  postal_code = '42103',
  phone = '(270) 781-4734',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.buzzfile.com/business/Federal-Bureau-of-Investigation-270-781-4734',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 650
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Covington, KY (physical address in Fort Mitchell, KY)
UPDATE app.agency_offices ao SET
  address_line1 = '2220 Grandview Dr',
  address_line2 = 'Ste 280',
  city = 'Fort Mitchell',
  postal_code = '41017',
  phone = '(859) 341-3901',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/fort-mitchell-ky/mip/federal-bureau-of-investigation-1077144',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 651
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Lexington, KY
UPDATE app.agency_offices ao SET
  address_line1 = '125 Lisle Industrial Ave',
  postal_code = '40511',
  phone = '(859) 254-4038',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.localoffices.com/office/federal-bureau-of-investigation-lexington-ky',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 652
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- London, KY
UPDATE app.agency_offices ao SET
  address_line1 = '201 County Extension Rd',
  postal_code = '40741',
  phone = '(606) 878-8922',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/kentucky/federal-bureau-of-investigation-303226776',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 653
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Owensboro, KY
UPDATE app.agency_offices ao SET
  address_line1 = '401 Frederica St',
  address_line2 = 'Ste 201D',
  postal_code = '42301',
  phone = '(270) 926-3441',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.rvbh.com/wp-content/uploads/sites/7/2016/09/Community-Resource-Referral-Guide.pdf',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 654
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Paducah, KY
UPDATE app.agency_offices ao SET
  address_line1 = '555 Jefferson St',
  postal_code = '42001',
  phone = '(270) 442-8050',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.finduslocal.com/police/kentucky/paducah/federal-bureau-investigation_555-jefferson-st/',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 655
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Pikeville, KY
UPDATE app.agency_offices ao SET
  address_line1 = '131 Summit Dr',
  address_line2 = 'Ste 308',
  postal_code = '41501',
  phone = '(606) 432-1226',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/kentucky/federal-bureau-of-investigation-353221244',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 656
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

COMMIT;

