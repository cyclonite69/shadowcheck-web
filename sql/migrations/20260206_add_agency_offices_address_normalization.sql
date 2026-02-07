-- Add normalized/validated address fields for agency_offices (keeps original address untouched)

BEGIN;

ALTER TABLE app.agency_offices
  ADD COLUMN IF NOT EXISTS normalized_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS normalized_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS normalized_city TEXT,
  ADD COLUMN IF NOT EXISTS normalized_state TEXT,
  ADD COLUMN IF NOT EXISTS normalized_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_validation_provider TEXT,
  ADD COLUMN IF NOT EXISTS address_validated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS address_validation_dpv_match_code TEXT,
  ADD COLUMN IF NOT EXISTS address_validation_metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_agency_offices_address_validation_provider
  ON app.agency_offices(address_validation_provider);

CREATE INDEX IF NOT EXISTS idx_agency_offices_address_validated_at
  ON app.agency_offices(address_validated_at);

COMMIT;

