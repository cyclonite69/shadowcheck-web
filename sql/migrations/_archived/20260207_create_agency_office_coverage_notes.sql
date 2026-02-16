-- Create a dedicated table for non-location coverage/jurisdiction notes that are currently stored
-- as placeholder resident_agency rows (e.g., "Areas covered", "Parishes covered").
--
-- This preserves the data while removing it from app.agency_offices so office lists/counts are not polluted.

BEGIN;

CREATE TABLE IF NOT EXISTS app.agency_office_coverage_notes (
  id serial PRIMARY KEY,
  agency text NOT NULL,
  field_office_id integer REFERENCES app.agency_offices(id) ON DELETE CASCADE,
  parent_office_name text,
  note_type text NOT NULL,
  state text,
  jurisdiction text,
  source_url text,
  source_retrieved_at timestamp without time zone,
  legacy_agency_offices_id integer UNIQUE,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- Prevent duplicate notes per field office/state/type.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'app'
      AND indexname = 'agency_office_coverage_notes_uniq'
  ) THEN
    CREATE UNIQUE INDEX agency_office_coverage_notes_uniq
      ON app.agency_office_coverage_notes (agency, field_office_id, note_type, state);
  END IF;
END $$;

-- Migrate existing placeholder rows into the new table (idempotent).
WITH placeholder_names AS (
  SELECT unnest(ARRAY[
    'Areas covered',
    'City covered',
    'Counties served',
    'Counties covered',
    'Counties and city covered',
    'Counties and cities covered',
    'Municipalities covered',
    'Parishes covered',
    'North',
    'South',
    'East',
    'West',
    'Iowa',
    'Nebraska'
  ]) AS name
), placeholders AS (
  SELECT ao.*
  FROM app.agency_offices ao
  JOIN placeholder_names pn ON pn.name = ao.name
  WHERE ao.agency = 'FBI'
    AND ao.office_type = 'resident_agency'
)
INSERT INTO app.agency_office_coverage_notes (
  agency,
  field_office_id,
  parent_office_name,
  note_type,
  state,
  jurisdiction,
  source_url,
  source_retrieved_at,
  legacy_agency_offices_id,
  created_at,
  updated_at
)
SELECT
  p.agency,
  fo.id AS field_office_id,
  p.parent_office AS parent_office_name,
  p.name AS note_type,
  p.state,
  p.jurisdiction,
  p.source_url,
  p.source_retrieved_at,
  p.id AS legacy_agency_offices_id,
  COALESCE(p.created_at, now()),
  COALESCE(p.updated_at, now())
FROM placeholders p
LEFT JOIN app.agency_offices fo
  ON fo.agency = p.agency
 AND fo.office_type = 'field_office'
 AND fo.name = p.parent_office
ON CONFLICT (legacy_agency_offices_id) DO NOTHING;

-- Remove placeholders from the locations table (they are not physical offices).
DELETE FROM app.agency_offices ao
USING (
  SELECT unnest(ARRAY[
    'Areas covered',
    'City covered',
    'Counties served',
    'Counties covered',
    'Counties and city covered',
    'Counties and cities covered',
    'Municipalities covered',
    'Parishes covered',
    'North',
    'South',
    'East',
    'West',
    'Iowa',
    'Nebraska'
  ]) AS name
) pn
WHERE ao.agency = 'FBI'
  AND ao.office_type = 'resident_agency'
  AND ao.name = pn.name;

COMMIT;
