-- ============================================================================
-- SIBLING DETECTION QUALITY ANALYSIS
-- Identifies potential false positives and targets for manual override
-- ============================================================================

\echo '--- TOP 20 SUSPECT SIBLINGS (High Distance, High Confidence) ---'
SELECT 
  bssid1, bssid2, ssid1, 
  round(distance_m::numeric, 2) as dist_m, 
  confidence, 
  rule
FROM app.network_sibling_pairs
WHERE confidence > 0.90 AND distance_m > 500
ORDER BY distance_m DESC
LIMIT 20;

\echo ''
\echo '--- SIBLING CLUSTERS (BSSIDs with many siblings - likely noise) ---'
SELECT bssid, count(*) as sibling_count, max(ssid) as ssid
FROM (
  SELECT bssid1 as bssid, ssid1 as ssid FROM app.network_sibling_pairs
  UNION ALL
  SELECT bssid2, ssid2 FROM app.network_sibling_pairs
) t
GROUP BY bssid
HAVING count(*) > 5
ORDER BY sibling_count DESC
LIMIT 20;

\echo ''
\echo '--- EMPTY SSID SIBLINGS (Often false positives) ---'
SELECT 
  count(*) as total_empty_ssid_pairs,
  round(avg(distance_m)::numeric, 2) as avg_dist_m
FROM app.network_sibling_pairs
WHERE (ssid1 IS NULL OR ssid1 = '') AND (ssid2 IS NULL OR ssid2 = '');

\echo ''
\echo '--- PAIRS NEAR HOME (High Forensic Value) ---'
SELECT 
  bssid1, bssid2, ssid1, 
  round(distance_m::numeric, 2) as dist_m,
  confidence
FROM app.network_sibling_pairs
WHERE distance_m < 100 AND confidence > 0.95
LIMIT 20;
