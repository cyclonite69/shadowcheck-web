-- Post-migration verification for:
--   sql/migrations/20260306_harden_db_roles_and_ownership.sql
--
-- Usage:
--   psql -U shadowcheck_admin -d shadowcheck_db -f scripts/verify_db_role_hardening.sql
--
-- This script is read-only and writes no secrets to disk.

\pset pager off
\timing on

\echo '=== 1) Role existence ==='
SELECT rolname
FROM pg_roles
WHERE rolname IN ('shadowcheck_admin', 'shadowcheck_user')
ORDER BY rolname;

\echo '=== 2) Schema ownership (app/public) ==='
SELECT nspname AS schema_name, pg_get_userbyid(nspowner) AS owner
FROM pg_namespace
WHERE nspname IN ('app', 'public')
ORDER BY nspname;

\echo '=== 3) Non-admin owned objects in app/public (should be 0 ideally) ==='
WITH objs AS (
  SELECT n.nspname AS schema_name,
         c.relname AS object_name,
         c.relkind,
         pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('app', 'public')
    AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
)
SELECT schema_name,
       relkind,
       COUNT(*) AS non_admin_owned
FROM objs
WHERE owner <> 'shadowcheck_admin'
GROUP BY schema_name, relkind
ORDER BY schema_name, relkind;

\echo '=== 4) Non-admin owned routines in app/public (should be 0 ideally) ==='
SELECT n.nspname AS schema_name,
       COUNT(*) AS non_admin_owned_routines
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('app', 'public')
  AND pg_get_userbyid(p.proowner) <> 'shadowcheck_admin'
GROUP BY n.nspname
ORDER BY n.nspname;

\echo '=== 5) shadowcheck_user schema privileges (expect USAGE=true, CREATE=false) ==='
SELECT schema_name,
       has_schema_privilege('shadowcheck_user', schema_name, 'USAGE') AS can_usage,
       has_schema_privilege('shadowcheck_user', schema_name, 'CREATE') AS can_create
FROM (VALUES ('app'), ('public')) AS s(schema_name)
ORDER BY schema_name;

\echo '=== 6) shadowcheck_user write privilege sample (expect false except auth exceptions) ==='
-- sampled across a few high-value tables
SELECT table_schema,
       table_name,
       has_table_privilege('shadowcheck_user', format('%I.%I', table_schema, table_name), 'INSERT') AS can_insert,
       has_table_privilege('shadowcheck_user', format('%I.%I', table_schema, table_name), 'UPDATE') AS can_update,
       has_table_privilege('shadowcheck_user', format('%I.%I', table_schema, table_name), 'DELETE') AS can_delete
FROM (
  VALUES
    ('app', 'observations'),
    ('app', 'networks'),
    ('app', 'network_threat_scores'),
    ('app', 'network_tags'),
    ('app', 'user_sessions'),
    ('app', 'users')
) t(table_schema, table_name)
ORDER BY table_schema, table_name;

\echo '=== 7) Required auth exceptions ==='
SELECT
  has_table_privilege('shadowcheck_user', 'app.user_sessions', 'INSERT,UPDATE,DELETE') AS user_sessions_iud,
  has_table_privilege('shadowcheck_user', 'app.users', 'UPDATE') AS users_update,
  has_column_privilege('shadowcheck_user', 'app.users', 'last_login', 'UPDATE') AS users_last_login_update;

\echo '=== 8) shadowcheck_user SELECT coverage in app schema ==='
SELECT
  COUNT(*) AS total_tables,
  COUNT(*) FILTER (
    WHERE has_table_privilege('shadowcheck_user', format('%I.%I', schemaname, tablename), 'SELECT')
  ) AS select_granted_tables,
  COUNT(*) FILTER (
    WHERE NOT has_table_privilege('shadowcheck_user', format('%I.%I', schemaname, tablename), 'SELECT')
  ) AS missing_select_tables
FROM pg_tables
WHERE schemaname = 'app';

\echo '=== 9) shadowcheck_admin broad privileges sanity ==='
SELECT
  has_schema_privilege('shadowcheck_admin', 'app', 'USAGE,CREATE') AS admin_app_schema,
  has_schema_privilege('shadowcheck_admin', 'public', 'USAGE,CREATE') AS admin_public_schema,
  has_table_privilege('shadowcheck_admin', 'app.networks', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS admin_networks_all,
  has_table_privilege('shadowcheck_admin', 'app.user_sessions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS admin_sessions_all;

\echo '=== 10) Default privileges for future shadowcheck_admin objects ==='
SELECT
  COALESCE(n.nspname, '(all)') AS schema_name,
  d.defaclobjtype,
  d.defaclacl::text AS acl
FROM pg_default_acl d
LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
JOIN pg_roles r ON r.oid = d.defaclrole
WHERE r.rolname = 'shadowcheck_admin'
ORDER BY schema_name, d.defaclobjtype;

\echo '=== 11) Any direct privileges granted to PUBLIC in app schema tables ==='
SELECT table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'PUBLIC'
  AND table_schema = 'app'
ORDER BY table_name, privilege_type;

\echo '=== Verification complete ==='
