-- Calculate Fleet Correlation Bonus in Batch
-- Purpose: Add fleet correlation bonus to already-scored networks
-- Run AFTER individual scoring completes

\timing on

SELECT 'Starting fleet correlation bonus calculation at ' || NOW() AS status;

-- Calculate fleet bonuses for all networks in one pass
WITH network_manufacturers AS (
    SELECT
        n.bssid,
        rm.manufacturer,
        n.ssid
    FROM app.networks n
    LEFT JOIN app.radio_manufacturers rm 
        ON rm.prefix = UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
    WHERE LENGTH(n.bssid) <= 17
),
-- Count networks with same manufacturer scoring >50
fleet_manufacturer_counts AS (
    SELECT
        nm1.bssid,
        COUNT(DISTINCT nm2.bssid) AS fleet_count
    FROM network_manufacturers nm1
    JOIN network_manufacturers nm2 
        ON nm2.manufacturer = nm1.manufacturer
        AND nm2.bssid != nm1.bssid
    JOIN app.network_threat_scores nts 
        ON nts.bssid = nm2.bssid
    WHERE nm1.manufacturer IS NOT NULL
    AND COALESCE(nts.final_threat_score, 0) > 50
    GROUP BY nm1.bssid
),
-- Find networks matching same SSID patterns
fleet_ssid_counts AS (
    SELECT
        nm1.bssid,
        COUNT(DISTINCT nm2.bssid) AS pattern_count
    FROM network_manufacturers nm1
    JOIN network_manufacturers nm2 
        ON nm2.bssid != nm1.bssid
    WHERE (
        (nm1.ssid ~ '^PAS-\d+$' AND nm2.ssid ~ '^PAS-\d+$') OR
        (nm1.ssid = 'mdt' AND nm2.ssid = 'mdt') OR
        (nm1.ssid ~ '^\d+$' AND nm2.ssid ~ '^\d+$')
    )
    GROUP BY nm1.bssid
),
-- Calculate fleet bonus for each network
fleet_bonuses AS (
    SELECT
        nm.bssid,
        (
            -- Manufacturer bonus (0-15 points - increased for massive fleets)
            CASE
                WHEN COALESCE(fmc.fleet_count, 0) >= 50 THEN 15
                WHEN COALESCE(fmc.fleet_count, 0) >= 20 THEN 12
                WHEN COALESCE(fmc.fleet_count, 0) >= 10 THEN 8
                WHEN COALESCE(fmc.fleet_count, 0) >= 5 THEN 5
                ELSE 0
            END +
            -- SSID pattern bonus (0-5 points - increased weight)
            CASE WHEN COALESCE(fsc.pattern_count, 0) >= 3 THEN 5 ELSE 0 END +
            -- Geographic overlap bonus (check if 2+ high-threat networks within 10km)
            CASE 
                WHEN (
                    SELECT COUNT(DISTINCT nts2.bssid)
                    FROM app.network_threat_scores nts2
                    JOIN app.observations o1 ON o1.bssid = nm.bssid
                    JOIN app.observations o2 ON o2.bssid = nts2.bssid
                    WHERE nts2.bssid != nm.bssid
                    AND COALESCE(nts2.final_threat_score, 0) > 50
                    AND o1.lat IS NOT NULL AND o1.lon IS NOT NULL
                    AND o2.lat IS NOT NULL AND o2.lon IS NOT NULL
                    AND ST_Distance(
                        ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
                    ) < 10000
                    LIMIT 2
                ) >= 2 THEN 2 
                ELSE 0 
            END
        )::numeric AS fleet_bonus
    FROM network_manufacturers nm
    LEFT JOIN fleet_manufacturer_counts fmc ON fmc.bssid = nm.bssid
    LEFT JOIN fleet_ssid_counts fsc ON fsc.bssid = nm.bssid
)
-- Update scores with fleet bonus
UPDATE app.network_threat_scores nts
SET
    rule_based_flags = jsonb_set(
        COALESCE(rule_based_flags, '{}'::jsonb),
        '{fleet_correlation_bonus}',
        to_jsonb(fb.fleet_bonus)
    ),
    final_threat_score = COALESCE(nts.final_threat_score, 0) + fb.fleet_bonus,
    final_threat_level = CASE
        WHEN (COALESCE(nts.final_threat_score, 0) + fb.fleet_bonus) >= 81 THEN 'CRITICAL'
        WHEN (COALESCE(nts.final_threat_score, 0) + fb.fleet_bonus) >= 61 THEN 'HIGH'
        WHEN (COALESCE(nts.final_threat_score, 0) + fb.fleet_bonus) >= 41 THEN 'MEDIUM'
        WHEN (COALESCE(nts.final_threat_score, 0) + fb.fleet_bonus) >= 21 THEN 'LOW'
        ELSE 'NONE'
    END,
    model_version = '4.0',
    updated_at = NOW()
FROM fleet_bonuses fb
WHERE nts.bssid = fb.bssid
AND nts.model_version = '4.0-individual';

SELECT 'Completed fleet correlation bonus calculation at ' || NOW() AS status;

-- Show distribution after fleet bonus
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
        ELSE 5
    END;
