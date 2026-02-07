-- Batch 4: Derive missing postal_code values from existing address_line1 via public lookup
--
-- Notes:
-- - This batch only fills postal_code when it is currently NULL/blank.
-- - We intentionally do not change source_url/source_status here; we are treating ZIP as derived
--   metadata from the address text, not a new canonical office listing.
--
-- Public lookup references used when creating this file (not stored in DB):
-- - MapQuest address pages for:
--   - 2101 Webster St, Oakland, CA
--   - 9325 Discovery Blvd, Manassas, VA
--   - 2868 Elm Hill Pike, Nashville, TN
--   - 500 N State Line Ave, Texarkana, TX
-- - Williston/Badlands Town Center references indicating 700 42nd St W is in ZIP 58801

BEGIN;

UPDATE app.agency_offices
SET postal_code = '94612-3011', updated_at = NOW()
WHERE id = 804 AND NULLIF(BTRIM(postal_code), '') IS NULL;

UPDATE app.agency_offices
SET postal_code = '20109-3992', updated_at = NOW()
WHERE id = 850 AND NULLIF(BTRIM(postal_code), '') IS NULL;

UPDATE app.agency_offices
SET postal_code = '58801', updated_at = NOW()
WHERE id = 851 AND NULLIF(BTRIM(postal_code), '') IS NULL;

UPDATE app.agency_offices
SET postal_code = '37214-3718', updated_at = NOW()
WHERE id = 852 AND NULLIF(BTRIM(postal_code), '') IS NULL;

UPDATE app.agency_offices
SET postal_code = '75501', updated_at = NOW()
WHERE id = 560 AND NULLIF(BTRIM(postal_code), '') IS NULL;

COMMIT;

