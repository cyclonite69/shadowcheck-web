-- Performance optimization for analytics queries
-- Add missing indexes for spatial operations and time-based filtering

-- Spatial index for geometry operations (if not exists)
CREATE INDEX IF NOT EXISTS idx_locations_geom_gist 
ON app.locations_legacy USING GIST (geom) 
WHERE geom IS NOT NULL;

-- Composite index for time-based filtering with BSSID
CREATE INDEX IF NOT EXISTS idx_locations_time_bssid 
ON app.locations_legacy (time DESC, bssid) 
WHERE geom IS NOT NULL;

-- Index for BSSID with geometry filtering
CREATE INDEX IF NOT EXISTS idx_locations_bssid_geom_not_null 
ON app.locations_legacy (bssid) 
WHERE geom IS NOT NULL;

-- Composite index for analytics aggregations
CREATE INDEX IF NOT EXISTS idx_locations_bssid_time_geom 
ON app.locations_legacy (bssid, time) 
WHERE geom IS NOT NULL;

-- Update table statistics
ANALYZE app.locations_legacy;

SELECT 'Analytics performance indexes created successfully!' as status;
