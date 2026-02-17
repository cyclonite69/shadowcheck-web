-- ============================================================================
-- Consolidated Migration 006: WiGLE Integration Tables
-- ============================================================================
-- WiGLE v2 network search results, v3 details, and v3 observations.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- wigle_v2_networks_search
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.wigle_v2_networks_search (
    id bigint NOT NULL,
    location public.geometry(Point,4326) NOT NULL,
    trilat numeric(12,10) NOT NULL,
    trilong numeric(13,10) NOT NULL,
    ssid character varying(255),
    bssid character varying(17) NOT NULL,
    firsttime timestamp with time zone NOT NULL,
    lasttime timestamp with time zone NOT NULL,
    lastupdt timestamp with time zone NOT NULL,
    type character varying(50) NOT NULL,
    encryption character varying(50),
    channel integer,
    frequency integer,
    qos smallint,
    wep character varying(10),
    bcninterval integer,
    freenet character varying(10),
    dhcp character varying(10),
    paynet character varying(10),
    transid character varying(50),
    rcois character varying(10),
    name character varying(255),
    comment text,
    userfound boolean DEFAULT false,
    source character varying(255),
    country character(2),
    region character varying(100),
    city character varying(100),
    road character varying(255),
    housenumber character varying(255),
    postalcode character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE app.wigle_v2_networks_search IS 'WiFi network locations from WiGLE.net /api/v2/network/search endpoint with PostGIS spatial support';
COMMENT ON COLUMN app.wigle_v2_networks_search.location IS 'Point geometry (lat/long) in EPSG:4326';
COMMENT ON COLUMN app.wigle_v2_networks_search.trilat IS 'Triangulated latitude (full precision)';
COMMENT ON COLUMN app.wigle_v2_networks_search.trilong IS 'Triangulated longitude (full precision)';
COMMENT ON COLUMN app.wigle_v2_networks_search.bssid IS 'Network MAC address (BSSID) - uppercase';
COMMENT ON COLUMN app.wigle_v2_networks_search.encryption IS 'Encryption type (WPA2, WEP, UNKNOWN, etc) - uppercase';
COMMENT ON COLUMN app.wigle_v2_networks_search.source IS 'Source JSON filename';

CREATE SEQUENCE IF NOT EXISTS app.wigle_v2_networks_search_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.wigle_v2_networks_search_id_seq OWNED BY app.wigle_v2_networks_search.id;
ALTER TABLE ONLY app.wigle_v2_networks_search ALTER COLUMN id SET DEFAULT nextval('app.wigle_v2_networks_search_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wigle_v2_networks_search_pkey') THEN
        ALTER TABLE ONLY app.wigle_v2_networks_search ADD CONSTRAINT wigle_v2_networks_search_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wigle_v2_networks_search_unique') THEN
        ALTER TABLE ONLY app.wigle_v2_networks_search ADD CONSTRAINT wigle_v2_networks_search_unique UNIQUE (bssid, trilat, trilong, lastupdt);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wigle_v2_bssid ON app.wigle_v2_networks_search USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_ssid ON app.wigle_v2_networks_search USING btree (ssid);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_location ON app.wigle_v2_networks_search USING gist (location);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_lasttime ON app.wigle_v2_networks_search USING btree (lasttime DESC);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_encryption ON app.wigle_v2_networks_search USING btree (encryption);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_channel ON app.wigle_v2_networks_search USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_country ON app.wigle_v2_networks_search USING btree (country);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_city ON app.wigle_v2_networks_search USING btree (city);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_source ON app.wigle_v2_networks_search USING btree (source);
CREATE INDEX IF NOT EXISTS idx_wigle_v2_location_time ON app.wigle_v2_networks_search USING btree (country, city, lasttime DESC);

-- --------------------------------------------------------------------------
-- wigle_v3_network_details
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.wigle_v3_network_details (
    netid text NOT NULL,
    name text,
    type text,
    comment text,
    ssid text,
    trilat double precision,
    trilon double precision,
    encryption text,
    channel integer,
    bcninterval integer,
    freenet text,
    dhcp text,
    paynet text,
    qos integer,
    first_seen timestamp with time zone,
    last_seen timestamp with time zone,
    last_update timestamp with time zone,
    street_address jsonb,
    city text GENERATED ALWAYS AS ((street_address ->> 'city'::text)) STORED,
    region text GENERATED ALWAYS AS ((street_address ->> 'region'::text)) STORED,
    country text GENERATED ALWAYS AS ((street_address ->> 'country'::text)) STORED,
    location_clusters jsonb,
    imported_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wigle_v3_network_details_pkey') THEN
        ALTER TABLE ONLY app.wigle_v3_network_details ADD CONSTRAINT wigle_v3_network_details_pkey PRIMARY KEY (netid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wigle_v3_trilat_trilon ON app.wigle_v3_network_details USING btree (trilat, trilon);
CREATE INDEX IF NOT EXISTS idx_wigle_v3_city ON app.wigle_v3_network_details USING btree (city);
CREATE INDEX IF NOT EXISTS idx_wigle_v3_region ON app.wigle_v3_network_details USING btree (region);

-- --------------------------------------------------------------------------
-- wigle_v3_observations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.wigle_v3_observations (
    id integer NOT NULL,
    netid text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    altitude double precision,
    accuracy double precision,
    signal integer,
    observed_at timestamp with time zone,
    last_update timestamp with time zone,
    ssid text,
    frequency integer,
    channel integer,
    encryption text,
    noise integer,
    snr integer,
    month text,
    location public.geometry(Point,4326),
    imported_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS app.wigle_v3_observations_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.wigle_v3_observations_id_seq OWNED BY app.wigle_v3_observations.id;
ALTER TABLE ONLY app.wigle_v3_observations ALTER COLUMN id SET DEFAULT nextval('app.wigle_v3_observations_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wigle_v3_observations_pkey') THEN
        ALTER TABLE ONLY app.wigle_v3_observations ADD CONSTRAINT wigle_v3_observations_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wigle_v3_obs_unique') THEN
        ALTER TABLE ONLY app.wigle_v3_observations ADD CONSTRAINT wigle_v3_obs_unique UNIQUE (netid, latitude, longitude, observed_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wigle_v3_observations_netid_fkey') THEN
        ALTER TABLE ONLY app.wigle_v3_observations
            ADD CONSTRAINT wigle_v3_observations_netid_fkey FOREIGN KEY (netid) REFERENCES app.wigle_v3_network_details(netid) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wigle_v3_obs_netid ON app.wigle_v3_observations USING btree (netid);
CREATE INDEX IF NOT EXISTS idx_wigle_v3_obs_location ON app.wigle_v3_observations USING gist (location);
CREATE INDEX IF NOT EXISTS idx_wigle_v3_obs_time ON app.wigle_v3_observations USING btree (observed_at);
