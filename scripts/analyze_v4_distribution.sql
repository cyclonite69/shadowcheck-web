-- Analyze v4 Score Distribution
-- Purpose: Validate scoring thresholds and identify false positives
-- Usage: psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f scripts/analyze_v4_distribution.sql

\timing on

SELECT '=== Threat Score v4.0 Distribution Analysis ===' AS report_section;
SELECT '';

-- Overall distribution by threat level
SELECT '1. Threat Level Distribution' AS section;
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

SELECT '';

-- Score percentiles
SELECT '2. Score Percentiles' AS section;
SELECT
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY final_threat_score), 2) AS p50_median,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY final_threat_score), 2) AS p75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY final_threat_score), 2) AS p90,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY final_threat_score), 2) AS p95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY final_threat_score), 2) AS p99,
    ROUND(MAX(final_threat_score), 2) AS max_score
FROM app.network_threat_scores
WHERE model_version = '4.0';

SELECT '';

-- Component score distributions
SELECT '3. Component Score Distributions (Averages)' AS section;
SELECT
    ROUND(AVG((rule_based_flags->>'following_pattern')::numeric), 2) AS avg_following,
    ROUND(AVG((rule_based_flags->>'parked_surveillance')::numeric), 2) AS avg_parked,
    ROUND(AVG((rule_based_flags->>'location_correlation')::numeric), 2) AS avg_correlation,
    ROUND(AVG((rule_based_flags->>'equipment_profile')::numeric), 2) AS avg_equipment,
    ROUND(AVG((rule_based_flags->>'temporal_persistence')::numeric), 2) AS avg_temporal,
    ROUND(AVG((rule_based_flags->>'fleet_correlation_bonus')::numeric), 2) AS avg_fleet
FROM app.network_threat_scores
WHERE model_version = '4.0';

SELECT '';

-- Networks with fleet bonus
SELECT '4. Fleet Correlation Analysis' AS section;
SELECT
    COUNT(*) AS networks_with_fleet_bonus,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM app.network_threat_scores WHERE model_version = '4.0'), 2) AS percentage,
    ROUND(AVG((rule_based_flags->>'fleet_correlation_bonus')::numeric), 2) AS avg_fleet_bonus
FROM app.network_threat_scores
WHERE model_version = '4.0'
    AND (rule_based_flags->>'fleet_correlation_bonus')::numeric > 0;

SELECT '';

-- Top 20 highest scoring networks
SELECT '5. Top 20 Highest Scoring Networks' AS section;
SELECT
    nts.bssid,
    COALESCE(n.ssid, 'N/A') AS ssid,
    rm.manufacturer AS manufacturer,
    ROUND(nts.final_threat_score, 1) AS score,
    nts.final_threat_level AS level,
    ROUND((nts.rule_based_flags->>'following_pattern')::numeric, 1) AS following,
    ROUND((nts.rule_based_flags->>'parked_surveillance')::numeric, 1) AS parked,
    ROUND((nts.rule_based_flags->>'location_correlation')::numeric, 1) AS correlation,
    ROUND((nts.rule_based_flags->>'equipment_profile')::numeric, 1) AS equipment,
    ROUND((nts.rule_based_flags->>'fleet_correlation_bonus')::numeric, 1) AS fleet
FROM app.network_threat_scores nts
LEFT JOIN app.networks n ON n.bssid = nts.bssid
LEFT JOIN app.radio_manufacturers rm ON rm.prefix = UPPER(REPLACE(SUBSTRING(nts.bssid, 1, 8), ':', ''))
WHERE nts.model_version = '4.0'
ORDER BY nts.final_threat_score DESC
LIMIT 20;

SELECT '';

-- Known legitimate networks (for false positive check)
SELECT '6. Known Legitimate Networks (Tagged as Ignored)' AS section;
SELECT
    nts.bssid,
    COALESCE(n.ssid, 'N/A') AS ssid,
    ROUND(nts.final_threat_score, 1) AS score,
    nts.final_threat_level AS level
FROM app.network_threat_scores nts
LEFT JOIN app.networks n ON n.bssid = nts.bssid
LEFT JOIN app.network_tags nt ON nt.bssid = nts.bssid
WHERE nts.model_version = '4.0'
    AND nt.is_ignored = true
ORDER BY nts.final_threat_score DESC
LIMIT 10;

SELECT '';

-- Validation summary
SELECT '7. Validation Summary' AS section;
WITH stats AS (
    SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE final_threat_level IN ('MEDIUM', 'HIGH', 'CRITICAL')) AS medium_plus,
        COUNT(*) FILTER (WHERE final_threat_level IN ('HIGH', 'CRITICAL')) AS high_plus,
        COUNT(*) FILTER (WHERE final_threat_level = 'CRITICAL') AS critical
    FROM app.network_threat_scores
    WHERE model_version = '4.0'
)
SELECT
    total AS total_networks,
    medium_plus AS medium_or_higher,
    ROUND(medium_plus * 100.0 / total, 2) AS medium_plus_pct,
    high_plus AS high_or_critical,
    ROUND(high_plus * 100.0 / total, 2) AS high_plus_pct,
    critical AS critical_only,
    ROUND(critical * 100.0 / total, 2) AS critical_pct,
    CASE
        WHEN (medium_plus * 100.0 / total) > 10 THEN '⚠️  WARNING: >10% MEDIUM+ (high false positive rate)'
        WHEN (high_plus * 100.0 / total) > 1 THEN '⚠️  WARNING: >1% HIGH+ (review thresholds)'
        WHEN (critical * 100.0 / total) > 0.1 THEN '⚠️  WARNING: >0.1% CRITICAL (review thresholds)'
        ELSE '✅ Distribution looks good'
    END AS validation_status
FROM stats;

SELECT '';
SELECT '=== Analysis Complete ===' AS report_section;
