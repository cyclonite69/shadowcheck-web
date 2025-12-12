\echo 'Merge device staging tables into unified staging_locations_all'

TRUNCATE staging_locations_all;

INSERT INTO staging_locations_all (
  device_id, source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
)
SELECT 'j24', source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
FROM staging_locations_j24
UNION ALL
SELECT 'g63', source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
FROM staging_locations_g63
UNION ALL
SELECT 's22_main', source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
FROM staging_locations_s22_main
UNION ALL
SELECT 's22_backup', source_pk, bssid, level, lat, lon, altitude, accuracy, time_ms, external, mfgrid
FROM staging_locations_s22_backup;
