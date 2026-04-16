-- ==========================================================================
-- BASELINE 003: External and Reference Data
-- ==========================================================================
-- This baseline consolidates the following migrations:
-- - 20260216_consolidated_006_wigle_integration.sql
-- - 20260216_consolidated_007_agency_offices.sql
-- - 20260403_add_anchor_points.sql
-- - 20260415_add_wigle_saved_ssid_terms.sql


-- ======== SOURCE: 20260216_consolidated_006_wigle_integration.sql ========

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

-- --------------------------------------------------------------------------
-- Folded from: 20260327_add_wigle_import_runs.sql
-- Persistent resumable WiGLE import runs and per-page progress logs.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.wigle_import_runs (
    id bigserial PRIMARY KEY,
    source text NOT NULL DEFAULT 'wigle',
    api_version text NOT NULL DEFAULT 'v2',
    search_term text NOT NULL DEFAULT '',
    state text,
    request_fingerprint text NOT NULL,
    request_params jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'paused', 'failed', 'completed', 'cancelled')),
    api_total_results integer,
    page_size integer NOT NULL DEFAULT 100 CHECK (page_size > 0),
    total_pages integer,
    last_successful_page integer NOT NULL DEFAULT 0 CHECK (last_successful_page >= 0),
    next_page integer NOT NULL DEFAULT 1 CHECK (next_page >= 1),
    pages_fetched integer NOT NULL DEFAULT 0 CHECK (pages_fetched >= 0),
    rows_returned integer NOT NULL DEFAULT 0 CHECK (rows_returned >= 0),
    rows_inserted integer NOT NULL DEFAULT 0 CHECK (rows_inserted >= 0),
    api_cursor text,
    last_error text,
    started_at timestamptz NOT NULL DEFAULT now(),
    last_attempted_at timestamptz,
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wigle_import_runs_started_at
    ON app.wigle_import_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wigle_import_runs_status_started_at
    ON app.wigle_import_runs (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wigle_import_runs_fingerprint_started_at
    ON app.wigle_import_runs (request_fingerprint, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wigle_import_runs_state_started_at
    ON app.wigle_import_runs (state, started_at DESC);

COMMENT ON TABLE app.wigle_import_runs IS
    'Persistent resumable WiGLE import runs for API search pagination.';
COMMENT ON COLUMN app.wigle_import_runs.search_term IS
    'Primary query term for operator display, typically SSID or BSSID.';
COMMENT ON COLUMN app.wigle_import_runs.request_fingerprint IS
    'Stable hash of normalized request params used to locate resumable runs.';

CREATE TABLE IF NOT EXISTS app.wigle_import_run_pages (
    id bigserial PRIMARY KEY,
    run_id bigint NOT NULL REFERENCES app.wigle_import_runs(id) ON DELETE CASCADE,
    page_number integer NOT NULL CHECK (page_number >= 1),
    request_cursor text,
    next_cursor text,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    rows_returned integer NOT NULL DEFAULT 0 CHECK (rows_returned >= 0),
    rows_inserted integer NOT NULL DEFAULT 0 CHECK (rows_inserted >= 0),
    success boolean NOT NULL DEFAULT true,
    error_message text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT wigle_import_run_pages_unique UNIQUE (run_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_wigle_import_run_pages_run_fetched_at
    ON app.wigle_import_run_pages (run_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_wigle_import_run_pages_run_success_page
    ON app.wigle_import_run_pages (run_id, success, page_number);

COMMENT ON TABLE app.wigle_import_run_pages IS
    'Per-page audit log for resumable WiGLE import runs.';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.wigle_import_runs TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.wigle_import_run_pages TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.wigle_import_runs_id_seq TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.wigle_import_run_pages_id_seq TO shadowcheck_user;

-- ======== SOURCE: 20260216_consolidated_007_agency_offices.sql ========

-- ============================================================================
-- Consolidated Migration 007: Agency Offices
-- ============================================================================
-- Agency offices with address/phone normalization, coverage notes, summary MV.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- agency_offices
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.agency_offices (
    id integer NOT NULL,
    agency text NOT NULL,
    office_type text NOT NULL,
    name text NOT NULL,
    parent_office text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    postal_code text,
    phone text,
    website text,
    jurisdiction text,
    latitude double precision,
    longitude double precision,
    location public.geography(Point,4326),
    source_url text,
    source_retrieved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    source_status text DEFAULT 'verified'::text NOT NULL,
    normalized_address_line1 text,
    normalized_address_line2 text,
    normalized_city text,
    normalized_state text,
    normalized_postal_code text,
    address_validation_provider text,
    address_validated_at timestamp without time zone,
    address_validation_dpv_match_code text,
    address_validation_metadata jsonb,
    normalized_phone text,
    normalized_phone_display text,
    phone_digits text,
    CONSTRAINT agency_offices_office_type_check CHECK ((office_type = ANY (ARRAY['field_office'::text, 'resident_agency'::text, 'training_facility'::text]))),
    CONSTRAINT agency_offices_source_status_check CHECK ((source_status = ANY (ARRAY['verified'::text, 'legacy_needs_verification'::text, 'unverified'::text])))
);

COMMENT ON TABLE app.agency_offices IS 'Public agency offices (field offices, resident agencies) with contact and jurisdiction data.';

CREATE SEQUENCE IF NOT EXISTS app.agency_offices_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.agency_offices_id_seq OWNED BY app.agency_offices.id;
ALTER TABLE ONLY app.agency_offices ALTER COLUMN id SET DEFAULT nextval('app.agency_offices_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_offices_pkey') THEN
        ALTER TABLE ONLY app.agency_offices ADD CONSTRAINT agency_offices_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_offices_agency_office_type_name_city_state_key') THEN
        ALTER TABLE ONLY app.agency_offices ADD CONSTRAINT agency_offices_agency_office_type_name_city_state_key
            UNIQUE (agency, office_type, name, city, state);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agency_offices_agency ON app.agency_offices USING btree (agency);
CREATE INDEX IF NOT EXISTS idx_agency_offices_type ON app.agency_offices USING btree (office_type);
CREATE INDEX IF NOT EXISTS idx_agency_offices_state ON app.agency_offices USING btree (state);
CREATE INDEX IF NOT EXISTS idx_agency_offices_location ON app.agency_offices USING gist (location);
CREATE INDEX IF NOT EXISTS idx_agency_offices_source_status ON app.agency_offices USING btree (source_status);
CREATE INDEX IF NOT EXISTS idx_agency_offices_address_validation_provider ON app.agency_offices USING btree (address_validation_provider);
CREATE INDEX IF NOT EXISTS idx_agency_offices_address_validated_at ON app.agency_offices USING btree (address_validated_at);
CREATE INDEX IF NOT EXISTS idx_agency_offices_normalized_phone ON app.agency_offices USING btree (normalized_phone);

-- --------------------------------------------------------------------------
-- agency_office_coverage_notes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.agency_office_coverage_notes (
    id integer NOT NULL,
    agency text NOT NULL,
    field_office_id integer,
    parent_office_name text,
    note_type text NOT NULL,
    state text,
    jurisdiction text,
    source_url text,
    source_retrieved_at timestamp without time zone,
    legacy_agency_offices_id integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS app.agency_office_coverage_notes_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.agency_office_coverage_notes_id_seq OWNED BY app.agency_office_coverage_notes.id;
ALTER TABLE ONLY app.agency_office_coverage_notes ALTER COLUMN id SET DEFAULT nextval('app.agency_office_coverage_notes_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_office_coverage_notes_pkey') THEN
        ALTER TABLE ONLY app.agency_office_coverage_notes ADD CONSTRAINT agency_office_coverage_notes_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_office_coverage_notes_legacy_agency_offices_id_key') THEN
        ALTER TABLE ONLY app.agency_office_coverage_notes ADD CONSTRAINT agency_office_coverage_notes_legacy_agency_offices_id_key UNIQUE (legacy_agency_offices_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agency_office_coverage_notes_field_office_id_fkey') THEN
        ALTER TABLE ONLY app.agency_office_coverage_notes
            ADD CONSTRAINT agency_office_coverage_notes_field_office_id_fkey FOREIGN KEY (field_office_id) REFERENCES app.agency_offices(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS agency_office_coverage_notes_uniq ON app.agency_office_coverage_notes USING btree (agency, field_office_id, note_type, state);

-- --------------------------------------------------------------------------
-- agency_offices_summary (materialized view)
-- --------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'app' AND matviewname = 'agency_offices_summary') THEN
        CREATE MATERIALIZED VIEW app.agency_offices_summary AS
        SELECT office_type,
            count(*) AS total_count,
            count(*) FILTER (WHERE (length(postal_code) > 5)) AS zip_plus_4_count,
            round((((count(*) FILTER (WHERE (length(postal_code) > 5)))::numeric * 100.0) / (count(*))::numeric), 1) AS zip_plus_4_pct,
            count(*) FILTER (WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL))) AS coordinate_count,
            count(*) FILTER (WHERE (phone IS NOT NULL)) AS phone_count,
            count(*) FILTER (WHERE (website IS NOT NULL)) AS website_count
        FROM app.agency_offices
        GROUP BY office_type
        WITH NO DATA;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_offices_summary_type ON app.agency_offices_summary USING btree (office_type);

-- ======== SOURCE: 20260403_add_anchor_points.sql ========

-- Migration: Add experimental anchor points table for high-confidence beacon validation
--
-- Purpose:
-- - Store curated stationary radio beacons used for validation and calibration workflows
-- - Support confidence scoring based on signal stability, geographic spread, and repeat observations
-- - Keep the dataset available for future productionization without blocking experimentation

CREATE TABLE IF NOT EXISTS app.anchor_points (
    id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    bssid text NOT NULL,
    ssid text,
    manufacturer text,
    location_label text NOT NULL,
    lat double precision NOT NULL,
    lon double precision NOT NULL,
    avg_signal double precision,
    signal_stddev double precision,
    geo_stddev_m double precision,
    observation_count integer,
    unique_days integer,
    first_seen timestamp with time zone,
    last_seen timestamp with time zone,
    confidence text DEFAULT 'medium'::text,
    wigle_confirmed boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE app.anchor_points IS
  'Stationary radio beacons used for device location verification and signal calibration';

CREATE UNIQUE INDEX IF NOT EXISTS idx_anchor_points_bssid_location_label
  ON app.anchor_points (bssid, location_label);

CREATE INDEX IF NOT EXISTS idx_anchor_points_location_label
  ON app.anchor_points (location_label);

CREATE INDEX IF NOT EXISTS idx_anchor_points_bssid
  ON app.anchor_points (bssid);

GRANT SELECT ON TABLE app.anchor_points TO shadowcheck_user;
GRANT SELECT ON TABLE app.anchor_points TO grafana_reader;
GRANT USAGE, SELECT ON SEQUENCE app.anchor_points_id_seq TO shadowcheck_user;
GRANT USAGE ON SEQUENCE app.anchor_points_id_seq TO grafana_reader;

-- ======== SOURCE: 20260415_add_wigle_saved_ssid_terms.sql ========

-- Migration: create wigle_saved_ssid_terms for persisting deduplicated SSID search history

CREATE TABLE IF NOT EXISTS app.wigle_saved_ssid_terms (
    id           bigserial   PRIMARY KEY,
    term         text        NOT NULL,
    term_normalized text     NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wigle_saved_ssid_terms_normalized_idx
    ON app.wigle_saved_ssid_terms (term_normalized);

-- Backfill: seed from existing import runs, keeping most recently-used variant.
-- Excludes: blank, ≤2 chars, pure country codes, "% bi%" patterns.
INSERT INTO app.wigle_saved_ssid_terms (term, term_normalized)
SELECT DISTINCT ON (lower(trim(search_term)))
       trim(search_term)        AS term,
       lower(trim(search_term)) AS term_normalized
  FROM app.wigle_import_runs
 WHERE search_term IS NOT NULL
   AND length(trim(search_term)) >= 3
   AND lower(trim(search_term)) NOT IN ('us', 'uk', 'ca', 'au', 'de', 'fr', 'jp')
   AND trim(search_term) NOT LIKE '% bi%'
   AND trim(search_term) !~ '^\s*$'
 ORDER BY lower(trim(search_term)), started_at DESC
ON CONFLICT (term_normalized) DO NOTHING;
