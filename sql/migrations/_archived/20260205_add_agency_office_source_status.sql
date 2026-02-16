-- Add source_status column for agency_offices provenance tracking

BEGIN;

ALTER TABLE app.agency_offices
  ADD COLUMN IF NOT EXISTS source_status TEXT NOT NULL DEFAULT 'verified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agency_offices_source_status_check'
      AND conrelid = 'app.agency_offices'::regclass
  ) THEN
    ALTER TABLE app.agency_offices
      ADD CONSTRAINT agency_offices_source_status_check
      CHECK (source_status IN ('verified', 'legacy_needs_verification', 'unverified'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agency_offices_source_status
  ON app.agency_offices(source_status);

COMMIT;
