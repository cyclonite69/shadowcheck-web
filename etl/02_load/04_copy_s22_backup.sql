\echo 'Loading S22 backup locations and networks'
-- Usage:
-- psql -v locations_csv='/path/to/s22_backup_locations.csv' \
--      -v networks_csv='/path/to/s22_backup_networks.csv' \
--      -f etl/02_load/04_copy_s22_backup.sql

TRUNCATE staging_locations_s22_backup;
DELETE FROM staging_networks WHERE device_id = 's22_backup';

\copy staging_locations_s22_backup (
  source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
) FROM :'locations_csv' CSV;

\copy staging_networks (
  device_id, bssid, ssid, frequency, capabilities, lasttime, lastlat, lastlon,
  type, bestlevel, bestlat, bestlon, rcois, mfgrid, service
) FROM :'networks_csv' CSV;
