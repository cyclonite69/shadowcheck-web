-- Tighten shadowcheck_user to truly read-only (except auth tables)
-- Transfer schema ownership to shadowcheck_admin
-- Set default privileges for future tables
--
-- Prerequisites: 20260129_implement_db_security.sql must have run first
-- Run as superuser (postgres) or the current schema owner

-- ============================================================================
-- 1. Transfer schema ownership to shadowcheck_admin
-- ============================================================================
-- The schemas may currently be owned by shadowcheck_user (the POSTGRES_USER in Docker).
-- shadowcheck_admin should own both schemas so it can CREATE/DROP objects.

ALTER SCHEMA app OWNER TO shadowcheck_admin;
ALTER SCHEMA public OWNER TO shadowcheck_admin;

-- Transfer ownership of all existing tables, sequences, and functions
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Transfer tables in app schema
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
        EXECUTE format('ALTER TABLE app.%I OWNER TO shadowcheck_admin', r.tablename);
    END LOOP;

    -- Transfer tables in public schema
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO shadowcheck_admin', r.tablename);
    END LOOP;

    -- Transfer sequences in app schema
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'app' LOOP
        EXECUTE format('ALTER SEQUENCE app.%I OWNER TO shadowcheck_admin', r.sequencename);
    END LOOP;

    -- Transfer sequences in public schema
    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO shadowcheck_admin', r.sequencename);
    END LOOP;

    -- Transfer materialized views in app schema
    FOR r IN SELECT matviewname FROM pg_matviews WHERE schemaname = 'app' LOOP
        EXECUTE format('ALTER MATERIALIZED VIEW app.%I OWNER TO shadowcheck_admin', r.matviewname);
    END LOOP;

    -- Transfer materialized views in public schema
    FOR r IN SELECT matviewname FROM pg_matviews WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER MATERIALIZED VIEW public.%I OWNER TO shadowcheck_admin', r.matviewname);
    END LOOP;
END
$$;

-- ============================================================================
-- 2. Revoke ALL write permissions from shadowcheck_user
-- ============================================================================

-- Revoke everything first, then grant back selectively
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM shadowcheck_user;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM shadowcheck_user;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM shadowcheck_user;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM shadowcheck_user;

-- ============================================================================
-- 3. Grant read-only access to shadowcheck_user
-- ============================================================================

-- Schema usage
GRANT USAGE ON SCHEMA app TO shadowcheck_user;
GRANT USAGE ON SCHEMA public TO shadowcheck_user;

-- SELECT on all tables (including materialized views)
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO shadowcheck_user;

-- Sequence usage (needed for SELECT queries that reference sequences)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_user;

-- ============================================================================
-- 4. Auth exception: shadowcheck_user needs session management
-- ============================================================================

-- Sessions: full CRUD (login creates, logout deletes, refresh updates)
GRANT INSERT, UPDATE, DELETE ON TABLE app.user_sessions TO shadowcheck_user;

-- Users: only update last_login column
GRANT UPDATE (last_login) ON TABLE app.users TO shadowcheck_user;

-- Sequences used by session inserts
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;

-- ============================================================================
-- 5. Ensure shadowcheck_admin has full privileges
-- ============================================================================

GRANT ALL PRIVILEGES ON SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_admin;

-- ============================================================================
-- 6. Default privileges for future objects
-- ============================================================================
-- When shadowcheck_admin creates new tables/sequences, auto-grant SELECT to shadowcheck_user

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
    GRANT SELECT ON TABLES TO shadowcheck_user;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
    GRANT SELECT ON TABLES TO shadowcheck_user;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
    GRANT USAGE ON SEQUENCES TO shadowcheck_user;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO shadowcheck_user;

-- Also grant execute on functions (needed for DB functions called via SELECT)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_user;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
    GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;
