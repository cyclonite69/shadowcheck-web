-- ==========================================================================
-- BASELINE 007: Runtime Contracts
-- ==========================================================================
-- This baseline consolidates the following migrations:
-- - 20260404_add_networks_orphans_table.sql
-- - 20260405_add_orphan_network_backfill_tracking.sql
-- - 20260405_normalize_radio_manufacturers.sql


-- ======== SOURCE: 20260404_add_networks_orphans_table.sql ========

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

-- ======== SOURCE: 20260405_add_orphan_network_backfill_tracking.sql ========

BEGIN;

CREATE TABLE IF NOT EXISTS app.orphan_network_backfills (
  bssid text PRIMARY KEY REFERENCES app.networks_orphans(bssid) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_attempted',
  matched_netid text,
  detail_imported boolean NOT NULL DEFAULT false,
  observations_imported integer NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT orphan_network_backfills_status_check CHECK (
    status IN ('not_attempted', 'wigle_match_imported_v3', 'no_wigle_match', 'error')
  )
);

CREATE INDEX IF NOT EXISTS idx_orphan_network_backfills_status
  ON app.orphan_network_backfills (status, last_attempted_at DESC);

ALTER TABLE app.orphan_network_backfills OWNER TO shadowcheck_admin;

GRANT SELECT ON app.orphan_network_backfills TO shadowcheck_user;
GRANT ALL PRIVILEGES ON app.orphan_network_backfills TO shadowcheck_admin;

COMMIT;

-- ======== SOURCE: 20260405_normalize_radio_manufacturers.sql ========

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'radio_manufacturers'
      AND column_name = 'registry_type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'radio_manufacturers'
      AND column_name = 'bit_length'
  ) THEN
    DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv CASCADE;
    DROP VIEW IF EXISTS app.api_network_explorer CASCADE;

    ALTER TABLE app.radio_manufacturers RENAME TO radio_manufacturers_legacy;

    CREATE TABLE app.radio_manufacturers (
      prefix TEXT NOT NULL,
      bit_length INTEGER NOT NULL CHECK (bit_length IN (24, 28, 36)),
      manufacturer TEXT,
      address TEXT,
      manufacturer_source TEXT NOT NULL DEFAULT 'legacy_migration',
      address_source TEXT,
      sources JSONB NOT NULL DEFAULT '[]'::jsonb,
      registries JSONB NOT NULL DEFAULT '[]'::jsonb,
      alt_manufacturers JSONB NOT NULL DEFAULT '[]'::jsonb,
      rows_merged INTEGER NOT NULL DEFAULT 1,
      prefix_hex_len INTEGER GENERATED ALWAYS AS (bit_length / 4) STORED,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      oui TEXT GENERATED ALWAYS AS (prefix) STORED,
      PRIMARY KEY (prefix, bit_length)
    );

    INSERT INTO app.radio_manufacturers (
      prefix,
      bit_length,
      manufacturer,
      address,
      manufacturer_source,
      address_source,
      sources,
      registries,
      alt_manufacturers,
      rows_merged
    )
    SELECT
      CASE
        WHEN NULLIF(prefix_36bit, '') IS NOT NULL THEN UPPER(prefix_36bit)
        WHEN NULLIF(prefix_28bit, '') IS NOT NULL THEN UPPER(prefix_28bit)
        WHEN NULLIF(prefix_24bit, '') IS NOT NULL THEN UPPER(prefix_24bit)
        ELSE UPPER(oui_assignment_hex)
      END AS prefix,
      CASE
        WHEN NULLIF(prefix_36bit, '') IS NOT NULL THEN 36
        WHEN NULLIF(prefix_28bit, '') IS NOT NULL THEN 28
        ELSE 24
      END AS bit_length,
      organization_name AS manufacturer,
      organization_address AS address,
      'legacy_migration' AS manufacturer_source,
      CASE
        WHEN organization_address IS NULL OR btrim(organization_address) = '' THEN NULL
        ELSE 'legacy_migration'
      END AS address_source,
      jsonb_build_array('legacy_migration') AS sources,
      CASE
        WHEN registry_type IS NULL OR btrim(registry_type) = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(registry_type)
      END AS registries,
      CASE
        WHEN organization_name IS NULL OR btrim(organization_name) = '' THEN '[]'::jsonb
        ELSE jsonb_build_array(organization_name)
      END AS alt_manufacturers,
      1 AS rows_merged
    FROM app.radio_manufacturers_legacy;

    DROP TABLE app.radio_manufacturers_legacy;
  END IF;
END $$;

ALTER TABLE app.radio_manufacturers
  ADD COLUMN IF NOT EXISTS bit_length INTEGER,
  ADD COLUMN IF NOT EXISTS manufacturer_source TEXT,
  ADD COLUMN IF NOT EXISTS address_source TEXT,
  ADD COLUMN IF NOT EXISTS sources JSONB,
  ADD COLUMN IF NOT EXISTS registries JSONB,
  ADD COLUMN IF NOT EXISTS alt_manufacturers JSONB,
  ADD COLUMN IF NOT EXISTS rows_merged INTEGER,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE app.radio_manufacturers
SET bit_length = COALESCE(
      bit_length,
      CASE
        WHEN length(prefix) = 9 THEN 36
        WHEN length(prefix) = 7 THEN 28
        ELSE 24
      END
    ),
    manufacturer_source = COALESCE(manufacturer_source, 'legacy_migration'),
    address_source = CASE
      WHEN address IS NULL OR btrim(address) = '' THEN address_source
      ELSE COALESCE(address_source, manufacturer_source, 'legacy_migration')
    END,
    sources = COALESCE(sources, '[]'::jsonb),
    registries = COALESCE(registries, '[]'::jsonb),
    alt_manufacturers = COALESCE(alt_manufacturers, '[]'::jsonb),
    rows_merged = COALESCE(rows_merged, 1)
WHERE bit_length IS NULL
   OR manufacturer_source IS NULL
   OR sources IS NULL
   OR registries IS NULL
   OR alt_manufacturers IS NULL
   OR rows_merged IS NULL
   OR (address IS NOT NULL AND btrim(address) <> '' AND address_source IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'radio_manufacturers'
      AND column_name = 'prefix_hex_len'
  ) THEN
    ALTER TABLE app.radio_manufacturers
      ADD COLUMN prefix_hex_len INTEGER GENERATED ALWAYS AS (bit_length / 4) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'app'
      AND table_name = 'radio_manufacturers'
      AND column_name = 'oui'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE app.radio_manufacturers
      DROP COLUMN IF EXISTS oui;
    ALTER TABLE app.radio_manufacturers
      ADD COLUMN oui TEXT GENERATED ALWAYS AS (prefix) STORED;
  END IF;
END $$;

ALTER TABLE app.radio_manufacturers
  ALTER COLUMN bit_length SET NOT NULL,
  ALTER COLUMN manufacturer DROP NOT NULL,
  ALTER COLUMN manufacturer_source SET NOT NULL,
  ALTER COLUMN sources SET DEFAULT '[]'::jsonb,
  ALTER COLUMN sources SET NOT NULL,
  ALTER COLUMN registries SET DEFAULT '[]'::jsonb,
  ALTER COLUMN registries SET NOT NULL,
  ALTER COLUMN alt_manufacturers SET DEFAULT '[]'::jsonb,
  ALTER COLUMN alt_manufacturers SET NOT NULL,
  ALTER COLUMN rows_merged SET DEFAULT 1,
  ALTER COLUMN rows_merged SET NOT NULL;

DO $$
DECLARE
  existing_pkey_name TEXT;
  existing_pkey_def TEXT;
BEGIN
  SELECT conname, pg_get_constraintdef(oid)
  INTO existing_pkey_name, existing_pkey_def
  FROM pg_constraint
  WHERE conrelid = 'app.radio_manufacturers'::regclass
    AND contype = 'p'
  LIMIT 1;

  IF existing_pkey_name IS NULL THEN
    ALTER TABLE app.radio_manufacturers
      ADD CONSTRAINT radio_manufacturers_pkey PRIMARY KEY (prefix, bit_length);
  ELSIF existing_pkey_def <> 'PRIMARY KEY (prefix, bit_length)' THEN
    EXECUTE format(
      'ALTER TABLE app.radio_manufacturers DROP CONSTRAINT %I',
      existing_pkey_name
    );
    ALTER TABLE app.radio_manufacturers
      ADD CONSTRAINT radio_manufacturers_pkey PRIMARY KEY (prefix, bit_length);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'app.radio_manufacturers'::regclass
      AND conname = 'radio_manufacturers_bit_length_check'
  ) THEN
    ALTER TABLE app.radio_manufacturers
      ADD CONSTRAINT radio_manufacturers_bit_length_check
      CHECK (bit_length IN (24, 28, 36));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_oui
  ON app.radio_manufacturers (oui);
CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_prefix24
  ON app.radio_manufacturers (prefix)
  WHERE bit_length = 24;
CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_manufacturer_gin
  ON app.radio_manufacturers
  USING gin (manufacturer gin_trgm_ops);

ALTER TABLE app.radio_manufacturers OWNER TO shadowcheck_admin;

GRANT SELECT ON app.radio_manufacturers TO shadowcheck_user;
GRANT ALL PRIVILEGES ON app.radio_manufacturers TO shadowcheck_admin;

COMMIT;
