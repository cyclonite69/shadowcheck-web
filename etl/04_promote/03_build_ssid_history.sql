\echo 'Rebuild ssid_history from observations'

DELETE FROM ssid_history
WHERE bssid IN (
  SELECT DISTINCT bssid FROM observations WHERE source_tag IN ('j24', 'g63', 's22_main', 's22_backup')
);

INSERT INTO ssid_history (bssid, ssid, first_seen, last_seen)
SELECT
  bssid,
  ssid,
  MIN(time) AS first_seen,
  MAX(time) AS last_seen
FROM observations
WHERE source_tag IN ('j24', 'g63', 's22_main', 's22_backup')
GROUP BY bssid, ssid;
