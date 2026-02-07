-- Batch 41: Fill missing phone for FBI Academy (training_facility)
-- Source (non-FBI): YellowPages listing for "FBI Academy".
-- We keep the existing facility source_url (EPA FRS) and record the phone source URL in address_validation_metadata.

BEGIN;

UPDATE app.agency_offices ao SET
  phone = '(703) 632-1000',
  address_validation_metadata =
    COALESCE(ao.address_validation_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'phone_source_url', 'https://www.yellowpages.com/quantico-va/mip/fbi-academy-26623922',
      'phone_source_retrieved_at', '2026-02-06'
    ),
  updated_at = NOW()
WHERE ao.id = 863
  AND (ao.phone IS NULL OR BTRIM(ao.phone) = '');

COMMIT;
