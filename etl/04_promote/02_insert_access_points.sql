\echo 'Build or refresh access_points'

WITH recent_ssid AS (
  SELECT DISTINCT ON (o.bssid)
    o.bssid,
    o.ssid
  FROM observations o
  WHERE o.source_tag IN ('j24', 'g63', 's22_main', 's22_backup')
  ORDER BY o.bssid, o.time DESC
),
agg AS (
  SELECT
    o.bssid,
    MIN(o.time) AS first_seen,
    MAX(o.time) AS last_seen,
    COUNT(*) AS total_observations,
    ARRAY(SELECT DISTINCT s FROM unnest(array_agg(NULLIF(o.ssid, ''))) s WHERE s IS NOT NULL) AS ssid_variants
  FROM observations o
  WHERE o.source_tag IN ('j24', 'g63', 's22_main', 's22_backup')
  GROUP BY o.bssid
),
freq AS (
  SELECT bssid, MAX(frequency) AS frequency
  FROM staging_networks
  GROUP BY bssid
)
INSERT INTO access_points (
  bssid, latest_ssid, ssid_variants, first_seen, last_seen, total_observations,
  is_5ghz, is_6ghz, is_hidden, vendor, enriched_json
)
SELECT
  a.bssid,
  rs.ssid,
  COALESCE(a.ssid_variants, '{}') AS ssid_variants,
  a.first_seen,
  a.last_seen,
  a.total_observations,
  CASE WHEN f.frequency BETWEEN 4900 AND 5899 THEN true ELSE false END AS is_5ghz,
  CASE WHEN f.frequency >= 5925 THEN true ELSE false END AS is_6ghz,
  (rs.ssid IS NULL OR rs.ssid = '') AS is_hidden,
  NULL AS vendor,
  '{}'::jsonb AS enriched_json
FROM agg a
LEFT JOIN recent_ssid rs ON rs.bssid = a.bssid
LEFT JOIN freq f ON f.bssid = a.bssid
ON CONFLICT (bssid) DO UPDATE
SET latest_ssid = EXCLUDED.latest_ssid,
    ssid_variants = EXCLUDED.ssid_variants,
    first_seen = LEAST(access_points.first_seen, EXCLUDED.first_seen),
    last_seen = GREATEST(access_points.last_seen, EXCLUDED.last_seen),
    total_observations = EXCLUDED.total_observations,
    is_5ghz = EXCLUDED.is_5ghz,
    is_6ghz = EXCLUDED.is_6ghz,
    is_hidden = EXCLUDED.is_hidden,
    vendor = COALESCE(EXCLUDED.vendor, access_points.vendor),
    enriched_json = COALESCE(EXCLUDED.enriched_json, access_points.enriched_json);
