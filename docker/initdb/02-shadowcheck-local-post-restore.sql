-- Post-restore privilege re-application for local Docker
-- This file is run AFTER a database dump is restored (via restore-local-backup.sh).
-- It ensures shadowcheck_user (read-only) and shadowcheck_admin (admin) roles
-- have the correct permissions after the restore.
--
-- Note: This is NOT the bootstrap file. Bootstrap (01-shadowcheck-local.sql) runs once
-- when the Docker container first starts. This file ensures post-restore consistency.

\set ON_ERROR_STOP on

ALTER ROLE shadowcheck_user NOSUPERUSER NOCREATEDB NOCREATEROLE;
ALTER ROLE shadowcheck_admin SUPERUSER CREATEDB CREATEROLE;

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION shadowcheck_admin;
ALTER SCHEMA app OWNER TO shadowcheck_admin;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA app;

GRANT CONNECT ON DATABASE :db_name TO shadowcheck_user;
GRANT CONNECT ON DATABASE :db_name TO shadowcheck_admin;
GRANT USAGE ON SCHEMA app TO shadowcheck_user;
GRANT USAGE ON SCHEMA public TO shadowcheck_user;
GRANT USAGE ON SCHEMA app TO shadowcheck_admin;
GRANT USAGE ON SCHEMA public TO shadowcheck_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT SELECT ON TABLES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT SELECT ON TABLES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;

REVOKE CREATE ON SCHEMA app FROM shadowcheck_user;
REVOKE CREATE ON SCHEMA public FROM shadowcheck_user;
