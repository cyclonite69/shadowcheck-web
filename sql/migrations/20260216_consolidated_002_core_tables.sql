-- ============================================================================
-- Consolidated Migration 002: Core Tables
-- ============================================================================
-- Networks, observations, access points, routes, staging, device sources.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- device_sources (FK target for many tables)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.device_sources (
    id integer NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    locale text
);

CREATE SEQUENCE IF NOT EXISTS app.device_sources_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.device_sources_id_seq OWNED BY app.device_sources.id;
ALTER TABLE ONLY app.device_sources ALTER COLUMN id SET DEFAULT nextval('app.device_sources_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_sources_pkey') THEN
        ALTER TABLE ONLY app.device_sources ADD CONSTRAINT device_sources_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'device_sources_code_key') THEN
        ALTER TABLE ONLY app.device_sources ADD CONSTRAINT device_sources_code_key UNIQUE (code);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- networks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.networks (
    bssid text NOT NULL,
    ssid text DEFAULT ''::text NOT NULL,
    type text NOT NULL,
    frequency integer NOT NULL,
    capabilities text NOT NULL,
    service text DEFAULT ''::text NOT NULL,
    rcois text DEFAULT ''::text NOT NULL,
    mfgrid integer DEFAULT 0 NOT NULL,
    lasttime_ms bigint NOT NULL,
    lastlat double precision NOT NULL,
    lastlon double precision NOT NULL,
    bestlevel integer DEFAULT 0 NOT NULL,
    bestlat double precision DEFAULT 0 NOT NULL,
    bestlon double precision DEFAULT 0 NOT NULL,
    source_device text,
    threat_score_v2 numeric(5,1),
    threat_factors jsonb,
    threat_level character varying(20),
    threat_updated_at timestamp with time zone,
    ml_threat_score integer DEFAULT 0,
    CONSTRAINT networks_bssid_upper CHECK ((bssid = upper(bssid)))
);
ALTER TABLE ONLY app.networks ALTER COLUMN bssid SET STATISTICS 500;
ALTER TABLE ONLY app.networks ALTER COLUMN ssid SET STATISTICS 500;

COMMENT ON COLUMN app.networks.threat_score_v2 IS 'Enhanced threat score (0-100) using v2.0 algorithm with geographical impossibility, multi-radio correlation, and temporal analysis';
COMMENT ON COLUMN app.networks.threat_factors IS 'JSON breakdown of threat scoring factors for transparency and debugging';
COMMENT ON COLUMN app.networks.threat_level IS 'Threat level classification: CRITICAL, HIGH, MEDIUM, LOW, MINIMAL';
COMMENT ON COLUMN app.networks.threat_updated_at IS 'Timestamp when threat score was last calculated';
COMMENT ON COLUMN app.networks.ml_threat_score IS 'ML-based threat score (0-100) calculated from network behavior patterns';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'networks_pkey') THEN
        ALTER TABLE ONLY app.networks ADD CONSTRAINT networks_pkey PRIMARY KEY (bssid);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'networks_source_device_fkey') THEN
        ALTER TABLE ONLY app.networks
            ADD CONSTRAINT networks_source_device_fkey FOREIGN KEY (source_device) REFERENCES app.device_sources(code);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- access_points
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.access_points (
    id bigint NOT NULL,
    bssid text NOT NULL,
    latest_ssid text,
    ssid_variants text[],
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    total_observations bigint NOT NULL,
    is_5ghz boolean,
    is_6ghz boolean,
    is_hidden boolean,
    is_sentinel boolean DEFAULT false,
    CONSTRAINT access_points_v2_bssid_upper CHECK ((bssid = upper(bssid)))
);

CREATE SEQUENCE IF NOT EXISTS app.access_points_v2_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.access_points_v2_id_seq OWNED BY app.access_points.id;
ALTER TABLE ONLY app.access_points ALTER COLUMN id SET DEFAULT nextval('app.access_points_v2_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_points_v2_pkey') THEN
        ALTER TABLE ONLY app.access_points ADD CONSTRAINT access_points_v2_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_points_v2_bssid_key') THEN
        ALTER TABLE ONLY app.access_points ADD CONSTRAINT access_points_v2_bssid_key UNIQUE (bssid);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- access_points_legacy
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.access_points_legacy (
    id bigint NOT NULL,
    bssid text NOT NULL,
    latest_ssid text,
    ssid_variants text[] DEFAULT '{}'::text[],
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    total_observations bigint DEFAULT 0 NOT NULL,
    is_5ghz boolean,
    is_6ghz boolean,
    is_hidden boolean,
    vendor text,
    enriched_json jsonb DEFAULT '{}'::jsonb
);

CREATE SEQUENCE IF NOT EXISTS app.access_points_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.access_points_id_seq OWNED BY app.access_points_legacy.id;
ALTER TABLE ONLY app.access_points_legacy ALTER COLUMN id SET DEFAULT nextval('app.access_points_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_points_pkey') THEN
        ALTER TABLE ONLY app.access_points_legacy ADD CONSTRAINT access_points_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'access_points_bssid_key') THEN
        ALTER TABLE ONLY app.access_points_legacy ADD CONSTRAINT access_points_bssid_key UNIQUE (bssid);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- observations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.observations (
    id bigint NOT NULL,
    device_id text NOT NULL,
    bssid text NOT NULL,
    ssid text,
    radio_type text,
    radio_frequency integer,
    radio_capabilities text,
    radio_service text,
    radio_rcois text,
    radio_lasttime_ms bigint,
    level integer NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    altitude double precision NOT NULL,
    accuracy double precision NOT NULL,
    "time" timestamp with time zone NOT NULL,
    observed_at_ms bigint NOT NULL,
    external boolean DEFAULT false NOT NULL,
    mfgrid integer NOT NULL,
    source_tag text NOT NULL,
    source_pk text NOT NULL,
    geom public.geometry(Point,4326) NOT NULL,
    time_ms bigint NOT NULL,
    observed_at timestamp with time zone GENERATED ALWAYS AS ("time") STORED,
    CONSTRAINT observations_v2_bssid_upper CHECK ((bssid = upper(bssid)))
);
ALTER TABLE ONLY app.observations ALTER COLUMN bssid SET STATISTICS 1000;
ALTER TABLE ONLY app.observations ALTER COLUMN "time" SET STATISTICS 1000;

COMMENT ON COLUMN app.observations.geom IS 'Geometry point (SRID 4326). TODO: convert to geography(Point,4326) for meter-based ST_Distance calculations in threat scoring.';

CREATE SEQUENCE IF NOT EXISTS app.observations_v2_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.observations_v2_id_seq OWNED BY app.observations.id;
ALTER TABLE ONLY app.observations ALTER COLUMN id SET DEFAULT nextval('app.observations_v2_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_v2_pkey') THEN
        ALTER TABLE ONLY app.observations ADD CONSTRAINT observations_v2_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_v2_natural_uniq') THEN
        ALTER TABLE ONLY app.observations ADD CONSTRAINT observations_v2_natural_uniq
            UNIQUE (device_id, source_pk, bssid, level, lat, lon, altitude, accuracy, observed_at_ms, external, mfgrid);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_obs_bssid') THEN
        ALTER TABLE ONLY app.observations
            ADD CONSTRAINT fk_obs_bssid FOREIGN KEY (bssid) REFERENCES app.access_points(bssid) DEFERRABLE INITIALLY DEFERRED;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_v2_device_id_fkey') THEN
        ALTER TABLE ONLY app.observations
            ADD CONSTRAINT observations_v2_device_id_fkey FOREIGN KEY (device_id) REFERENCES app.device_sources(code);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- observations_legacy
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.observations_legacy (
    id bigint NOT NULL,
    device_id text NOT NULL,
    bssid text NOT NULL,
    ssid text,
    level integer NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    altitude double precision NOT NULL,
    accuracy double precision NOT NULL,
    "time" timestamp with time zone NOT NULL,
    external boolean DEFAULT false NOT NULL,
    mfgrid integer NOT NULL,
    source_tag text NOT NULL,
    source_pk text NOT NULL,
    geom public.geometry(Point,4326) NOT NULL,
    time_ms bigint NOT NULL,
    observed_at timestamp with time zone GENERATED ALWAYS AS ("time") STORED,
    observed_at_ms bigint
);

CREATE SEQUENCE IF NOT EXISTS app.observations_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.observations_id_seq OWNED BY app.observations_legacy.id;
ALTER TABLE ONLY app.observations_legacy ALTER COLUMN id SET DEFAULT nextval('app.observations_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_pkey') THEN
        ALTER TABLE ONLY app.observations_legacy ADD CONSTRAINT observations_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_natural_uniq') THEN
        ALTER TABLE ONLY app.observations_legacy ADD CONSTRAINT observations_natural_uniq
            UNIQUE (device_id, source_pk, bssid, level, lat, lon, altitude, accuracy, observed_at_ms, external, mfgrid);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_obs_device') THEN
        ALTER TABLE ONLY app.observations_legacy
            ADD CONSTRAINT fk_obs_device FOREIGN KEY (device_id) REFERENCES app.device_sources(code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'observations_device_id_fkey') THEN
        ALTER TABLE ONLY app.observations_legacy
            ADD CONSTRAINT observations_device_id_fkey FOREIGN KEY (device_id) REFERENCES app.device_sources(code);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- routes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.routes (
    id bigint NOT NULL,
    device_id text NOT NULL,
    source_pk text NOT NULL,
    run_id integer NOT NULL,
    wifi_visible integer DEFAULT 0 NOT NULL,
    cell_visible integer DEFAULT 0 NOT NULL,
    bt_visible integer DEFAULT 0 NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    altitude double precision NOT NULL,
    accuracy double precision NOT NULL,
    observed_at_ms bigint NOT NULL,
    geom public.geometry(Point,4326) NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS app.routes_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.routes_id_seq OWNED BY app.routes.id;
ALTER TABLE ONLY app.routes ALTER COLUMN id SET DEFAULT nextval('app.routes_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routes_pkey') THEN
        ALTER TABLE ONLY app.routes ADD CONSTRAINT routes_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routes_natural_uniq') THEN
        ALTER TABLE ONLY app.routes ADD CONSTRAINT routes_natural_uniq
            UNIQUE (device_id, source_pk, run_id, wifi_visible, cell_visible, bt_visible, lat, lon, altitude, accuracy, observed_at_ms);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routes_device_id_fkey') THEN
        ALTER TABLE ONLY app.routes
            ADD CONSTRAINT routes_device_id_fkey FOREIGN KEY (device_id) REFERENCES app.device_sources(code);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- Staging tables
-- --------------------------------------------------------------------------
CREATE UNLOGGED TABLE IF NOT EXISTS app.staging_networks (
    device_id text NOT NULL,
    bssid text NOT NULL,
    ssid text,
    frequency integer NOT NULL,
    capabilities text NOT NULL,
    lasttime bigint NOT NULL,
    lastlat double precision NOT NULL,
    lastlon double precision NOT NULL,
    type text NOT NULL,
    bestlevel integer NOT NULL,
    bestlat double precision NOT NULL,
    bestlon double precision NOT NULL,
    rcois text,
    mfgrid integer NOT NULL,
    service text
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staging_networks_device_id_fkey') THEN
        ALTER TABLE ONLY app.staging_networks
            ADD CONSTRAINT staging_networks_device_id_fkey FOREIGN KEY (device_id) REFERENCES app.device_sources(code);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.staging_locations_all_raw (
    location_id bigint NOT NULL,
    device_id text,
    source_pk text NOT NULL,
    bssid text NOT NULL,
    level integer NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    altitude double precision NOT NULL,
    accuracy double precision NOT NULL,
    location_at_ms bigint NOT NULL,
    external integer DEFAULT 0 NOT NULL,
    mfgrid integer DEFAULT 0 NOT NULL,
    source_db text,
    loaded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS app.staging_locations_all_raw_location_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.staging_locations_all_raw_location_id_seq OWNED BY app.staging_locations_all_raw.location_id;
ALTER TABLE ONLY app.staging_locations_all_raw ALTER COLUMN location_id SET DEFAULT nextval('app.staging_locations_all_raw_location_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staging_locations_all_raw_pkey') THEN
        ALTER TABLE ONLY app.staging_locations_all_raw ADD CONSTRAINT staging_locations_all_raw_pkey PRIMARY KEY (location_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staging_locations_all_raw_device_id_fkey') THEN
        ALTER TABLE ONLY app.staging_locations_all_raw
            ADD CONSTRAINT staging_locations_all_raw_device_id_fkey FOREIGN KEY (device_id) REFERENCES app.device_sources(code);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS app.staging_routes (
    device_id text,
    source_pk text NOT NULL,
    run_id integer NOT NULL,
    wifi_visible integer NOT NULL,
    cell_visible integer NOT NULL,
    bt_visible integer NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    altitude double precision NOT NULL,
    accuracy double precision NOT NULL,
    observed_at_ms bigint NOT NULL
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staging_routes_device_id_fkey') THEN
        ALTER TABLE ONLY app.staging_routes
            ADD CONSTRAINT staging_routes_device_id_fkey FOREIGN KEY (device_id) REFERENCES app.device_sources(code);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- Basic indexes for core tables
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_access_points_bssid ON app.access_points USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_observations_bssid ON app.observations_legacy USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_observations_device_id ON app.observations_legacy USING btree (device_id);
CREATE INDEX IF NOT EXISTS idx_observations_geom ON app.observations_legacy USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_observations_time ON app.observations_legacy USING btree ("time");
CREATE INDEX IF NOT EXISTS idx_observations_observed_at_ms ON app.observations_legacy USING btree (observed_at_ms);
CREATE INDEX IF NOT EXISTS idx_observations_v2_bssid ON app.observations USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_observations_v2_device_id ON app.observations USING btree (device_id);
CREATE INDEX IF NOT EXISTS idx_observations_v2_geom ON app.observations USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_observations_v2_observed_at_ms ON app.observations USING btree (observed_at_ms);
CREATE INDEX IF NOT EXISTS idx_observations_v2_radio_frequency ON app.observations USING btree (radio_frequency);
CREATE INDEX IF NOT EXISTS idx_observations_v2_radio_type ON app.observations USING btree (radio_type);
CREATE INDEX IF NOT EXISTS idx_observations_bssid_time ON app.observations USING btree (bssid, "time" DESC);
CREATE INDEX IF NOT EXISTS idx_obs_device_time ON app.observations USING btree (device_id, "time");
CREATE INDEX IF NOT EXISTS obs_time_idx ON app.observations USING btree ("time");
CREATE INDEX IF NOT EXISTS idx_observations_time_bssid ON app.observations USING btree ("time" DESC, bssid);
CREATE INDEX IF NOT EXISTS idx_routes_device_observed ON app.routes USING btree (device_id, observed_at_ms);
CREATE INDEX IF NOT EXISTS idx_routes_geom ON app.routes USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_raw_locations_bssid ON app.staging_locations_all_raw USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_raw_locations_device_time ON app.staging_locations_all_raw USING btree (device_id, location_at_ms);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_locations_natural_key ON app.staging_locations_all_raw USING btree (device_id, source_pk, location_at_ms);

-- Network indexes
CREATE INDEX IF NOT EXISTS idx_networks_ssid_upper ON app.networks USING btree (upper(ssid));
CREATE INDEX IF NOT EXISTS idx_networks_threat_level ON app.networks USING btree (threat_level);
CREATE INDEX IF NOT EXISTS idx_networks_threat_score_v2 ON app.networks USING btree (threat_score_v2 DESC);
CREATE INDEX IF NOT EXISTS idx_networks_threat_updated_at ON app.networks USING btree (threat_updated_at);
CREATE INDEX IF NOT EXISTS idx_networks_ml_threat_score ON app.networks USING btree (ml_threat_score) WHERE (ml_threat_score > 0);
