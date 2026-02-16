-- Add geocode enrichment columns to locations_legacy
ALTER TABLE app.locations_legacy 
ADD COLUMN IF NOT EXISTS geocoded_address TEXT,
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS geocode_source VARCHAR(50);

-- Add index for geocoded locations
CREATE INDEX IF NOT EXISTS idx_locations_geocoded ON app.locations_legacy(geocode_source) WHERE geocode_source IS NOT NULL;

-- Add geocode enrichment columns to networks_legacy
ALTER TABLE app.networks_legacy 
ADD COLUMN IF NOT EXISTS geocoded_address TEXT,
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS geocode_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_networks_geocoded ON app.networks_legacy(geocode_source) WHERE geocode_source IS NOT NULL;
