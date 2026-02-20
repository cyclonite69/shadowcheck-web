-- ============================================================================
-- ShadowCheck Database Bootstrap
-- ============================================================================
-- Idempotent script that runs on first DB init (docker-entrypoint-initdb.d)
-- and can be safely re-run on existing databases.
--
-- Runs as: shadowcheck_user (POSTGRES_USER / superuser)
-- Creates: app schema, shadowcheck_admin role, permissions, views
-- ============================================================================

\echo '=============================='
\echo 'ShadowCheck DB Bootstrap'
\echo '=============================='

-- ============================================================================
-- 1. Create app schema
-- ============================================================================
\echo '[1/7] Creating app schema...'
CREATE SCHEMA IF NOT EXISTS app;

-- ============================================================================
-- PostgreSQL 18 Performance Configuration (ARM Graviton2)
-- ============================================================================
-- Database-level optimizer settings that persist across restarts.
-- Server-level resource limits (shared_buffers, work_mem) are in deploy-postgres.sh

-- Parallel query optimization for ARM (2 vCPU t4g.large)
ALTER DATABASE shadowcheck_db SET parallel_setup_cost = 100;
ALTER DATABASE shadowcheck_db SET parallel_tuple_cost = 0.01;
ALTER DATABASE shadowcheck_db SET min_parallel_table_scan_size = '8MB';
ALTER DATABASE shadowcheck_db SET min_parallel_index_scan_size = '512kB';
ALTER DATABASE shadowcheck_db SET enable_incremental_sort = on;

-- JIT compilation (excellent on ARM Graviton2)
ALTER DATABASE shadowcheck_db SET jit = on;
ALTER DATABASE shadowcheck_db SET jit_above_cost = 100000;
ALTER DATABASE shadowcheck_db SET jit_optimize_above_cost = 500000;

\echo '  Applied PostgreSQL 18 performance tuning for ARM'

-- ============================================================================
-- 2. Create shadowcheck_admin role
-- ============================================================================
\echo '[2/7] Creating shadowcheck_admin role...'

-- Bridge psql variable (from -v admin_password=xxx) into a GUC readable by PL/pgSQL
-- If the variable wasn't passed, default to empty string
\if :{?admin_password}
  SET app.admin_password = :'admin_password';
\else
  SET app.admin_password = '';
\endif

DO $$
DECLARE
    admin_pass text;
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'shadowcheck_admin') THEN
        -- Read from GUC set above (bridged from psql -v flag)
        BEGIN
            admin_pass := current_setting('app.admin_password');
        EXCEPTION WHEN OTHERS THEN
            admin_pass := NULL;
        END;

        IF admin_pass IS NULL OR admin_pass = '' THEN
            -- Generate a random password rather than using a hardcoded default
            admin_pass := encode(gen_random_bytes(24), 'base64');
            RAISE WARNING 'No admin password provided — generated random password: %', admin_pass;
        END IF;

        EXECUTE format('CREATE USER shadowcheck_admin WITH PASSWORD %L', admin_pass);
        RAISE NOTICE 'Created shadowcheck_admin role';
    ELSE
        -- Role exists — update password if one was provided so scs_rebuild always stays in sync
        IF admin_pass IS NOT NULL AND admin_pass != '' THEN
            EXECUTE format('ALTER USER shadowcheck_admin PASSWORD %L', admin_pass);
            RAISE NOTICE 'Updated shadowcheck_admin password';
        ELSE
            RAISE NOTICE 'shadowcheck_admin role already exists, no password provided — skipping';
        END IF;
    END IF;
END
$$;

-- ============================================================================
-- 3. Set search_path at role level
-- ============================================================================
\echo '[3/7] Setting search_path for roles...'

ALTER ROLE shadowcheck_user SET search_path TO app, public, topology, tiger;
ALTER ROLE shadowcheck_admin SET search_path TO app, public, topology, tiger;

-- ============================================================================
-- 4. Grant permissions
-- ============================================================================
\echo '[4/7] Granting permissions...'

-- Admin: connect + full access to both schemas
GRANT CONNECT ON DATABASE shadowcheck_db TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_admin;

-- User: connect + read-only
GRANT CONNECT ON DATABASE shadowcheck_db TO shadowcheck_user;
GRANT USAGE ON SCHEMA app TO shadowcheck_user;
GRANT USAGE ON SCHEMA public TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_user;

-- Auth exception: user needs session management
DO $$
BEGIN
    -- These may fail on fresh DB (tables don't exist yet) — that's OK
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE app.user_sessions TO shadowcheck_user';
    EXECUTE 'GRANT UPDATE (last_login) ON TABLE app.users TO shadowcheck_user';
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Auth tables do not exist yet — skipping session grants (migrations will handle)';
END
$$;

-- Default privileges for future objects created by shadowcheck_admin
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
    GRANT SELECT ON TABLES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
    GRANT SELECT ON TABLES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
    GRANT USAGE ON SEQUENCES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
    GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;

-- ============================================================================
-- 5. Create radio_manufacturers table with oui column
-- ============================================================================
\echo '[5/7] Creating radio_manufacturers table...'

CREATE TABLE IF NOT EXISTS app.radio_manufacturers (
    registry_type TEXT NOT NULL,
    oui_assignment_hex TEXT NOT NULL,
    prefix_24bit TEXT,
    prefix_28bit TEXT,
    prefix_36bit TEXT,
    organization_name TEXT NOT NULL,
    organization_address TEXT,
    -- Compatibility columns referenced by application code (list.ts, manufacturer.ts)
    oui TEXT GENERATED ALWAYS AS (oui_assignment_hex) STORED,
    oui_prefix_24bit TEXT GENERATED ALWAYS AS (prefix_24bit) STORED,
    manufacturer TEXT GENERATED ALWAYS AS (organization_name) STORED,
    address TEXT GENERATED ALWAYS AS (organization_address) STORED,
    PRIMARY KEY (registry_type, oui_assignment_hex)
);

-- Indexes (IF NOT EXISTS not supported for indexes on all PG versions, use DO block)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radio_manufacturers_oui') THEN
        CREATE INDEX idx_radio_manufacturers_oui ON app.radio_manufacturers(oui);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radio_manufacturers_oui_hex') THEN
        CREATE INDEX idx_radio_manufacturers_oui_hex ON app.radio_manufacturers(oui_assignment_hex);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_radio_manufacturers_prefix24') THEN
        CREATE INDEX idx_radio_manufacturers_prefix24 ON app.radio_manufacturers(prefix_24bit);
    END IF;
END
$$;

GRANT SELECT ON app.radio_manufacturers TO shadowcheck_user;
GRANT ALL ON app.radio_manufacturers TO shadowcheck_admin;

-- ============================================================================
-- 6. Create network_entries view
-- ============================================================================
\echo '[6/7] Creating network_entries view...'

-- Only create if app.networks exists (it won't on a truly fresh DB before ETL)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'app' AND table_name = 'networks') THEN

        -- Drop any stale materialized view with the same name
        DROP MATERIALIZED VIEW IF EXISTS app.network_entries CASCADE;
        DROP VIEW IF EXISTS app.network_entries CASCADE;

        CREATE OR REPLACE VIEW app.network_entries AS
        SELECT
            n.bssid,
            n.ssid,
            n.type,
            n.frequency,
            n.capabilities AS security,
            n.bestlevel AS signal,
            n.bestlat AS lat,
            n.bestlon AS lon,
            to_timestamp(n.lasttime_ms / 1000.0) AS last_seen,
            to_timestamp(n.lasttime_ms / 1000.0) AS first_seen,
            to_timestamp(n.lasttime_ms / 1000.0) AS observed_at,
            1 AS observations,
            0::double precision AS accuracy_meters,
            NULL::integer AS channel,
            NULL::text AS wps,
            NULL::text AS battery,
            NULL::text AS auth,
            0::double precision AS altitude_m,
            0::double precision AS min_altitude_m,
            0::double precision AS max_altitude_m,
            0::double precision AS altitude_accuracy_m,
            0::double precision AS altitude_span_m,
            0::double precision AS max_distance_meters,
            0::double precision AS last_altitude_m,
            1 AS unique_days,
            1 AS unique_locations,
            false AS is_sentinel,
            LEFT(REPLACE(n.bssid, ':', ''), 6) AS oui,
            NULL::text[] AS insecure_flags,
            NULL::text[] AS security_flags
        FROM app.networks n;

        GRANT SELECT ON app.network_entries TO shadowcheck_user;
        GRANT SELECT ON app.network_entries TO shadowcheck_admin;

        RAISE NOTICE 'Created network_entries view';
    ELSE
        RAISE NOTICE 'app.networks does not exist yet — skipping network_entries view (ETL will create it)';
    END IF;
END
$$;

-- ============================================================================
-- 7. Create schema_migrations tracking table
-- ============================================================================
\echo '[7/7] Creating schema_migrations tracking table...'

CREATE TABLE IF NOT EXISTS app.schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON app.schema_migrations TO shadowcheck_user;
GRANT ALL ON app.schema_migrations TO shadowcheck_admin;

\echo ''
\echo '=============================='
\echo 'Bootstrap complete!'
\echo '=============================='
