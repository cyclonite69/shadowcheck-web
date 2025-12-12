\echo 'Loading J24 locations and networks'
-- Usage:
-- psql -v locations_csv='/path/to/j24_locations.csv' \
--      -v networks_csv='/path/to/j24_networks.csv' \
--      -f etl/02_load/01_copy_j24.sql

TRUNCATE staging_locations_j24;
DELETE FROM staging_networks WHERE device_id = 'j24';

\copy staging_locations_j24 (
  source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
) FROM :'locations_csv' CSV;

\copy staging_networks (
  device_id, bssid, ssid, frequency, capabilities, lasttime, lastlat, lastlon,
  type, bestlevel, bestlat, bestlon, rcois, mfgrid, service
) FROM :'networks_csv' CSV;
