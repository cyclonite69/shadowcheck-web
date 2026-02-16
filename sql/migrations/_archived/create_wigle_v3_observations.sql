-- Create table for individual WiGLE v3 observations
CREATE TABLE IF NOT EXISTS public.wigle_v3_observations (
    id SERIAL PRIMARY KEY,
    netid TEXT NOT NULL REFERENCES public.wigle_v3_network_details(netid) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    signal INTEGER,
    observed_at TIMESTAMPTZ,
    last_update TIMESTAMPTZ,
    ssid TEXT,
    frequency INTEGER,
    channel INTEGER,
    encryption TEXT,
    noise INTEGER,
    snr INTEGER,
    month TEXT,
    
    -- Geospatial column
    location GEOMETRY(Point, 4326),
    
    -- Metadata
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate observations
    UNIQUE (netid, latitude, longitude, observed_at)
);

-- Index for searching by netid
CREATE INDEX IF NOT EXISTS idx_wigle_v3_obs_netid ON public.wigle_v3_observations (netid);
-- Index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_wigle_v3_obs_location ON public.wigle_v3_observations USING GIST (location);
-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_wigle_v3_obs_time ON public.wigle_v3_observations (observed_at);
