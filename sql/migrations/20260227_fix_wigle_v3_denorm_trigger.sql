-- Fix WiGLE v3 denormalization trigger: wigle_v3_observations uses netid (not bssid)
-- and backfill counts so app.networks stays in sync.

BEGIN;

CREATE OR REPLACE FUNCTION app.update_networks_wigle_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_netid text := COALESCE(NEW.netid, OLD.netid);
BEGIN
  UPDATE app.networks n
  SET wigle_v3_observation_count = w.cnt,
      wigle_v3_last_import_at = NOW()
  FROM (
    SELECT COUNT(*)::integer AS cnt
    FROM app.wigle_v3_observations
    WHERE netid = target_netid
  ) w
  WHERE UPPER(n.bssid) = UPPER(target_netid);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wigle_v3_count_update ON app.wigle_v3_observations;
CREATE TRIGGER trg_wigle_v3_count_update
AFTER INSERT OR DELETE ON app.wigle_v3_observations
FOR EACH ROW EXECUTE FUNCTION app.update_networks_wigle_counts();

-- Backfill counts for all networks that currently have WiGLE v3 rows.
WITH counts AS (
  SELECT netid, COUNT(*)::integer AS cnt
  FROM app.wigle_v3_observations
  GROUP BY netid
)
UPDATE app.networks n
SET wigle_v3_observation_count = c.cnt,
    wigle_v3_last_import_at = NOW()
FROM counts c
WHERE UPPER(n.bssid) = UPPER(c.netid);

-- Reset stale positive counts when no matching rows exist.
UPDATE app.networks n
SET wigle_v3_observation_count = 0
WHERE n.wigle_v3_observation_count IS DISTINCT FROM 0
  AND NOT EXISTS (
    SELECT 1
    FROM app.wigle_v3_observations w
    WHERE UPPER(w.netid) = UPPER(n.bssid)
  );

REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;

COMMIT;
