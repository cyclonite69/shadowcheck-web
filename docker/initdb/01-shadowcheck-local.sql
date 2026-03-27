DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shadowcheck_admin') THEN
    CREATE ROLE shadowcheck_admin LOGIN;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION shadowcheck_user;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA app;

GRANT CONNECT ON DATABASE shadowcheck_db TO shadowcheck_admin;
GRANT USAGE ON SCHEMA app TO shadowcheck_admin;
GRANT USAGE ON SCHEMA public TO shadowcheck_admin;
ALTER ROLE shadowcheck_user SET search_path = app, public;
ALTER ROLE shadowcheck_admin SET search_path = app, public;
