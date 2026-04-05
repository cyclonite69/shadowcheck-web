\echo 'Phase 3 baseline 001: extensions, schemas, auth, and schema_migrations'

-- Concrete assembly artifact for the baseline refresh.
-- Not part of sql/run-migrations.sh yet.
-- Applies the current fold-candidate source migrations in order.
--
-- Bootstrap sets shadowcheck_admin search_path to app, public, topology, tiger.
-- Without overriding that here, CREATE EXTENSION installs PostGIS into app and
-- later migrations that reference public.geometry fail on a fresh DB.

SET search_path TO public;

\ir ../migrations/20260216_consolidated_001_extensions_and_schemas.sql

SET search_path TO app, public, topology, tiger;
\ir ../migrations/20260216_consolidated_003_auth_and_users.sql
