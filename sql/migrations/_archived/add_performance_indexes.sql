-- Performance optimization indexes for shadowcheck database
-- Run this to speed up common queries

-- Networks table indexes
CREATE INDEX IF NOT EXISTS idx_networks_bssid ON app.networks_legacy(bssid);
CREATE INDEX IF NOT EXISTS idx_networks_type ON app.networks_legacy(type);
CREATE INDEX IF NOT EXISTS idx_networks_lastseen ON app.networks_legacy(lastseen DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_networks_firstseen ON app.networks_legacy(firstseen);
CREATE INDEX IF NOT EXISTS idx_networks_ssid ON app.networks_legacy(ssid);
CREATE INDEX IF NOT EXISTS idx_networks_encryption ON app.networks_legacy(encryption);

-- Locations table indexes
CREATE INDEX IF NOT EXISTS idx_locations_bssid ON app.locations_legacy(bssid);
CREATE INDEX IF NOT EXISTS idx_locations_time ON app.locations_legacy(time DESC);
CREATE INDEX IF NOT EXISTS idx_locations_lat_lon ON app.locations_legacy(lat, lon);

-- Network tags indexes
CREATE INDEX IF NOT EXISTS idx_network_tags_bssid ON app.network_tags(bssid);
CREATE INDEX IF NOT EXISTS idx_network_tags_type ON app.network_tags(tag_type);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_networks_type_lastseen ON app.networks_legacy(type, lastseen DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_locations_bssid_time ON app.locations_legacy(bssid, time DESC);

-- Analyze tables to update statistics
ANALYZE app.networks_legacy;
ANALYZE app.locations_legacy;
ANALYZE app.network_tags;

SELECT 'Performance indexes created successfully!' as status;
