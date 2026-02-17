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
