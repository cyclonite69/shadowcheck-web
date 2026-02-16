-- Add normalized phone fields for agency_offices (keeps original phone untouched)
--
-- normalized_phone: US national 10-digit format where parseable (e.g., 2065551234)
-- normalized_phone_display: consistent US display format where possible (e.g., (206) 555-1234)
-- phone_digits: digits-only extraction from phone (useful for debugging/QA)

BEGIN;

ALTER TABLE app.agency_offices
  ADD COLUMN IF NOT EXISTS normalized_phone TEXT,
  ADD COLUMN IF NOT EXISTS normalized_phone_display TEXT,
  ADD COLUMN IF NOT EXISTS phone_digits TEXT;

CREATE INDEX IF NOT EXISTS idx_agency_offices_normalized_phone
  ON app.agency_offices(normalized_phone);

COMMIT;
