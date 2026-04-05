BEGIN;

CREATE TABLE IF NOT EXISTS app.networks_orphans (
  LIKE app.networks INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING CONSTRAINTS
);

ALTER TABLE app.networks_orphans
  ADD COLUMN IF NOT EXISTS moved_at timestamptz NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS move_reason text NOT NULL DEFAULT 'manual_migration';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'networks_orphans_pkey'
      AND conrelid = 'app.networks_orphans'::regclass
  ) THEN
    ALTER TABLE app.networks_orphans
      ADD CONSTRAINT networks_orphans_pkey PRIMARY KEY (bssid);
  END IF;
END $$;

ALTER TABLE app.networks_orphans OWNER TO shadowcheck_admin;

CREATE INDEX IF NOT EXISTS idx_networks_orphans_moved_at
  ON app.networks_orphans (moved_at DESC);

GRANT SELECT ON app.networks_orphans TO shadowcheck_user;
GRANT ALL PRIVILEGES ON app.networks_orphans TO shadowcheck_admin;

COMMIT;
