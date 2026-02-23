ALTER TABLE app.networks
  ADD COLUMN IF NOT EXISTS wigle_v3_observation_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wigle_v3_last_import_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_networks_wigle_count
  ON app.networks (wigle_v3_observation_count DESC)
  WHERE wigle_v3_observation_count > 0;

CREATE OR REPLACE FUNCTION update_networks_wigle_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE app.networks
  SET wigle_v3_observation_count = (
        SELECT COUNT(*) FROM app.wigle_v3_observations
        WHERE bssid = COALESCE(NEW.bssid, OLD.bssid)
      ),
      wigle_v3_last_import_at = NOW()
  WHERE bssid = COALESCE(NEW.bssid, OLD.bssid);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wigle_v3_count_update ON app.wigle_v3_observations;
CREATE TRIGGER trg_wigle_v3_count_update
AFTER INSERT OR DELETE ON app.wigle_v3_observations
FOR EACH ROW EXECUTE FUNCTION update_networks_wigle_counts();

ALTER TABLE app.network_notes
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
