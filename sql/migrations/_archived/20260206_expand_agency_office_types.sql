-- Expand agency_offices office_type enum to include training facilities

BEGIN;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname
  INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'app.agency_offices'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%office_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE app.agency_offices DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agency_offices_office_type_check'
      AND conrelid = 'app.agency_offices'::regclass
  ) THEN
    ALTER TABLE app.agency_offices
      ADD CONSTRAINT agency_offices_office_type_check
      CHECK (office_type IN ('field_office', 'resident_agency', 'training_facility'));
  END IF;
END $$;

COMMIT;
