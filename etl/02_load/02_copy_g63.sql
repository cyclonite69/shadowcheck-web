\echo 'Loading G63 locations and networks'
-- Usage:
-- psql -v locations_csv='/path/to/g63_locations.csv' \
--      -v networks_csv='/path/to/g63_networks.csv' \
--      -f etl/02_load/02_copy_g63.sql

TRUNCATE staging_locations_g63;
DELETE FROM staging_networks WHERE device_id = 'g63';

\copy staging_locations_g63 (
  source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
) FROM :'locations_csv' CSV;

\copy staging_networks (
  device_id, bssid, ssid, frequency, capabilities, lasttime, lastlat, lastlon,
  type, bestlevel, bestlat, bestlon, rcois, mfgrid, service
) FROM :'networks_csv' CSV;
