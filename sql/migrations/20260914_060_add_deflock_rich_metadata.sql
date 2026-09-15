-- Add promoted and raw source metadata for authoritative FLOCK snapshots.
-- The importer refreshes these source-owned values on exact (lat, lon) conflicts.

ALTER TABLE app.deflock_cameras
  ADD COLUMN IF NOT EXISTS operator TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS housenumber TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer_wikidata TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS camera_mount TEXT,
  ADD COLUMN IF NOT EXISTS surveillance TEXT,
  ADD COLUMN IF NOT EXISTS surveillance_type TEXT,
  ADD COLUMN IF NOT EXISTS surveillance_zone TEXT,
  ADD COLUMN IF NOT EXISTS electricity TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS source_properties JSONB;

COMMENT ON COLUMN app.deflock_cameras.operator IS
  'Operator value promoted from the authoritative FLOCK source snapshot';
COMMENT ON COLUMN app.deflock_cameras.name IS
  'Source feature name from the authoritative FLOCK snapshot';
COMMENT ON COLUMN app.deflock_cameras.address IS
  'Source address value, promoted from addr:full or address';
COMMENT ON COLUMN app.deflock_cameras.source_properties IS
  'Complete original FLOCK/OSM feature properties JSON, retained for provenance and future use';

CREATE INDEX IF NOT EXISTS deflock_cameras_manufacturer_idx
  ON app.deflock_cameras (manufacturer);
CREATE INDEX IF NOT EXISTS deflock_cameras_camera_type_idx
  ON app.deflock_cameras (camera_type);
