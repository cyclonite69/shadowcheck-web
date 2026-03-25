-- Migration: Re-grant app schema permissions to all roles
-- Date: 2026-03-25
-- Purpose:
--   DROP MATERIALIZED VIEW ... CASCADE silently revokes all grants on the
--   dropped object. Any migration that recreates an MV must re-grant access.
--   This migration does a blanket re-grant on all current objects in the app
--   schema so all roles are in a known-good state regardless of migration order.
--
--   Run this migration last (highest timestamp) so it always runs after any
--   migration that drops/recreates objects.

-- shadowcheck_user
GRANT USAGE ON SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL MATERIALIZED VIEWS IN SCHEMA app TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_user;

-- grafana_reader (conditional — role may not exist on all installs)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_reader') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA app TO grafana_reader';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA app TO grafana_reader';
        EXECUTE 'GRANT SELECT ON ALL MATERIALIZED VIEWS IN SCHEMA app TO grafana_reader';
        EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO grafana_reader';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO grafana_reader';
    END IF;
END
$$;
