\echo 'Ensure observation indexes exist'

CREATE INDEX IF NOT EXISTS idx_observations_bssid ON observations (bssid);
CREATE INDEX IF NOT EXISTS idx_observations_device_id ON observations (device_id);
CREATE INDEX IF NOT EXISTS idx_observations_time ON observations (time);
CREATE INDEX IF NOT EXISTS idx_observations_geom ON observations USING GIST (geom);
