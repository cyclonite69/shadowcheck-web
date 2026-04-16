-- ============================================================================
-- Consolidated Migration 003: Authentication and Users
-- ============================================================================
-- Users, sessions, settings tables.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- users
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    last_login timestamp without time zone,
    is_active boolean DEFAULT true,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('user'::character varying)::text, ('admin'::character varying)::text])))
);

CREATE SEQUENCE IF NOT EXISTS app.users_id_seq
    AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.users_id_seq OWNED BY app.users.id;
ALTER TABLE ONLY app.users ALTER COLUMN id SET DEFAULT nextval('app.users_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey') THEN
        ALTER TABLE ONLY app.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
        ALTER TABLE ONLY app.users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
        ALTER TABLE ONLY app.users ADD CONSTRAINT users_email_key UNIQUE (email);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- user_sessions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    user_agent text,
    ip_address inet
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_pkey') THEN
        ALTER TABLE ONLY app.user_sessions ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_sessions_user_id_fkey') THEN
        ALTER TABLE ONLY app.user_sessions
            ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON app.user_sessions USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app.user_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON app.user_sessions USING btree (expires_at);

-- --------------------------------------------------------------------------
-- settings
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
        ALTER TABLE ONLY app.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (key);
    END IF;
END $$;

INSERT INTO app.settings (key, value, description)
VALUES
    (
        'backup_job_config',
        '{"enabled": false, "cron": "0 3 * * *", "uploadToS3": true}'::jsonb,
        'Configuration for automated database backups'
    ),
    (
        'ml_scoring_job_config',
        '{"enabled": true, "cron": "0 */4 * * *", "limit": 10000}'::jsonb,
        'Configuration for behavioral threat scoring'
    ),
    (
        'mv_refresh_job_config',
        '{"enabled": true, "cron": "30 4 * * *"}'::jsonb,
        'Configuration for daily materialized view refreshes'
    ),
    (
        'admin_allow_docker',
        'false'::jsonb,
        'Allow PgAdmin and Docker-backed admin controls from the UI'
    ),
    (
        'admin_allow_ml_training',
        'true'::jsonb,
        'Allow ML model training from the admin UI'
    ),
    (
        'admin_allow_ml_scoring',
        'true'::jsonb,
        'Allow ML score recalculation from the admin UI'
    ),
    (
        'enable_background_jobs',
        'false'::jsonb,
        'Enable automatic background job scheduling'
    ),
    (
        'simple_rule_scoring_enabled',
        'false'::jsonb,
        'Use rule-based scoring only when calculating threat scores'
    )
ON CONFLICT (key) DO NOTHING;

-- --------------------------------------------------------------------------
-- schema_migrations tracking
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schema_migrations_pkey') THEN
        ALTER TABLE ONLY app.schema_migrations ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- users: force_password_change (added 2026-02-16)
-- --------------------------------------------------------------------------
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false;
