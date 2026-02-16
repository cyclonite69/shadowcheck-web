-- Add compatibility columns to radio_manufacturers for application code
-- list.ts references rm.oui, rm.manufacturer, rm.address
-- manufacturer.ts references oui_prefix_24bit
--
-- These are generated columns that mirror the canonical columns.
-- Safe to re-run: uses IF NOT EXISTS checks.

DO $$
BEGIN
    -- oui (alias for oui_assignment_hex)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'radio_manufacturers' AND column_name = 'oui'
    ) THEN
        ALTER TABLE app.radio_manufacturers
            ADD COLUMN oui TEXT GENERATED ALWAYS AS (oui_assignment_hex) STORED;
        CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_oui ON app.radio_manufacturers(oui);
        RAISE NOTICE 'Added oui column';
    END IF;

    -- oui_prefix_24bit (alias for prefix_24bit)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'radio_manufacturers' AND column_name = 'oui_prefix_24bit'
    ) THEN
        ALTER TABLE app.radio_manufacturers
            ADD COLUMN oui_prefix_24bit TEXT GENERATED ALWAYS AS (prefix_24bit) STORED;
        RAISE NOTICE 'Added oui_prefix_24bit column';
    END IF;

    -- manufacturer (alias for organization_name)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'radio_manufacturers' AND column_name = 'manufacturer'
    ) THEN
        ALTER TABLE app.radio_manufacturers
            ADD COLUMN manufacturer TEXT GENERATED ALWAYS AS (organization_name) STORED;
        RAISE NOTICE 'Added manufacturer column';
    END IF;

    -- address (alias for organization_address)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'app' AND table_name = 'radio_manufacturers' AND column_name = 'address'
    ) THEN
        ALTER TABLE app.radio_manufacturers
            ADD COLUMN address TEXT GENERATED ALWAYS AS (organization_address) STORED;
        RAISE NOTICE 'Added address column';
    END IF;
END
$$;
