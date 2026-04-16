BEGIN;

-- 1. Enable trigram extension if not exists (required for fast ILIKE search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add trigram index to orphan SSIDs
CREATE INDEX IF NOT EXISTS idx_networks_orphans_ssid_trgm
  ON app.networks_orphans USING gin (ssid gin_trgm_ops);

-- 3. Add last_promoted_at to backfill tracking
ALTER TABLE app.orphan_network_backfills
  ADD COLUMN IF NOT EXISTS last_promoted_at timestamptz;

-- 4. Ensure unique index on orphan BSSID (it should be PK but just in case)
-- (It already has PK from 20260404_add_networks_orphans_table.sql)

COMMIT;
