-- Create table for WiGLE v3 network details
CREATE TABLE IF NOT EXISTS public.wigle_v3_network_details (
    netid TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    comment TEXT,
    ssid TEXT, -- Extracted from name or clusters if needed
    
    -- Location (Trilaterated)
    trilat DOUBLE PRECISION,
    trilon DOUBLE PRECISION,
    
    -- Technical Details
    encryption TEXT,
    channel INTEGER,
    bcninterval INTEGER,
    freenet TEXT,
    dhcp TEXT,
    paynet TEXT,
    
    -- Quality & Time
    qos INTEGER,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    last_update TIMESTAMPTZ,
    
    -- Address (stored as JSONB for flexibility)
    street_address JSONB,
    city TEXT GENERATED ALWAYS AS (street_address->>'city') STORED,
    region TEXT GENERATED ALWAYS AS (street_address->>'region') STORED,
    country TEXT GENERATED ALWAYS AS (street_address->>'country') STORED,
    
    -- Clusters (stored as JSONB array)
    location_clusters JSONB,
    
    -- Metadata
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for searching by location
CREATE INDEX IF NOT EXISTS idx_wigle_v3_trilat_trilon ON public.wigle_v3_network_details (trilat, trilon);
CREATE INDEX IF NOT EXISTS idx_wigle_v3_city ON public.wigle_v3_network_details (city);
CREATE INDEX IF NOT EXISTS idx_wigle_v3_region ON public.wigle_v3_network_details (region);
