-- Incremental Threat Scoring v4 - Process Queue
-- Purpose: Score only networks marked for rescoring
-- Usage: Run periodically (cron job, manual, or after ETL)

\timing on

SELECT 'Starting incremental v4 scoring at ' || NOW() AS status;

-- Count networks needing rescoring
SELECT COUNT(*) AS networks_to_score
FROM app.threat_scores_cache
WHERE needs_recompute = true;

-- Score networks marked for rescoring (using movement filter)
WITH networks_to_score AS (
    SELECT tsc.bssid
    FROM app.threat_scores_cache tsc
    JOIN app.api_network_explorer_mv mv ON mv.bssid = tsc.bssid
    WHERE tsc.needs_recompute = true
    AND LENGTH(tsc.bssid) <= 17
),
mobile_networks AS (
    SELECT nts.bssid
    FROM networks_to_score nts
    JOIN app.api_network_explorer_mv mv ON mv.bssid = nts.bssid
    WHERE mv.max_distance_meters > 150
    AND mv.observations >= 2
),
stationary_networks AS (
    SELECT nts.bssid
    FROM networks_to_score nts
    JOIN app.api_network_explorer_mv mv ON mv.bssid = nts.bssid
    WHERE mv.max_distance_meters <= 150
    OR mv.observations < 2
),
-- Bulk assign NONE to stationary
stationary_scored AS (
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
    FROM stationary_networks
    ON CONFLICT (bssid) DO UPDATE SET
        rule_based_score = EXCLUDED.rule_based_score,
        rule_based_flags = EXCLUDED.rule_based_flags,
        final_threat_score = EXCLUDED.final_threat_score,
        final_threat_level = EXCLUDED.final_threat_level,
        model_version = EXCLUDED.model_version,
        scored_at = NOW(),
        updated_at = NOW()
    RETURNING bssid
),
-- Score mobile networks with v4
mobile_scored AS (
    SELECT
        m.bssid,
        calculate_threat_score_v4_individual(m.bssid) AS details
    FROM mobile_networks m
),
mobile_inserted AS (
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
    FROM mobile_scored
    ON CONFLICT (bssid) DO UPDATE SET
        rule_based_score = EXCLUDED.rule_based_score,
        rule_based_flags = EXCLUDED.rule_based_flags,
        final_threat_score = EXCLUDED.final_threat_score,
        final_threat_level = EXCLUDED.final_threat_level,
        model_version = EXCLUDED.model_version,
        scored_at = NOW(),
        updated_at = NOW()
    RETURNING bssid
)
-- Update cache to mark as scored
UPDATE app.threat_scores_cache tsc
SET 
    threat_score = nts.final_threat_score,
    threat_level = nts.final_threat_level,
    computed_at = NOW(),
    needs_recompute = false
FROM app.network_threat_scores nts
WHERE tsc.bssid = nts.bssid
AND tsc.needs_recompute = true;

SELECT 'Completed incremental v4 scoring at ' || NOW() AS status;

-- Show results
SELECT 
    COUNT(*) FILTER (WHERE needs_recompute = true) AS still_pending,
    COUNT(*) FILTER (WHERE needs_recompute = false) AS scored,
    MAX(computed_at) AS last_scored
FROM app.threat_scores_cache;
