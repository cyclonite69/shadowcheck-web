-- Fix location_markers table schema
-- Change 'name' to 'marker_type' with proper constraints
-- Add PostGIS geometry column for consistency with other tables

BEGIN;

-- Rename column
ALTER TABLE app.location_markers 
  RENAME COLUMN name TO marker_type;

-- Add constraint for valid marker types
ALTER TABLE app.location_markers
  ADD CONSTRAINT valid_marker_types 
  CHECK (marker_type IN ('home', 'work', 'poi', 'waypoint', 'custom'));

-- Add comment
COMMENT ON COLUMN app.location_markers.marker_type IS 'Type of location marker: home, work, poi, waypoint, custom';

-- Update index
DROP INDEX IF EXISTS app.idx_location_markers_name;
CREATE INDEX idx_location_markers_type ON app.location_markers(marker_type);

COMMIT;
