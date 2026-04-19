-- Re-score all networks with v5.1 scoring function, gated on max_distance_meters
-- Cellular (L/N/G) always score 0 — excluded from function calls.
-- BT/BLE get signal-strength modifier applied inside the function.
-- Networks with max_distance_meters < 500 or < 3 obs score 0 directly.
-- Run as shadowcheck_admin

\echo 'Starting v5 gated re-score...'

-- Step 1: Zero-score all networks that cannot have qualifying legs
\echo 'Step 1: Writing zero scores for non-qualifying networks...'

INSERT INTO app.network_threat_scores
  (bssid, rule_based_score, rule_based_flags, model_version, scored_at)
SELECT
  n.bssid,
  0,
  '{"follow_legs":0,"public_pattern_bonus":0,"parked_surveillance":0,"location_correlation":0,"equipment_profile":0,"temporal_persistence":0,"fleet_correlation_bonus":0}'::jsonb,
  '5.0',
  NOW()
FROM app.networks n
LEFT JOIN app.api_network_explorer_mv mv ON mv.bssid = n.bssid
WHERE n.bssid IS NOT NULL
  AND (mv.max_distance_meters IS NULL OR mv.max_distance_meters < 500 OR mv.observations < 3
       OR n.type IN ('L', 'N', 'G'))
ON CONFLICT (bssid) DO UPDATE SET
  rule_based_score = EXCLUDED.rule_based_score,
  rule_based_flags = EXCLUDED.rule_based_flags,
  model_version    = EXCLUDED.model_version,
  scored_at        = NOW(),
  updated_at       = NOW();

\echo 'Step 1 complete.'

-- Step 2: Score only networks with max_distance_meters >= 500 AND >= 3 observations
\echo 'Step 2: Scoring qualifying networks via calculate_threat_score_v5...'

WITH scored AS (
  SELECT mv.bssid, calculate_threat_score_v5(mv.bssid) AS details
  FROM app.api_network_explorer_mv mv
  JOIN app.networks n ON n.bssid = mv.bssid
  WHERE mv.max_distance_meters >= 500
    AND mv.observations >= 3
    AND mv.bssid IS NOT NULL
    AND n.type NOT IN ('L', 'N', 'G')
)
INSERT INTO app.network_threat_scores
  (bssid, rule_based_score, rule_based_flags, model_version, scored_at)
SELECT
  bssid,
  (details->>'total_score')::numeric,
  details->'components',
  details->>'model_version',
  NOW()
FROM scored
ON CONFLICT (bssid) DO UPDATE SET
  rule_based_score = EXCLUDED.rule_based_score,
  rule_based_flags = EXCLUDED.rule_based_flags,
  model_version    = EXCLUDED.model_version,
  scored_at        = NOW(),
  updated_at       = NOW();

\echo 'Step 2 complete. Refreshing materialized view...'

REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv;

\echo 'Done. Score distribution:'

SELECT
  final_threat_level,
  COUNT(*) AS networks,
  MIN(final_threat_score) AS min_score,
  MAX(final_threat_score) AS max_score,
  ROUND(AVG(final_threat_score), 2) AS avg_score,
  COUNT(CASE WHEN model_version = '5.0' THEN 1 END) AS v5_count
FROM app.network_threat_scores
GROUP BY final_threat_level
ORDER BY MIN(final_threat_score);
