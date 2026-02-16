-- Add business/venue name column
ALTER TABLE app.networks_legacy 
ADD COLUMN IF NOT EXISTS venue_name TEXT,
ADD COLUMN IF NOT EXISTS venue_category TEXT;

ALTER TABLE app.ap_locations
ADD COLUMN IF NOT EXISTS venue_name TEXT,
ADD COLUMN IF NOT EXISTS venue_category TEXT;

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_networks_trilat_coords ON app.networks_legacy(trilat_lat, trilat_lon) WHERE trilat_lat IS NOT NULL;

SELECT 'Business name columns added' as status;
