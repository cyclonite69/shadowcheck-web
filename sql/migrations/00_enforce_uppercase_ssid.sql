-- Migration: Enforce UPPERCASE SSID
-- This ensures all SSIDs are stored in uppercase for consistency

-- Create function to automatically uppercase SSID on insert/update
CREATE OR REPLACE FUNCTION app.uppercase_ssid_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Convert SSID to uppercase if not null
  IF NEW.ssid IS NOT NULL THEN
    NEW.ssid = UPPER(NEW.ssid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for networks table
DROP TRIGGER IF EXISTS trigger_uppercase_ssid_networks ON app.networks;
CREATE TRIGGER trigger_uppercase_ssid_networks
  BEFORE INSERT OR UPDATE OF ssid ON app.networks
  FOR EACH ROW
  EXECUTE FUNCTION app.uppercase_ssid_trigger();

-- Create triggers for legacy tables (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'networks_legacy') THEN
    DROP TRIGGER IF EXISTS trigger_uppercase_ssid_networks_legacy ON app.networks_legacy;
    CREATE TRIGGER trigger_uppercase_ssid_networks_legacy
      BEFORE INSERT OR UPDATE OF ssid ON app.networks_legacy
      FOR EACH ROW
      EXECUTE FUNCTION app.uppercase_ssid_trigger();
  END IF;
END $$;

-- Update existing SSIDs to uppercase
UPDATE app.networks SET ssid = UPPER(ssid) WHERE ssid IS NOT NULL;

-- Update legacy table if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'app' AND table_name = 'networks_legacy') THEN
    EXECUTE 'UPDATE app.networks_legacy SET ssid = UPPER(ssid) WHERE ssid IS NOT NULL';
  END IF;
END $$;

-- Create index on uppercase SSID for faster searches
CREATE INDEX IF NOT EXISTS idx_networks_ssid_upper ON app.networks(UPPER(ssid));

COMMENT ON FUNCTION app.uppercase_ssid_trigger() IS 'Automatically converts SSID to uppercase before insert/update';
