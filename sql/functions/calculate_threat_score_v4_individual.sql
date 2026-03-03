-- Threat Scoring v4.0 - Individual Behavior Only (No Fleet Correlation)
-- Purpose: Fast per-network scoring without expensive cross-network queries
-- Fleet correlation bonus calculated separately in batch

CREATE OR REPLACE FUNCTION calculate_threat_score_v4_individual(p_bssid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN (
        WITH observations AS (
            SELECT
                o.id,
                o.bssid,
                o.lat,
                o.lon,
                o.time,
                o.level AS signal
            FROM app.observations o
            WHERE o.bssid = p_bssid
            AND o.lat IS NOT NULL
            AND o.lon IS NOT NULL
            AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
        ),
        home_location AS (
            SELECT
                latitude AS lat,
                longitude AS lon
            FROM app.location_markers
            WHERE marker_type = 'home'
            LIMIT 1
        ),
        network_metadata AS (
            SELECT
                n.bssid,
                n.ssid,
                n.type
            FROM app.networks n
            WHERE n.bssid = p_bssid
        ),

        -- Task 2: Following Pattern Score (35%)
        location_classification AS (
            SELECT
                o.id,
                o.lat,
                o.lon,
                o.time,
                CASE
                    WHEN h.lat IS NULL THEN NULL
                    ELSE ST_Distance(
                        ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(h.lon, h.lat), 4326)::geography
                    )
                END AS distance_from_home_m
            FROM observations o
            CROSS JOIN home_location h
        ),
        away_clusters AS (
            SELECT
                ST_ClusterDBSCAN(
                    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geometry,
                    eps := 0.01,  -- ~1km in degrees
                    minpoints := 1
                ) OVER () AS cluster_id,
                lat,
                lon
            FROM location_classification
            WHERE distance_from_home_m > 2000  -- Away = >2km from home
        ),
        away_cluster_count AS (
            SELECT COUNT(DISTINCT cluster_id) AS count
            FROM away_clusters
            WHERE cluster_id IS NOT NULL
        ),
        wigle_spread AS (
            SELECT
                COALESCE(MAX(
                    ST_Distance(
                        ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
                        ST_SetSRID(ST_MakePoint(h.lon, h.lat), 4326)::geography
                    ) / 1000.0
                ), 0) AS max_distance_km
            FROM app.wigle_v3_observations w
            CROSS JOIN home_location h
            WHERE UPPER(w.netid) = UPPER(p_bssid)
        ),
        following_score AS (
            SELECT
                LEAST(35,
                    (COALESCE(acc.count, 0) * 7) +
                    (ws.max_distance_km / 10.0)
                )::numeric AS score
            FROM away_cluster_count acc
            CROSS JOIN wigle_spread ws
        ),

        -- Task 3: Parked Surveillance Score (20%)
        observation_pairs AS (
            SELECT
                o1.id AS id1,
                o2.id AS id2,
                o1.lat AS lat1,
                o1.lon AS lon1,
                o2.lat AS lat2,
                o2.lon AS lon2,
                o1.time AS time1,
                o2.time AS time2,
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
                ) AS distance_m,
                EXTRACT(EPOCH FROM (o2.time - o1.time)) / 60.0 AS time_diff_min
            FROM location_classification o1
            JOIN location_classification o2 ON o2.id > o1.id
            WHERE EXTRACT(EPOCH FROM (o2.time - o1.time)) BETWEEN 0 AND 600  -- Within 10 minutes
        ),
        parking_events AS (
            SELECT
                lat1,
                lon1,
                time1,
                COUNT(*) AS detections_in_window,
                AVG(distance_from_home_m) AS avg_distance_from_home
            FROM observation_pairs op
            JOIN location_classification lc ON lc.id = op.id1
            WHERE op.distance_m < 100  -- Within 100m
            GROUP BY lat1, lon1, time1
            HAVING COUNT(*) >= 2  -- 3+ total detections (original + 2 pairs)
        ),
        parking_score AS (
            SELECT
                LEAST(20,
                    COUNT(*) * 4 * AVG(1.0 / (1.0 + COALESCE(avg_distance_from_home / 1000.0, 10)))
                )::numeric AS score
            FROM parking_events
        ),

        -- Task 4: Location Correlation Score (15%)
        home_staging AS (
            SELECT
                COUNT(CASE WHEN distance_from_home_m < 500 THEN 1 END)::numeric /
                NULLIF(COUNT(*)::numeric, 0) AS home_staging_pct
            FROM location_classification
        ),
        location_clusters AS (
            SELECT COUNT(DISTINCT cluster_id) AS cluster_count
            FROM (
                SELECT ST_ClusterDBSCAN(
                    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geometry,
                    eps := 0.005,  -- ~500m in degrees
                    minpoints := 1
                ) OVER () AS cluster_id
                FROM location_classification
            ) clusters
            WHERE cluster_id IS NOT NULL
        ),
        correlation_score AS (
            SELECT
                LEAST(15,
                    (COALESCE(hs.home_staging_pct, 0) * 0.7 +
                     LEAST(1.0, COALESCE(lc.cluster_count, 0) / 5.0) * 0.3) * 15
                )::numeric AS score
            FROM home_staging hs
            CROSS JOIN location_clusters lc
        ),

        -- Task 5: Equipment Profile Score (10%)
        manufacturer_lookup AS (
            SELECT
                rm.manufacturer AS manufacturer
            FROM network_metadata nm
            LEFT JOIN app.radio_manufacturers rm
            ON rm.prefix = UPPER(REPLACE(SUBSTRING(nm.bssid, 1, 8), ':', ''))
        ),
        equipment_score AS (
            SELECT
                (
                    -- Manufacturer scoring (5 points)
                    CASE
                        WHEN ml.manufacturer ILIKE '%AirLink%'
                          OR ml.manufacturer ILIKE '%Cradlepoint%'
                          OR ml.manufacturer ILIKE '%Sierra Wireless%' THEN 5
                        ELSE 0
                    END +
                    -- SSID pattern scoring (3 points max)
                    CASE
                        WHEN nm.ssid ~ '^PAS-\d+$' THEN 3
                        WHEN nm.ssid = 'mdt' THEN 3
                        WHEN nm.ssid ~ '^\d+$' THEN 2
                        WHEN nm.ssid ~* '(myChevrolet|myBuick|myGMC|MBUX|CADILLAC)' THEN 2
                        ELSE 0
                    END
                )::numeric AS score
            FROM network_metadata nm
            CROSS JOIN manufacturer_lookup ml
        ),

        -- Task 6: Temporal Persistence Score (5%)
        temporal_score AS (
            SELECT
                LEAST(5,
                    (COUNT(DISTINCT DATE(time))::numeric / 100.0) * 5
                )::numeric AS score
            FROM observations
        )

        -- Return structure WITHOUT fleet correlation
        SELECT jsonb_build_object(
            'bssid', p_bssid,
            'total_score', COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0),
            'threat_level',
                CASE
                    WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0)) >= 81 THEN 'CRITICAL'
                    WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0)) >= 61 THEN 'HIGH'
                    WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0)) >= 41 THEN 'MEDIUM'
                    WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0)) >= 21 THEN 'LOW'
                    ELSE 'NONE'
                END,
            'model_version', '4.0-individual',
            'components', jsonb_build_object(
                'following_pattern', COALESCE(fs.score, 0),
                'parked_surveillance', COALESCE(ps.score, 0),
                'location_correlation', COALESCE(cs.score, 0),
                'equipment_profile', COALESCE(es.score, 0),
                'temporal_persistence', COALESCE(ts.score, 0),
                'fleet_correlation_bonus', 0
            )
        )
        FROM following_score fs
        CROSS JOIN parking_score ps
        CROSS JOIN correlation_score cs
        CROSS JOIN equipment_score es
        CROSS JOIN temporal_score ts
    );
END;
$$;

COMMENT ON FUNCTION calculate_threat_score_v4_individual IS 
'Threat scoring v4.0 - individual behavior only. Fleet correlation (max 25 points) calculated separately in batch.';
