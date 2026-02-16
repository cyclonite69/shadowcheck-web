-- Cleanup duplicate tables between public and app schemas
-- All application tables belong in the app schema.
-- The public versions are stale duplicates left over from the schema migration.
--
-- Run as: docker exec -i shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db < this_file.sql

DROP TABLE IF EXISTS public.threat_scores_cache CASCADE;
DROP TABLE IF EXISTS public.wigle_v3_network_details CASCADE;
DROP TABLE IF EXISTS public.wigle_v3_observations CASCADE;

COMMENT ON SCHEMA app IS 'ShadowCheck application schema - all tables belong here';
