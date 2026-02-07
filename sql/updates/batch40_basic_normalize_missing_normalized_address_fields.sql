-- Batch 40: Populate normalized_* address fields from raw address fields when missing
-- This is a non-verifying normalization step (no DPV); it preserves any Smarty-filled normalized values.
-- Motivation: Smarty US Street API is currently returning HTTP 402 (subscription required).

BEGIN;

UPDATE app.agency_offices ao SET
  normalized_address_line1 = COALESCE(NULLIF(BTRIM(ao.normalized_address_line1), ''), NULLIF(BTRIM(ao.address_line1), '')),
  normalized_address_line2 = COALESCE(NULLIF(BTRIM(ao.normalized_address_line2), ''), NULLIF(BTRIM(ao.address_line2), '')),
  normalized_city = COALESCE(NULLIF(BTRIM(ao.normalized_city), ''), NULLIF(BTRIM(ao.city), '')),
  normalized_state = COALESCE(NULLIF(BTRIM(ao.normalized_state), ''), NULLIF(BTRIM(UPPER(ao.state)), '')),
  normalized_postal_code = COALESCE(NULLIF(BTRIM(ao.normalized_postal_code), ''), NULLIF(BTRIM(ao.postal_code), '')),
  address_validation_provider = COALESCE(ao.address_validation_provider, 'basic_copy'),
  address_validated_at = COALESCE(ao.address_validated_at, NOW()),
  address_validation_metadata =
    COALESCE(ao.address_validation_metadata, '{}'::jsonb)
    || jsonb_build_object('basic_copy', true, 'basic_copy_at', NOW()),
  updated_at = NOW()
WHERE NULLIF(BTRIM(ao.address_line1), '') IS NOT NULL
  AND NULLIF(BTRIM(ao.city), '') IS NOT NULL
  AND NULLIF(BTRIM(ao.state), '') IS NOT NULL
  AND (
    NULLIF(BTRIM(ao.normalized_address_line1), '') IS NULL
    OR NULLIF(BTRIM(ao.normalized_city), '') IS NULL
    OR NULLIF(BTRIM(ao.normalized_state), '') IS NULL
    OR NULLIF(BTRIM(ao.normalized_postal_code), '') IS NULL
  );

COMMIT;

