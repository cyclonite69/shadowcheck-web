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
    created_at timestamp without time zone DEFAULT now()
);

COMMENT ON TABLE app.note_media IS 'Media attachments for network notes';

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
            ADD CONSTRAINT note_media_bssid_fkey FOREIGN KEY (bssid) REFERENCES app.access_points(bssid) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'note_media_note_id_fkey') THEN
        ALTER TABLE ONLY app.note_media
            ADD CONSTRAINT note_media_note_id_fkey FOREIGN KEY (note_id) REFERENCES app.network_notes(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_note_media_bssid ON app.note_media USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_note_media_created ON app.note_media USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_note_media_note_id ON app.note_media USING btree (note_id);

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
            ADD CONSTRAINT ssid_history_bssid_fkey FOREIGN KEY (bssid) REFERENCES app.access_points(bssid) DEFERRABLE INITIALLY DEFERRED;
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
