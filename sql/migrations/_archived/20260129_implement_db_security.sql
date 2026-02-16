-- Implement Database Security & Admin Gating
-- This script creates the shadowcheck_admin user and restricts shadowcheck_user to read-only access.

-- 1. Create shadowcheck_admin user (admin operations only)
-- Note: Change 'secure_password_here' to a strong password
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'shadowcheck_admin') THEN
        CREATE USER shadowcheck_admin WITH PASSWORD 'changeme';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE shadowcheck_db TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_admin;

-- 2. Restrict shadowcheck_user to READ-ONLY
-- Ensure it can connect
GRANT CONNECT ON DATABASE shadowcheck_db TO shadowcheck_user;
GRANT USAGE ON SCHEMA public TO shadowcheck_user;
GRANT USAGE ON SCHEMA app TO shadowcheck_user;

-- Grant SELECT on everything
GRANT SELECT ON ALL TABLES IN SCHEMA public TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_user;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;

-- Exception: shadowcheck_user NEEDS to be able to manage sessions and update last_login
GRANT INSERT, UPDATE, DELETE ON TABLE app.user_sessions TO shadowcheck_user;
GRANT UPDATE ON TABLE app.users TO shadowcheck_user;

-- Remove write permissions from everything else
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM shadowcheck_user;
-- Revoke from app schema except for the exceptions above
REVOKE INSERT, DELETE ON TABLE app.users FROM shadowcheck_user;
-- Restrict update on users to specific columns if possible, otherwise just grant UPDATE
-- GRANT UPDATE (last_login) ON TABLE app.users TO shadowcheck_user;

-- Ensure shadowcheck_admin can still do everything
GRANT ALL PRIVILEGES ON TABLE app.user_sessions TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON TABLE app.users TO shadowcheck_admin;
