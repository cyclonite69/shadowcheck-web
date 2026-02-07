-- Batch 1: Fill missing addresses for AL, AR, AZ resident agencies
-- ONLY updates where address_line1 IS NULL or empty
-- Source: public directory listings (Yellow Pages, Yelp, CountyOffice.org, etc.)
-- source_status = 'unverified' for all public directory data

BEGIN;

-- Alabama (parent: Mobile/Birmingham)
UPDATE app.agency_offices SET
  address_line1 = '3371 Skyway Dr', postal_code = '36830', phone = '(334) 466-5041',
  source_url = 'https://www.yellowpages.com/auburn-al/mip/u-s-government-fbi-23032807',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 683 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '2999 Ross Clark Cir', address_line2 = 'Ste 502', postal_code = '36301', phone = '(334) 792-7130',
  source_url = 'https://www.countyoffice.org/dothan-alabama-fbi-office-dothan-al-f92/',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 684 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '4700 Whitesburg Dr SW', address_line2 = 'Unit 400', postal_code = '35802', phone = '(256) 539-1711',
  source_url = 'https://www.yellowpages.com/huntsville-al/mip/federal-bureau-of-investigation-497398017',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 496 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '65 Pineville Rd', postal_code = '36460', phone = '(251) 575-5395',
  source_url = 'https://investigation-services.cmac.ws/AL/Monroeville/',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 685 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '1 Commerce St', address_line2 = 'Ste 606', postal_code = '36104', phone = '(334) 263-1691',
  source_url = 'https://www.yelp.com/biz/federal-bureau-of-investigation-montgomery',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 686 AND (address_line1 IS NULL OR trim(address_line1) = '');

-- Arkansas (parent: Little Rock)
UPDATE app.agency_offices SET
  address_line1 = '100 E Peach St', postal_code = '71730', phone = '(870) 863-3466',
  source_url = 'https://www.yellowpages.com/el-dorado-ar/mip/federal-bureau-investigation-455435763',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 631 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '75 N East Ave', address_line2 = 'Ste 302', postal_code = '72701', phone = '(479) 443-3181',
  source_url = 'https://www.yelp.com/biz/federal-bureau-of-investigation-fayetteville-2',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 632 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '415 Garland St', postal_code = '72901',
  source_url = 'https://www.dandb.com/businessdirectory/federalbureauofinvestigation-fortsmith-ar-18545488.html',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 633 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '2400 E Highland Dr', postal_code = '72401', phone = '(870) 932-0700',
  source_url = 'https://www.yelp.com/biz/federal-bureau-of-investigation-jonesboro',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 634 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '310 Mid Continent Plz', postal_code = '72301', phone = '(870) 735-4633',
  source_url = 'https://www.loopnet.com/property/310-mid-continent-plz-west-memphis-ar-72301/05035-388050000000/',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 635 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '500 N State Line Ave', postal_code = '71854', phone = '(870) 774-7682',
  source_url = 'https://www.yellowpages.com/texarkana-ar/mip/federal-bureau-of-investigation-467271162',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 636 AND (address_line1 IS NULL OR trim(address_line1) = '');

-- Arizona (parent: Phoenix)
UPDATE app.agency_offices SET
  address_line1 = '5900 S Pulliam Dr', postal_code = '86005', phone = '(928) 774-0631',
  source_url = 'https://www.yellowpages.com/flagstaff-az/mip/federal-bureau-of-investigation-495215737',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 749 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '94 Acoma Blvd S', address_line2 = 'Ste 202', postal_code = '86403', phone = '(928) 854-7150',
  source_url = 'https://www.yellowpages.com/lake-havasu-city-az/mip/fbi-459292320',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 751 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '625 E White Mountain Blvd', postal_code = '85935', phone = '(928) 367-8211',
  source_url = 'https://www.countyoffice.org/lakeside-arizona-fbi-office-pinetop-lakeside-az-f99/',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 752 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '2211 Oakmont Dr', postal_code = '85635', phone = '(520) 459-2232',
  source_url = 'https://www.yellowpages.com/sierra-vista-az/mip/fbi-277387',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 753 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '275 N Commerce Park Loop', postal_code = '85745', phone = '(520) 623-4306',
  source_url = 'https://www.yellowpages.com/tucson-az/mip/federal-bureau-of-investigation-472287623',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 754 AND (address_line1 IS NULL OR trim(address_line1) = '');

UPDATE app.agency_offices SET
  address_line1 = '775 E 39th St', address_line2 = 'Floor 2', postal_code = '85365', phone = '(928) 344-3050',
  source_url = 'https://www.finduslocal.com/federal-governmentpolice/arizona/yuma/fbi_775-e-39th-st/',
  source_retrieved_at = '2026-02-06', source_status = 'unverified', updated_at = NOW()
WHERE id = 755 AND (address_line1 IS NULL OR trim(address_line1) = '');

COMMIT;
