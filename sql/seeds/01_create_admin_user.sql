-- ============================================================================
-- Create admin user
-- ============================================================================
-- DO NOT hardcode passwords in this file.
-- Use deploy/aws/scripts/init-admin-user.sh which generates a random
-- password at deploy time, hashes it with bcrypt, and prints it once.
--
-- This file only exists as a fallback template. The password_hash below
-- is a PLACEHOLDER that will not authenticate — you must run the init
-- script or manually generate a bcrypt hash.
-- ============================================================================

-- Placeholder hash (not a valid password — forces use of init script)
INSERT INTO app.users (username, password_hash, email, role, force_password_change, created_at)
VALUES (
  'admin',
  '$2b$10$PLACEHOLDER_INVALID_HASH_RUN_INIT_SCRIPT_INSTEAD',
  'admin@shadowcheck.local',
  'admin',
  true,
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Verify
SELECT username, email, role, force_password_change, created_at FROM app.users WHERE username = 'admin';
