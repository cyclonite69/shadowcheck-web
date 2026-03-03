-- Recompute Threat Scores v4 - Optimized with Movement Filter
-- Purpose: Score only mobile networks, bulk-assign NONE to stationary
-- Reduces 180K network scoring from 3.5 hours to ~16 minutes

\timing on

SELECT 'Starting optimized v4 threat score recomputation at ' || NOW() AS status;

-- Count networks by category
SELECT 
    COUNT(*) FILTER (WHERE max_distance_meters > 150 AND observations >= 2) AS mobile_networks,
    COUNT(*) FILTER (WHERE max_distance_meters <= 150 OR observations < 2) AS stationary_networks,
    COUNT(*) AS total_networks
FROM app.api_network_explorer_mv;

-- Step 1: Bulk-assign NONE to stationary networks
WITH stationary AS (
    SELECT mv.bssid
    FROM app.api_network_explorer_mv mv
    WHERE (mv.max_distance_meters <= 150 OR mv.observations < 2)
    AND LENGTH(mv.bssid) <= 17
)
INSERT INTO app.network_threat_scores
    (bssid, rule_based_score, rule_based_flags, final_threat_score,
     final_threat_level, model_version, scored_at, updated_at)
SELECT
    bssid,
    5,
    jsonb_build_object(
        'following_pattern', 0,
        'parked_surveillance', 0,
        'location_correlation', 0,
        'equipment_profile', 5,
        'temporal_persistence', 0,
        'fleet_correlation_bonus', 0
    ),
    5,
    'NONE',
    '4.0-individual',
    NOW(),
    NOW()
FROM stationary
ON CONFLICT (bssid) DO UPDATE SET
    rule_based_score = EXCLUDED.rule_based_score,
    rule_based_flags = EXCLUDED.rule_based_flags,
    final_threat_score = EXCLUDED.final_threat_score,
    final_threat_level = EXCLUDED.final_threat_level,
    model_version = EXCLUDED.model_version,
    scored_at = NOW(),
    updated_at = NOW();

SELECT 'Stationary networks assigned NONE at ' || NOW() AS status;

-- Step 2: Score mobile networks with full v4 analysis
WITH mobile AS (
    SELECT mv.bssid
    FROM app.api_network_explorer_mv mv
    WHERE mv.max_distance_meters > 150
    AND mv.observations >= 2
    AND LENGTH(mv.bssid) <= 17
),
scored AS (
    SELECT
        m.bssid,
        calculate_threat_score_v4_individual(m.bssid) AS details
    FROM mobile m
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

SELECT 'Mobile networks scored at ' || NOW() AS status;

-- Show distribution before fleet bonus
SELECT
    final_threat_level,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM app.network_threat_scores
WHERE model_version = '4.0-individual'
GROUP BY final_threat_level
ORDER BY 
    CASE final_threat_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
    END;

-- Top 20 mobile networks (before fleet bonus)
SELECT
    nts.bssid,
    n.ssid,
    nts.final_threat_score AS score,
    nts.final_threat_level AS level,
    (nts.rule_based_flags->>'following_pattern')::numeric AS following,
    (nts.rule_based_flags->>'parked_surveillance')::numeric AS parked
FROM app.network_threat_scores nts
JOIN app.networks n ON n.bssid = nts.bssid
WHERE nts.model_version = '4.0-individual'
AND nts.final_threat_score > 20
ORDER BY nts.final_threat_score DESC
LIMIT 20;

SELECT 'Completed individual scoring at ' || NOW() AS status;
SELECT 'Run scripts/calculate_fleet_bonus.sql next to add fleet correlation' AS next_step;
