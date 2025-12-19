\echo 'Loading networks from CSV (networks-only mode)'
-- Usage:
-- psql -v device_id='g63' \
--      -v networks_csv='/path/to/g63_networks.csv' \
--      -f etl/02_load/05_copy_networks_only.sql

-- Clean staging for this device
DELETE FROM staging_networks WHERE device_id = :'device_id';

-- Import networks CSV with header
\copy staging_networks (device_id, bssid, ssid, frequency, capabilities, lasttime, lastlat, lastlon, type, bestlevel, bestlat, bestlon, rcois, mfgrid, service) FROM :'networks_csv' CSV HEADER

-- Report import statistics
\echo 'Import statistics:'
SELECT
  device_id AS device_loaded,
  COUNT(*) AS networks_imported,
  COUNT(DISTINCT type) AS network_types,
  COUNT(*) FILTER (WHERE ssid IS NULL) AS without_ssid
FROM staging_networks
WHERE device_id = :'device_id'
GROUP BY device_id;
