-- ==========================================================================
-- BASELINE 002: Core Tables
-- ==========================================================================
-- This baseline consolidates the following migrations:
-- - 20260216_consolidated_002_core_tables.sql
-- - 20260216_consolidated_004_network_analysis.sql
-- - 20260216_consolidated_005_ml_and_scoring.sql
-- - 20260401_observations_upper_bssid_index.sql
-- - 20260402_add_kml_staging_tables.sql
-- - 20260404_backfill_networks_from_child_tables.sql
-- - 20260404_retarget_bssid_fks_to_networks.sql
-- - 20260404_drop_access_points.sql
-- - 20260406_create_mobile_uploads_table.sql
-- - 20260415_add_scoring_control_flags.sql


-- ======== SOURCE: 20260216_consolidated_002_core_tables.sql ========

-- ============================================================================
-- Consolidated Migration 002: Core Tables
-- ============================================================================
-- Networks, observations, access points, routes, staging, device sources,
-- import history, AI insights.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- Updated: 2026-02-20 (import_history), 2026-02-22 (ai_insights)
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
    min_altitude_m double precision DEFAULT 0,
    max_altitude_m double precision DEFAULT 0,
    altitude_span_m double precision DEFAULT 0,
    last_altitude_m double precision DEFAULT 0,
    altitude_m double precision DEFAULT 0,
    altitude_accuracy_m double precision DEFAULT 0,
    unique_days integer DEFAULT 1,
    unique_locations integer DEFAULT 1,
    is_sentinel boolean DEFAULT false,
    accuracy_meters double precision DEFAULT 0,
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
            ADD CONSTRAINT fk_obs_bssid FOREIGN KEY (bssid) REFERENCES app.networks(bssid) DEFERRABLE INITIALLY DEFERRED;
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

-- --------------------------------------------------------------------------
-- import_history (added 2026-02-20)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.import_history (
  id           SERIAL PRIMARY KEY,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  source_tag   TEXT NOT NULL,
  filename     TEXT,
  imported     INTEGER,
  failed       INTEGER,
  duration_s   NUMERIC(10, 2),
  status       TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  error_detail TEXT,
  metrics_before JSONB,
  metrics_after  JSONB,
  backup_taken   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_import_history_source_tag ON app.import_history (source_tag);
CREATE INDEX IF NOT EXISTS idx_import_history_started_at ON app.import_history (started_at DESC);

-- --------------------------------------------------------------------------
-- ai_insights (added 2026-02-22)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ai_insights (
  id                SERIAL PRIMARY KEY,
  user_id           UUID,
  question          TEXT,
  filtered_networks JSONB,
  claude_response   TEXT,
  suggestions       TEXT[],
  tags              TEXT[],
  useful            BOOLEAN,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user_created ON app.ai_insights (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON app.ai_insights (created_at DESC);

COMMENT ON TABLE app.ai_insights IS
  'Persisted Claude/Bedrock analyses of network observations, with optional user feedback.';

-- --------------------------------------------------------------------------
-- Post-consolidation updates (2026-02-22 through 2026-02-27)
-- --------------------------------------------------------------------------

-- WiGLE v3 denormalized fields on networks.
ALTER TABLE app.networks
  ADD COLUMN IF NOT EXISTS wigle_v3_observation_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wigle_v3_last_import_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_networks_wigle_count
  ON app.networks (wigle_v3_observation_count DESC)
  WHERE wigle_v3_observation_count > 0;

-- Data-quality filter fields on observations.
ALTER TABLE app.observations
  ADD COLUMN IF NOT EXISTS is_temporal_cluster boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_duplicate_coord boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_extreme_signal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_quality_filtered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quality_filter_applied_at timestamp;

CREATE INDEX IF NOT EXISTS idx_obs_time_lat_lon ON app.observations ("time", lat, lon);
CREATE INDEX IF NOT EXISTS idx_obs_lat_lon ON app.observations (lat, lon);
CREATE INDEX IF NOT EXISTS idx_obs_quality_filtered ON app.observations (is_quality_filtered)
  WHERE is_quality_filtered = true;

-- ======== SOURCE: 20260216_consolidated_004_network_analysis.sql ========

-- ============================================================================
-- Consolidated Migration 004: Network Analysis Tables
-- ============================================================================
-- Tags, threat scores, notes, media, location markers, geocoding, etc.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- network_tags
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.network_tags (
    id integer NOT NULL,
    bssid character varying(17) NOT NULL,
    is_ignored boolean DEFAULT false,
    ignore_reason character varying(50),
    threat_tag character varying(20),
    threat_confidence numeric(3,2),
    notes text,
    wigle_lookup_requested boolean DEFAULT false,
    wigle_lookup_at timestamp with time zone,
    wigle_result jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by character varying(100) DEFAULT 'user'::character varying,
    tag_history jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    detailed_notes jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT network_tags_threat_confidence_check CHECK (((threat_confidence IS NULL) OR ((threat_confidence >= (0)::numeric) AND (threat_confidence <= (1)::numeric))))
);

COMMENT ON TABLE app.network_tags IS 'User classifications and notes for networks - used for ML training and filtering';
COMMENT ON COLUMN app.network_tags.is_ignored IS 'If true, network is known/friendly and excluded from threat detection';
COMMENT ON COLUMN app.network_tags.ignore_reason IS 'Why ignored: own_device, known_friend, neighbor, business, infrastructure';
COMMENT ON COLUMN app.network_tags.threat_tag IS 'User classification: THREAT, SUSPECT, FALSE_POSITIVE, INVESTIGATE, or NULL';
COMMENT ON COLUMN app.network_tags.threat_confidence IS 'User confidence in classification 0.00-1.00';
COMMENT ON COLUMN app.network_tags.wigle_lookup_requested IS 'If true, queued for WiGLE crowdsource lookup';
COMMENT ON COLUMN app.network_tags.tag_history IS 'JSONB array of previous tag changes for ML training iteration';

CREATE SEQUENCE IF NOT EXISTS app.network_tags_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.network_tags_id_seq OWNED BY app.network_tags.id;
ALTER TABLE ONLY app.network_tags ALTER COLUMN id SET DEFAULT nextval('app.network_tags_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_tags_pkey') THEN
        ALTER TABLE ONLY app.network_tags ADD CONSTRAINT network_tags_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_tags_bssid_unique') THEN
        ALTER TABLE ONLY app.network_tags ADD CONSTRAINT network_tags_bssid_unique UNIQUE (bssid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_network_tags_bssid ON app.network_tags USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_network_tags_threat ON app.network_tags USING btree (threat_tag) WHERE (threat_tag IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_network_tags_investigate ON app.network_tags USING btree (threat_tag) WHERE ((threat_tag)::text = 'INVESTIGATE'::text);
CREATE INDEX IF NOT EXISTS idx_network_tags_ignored ON app.network_tags USING btree (is_ignored) WHERE (is_ignored = true);
CREATE INDEX IF NOT EXISTS idx_network_tags_wigle_pending ON app.network_tags USING btree (wigle_lookup_requested) WHERE ((wigle_lookup_requested = true) AND (wigle_result IS NULL));
CREATE INDEX IF NOT EXISTS idx_network_tags_tags_gin ON app.network_tags USING gin (tags);

-- --------------------------------------------------------------------------
-- network_threat_scores
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.network_threat_scores (
    id bigint NOT NULL,
    bssid character varying(17) NOT NULL,
    ml_threat_score numeric(5,2),
    ml_threat_probability numeric(3,2),
    ml_primary_class character varying(20),
    ml_feature_values jsonb,
    rule_based_score numeric(5,2),
    rule_based_flags jsonb,
    final_threat_score numeric(5,2),
    final_threat_level character varying(10),
    scored_at timestamp with time zone DEFAULT now(),
    model_version character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS app.network_threat_scores_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.network_threat_scores_id_seq OWNED BY app.network_threat_scores.id;
ALTER TABLE ONLY app.network_threat_scores ALTER COLUMN id SET DEFAULT nextval('app.network_threat_scores_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_threat_scores_pkey') THEN
        ALTER TABLE ONLY app.network_threat_scores ADD CONSTRAINT network_threat_scores_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_threat_scores_bssid_key') THEN
        ALTER TABLE ONLY app.network_threat_scores ADD CONSTRAINT network_threat_scores_bssid_key UNIQUE (bssid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_network_threat_scores_bssid ON app.network_threat_scores USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_network_threat_scores_scored_at ON app.network_threat_scores USING btree (scored_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_threat_scores_threat_level ON app.network_threat_scores USING btree (final_threat_level);

-- --------------------------------------------------------------------------
-- threat_scores_cache
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.threat_scores_cache (
    bssid text NOT NULL,
    threat_score numeric(5,1),
    threat_level text,
    threat_summary text,
    threat_flags text[],
    computed_at timestamp with time zone DEFAULT now(),
    needs_recompute boolean DEFAULT true
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'threat_scores_cache_pkey') THEN
        ALTER TABLE ONLY app.threat_scores_cache ADD CONSTRAINT threat_scores_cache_pkey PRIMARY KEY (bssid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS threat_scores_cache_computed_at_idx ON app.threat_scores_cache USING btree (computed_at);
CREATE INDEX IF NOT EXISTS threat_scores_cache_needs_recompute_idx ON app.threat_scores_cache USING btree (needs_recompute) WHERE (needs_recompute = true);
CREATE INDEX IF NOT EXISTS threat_scores_cache_threat_level_idx ON app.threat_scores_cache USING btree (threat_level);
CREATE INDEX IF NOT EXISTS threat_scores_cache_threat_score_idx ON app.threat_scores_cache USING btree (threat_score DESC);

-- --------------------------------------------------------------------------
-- network_notes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.network_notes (
    id integer NOT NULL,
    bssid character varying(17) NOT NULL,
    user_id character varying(50) DEFAULT 'default_user'::character varying,
    content text NOT NULL,
    note_type character varying(20) DEFAULT 'general'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

COMMENT ON TABLE app.network_notes IS 'User notes and observations for networks - supports right-click context menu';

CREATE SEQUENCE IF NOT EXISTS app.network_notes_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.network_notes_id_seq OWNED BY app.network_notes.id;
ALTER TABLE ONLY app.network_notes ALTER COLUMN id SET DEFAULT nextval('app.network_notes_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_notes_pkey') THEN
        ALTER TABLE ONLY app.network_notes ADD CONSTRAINT network_notes_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_network_notes_bssid ON app.network_notes USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_network_notes_created ON app.network_notes USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_notes_user ON app.network_notes USING btree (user_id);

-- --------------------------------------------------------------------------
-- note_media
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.note_media (
    id integer NOT NULL,
    note_id integer NOT NULL,
    bssid character varying(17) NOT NULL,
    file_path character varying(512) NOT NULL,
    file_name character varying(256) NOT NULL,
    file_size integer,
    media_type character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    media_data bytea,
    mime_type varchar(255),
    storage_backend varchar(16) NOT NULL DEFAULT 'db'
);

COMMENT ON TABLE app.note_media IS 'Media attachments for network notes';
COMMENT ON COLUMN app.note_media.media_data IS 'Raw attachment payload stored in Postgres (bytea).';
COMMENT ON COLUMN app.note_media.storage_backend IS 'Storage backend indicator: db (bytea) or file (legacy path).';

CREATE SEQUENCE IF NOT EXISTS app.note_media_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.note_media_id_seq OWNED BY app.note_media.id;
ALTER TABLE ONLY app.note_media ALTER COLUMN id SET DEFAULT nextval('app.note_media_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_media_pkey') THEN
        ALTER TABLE ONLY app.note_media ADD CONSTRAINT note_media_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_media_bssid_fkey') THEN
        ALTER TABLE ONLY app.note_media
            ADD CONSTRAINT note_media_bssid_fkey FOREIGN KEY (bssid) REFERENCES app.networks(bssid) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_media_note_id_fkey') THEN
        ALTER TABLE ONLY app.note_media
            ADD CONSTRAINT note_media_note_id_fkey FOREIGN KEY (note_id) REFERENCES app.network_notes(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_note_media_bssid ON app.note_media USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_note_media_created ON app.note_media USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_media_note_id ON app.note_media USING btree (note_id);
CREATE INDEX IF NOT EXISTS idx_note_media_note_id_created ON app.note_media (note_id, created_at DESC);

-- --------------------------------------------------------------------------
-- network_sibling_pairs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.network_sibling_pairs (
    bssid1 varchar(17) NOT NULL,
    bssid2 varchar(17) NOT NULL,
    rule text NOT NULL DEFAULT 'heuristic',
    confidence numeric(6,3) NOT NULL,
    pair_strength text NOT NULL DEFAULT 'candidate',
    d_last_octet int,
    d_third_octet int,
    ssid1 text,
    ssid2 text,
    frequency1 int,
    frequency2 int,
    distance_m numeric,
    quality_scope text NOT NULL DEFAULT 'default',
    source text NOT NULL DEFAULT 'heuristic',
    computed_at timestamptz NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT network_sibling_pairs_pkey PRIMARY KEY (bssid1, bssid2),
    CONSTRAINT network_sibling_pairs_order_chk CHECK (bssid1 < bssid2),
    CONSTRAINT network_sibling_pairs_strength_chk CHECK (pair_strength IN ('candidate', 'strong', 'verified')),
    CONSTRAINT network_sibling_pairs_conf_chk CHECK (confidence >= 0 AND confidence <= 2)
);

CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_conf
    ON app.network_sibling_pairs (confidence DESC);
CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_strength
    ON app.network_sibling_pairs (pair_strength, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_bssid1
    ON app.network_sibling_pairs (bssid1);
CREATE INDEX IF NOT EXISTS idx_network_sibling_pairs_bssid2
    ON app.network_sibling_pairs (bssid2);

-- --------------------------------------------------------------------------
-- network_sibling_overrides
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.network_sibling_overrides (
    bssid1 varchar(17) NOT NULL,
    bssid2 varchar(17) NOT NULL,
    relation text NOT NULL,
    confidence numeric(6,3) NOT NULL DEFAULT 1.000,
    notes text,
    updated_by text NOT NULL DEFAULT 'analyst',
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT network_sibling_overrides_pkey PRIMARY KEY (bssid1, bssid2),
    CONSTRAINT network_sibling_overrides_order_chk CHECK (bssid1 < bssid2),
    CONSTRAINT network_sibling_overrides_relation_chk CHECK (relation IN ('sibling', 'not_sibling')),
    CONSTRAINT network_sibling_overrides_conf_chk CHECK (confidence >= 0 AND confidence <= 2)
);

CREATE INDEX IF NOT EXISTS idx_network_sibling_overrides_relation
    ON app.network_sibling_overrides (relation, is_active);

-- --------------------------------------------------------------------------
-- network_siblings_effective
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.network_siblings_effective AS
WITH blocked AS (
    SELECT bssid1, bssid2
    FROM app.network_sibling_overrides
    WHERE is_active = true
      AND relation = 'not_sibling'
),
manual_positive AS (
    SELECT
        o.bssid1,
        o.bssid2,
        'manual_override'::text AS rule,
        o.confidence,
        'verified'::text AS pair_strength,
        null::int AS d_last_octet,
        null::int AS d_third_octet,
        null::text AS ssid1,
        null::text AS ssid2,
        null::int AS frequency1,
        null::int AS frequency2,
        null::numeric AS distance_m,
        'default'::text AS quality_scope,
        'manual'::text AS source,
        o.updated_at AS computed_at
    FROM app.network_sibling_overrides o
    WHERE o.is_active = true
      AND o.relation = 'sibling'
),
heuristic_strong AS (
    SELECT
        p.bssid1,
        p.bssid2,
        p.rule,
        p.confidence,
        CASE
            WHEN p.confidence >= 0.97 THEN 'strong'
            WHEN p.confidence >= 0.90 THEN 'candidate'
            ELSE 'candidate'
        END AS pair_strength,
        p.d_last_octet,
        p.d_third_octet,
        p.ssid1,
        p.ssid2,
        p.frequency1,
        p.frequency2,
        p.distance_m,
        p.quality_scope,
        'heuristic'::text AS source,
        p.computed_at
    FROM app.network_sibling_pairs p
    LEFT JOIN blocked b
      ON b.bssid1 = p.bssid1 AND b.bssid2 = p.bssid2
    WHERE p.confidence >= 0.92
      AND b.bssid1 IS NULL
)
SELECT * FROM manual_positive
UNION ALL
SELECT hs.*
FROM heuristic_strong hs
LEFT JOIN manual_positive mp
  ON mp.bssid1 = hs.bssid1 AND mp.bssid2 = hs.bssid2
WHERE mp.bssid1 IS NULL;

-- --------------------------------------------------------------------------
-- network_media
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.network_media (
    id bigint NOT NULL,
    bssid character varying(17) NOT NULL,
    media_type character varying(10) NOT NULL,
    filename character varying(255) NOT NULL,
    original_filename character varying(255),
    file_size bigint,
    mime_type character varying(100),
    media_data bytea NOT NULL,
    thumbnail bytea,
    description text,
    uploaded_by character varying(100) DEFAULT 'user'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT network_media_media_type_check CHECK (((media_type)::text = ANY (ARRAY[('image'::character varying)::text, ('video'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS app.network_media_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.network_media_id_seq OWNED BY app.network_media.id;
ALTER TABLE ONLY app.network_media ALTER COLUMN id SET DEFAULT nextval('app.network_media_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'network_media_pkey') THEN
        ALTER TABLE ONLY app.network_media ADD CONSTRAINT network_media_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_network_media_bssid ON app.network_media USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_network_media_created ON app.network_media USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_media_type ON app.network_media USING btree (media_type);

-- --------------------------------------------------------------------------
-- ssid_history
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ssid_history (
    id bigint NOT NULL,
    bssid text NOT NULL,
    ssid text,
    first_seen timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS app.ssid_history_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.ssid_history_id_seq OWNED BY app.ssid_history.id;
ALTER TABLE ONLY app.ssid_history ALTER COLUMN id SET DEFAULT nextval('app.ssid_history_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ssid_history_pkey') THEN
        ALTER TABLE ONLY app.ssid_history ADD CONSTRAINT ssid_history_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ssid_history_bssid_fkey') THEN
        ALTER TABLE ONLY app.ssid_history
            ADD CONSTRAINT ssid_history_bssid_fkey FOREIGN KEY (bssid) REFERENCES app.networks(bssid) DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- mac_randomization_suspects
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.mac_randomization_suspects (
    id integer NOT NULL,
    oui character varying(8) NOT NULL,
    mac_sequence text[],
    location_sequence point[],
    time_deltas integer[],
    avg_distance_km numeric(8,2),
    movement_speed_kmh numeric(8,2),
    confidence_score numeric(5,2),
    status character varying(20) DEFAULT 'suspected'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);

COMMENT ON TABLE app.mac_randomization_suspects IS 'Tracks MAC randomization patterns (walked BSSIDs)';

CREATE SEQUENCE IF NOT EXISTS app.mac_randomization_suspects_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.mac_randomization_suspects_id_seq OWNED BY app.mac_randomization_suspects.id;
ALTER TABLE ONLY app.mac_randomization_suspects ALTER COLUMN id SET DEFAULT nextval('app.mac_randomization_suspects_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mac_randomization_suspects_pkey') THEN
        ALTER TABLE ONLY app.mac_randomization_suspects ADD CONSTRAINT mac_randomization_suspects_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mac_randomization_oui ON app.mac_randomization_suspects USING btree (oui);
CREATE INDEX IF NOT EXISTS idx_mac_randomization_confidence ON app.mac_randomization_suspects USING btree (confidence_score DESC);

-- --------------------------------------------------------------------------
-- oui_device_groups
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.oui_device_groups (
    id integer NOT NULL,
    oui character varying(8) NOT NULL,
    vendor_name character varying(256),
    device_count integer DEFAULT 0,
    collective_threat_score numeric(5,2),
    threat_level character varying(20),
    primary_bssid character varying(17),
    secondary_bssids text[],
    radio_types text[],
    has_randomization boolean DEFAULT false,
    randomization_confidence numeric(5,2),
    first_seen timestamp without time zone DEFAULT now(),
    last_updated timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);

COMMENT ON TABLE app.oui_device_groups IS 'Groups BSSIDs by OUI (vendor MAC prefix) to detect same-device networks';

CREATE SEQUENCE IF NOT EXISTS app.oui_device_groups_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.oui_device_groups_id_seq OWNED BY app.oui_device_groups.id;
ALTER TABLE ONLY app.oui_device_groups ALTER COLUMN id SET DEFAULT nextval('app.oui_device_groups_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oui_device_groups_pkey') THEN
        ALTER TABLE ONLY app.oui_device_groups ADD CONSTRAINT oui_device_groups_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oui_device_groups_oui_key') THEN
        ALTER TABLE ONLY app.oui_device_groups ADD CONSTRAINT oui_device_groups_oui_key UNIQUE (oui);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_oui_device_groups_oui ON app.oui_device_groups USING btree (oui);
CREATE INDEX IF NOT EXISTS idx_oui_device_groups_threat ON app.oui_device_groups USING btree (collective_threat_score DESC);

-- --------------------------------------------------------------------------
-- location_markers
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.location_markers (
    id bigint NOT NULL,
    marker_type text NOT NULL,
    label text,
    location public.geography(Point,4326) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision,
    longitude double precision,
    accuracy double precision,
    altitude double precision,
    provider text,
    "timestamp" bigint,
    raw_data jsonb,
    location_3d public.geography(PointZ,4326),
    radius integer DEFAULT 100
);

CREATE SEQUENCE IF NOT EXISTS app.location_markers_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.location_markers_id_seq OWNED BY app.location_markers.id;
ALTER TABLE ONLY app.location_markers ALTER COLUMN id SET DEFAULT nextval('app.location_markers_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'location_markers_pkey') THEN
        ALTER TABLE ONLY app.location_markers ADD CONSTRAINT location_markers_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_location_markers_type ON app.location_markers USING btree (marker_type);
CREATE INDEX IF NOT EXISTS idx_location_markers_location ON app.location_markers USING gist (location);
CREATE INDEX IF NOT EXISTS idx_location_markers_location_3d ON app.location_markers USING gist (location_3d);

-- --------------------------------------------------------------------------
-- geocoding_cache
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.geocoding_cache (
    id bigint NOT NULL,
    "precision" smallint NOT NULL,
    lat_round double precision NOT NULL,
    lon_round double precision NOT NULL,
    lat double precision,
    lon double precision,
    address text,
    poi_name text,
    poi_category text,
    feature_type text,
    city text,
    state text,
    postal_code text,
    country text,
    provider text,
    confidence numeric(5,4),
    geocoded_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_response jsonb,
    poi_skip boolean DEFAULT false NOT NULL,
    poi_attempted_at timestamp with time zone,
    poi_attempts integer DEFAULT 0 NOT NULL,
    address_attempted_at timestamp with time zone,
    address_attempts integer DEFAULT 0 NOT NULL,
    CONSTRAINT geocoding_cache_precision_check CHECK ((("precision" >= 0) AND ("precision" <= 6)))
);

CREATE SEQUENCE IF NOT EXISTS app.geocoding_cache_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.geocoding_cache_id_seq OWNED BY app.geocoding_cache.id;
ALTER TABLE ONLY app.geocoding_cache ALTER COLUMN id SET DEFAULT nextval('app.geocoding_cache_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'geocoding_cache_pkey') THEN
        ALTER TABLE ONLY app.geocoding_cache ADD CONSTRAINT geocoding_cache_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS geocoding_cache_round_idx ON app.geocoding_cache USING btree ("precision", lat_round, lon_round);
CREATE INDEX IF NOT EXISTS geocoding_cache_provider_idx ON app.geocoding_cache USING btree (provider);

-- --------------------------------------------------------------------------
-- geocoding_job_runs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.geocoding_job_runs (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    provider text NOT NULL,
    mode text NOT NULL,
    precision smallint NOT NULL,
    limit_rows integer NOT NULL,
    per_minute integer NOT NULL,
    permanent boolean NOT NULL DEFAULT false,
    status text NOT NULL,
    processed integer,
    successful integer,
    poi_hits integer,
    rate_limited integer,
    duration_ms integer,
    error text,
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    finished_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT geocoding_job_runs_status_check
        CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_geocoding_job_runs_started_at
    ON app.geocoding_job_runs (started_at DESC);

-- --------------------------------------------------------------------------
-- background_job_runs
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.background_job_runs (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    job_name text NOT NULL,
    status text NOT NULL DEFAULT 'running',
    cron text,
    started_at timestamp with time zone NOT NULL DEFAULT now(),
    finished_at timestamp with time zone,
    duration_ms integer,
    error text,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT background_job_runs_job_name_check
        CHECK (job_name IN ('backup', 'mlScoring', 'mvRefresh')),
    CONSTRAINT background_job_runs_status_check
        CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_background_job_runs_job_name_started_at
    ON app.background_job_runs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_background_job_runs_status
    ON app.background_job_runs (status, started_at DESC);

-- --------------------------------------------------------------------------
-- api_mv_refresh_state
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.api_mv_refresh_state (
    id smallint DEFAULT 1 NOT NULL,
    last_refresh_ts timestamp with time zone NOT NULL,
    last_refresh_id bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT api_mv_refresh_state_id_check CHECK ((id = 1))
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_mv_refresh_state_pkey') THEN
        ALTER TABLE ONLY app.api_mv_refresh_state ADD CONSTRAINT api_mv_refresh_state_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- Post-consolidation updates (2026-02-22 through 2026-02-27)
-- --------------------------------------------------------------------------

-- Soft-delete support for network notes.
ALTER TABLE app.network_notes
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_network_notes_bssid_active
  ON app.network_notes (bssid)
  WHERE is_deleted = FALSE;

-- ======== SOURCE: 20260216_consolidated_005_ml_and_scoring.sql ========

-- ============================================================================
-- Consolidated Migration 005: ML Model Tables and Scoring Functions
-- ============================================================================
-- ML config, metadata, training history, and scoring/trigger functions.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- ml_model_config
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ml_model_config (
    model_type character varying(50) NOT NULL,
    coefficients jsonb NOT NULL,
    intercept numeric NOT NULL,
    feature_names jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE app.ml_model_config IS 'Stores trained ML model coefficients for threat scoring';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ml_model_config_pkey') THEN
        ALTER TABLE ONLY app.ml_model_config ADD CONSTRAINT ml_model_config_pkey PRIMARY KEY (model_type);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- ml_model_metadata
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ml_model_metadata (
    model_type character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    trained_at timestamp with time zone DEFAULT now(),
    training_samples integer NOT NULL,
    threat_count integer,
    false_positive_count integer,
    legitimate_count integer,
    accuracy numeric(3,2),
    feature_names jsonb NOT NULL,
    model_config jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ml_model_metadata_pkey') THEN
        ALTER TABLE ONLY app.ml_model_metadata ADD CONSTRAINT ml_model_metadata_pkey PRIMARY KEY (model_type);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- ml_training_history
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ml_training_history (
    id bigint NOT NULL,
    model_type character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    trained_at timestamp with time zone DEFAULT now(),
    training_samples integer,
    threat_count integer,
    false_positive_count integer,
    legitimate_count integer,
    accuracy numeric(3,2),
    coefficients jsonb NOT NULL,
    intercept numeric,
    feature_names jsonb NOT NULL,
    model_config jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS app.ml_training_history_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.ml_training_history_id_seq OWNED BY app.ml_training_history.id;
ALTER TABLE ONLY app.ml_training_history ALTER COLUMN id SET DEFAULT nextval('app.ml_training_history_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ml_training_history_pkey') THEN
        ALTER TABLE ONLY app.ml_training_history ADD CONSTRAINT ml_training_history_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ml_training_history_model ON app.ml_training_history USING btree (model_type, trained_at DESC);

-- --------------------------------------------------------------------------
-- Scoring functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.calculate_threat_score(p_bssid character varying, p_new_tag_type character varying, p_user_confidence numeric DEFAULT 0.5)
RETURNS TABLE(new_threat_score numeric, new_ml_confidence numeric, reasoning jsonb)
LANGUAGE plpgsql AS $$
DECLARE
    v_existing_score NUMERIC(5,4);
    v_existing_confidence NUMERIC(5,4);
    v_tag_count INTEGER;
    v_base_score NUMERIC(5,4);
    v_weight NUMERIC(5,4);
    v_learning_rate NUMERIC(5,4) := 0.3;
    v_confidence_decay NUMERIC(5,4) := 0.9;
    v_reasoning JSONB;
BEGIN
    SELECT threat_score, ml_confidence, jsonb_array_length(COALESCE(tag_history, '[]'::jsonb))
    INTO v_existing_score, v_existing_confidence, v_tag_count
    FROM app.network_tags WHERE bssid = p_bssid;

    IF v_existing_score IS NULL THEN
        v_existing_score := 0.5000; v_existing_confidence := 0.0; v_tag_count := 0;
    END IF;

    v_base_score := CASE p_new_tag_type
        WHEN 'LEGIT' THEN 0.0000
        WHEN 'FALSE_POSITIVE' THEN 0.0500
        WHEN 'INVESTIGATE' THEN 0.7000
        WHEN 'THREAT' THEN 1.0000
        ELSE 0.5000
    END;

    v_weight := v_learning_rate * (0.5 + (p_user_confidence * 0.5));

    new_threat_score := ROUND(((1 - v_weight) * v_existing_score + v_weight * v_base_score)::numeric, 4);
    new_ml_confidence := ROUND((1.0 / (1.0 + exp(-0.3 * ((v_tag_count + 1) - 3.0))))::numeric, 4);

    v_reasoning := jsonb_build_object(
        'previous_score', v_existing_score, 'base_score_for_tag', v_base_score,
        'learning_rate', v_learning_rate, 'weight_applied', v_weight,
        'user_confidence', p_user_confidence, 'tag_count', v_tag_count + 1,
        'formula', 'exponential_moving_average', 'timestamp', NOW()
    );

    RETURN QUERY SELECT new_threat_score, new_ml_confidence, v_reasoning;
END;
$$;

CREATE OR REPLACE FUNCTION app.calculate_threat_score_v3(p_bssid text)
RETURNS TABLE(bssid text, threat_score integer, threat_level text, factors jsonb)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_score integer := 0;
    v_factors jsonb := '{}';
    v_home_lat double precision;
    v_home_lon double precision;
    v_seen_at_home boolean := false;
    v_seen_away boolean := false;
    v_distance_range double precision := 0;
    v_observation_count integer := 0;
    v_days_seen integer := 0;
BEGIN
    SELECT latitude, longitude INTO v_home_lat, v_home_lon
    FROM app.location_markers WHERE marker_type = 'home' LIMIT 1;

    SELECT COUNT(*), COUNT(DISTINCT DATE(time))
    INTO v_observation_count, v_days_seen
    FROM app.observations WHERE observations.bssid = p_bssid;

    IF v_home_lat IS NOT NULL THEN
        SELECT MAX(ST_Distance(
            ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography
        )) INTO v_distance_range
        FROM app.observations
        WHERE observations.bssid = p_bssid AND lat IS NOT NULL AND lon IS NOT NULL;

        SELECT EXISTS(
            SELECT 1 FROM app.observations
            WHERE observations.bssid = p_bssid
              AND ST_DWithin(
                  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography, 100)
        ) INTO v_seen_at_home;

        SELECT EXISTS(
            SELECT 1 FROM app.observations
            WHERE observations.bssid = p_bssid
              AND ST_Distance(
                  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography) > 200
        ) INTO v_seen_away;
    END IF;

    IF v_seen_at_home AND v_seen_away THEN
        v_score := v_score + 40;
        v_factors := v_factors || '{"home_and_away": 40}';
    END IF;
    IF v_distance_range > 200 THEN
        v_score := v_score + 25;
        v_factors := v_factors || jsonb_build_object('distance_range', 25);
    END IF;
    IF v_days_seen >= 3 THEN
        v_score := v_score + LEAST(15, v_days_seen);
        v_factors := v_factors || jsonb_build_object('multiple_days', LEAST(15, v_days_seen));
    END IF;
    IF v_observation_count >= 10 THEN
        v_score := v_score + LEAST(10, v_observation_count / 10);
        v_factors := v_factors || jsonb_build_object('observation_count', LEAST(10, v_observation_count / 10));
    END IF;

    RETURN QUERY SELECT p_bssid, v_score,
        CASE WHEN v_score >= 80 THEN 'CRITICAL' WHEN v_score >= 60 THEN 'HIGH'
             WHEN v_score >= 40 THEN 'MED' WHEN v_score >= 20 THEN 'LOW' ELSE 'NONE' END,
        v_factors;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_threat_score(p_rule_based_score numeric, p_ml_score numeric, p_threat_tag text, p_threat_confidence numeric)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_ml_enabled BOOLEAN;
    v_ml_weight NUMERIC;
    v_base_score NUMERIC;
    v_final_score NUMERIC;
BEGIN
    SELECT (value::text)::boolean INTO v_ml_enabled FROM app.settings WHERE key = 'ml_blending_enabled';
    SELECT (value::text)::numeric INTO v_ml_weight FROM app.settings WHERE key = 'ml_blending_weight';
    v_ml_enabled := COALESCE(v_ml_enabled, false);
    v_ml_weight := COALESCE(v_ml_weight, 0.3);

    IF p_threat_tag = 'FALSE_POSITIVE' THEN RETURN 0; END IF;

    IF v_ml_enabled AND p_ml_score IS NOT NULL AND p_ml_score > 0 THEN
        v_base_score := (COALESCE(p_rule_based_score, 0) * (1 - v_ml_weight)) + (COALESCE(p_ml_score, 0) * v_ml_weight);
    ELSE
        v_base_score := COALESCE(p_rule_based_score, 0);
    END IF;

    IF p_threat_tag = 'THREAT' THEN
        v_final_score := LEAST(100, v_base_score + COALESCE(p_threat_confidence, 0) * 20);
    ELSE
        v_final_score := v_base_score;
    END IF;

    RETURN v_final_score;
END;
$$;

-- --------------------------------------------------------------------------
-- Trigger functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.network_tags_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    IF OLD.threat_tag IS DISTINCT FROM NEW.threat_tag THEN
        NEW.tag_history = COALESCE(OLD.tag_history, '[]'::jsonb) || jsonb_build_object(
            'previous_tag', OLD.threat_tag, 'new_tag', NEW.threat_tag,
            'changed_at', NOW(), 'confidence', OLD.threat_confidence
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.network_threat_scores_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.ml_model_config_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.network_media_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- mark_network_for_threat_recompute (in public schema, used by observation insert trigger)
-- Fixed: uses app.threat_scores_cache instead of public.threat_scores_cache
CREATE OR REPLACE FUNCTION public.mark_network_for_threat_recompute() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    INSERT INTO app.threat_scores_cache (bssid, needs_recompute)
    VALUES (NEW.bssid, TRUE)
    ON CONFLICT (bssid) DO UPDATE SET needs_recompute = TRUE;
    RETURN NEW;
END;
$function$;

-- ======== SOURCE: 20260401_observations_upper_bssid_index.sql ========

-- Migration: Add functional index for UPPER(bssid) to fix observation query performance
-- 
-- Problem: Queries using UPPER(o.bssid) = ANY(...) were doing full table scans (316ms)
-- instead of using the btree index on bssid (2.6ms with direct comparison).
-- 
-- Solution: Create a functional index on UPPER(bssid) so the optimizer can use it
-- when the query also uses UPPER() in the WHERE clause.
--
-- This allows: UPPER(o.bssid) = ANY(array_of_uppercase_values)
-- to use the index instead of scanning all 606K rows.
--
-- NOTE: CREATE INDEX CONCURRENTLY runs outside transactions.
-- This migration file intentionally does NOT open BEGIN/COMMIT;
-- the runner (sql/run-migrations.sh) wraps the entire file execution.

-- Create functional index for UPPER(bssid) lookups on observations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_upper_bssid 
  ON app.observations (UPPER(bssid));

-- Create functional index for UPPER(bssid) lookups on network_locations  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_network_locations_upper_bssid
  ON app.network_locations (UPPER(bssid));

-- Note: api_network_explorer_mv is a materialized view, so functional indexes
-- may need to be on the underlying tables. The JOINs with this MV will still
-- benefit from the functional indexes on observations table.

-- ======== SOURCE: 20260402_add_kml_staging_tables.sql ========

-- Migration: Add KML staging tables for recovery and reconciliation workflows
--
-- Purpose:
-- - Store lossy KML exports in source-native staging tables
-- - Preserve file provenance separately from parsed point rows
-- - Keep KML-derived data out of canonical observation tables until reviewed

-- --------------------------------------------------------------------------
-- kml_files
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.kml_files (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    source_file text NOT NULL,
    source_name text,
    source_type text NOT NULL DEFAULT 'kml',
    file_hash text,
    placemark_count integer NOT NULL DEFAULT 0,
    imported_at timestamp with time zone NOT NULL DEFAULT now(),
    raw_kml jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE app.kml_files IS
  'File-level staging metadata for imported KML/KMZ artifacts used in recovery and reconciliation workflows.';
COMMENT ON COLUMN app.kml_files.source_file IS
  'Original file path or filename used during import.';
COMMENT ON COLUMN app.kml_files.source_name IS
  'Document-level display name extracted from the KML when present.';
COMMENT ON COLUMN app.kml_files.source_type IS
  'Source family for the KML artifact, e.g. wigle.';
COMMENT ON COLUMN app.kml_files.file_hash IS
  'Optional content hash for deduplication and provenance checks.';
COMMENT ON COLUMN app.kml_files.raw_kml IS
  'Optional file-level raw metadata captured during parsing.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_kml_files_source_file
  ON app.kml_files (source_file);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kml_files_file_hash
  ON app.kml_files (file_hash)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kml_files_imported_at
  ON app.kml_files (imported_at DESC);


-- --------------------------------------------------------------------------
-- kml_points
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.kml_points (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    kml_file_id bigint NOT NULL,
    folder_name text,
    name text,
    network_id text,
    bssid text,
    encryption text,
    attributes text,
    observed_at timestamp with time zone,
    signal_dbm double precision,
    accuracy_m double precision,
    network_type text,
    location public.geometry(Point,4326),
    raw_description text,
    raw_kml jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE app.kml_points IS
  'Point-level KML staging rows parsed from Placemark entries. These rows are preserved as imported and are not canonical observations.';
COMMENT ON COLUMN app.kml_points.folder_name IS
  'Folder label from the source KML, e.g. Wifi Networks or Cellular Networks.';
COMMENT ON COLUMN app.kml_points.network_id IS
  'Identifier parsed from the KML description, usually from the Network ID field.';
COMMENT ON COLUMN app.kml_points.bssid IS
  'Normalized WiFi BSSID when the KML point type is WIFI; null for non-WiFi rows unless explicitly meaningful.';
COMMENT ON COLUMN app.kml_points.location IS
  'Geometry point from the KML coordinates in SRID 4326.';
COMMENT ON COLUMN app.kml_points.raw_description IS
  'Original KML Placemark description text before field parsing.';
COMMENT ON COLUMN app.kml_points.raw_kml IS
  'Optional raw parsed KML payload for debugging and future remapping.';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kml_points_kml_file_id_fkey') THEN
        ALTER TABLE ONLY app.kml_points
            ADD CONSTRAINT kml_points_kml_file_id_fkey
            FOREIGN KEY (kml_file_id) REFERENCES app.kml_files(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kml_points_kml_file_id
  ON app.kml_points (kml_file_id);

CREATE INDEX IF NOT EXISTS idx_kml_points_network_id
  ON app.kml_points (network_id)
  WHERE network_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kml_points_bssid
  ON app.kml_points (bssid)
  WHERE bssid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kml_points_observed_at
  ON app.kml_points (observed_at DESC)
  WHERE observed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kml_points_network_type
  ON app.kml_points (network_type)
  WHERE network_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kml_points_location
  ON app.kml_points USING gist (location)
  WHERE location IS NOT NULL;


-- --------------------------------------------------------------------------
-- runtime permissions
-- --------------------------------------------------------------------------
GRANT SELECT ON TABLE app.kml_files TO shadowcheck_user;
GRANT SELECT ON TABLE app.kml_points TO shadowcheck_user;
GRANT USAGE ON SEQUENCE app.kml_files_id_seq TO shadowcheck_user;
GRANT USAGE ON SEQUENCE app.kml_points_id_seq TO shadowcheck_user;

-- ======== SOURCE: 20260404_backfill_networks_from_child_tables.sql ========

BEGIN;

WITH latest_obs AS (
    SELECT DISTINCT ON (o.bssid)
        o.bssid,
        NULLIF(o.ssid, '') AS ssid,
        COALESCE(NULLIF(o.radio_type, ''), 'WIFI') AS type,
        COALESCE(o.radio_frequency, 0) AS frequency,
        COALESCE(NULLIF(o.radio_capabilities, ''), '') AS capabilities,
        COALESCE(NULLIF(o.radio_service, ''), '') AS service,
        COALESCE(NULLIF(o.radio_rcois, ''), '') AS rcois,
        COALESCE(o.radio_lasttime_ms, o.time_ms, o.observed_at_ms, 0) AS lasttime_ms,
        o.lat AS lastlat,
        o.lon AS lastlon,
        o.device_id AS source_device
    FROM app.observations o
    WHERE o.bssid IS NOT NULL
    ORDER BY o.bssid, o.observed_at DESC, o.id DESC
),
best_obs AS (
    SELECT DISTINCT ON (o.bssid)
        o.bssid,
        o.level AS bestlevel,
        o.lat AS bestlat,
        o.lon AS bestlon,
        COALESCE(o.altitude, 0) AS altitude_m,
        COALESCE(o.accuracy, 0) AS accuracy_meters
    FROM app.observations o
    WHERE o.bssid IS NOT NULL
    ORDER BY o.bssid, o.level DESC, o.observed_at DESC, o.id DESC
),
obs_bounds AS (
    SELECT
        o.bssid,
        MIN(COALESCE(o.altitude, 0)) AS min_altitude_m,
        MAX(COALESCE(o.altitude, 0)) AS max_altitude_m,
        MAX(COALESCE(o.altitude, 0)) - MIN(COALESCE(o.altitude, 0)) AS altitude_span_m,
        COUNT(DISTINCT DATE_TRUNC('day', o.observed_at))::integer AS unique_days,
        COUNT(DISTINCT CONCAT_WS(':', o.lat::text, o.lon::text))::integer AS unique_locations,
        MAX(o.observed_at) AS updated_at
    FROM app.observations o
    WHERE o.bssid IS NOT NULL
    GROUP BY o.bssid
)
INSERT INTO app.networks (
    bssid,
    ssid,
    type,
    frequency,
    capabilities,
    service,
    rcois,
    mfgrid,
    lasttime_ms,
    lastlat,
    lastlon,
    bestlevel,
    bestlat,
    bestlon,
    source_device,
    min_altitude_m,
    max_altitude_m,
    altitude_span_m,
    last_altitude_m,
    altitude_m,
    altitude_accuracy_m,
    unique_days,
    unique_locations,
    is_sentinel,
    accuracy_meters
)
SELECT
    lo.bssid,
    COALESCE(lo.ssid, '') AS ssid,
    lo.type,
    lo.frequency,
    lo.capabilities,
    lo.service,
    lo.rcois,
    0 AS mfgrid,
    lo.lasttime_ms,
    lo.lastlat,
    lo.lastlon,
    bo.bestlevel,
    bo.bestlat,
    bo.bestlon,
    lo.source_device,
    ob.min_altitude_m,
    ob.max_altitude_m,
    ob.altitude_span_m,
    bo.altitude_m AS last_altitude_m,
    bo.altitude_m,
    bo.accuracy_meters AS altitude_accuracy_m,
    GREATEST(ob.unique_days, 1),
    GREATEST(ob.unique_locations, 1),
    false AS is_sentinel,
    bo.accuracy_meters
FROM latest_obs lo
JOIN best_obs bo ON bo.bssid = lo.bssid
JOIN obs_bounds ob ON ob.bssid = lo.bssid
WHERE NOT EXISTS (
    SELECT 1
    FROM app.networks n
    WHERE n.bssid = lo.bssid
);

COMMIT;

-- ======== SOURCE: 20260404_retarget_bssid_fks_to_networks.sql ========

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM app.observations o
        WHERE NOT EXISTS (
            SELECT 1
            FROM app.networks n
            WHERE n.bssid = o.bssid
        )
    ) THEN
        RAISE EXCEPTION 'Cannot retarget observations FK: some bssids are missing from app.networks';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM app.note_media nm
        WHERE NOT EXISTS (
            SELECT 1
            FROM app.networks n
            WHERE n.bssid = nm.bssid
        )
    ) THEN
        RAISE EXCEPTION 'Cannot retarget note_media FK: some bssids are missing from app.networks';
    END IF;

    IF to_regclass('app.ssid_history') IS NOT NULL AND EXISTS (
        SELECT 1
        FROM app.ssid_history sh
        WHERE NOT EXISTS (
            SELECT 1
            FROM app.networks n
            WHERE n.bssid = sh.bssid
        )
    ) THEN
        RAISE EXCEPTION 'Cannot retarget ssid_history FK: some bssids are missing from app.networks';
    END IF;
END $$;

ALTER TABLE ONLY app.observations
    DROP CONSTRAINT IF EXISTS fk_obs_bssid;
ALTER TABLE ONLY app.observations
    ADD CONSTRAINT fk_obs_bssid
    FOREIGN KEY (bssid)
    REFERENCES app.networks(bssid)
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE ONLY app.note_media
    DROP CONSTRAINT IF EXISTS note_media_bssid_fkey;
ALTER TABLE ONLY app.note_media
    ADD CONSTRAINT note_media_bssid_fkey
    FOREIGN KEY (bssid)
    REFERENCES app.networks(bssid)
    ON DELETE CASCADE;

DO $$
BEGIN
    IF to_regclass('app.ssid_history') IS NOT NULL THEN
        ALTER TABLE ONLY app.ssid_history
            DROP CONSTRAINT IF EXISTS ssid_history_bssid_fkey;
        ALTER TABLE ONLY app.ssid_history
            ADD CONSTRAINT ssid_history_bssid_fkey
            FOREIGN KEY (bssid)
            REFERENCES app.networks(bssid)
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

COMMIT;

-- ======== SOURCE: 20260404_drop_access_points.sql ========

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'potential_cruft'
          AND table_name = 'access_points_orphans'
          AND column_name = 'id'
          AND column_default LIKE '%access_points_v2_id_seq%'
    ) THEN
        ALTER TABLE potential_cruft.access_points_orphans
            ALTER COLUMN id DROP DEFAULT;
    END IF;
END $$;

DROP VIEW IF EXISTS app.v_real_access_points;
DROP TABLE IF EXISTS app.access_points;
DROP SEQUENCE IF EXISTS app.access_points_v2_id_seq;

COMMIT;

-- ======== SOURCE: 20260406_create_mobile_uploads_table.sql ========

-- Migration: Create mobile_uploads table for full-fidelity device metadata tracking
-- Target: app.mobile_uploads

CREATE TABLE IF NOT EXISTS app.mobile_uploads (
    id SERIAL PRIMARY KEY,
    s3_key TEXT NOT NULL UNIQUE,
    source_tag TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    history_id INTEGER REFERENCES app.import_history(id),
    
    -- Full Fidelity Device Metadata
    device_model TEXT,        -- e.g. 'SM-S908U'
    device_id TEXT,           -- e.g. 'S22Ultra'
    os_version TEXT,          -- e.g. 'Android 14'
    app_version TEXT,         -- e.g. '1.4.2-build88'
    battery_level INTEGER,    -- 0-100
    storage_free_gb NUMERIC,  -- e.g. 128.5
    extra_metadata JSONB,     -- Catch-all for extra metrics
    
    error_detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION app.update_mobile_uploads_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_mobile_uploads_timestamp
    BEFORE UPDATE ON app.mobile_uploads
    FOR EACH ROW
    EXECUTE FUNCTION app.update_mobile_uploads_timestamp();

-- Indexes for status and source tracking
CREATE INDEX idx_mobile_uploads_status ON app.mobile_uploads (status);
CREATE INDEX idx_mobile_uploads_source_tag ON app.mobile_uploads (source_tag);
CREATE INDEX idx_mobile_uploads_created_at ON app.mobile_uploads (created_at DESC);

-- Grants
GRANT SELECT ON app.mobile_uploads TO shadowcheck_user;
GRANT ALL PRIVILEGES ON app.mobile_uploads TO shadowcheck_admin;

-- ======== SOURCE: 20260415_add_scoring_control_flags.sql ========

-- Migration: add scoring control feature flags
-- Adds score_debug_logging, auto_geocode_on_import, dedupe_on_scan to app.settings

INSERT INTO app.settings (key, value, description)
VALUES
    (
        'score_debug_logging',
        'false'::jsonb,
        'Emit per-network scoring debug output to the server log'
    ),
    (
        'auto_geocode_on_import',
        'true'::jsonb,
        'Automatically geocode networks when imported via the ETL pipeline'
    ),
    (
        'dedupe_on_scan',
        'true'::jsonb,
        'Deduplicate observation records during scan ingest'
    )
ON CONFLICT (key) DO NOTHING;
