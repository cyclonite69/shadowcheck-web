-- Recompute Threat Scores for AirLink Fleet Only
-- Purpose: Quick validation of v4 scoring on known surveillance fleet
-- Usage: psql -U $DB_USER -h $DB_HOST -d $DB_NAME -f scripts/recompute_airlink_only.sql

\timing on

-- Log start
SELECT 'Starting AirLink fleet v4 scoring at ' || NOW() AS status;

-- Count AirLink networks
SELECT COUNT(*) AS airlink_networks 
FROM app.networks n
JOIN app.radio_manufacturers rm ON rm.prefix = UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
WHERE rm.manufacturer ILIKE '%AirLink%'
AND LENGTH(n.bssid) <= 17;

-- Recompute AirLink scores only
WITH targets AS (
    SELECT n.bssid
    FROM app.networks n
    JOIN app.radio_manufacturers rm ON rm.prefix = UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
    WHERE rm.manufacturer ILIKE '%AirLink%'
    AND LENGTH(n.bssid) <= 17
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

-- Show AirLink score distribution
SELECT
    final_threat_level,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM app.network_threat_scores nts
JOIN app.networks n ON n.bssid = nts.bssid
JOIN app.radio_manufacturers rm ON rm.prefix = UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
WHERE rm.manufacturer ILIKE '%AirLink%'
AND nts.model_version = '4.0'
GROUP BY final_threat_level
ORDER BY 
    CASE final_threat_level
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
    END;

-- Top 10 AirLink networks
SELECT
    nts.bssid,
    n.ssid,
    nts.final_threat_score AS score,
    nts.final_threat_level AS level,
    (nts.rule_based_flags->>'following_pattern')::numeric AS following,
    (nts.rule_based_flags->>'parked_surveillance')::numeric AS parked,
    (nts.rule_based_flags->>'fleet_correlation_bonus')::numeric AS fleet
FROM app.network_threat_scores nts
JOIN app.networks n ON n.bssid = nts.bssid
JOIN app.radio_manufacturers rm ON rm.prefix = UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
WHERE rm.manufacturer ILIKE '%AirLink%'
AND nts.model_version = '4.0'
ORDER BY nts.final_threat_score DESC
LIMIT 10;

SELECT 'Completed AirLink fleet v4 scoring at ' || NOW() AS status;
