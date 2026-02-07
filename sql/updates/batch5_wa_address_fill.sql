-- Batch 5: Fill missing addresses for WA resident agencies (Seattle division)
-- Rules:
-- - Only fills address fields when existing address_line1 is NULL/blank (except Spokane: phone-only).
-- - Preserves the existing official link by copying prior source_url into website when website is blank.
-- - Uses non-FBI sources (public directories / other .gov pages); marks source_status='unverified'.

BEGIN;

-- Bellingham, WA
UPDATE app.agency_offices ao SET
  address_line1 = '1835 Barkley Blvd',
  postal_code = '98226',
  phone = '(360) 734-2980',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/washington/federal-bureau-of-investigation-356069246',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 816
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Everett, WA
UPDATE app.agency_offices ao SET
  address_line1 = '3020 Rucker Ave',
  postal_code = '98201',
  phone = '(425) 252-3500',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/washington/federal-bureau-of-investigation-352487884',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 817
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Olympia, WA
UPDATE app.agency_offices ao SET
  address_line1 = '1802 Black Lake Blvd SW',
  postal_code = '98512',
  phone = '(360) 709-3370',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/washington/federal-bureau-of-investigation-356239744',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 818
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Poulsbo, WA
UPDATE app.agency_offices ao SET
  address_line1 = '19500 10th Ave NE',
  postal_code = '98370',
  phone = '(360) 779-8809',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.yellowpages.com/poulsbo-wa/mip/fbi-poulsbo-459244058',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 819
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Tacoma, WA
UPDATE app.agency_offices ao SET
  address_line1 = '1145 Broadway',
  address_line2 = 'Ste 500',
  postal_code = '98402',
  phone = '(253) 272-8439',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/washington/federal-bureau-of-investigation-356071793',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 821
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Tri-Cities, WA (listing is in Kennewick)
UPDATE app.agency_offices ao SET
  address_line1 = '211 W 6th Ave',
  city = CASE WHEN ao.city = 'Tri-Cities' THEN 'Kennewick' ELSE ao.city END,
  postal_code = '99336',
  phone = '(509) 585-4827',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/washington/fbi-410564409',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 822
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Vancouver, WA (MapQuest listing flagged "permanently closed"; treat as unverified)
UPDATE app.agency_offices ao SET
  address_line1 = '400 E Mill Plain Blvd',
  address_line2 = 'Ste 303',
  postal_code = '98660',
  phone = '(360) 695-5661',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/washington/federal-bureau-of-investigation-fbi-433067570',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 823
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Yakima, WA
UPDATE app.agency_offices ao SET
  address_line1 = '402 E Yakima Ave',
  address_line2 = 'Ste 410',
  postal_code = '98901',
  phone = '(509) 453-4859',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.mapquest.com/us/washington/federal-bureau-of-investigation-354620749',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 824
  AND (ao.address_line1 IS NULL OR BTRIM(ao.address_line1) = '');

-- Spokane, WA (phone-only from DOJ page; keep existing address provenance)
UPDATE app.agency_offices ao SET
  phone = '(509) 747-5195',
  website = CASE WHEN NULLIF(BTRIM(ao.website), '') IS NULL THEN ao.source_url ELSE ao.website END,
  source_url = 'https://www.justice.gov/usao-edwa/federal-crimes-and-agency-contact-information2',
  source_retrieved_at = '2026-02-06'::timestamp,
  source_status = 'unverified',
  updated_at = NOW()
WHERE ao.id = 820
  AND (NULLIF(BTRIM(ao.phone), '') IS NULL);

COMMIT;

