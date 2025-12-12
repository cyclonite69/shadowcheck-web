\echo 'Promote enriched staging into observations'

-- Idempotent reload: clear observations for current devices.
DELETE FROM observations
WHERE source_tag IN ('j24', 'g63', 's22_main', 's22_backup');

INSERT INTO observations (
  device_id, bssid, ssid, level, lat, lon, altitude, accuracy,
  time, external, mfgrid, source_tag, source_pk, geom, time_ms
)
SELECT
  device_id,
  bssid,
  ssid,
  level,
  lat,
  lon,
  altitude,
  accuracy,
  observed_at AS time,
  external,
  mfgrid,
  source_tag,
  source_pk,
  geom,
  time_ms
FROM staging_locations_all_enriched;
