-- Recompute All Threat Scores with v4
-- Purpose: Update all networks with new v4 scoring
-- Usage: psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f scripts/recompute_threat_scores_v4.sql

\timing on

-- Log start
SELECT 'Starting v4 threat score recomputation at ' || NOW() AS status;

-- Count total networks
SELECT COUNT(*) AS total_networks FROM app.networks;

-- Recompute all scores in batches
WITH targets AS (
    SELECT bssid
    FROM app.networks
    WHERE bssid IS NOT NULL
    AND LENGTH(bssid) <= 17  -- Exclude cell tower IDs
),
scored AS (
    SELECT
        t.bssid,
        calculate_threat_score_v4(t.bssid) AS details
    FROM targets t
)
INSERT INTO app.network_threat_scores
    (bssid, rule_based_score, rule_based_flags, final_threat_score,
     final_threat_level, model_version, scored_at, updated_at)
SELECT
    bssid,
    (details->>'total_score')::numeric,
    details->'components',
    (details->>'total_score')::numeric,
    details->>'threat_level',
    details->>'model_version',
    NOW(),
    NOW()
FROM scored
ON CONFLICT (bssid) DO UPDATE SET
    rule_based_score = EXCLUDED.rule_based_score,
    rule_based_flags = EXCLUDED.rule_based_flags,
    final_threat_score = EXCLUDED.final_threat_score,
    final_threat_level = EXCLUDED.final_threat_level,
    model_version = EXCLUDED.model_version,
    scored_at = NOW(),
    updated_at = NOW();

-- Show score distribution
SELECT
    final_threat_level,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM app.network_threat_scores
WHERE model_version = '4.0'
GROUP BY final_threat_level
ORDER BY
    CASE final_threat_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        WHEN 'NONE' THEN 5
    END;

-- Show top 20 threats
SELECT
    nts.bssid,
    n.ssid,
    nts.final_threat_score,
    nts.final_threat_level,
    nts.rule_based_flags->'following_pattern' AS following,
    nts.rule_based_flags->'parked_surveillance' AS parked,
    nts.rule_based_flags->'fleet_correlation_bonus' AS fleet
FROM app.network_threat_scores nts
JOIN app.networks n ON n.bssid = nts.bssid
WHERE nts.model_version = '4.0'
ORDER BY nts.final_threat_score DESC
LIMIT 20;

-- Log completion
SELECT 'Completed v4 threat score recomputation at ' || NOW() AS status;
