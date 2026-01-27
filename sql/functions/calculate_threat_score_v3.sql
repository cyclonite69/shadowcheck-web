-- Threat Scoring v3.0 - Forensically Sound Methodology (OPTIMIZED)
--
-- Key improvements over v2:
-- 1. Radio range-based distance analysis (not home-dependent)
-- 2. Jump-frequency and cluster-switching metrics added (time-bound)
-- 3. Co-occurrence remains disabled for performance
-- 4. Excludes cellular (range too large for stalking detection)
-- 5. Signal strength variability analysis
-- 6. Location-aware observation density (high obs at ONE location = not suspicious)
--
-- Composite Score Formula:
--   threat_score =
--     (range_violation × 0.30) +        -- Primary: seen beyond radio range
--     (jump_frequency × 0.25) +         -- Repeated long-distance jumps (time-bound)
--     (cluster_switching × 0.15) +      -- Frequent switching between location clusters
--     (multi_location_density × 0.15) + -- High obs at MULTIPLE locations
--     (signal_pattern × 0.10) +         -- Variable/weak signal pattern
--     (temporal_persistence × 0.05)     -- Multiple days (minor)

CREATE OR REPLACE FUNCTION calculate_threat_score_v3(p_bssid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, topology, tiger
AS $$
DECLARE
    v_network_type TEXT;
    v_expected_range_m NUMERIC;
    v_max_distance_m NUMERIC := 0;
    v_observation_count INTEGER := 0;
    v_unique_locations INTEGER := 0;
    v_unique_days INTEGER := 0;
    v_signal_stddev NUMERIC := 0;
    v_signal_mean NUMERIC := 0;
    v_co_occurrence_count INTEGER := 0;
    v_max_obs_single_location INTEGER := 0;
    v_jump_threshold_m NUMERIC := 0;
    v_transition_count INTEGER := 0;
    v_jump_count INTEGER := 0;
    v_jump_rate NUMERIC := 0;
    v_max_jump_m NUMERIC := 0;
    v_unique_clusters INTEGER := 0;
    v_cluster_switches INTEGER := 0;
    v_cluster_switch_rate NUMERIC := 0;
    v_median_gap_hours NUMERIC := 0;

    -- Scoring components (0-100 each)
    v_range_violation_score NUMERIC := 0;
    v_co_occurrence_score NUMERIC := 0;
    v_multi_location_score NUMERIC := 0;
    v_signal_pattern_score NUMERIC := 0;
    v_temporal_score NUMERIC := 0;
    v_jump_frequency_score NUMERIC := 0;
    v_cluster_switch_score NUMERIC := 0;

    -- Final composite
    v_composite_score NUMERIC := 0;
    v_threat_level TEXT := 'NONE';
    v_confidence NUMERIC := 0;
    v_flags TEXT[] := ARRAY[]::TEXT[];
    v_summary TEXT := '';
BEGIN
    -- Get ALL metrics in a single query for performance
    WITH obs_stats AS (
        SELECT
            o.bssid,
            COALESCE(n.type,
                CASE
                    WHEN MAX(o.radio_frequency) BETWEEN 2412 AND 2484 THEN 'W'
                    WHEN MAX(o.radio_frequency) BETWEEN 5000 AND 5900 THEN 'W'
                    WHEN MAX(UPPER(COALESCE(o.radio_capabilities, ''))) ~ '(BLE|BTLE)' THEN 'E'
                    WHEN MAX(UPPER(COALESCE(o.radio_capabilities, ''))) ~ 'BLUETOOTH' THEN 'B'
                    ELSE 'W'
                END
            ) AS network_type,
            COUNT(*) AS obs_count,
            COUNT(DISTINCT DATE(o.time)) AS unique_days,
            COALESCE(STDDEV(o.level), 0) AS signal_stddev,
            COALESCE(AVG(o.level), 0) AS signal_mean,
            MIN(o.lat) AS min_lat,
            MAX(o.lat) AS max_lat,
            MIN(o.lon) AS min_lon,
            MAX(o.lon) AS max_lon
        FROM public.observations o
        LEFT JOIN public.networks n ON UPPER(n.bssid) = UPPER(o.bssid)
        WHERE UPPER(o.bssid) = UPPER(p_bssid)
          AND o.lat IS NOT NULL AND o.lon IS NOT NULL
          AND o.lat BETWEEN -90 AND 90 AND o.lon BETWEEN -180 AND 180
        GROUP BY o.bssid, n.type
    ),
    location_clusters AS (
        SELECT
            COUNT(DISTINCT (grids.lat_grid::text || ',' || grids.lon_grid::text)) AS unique_locs,
            COALESCE(MAX(grids.cluster_count), 0) AS max_cluster
        FROM (
            SELECT FLOOR(lat * 1000) AS lat_grid, FLOOR(lon * 1000) AS lon_grid, COUNT(*) AS cluster_count
            FROM public.observations
            WHERE UPPER(bssid) = UPPER(p_bssid)
              AND lat IS NOT NULL AND lon IS NOT NULL
            GROUP BY FLOOR(lat * 1000), FLOOR(lon * 1000)
        ) grids
    )
    SELECT
        s.network_type,
        s.obs_count,
        s.unique_days,
        s.signal_stddev,
        s.signal_mean,
        COALESCE(ST_Distance(
            ST_SetSRID(ST_MakePoint(s.min_lon, s.min_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(s.max_lon, s.max_lat), 4326)::geography
        ), 0),
        l.unique_locs,
        l.max_cluster
    INTO
        v_network_type,
        v_observation_count,
        v_unique_days,
        v_signal_stddev,
        v_signal_mean,
        v_max_distance_m,
        v_unique_locations,
        v_max_obs_single_location
    FROM obs_stats s
    CROSS JOIN location_clusters l;

    -- Skip cellular networks entirely (L=LTE, G=GSM, N=5G NR)
    IF v_network_type IN ('L', 'G', 'N') THEN
        RETURN jsonb_build_object(
            'score', 0,
            'level', 'NONE',
            'summary', 'Cellular network excluded from threat analysis (range too large)',
            'confidence', 0,
            'flags', ARRAY['CELLULAR_EXCLUDED']::TEXT[],
            'factors', jsonb_build_object(
                'range_violation', 0,
                'co_occurrence', 0,
                'jump_frequency', 0,
                'cluster_switching', 0,
                'multi_location', 0,
                'signal_pattern', 0,
                'temporal', 0
            )
        );
    END IF;

    -- Handle case where no observations found
    IF v_observation_count IS NULL OR v_observation_count = 0 THEN
        RETURN jsonb_build_object(
            'score', 0,
            'level', 'NONE',
            'summary', 'No observations found',
            'confidence', 0,
            'flags', ARRAY[]::TEXT[],
            'factors', jsonb_build_object(
                'range_violation', 0,
                'co_occurrence', 0,
                'jump_frequency', 0,
                'cluster_switching', 0,
                'multi_location', 0,
                'signal_pattern', 0,
                'temporal', 0
            )
        );
    END IF;

    -- Determine expected radio range based on type
    v_expected_range_m := CASE v_network_type
        WHEN 'E' THEN 100   -- BLE: 30-50m typical, use 100m with padding
        WHEN 'B' THEN 200   -- Bluetooth Classic: 100m typical, use 200m with padding
        WHEN 'W' THEN 250   -- WiFi: 100m typical, use 250m with padding
        ELSE 250            -- Default to WiFi range
    END;

    -- Jump threshold (long-distance movement) by radio type
    v_jump_threshold_m := CASE v_network_type
        WHEN 'E' THEN 150
        WHEN 'B' THEN 300
        WHEN 'W' THEN 500
        ELSE 500
    END;

    -- Jump frequency + cluster switching metrics (time-bound to 7 days between points)
    WITH ordered AS (
        SELECT
            o.time,
            o.lat,
            o.lon,
            LAG(o.time) OVER w AS prev_time,
            LAG(o.lat) OVER w AS prev_lat,
            LAG(o.lon) OVER w AS prev_lon,
            FLOOR(o.lat * 1000) AS lat_grid,
            FLOOR(o.lon * 1000) AS lon_grid,
            LAG(FLOOR(o.lat * 1000)) OVER w AS prev_lat_grid,
            LAG(FLOOR(o.lon * 1000)) OVER w AS prev_lon_grid,
            ST_Distance(
                ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(LAG(o.lon) OVER w, LAG(o.lat) OVER w), 4326)::geography
            ) AS distance_m,
            EXTRACT(EPOCH FROM (o.time - LAG(o.time) OVER w)) / 3600.0 AS gap_hours
        FROM public.observations o
        WHERE UPPER(o.bssid) = UPPER(p_bssid)
          AND o.lat IS NOT NULL AND o.lon IS NOT NULL
          AND o.lat BETWEEN -90 AND 90 AND o.lon BETWEEN -180 AND 180
        WINDOW w AS (ORDER BY o.time)
    )
    SELECT
        COUNT(*) AS transitions,
        COUNT(*) FILTER (
            WHERE gap_hours <= 168
              AND distance_m >= v_jump_threshold_m
        ) AS jumps,
        COALESCE(MAX(distance_m), 0) AS max_jump_m,
        COUNT(DISTINCT (lat_grid::text || ',' || lon_grid::text)) AS unique_clusters,
        COUNT(*) FILTER (
            WHERE (lat_grid::text || ',' || lon_grid::text)
                  IS DISTINCT FROM (prev_lat_grid::text || ',' || prev_lon_grid::text)
        ) AS cluster_switches,
        COALESCE(
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY gap_hours),
            0
        ) AS median_gap_hours
    INTO
        v_transition_count,
        v_jump_count,
        v_max_jump_m,
        v_unique_clusters,
        v_cluster_switches,
        v_median_gap_hours
    FROM ordered
    WHERE prev_lat IS NOT NULL AND prev_lon IS NOT NULL;

    IF v_transition_count > 0 THEN
        v_jump_rate := v_jump_count::NUMERIC / v_transition_count;
        v_cluster_switch_rate := v_cluster_switches::NUMERIC / v_transition_count;
    END IF;

    -- Co-occurrence: temporarily disabled for performance
    -- TODO: Pre-compute co-occurrence in a summary table for efficient lookup
    v_co_occurrence_count := 0;

    ---------------------------------------------------------------------------
    -- FACTOR 1: Range Violation (30% weight)
    -- Device seen at locations beyond its physical radio range
    ---------------------------------------------------------------------------
    IF v_max_distance_m > v_expected_range_m THEN
        -- Score based on how much it exceeds expected range
        v_range_violation_score := LEAST(100,
            (v_max_distance_m / v_expected_range_m) * 40
        );

        IF v_max_distance_m > v_expected_range_m * 5 THEN
            v_flags := array_append(v_flags, 'EXTREME_RANGE_VIOLATION');
            v_range_violation_score := LEAST(100, v_range_violation_score + 30);
        ELSIF v_max_distance_m > v_expected_range_m * 2 THEN
            v_flags := array_append(v_flags, 'SIGNIFICANT_RANGE_VIOLATION');
        ELSE
            v_flags := array_append(v_flags, 'RANGE_VIOLATION');
        END IF;
    END IF;

    ---------------------------------------------------------------------------
    -- FACTOR 2: Jump Frequency (25% weight)
    -- Repeated long-distance jumps within 7 days between points
    ---------------------------------------------------------------------------
    IF v_transition_count >= 3 THEN
        IF v_jump_count >= 6 THEN
            v_jump_frequency_score := 70;
        ELSIF v_jump_count >= 3 THEN
            v_jump_frequency_score := 55;
        ELSIF v_jump_count >= 1 THEN
            v_jump_frequency_score := 35;
        END IF;

        v_jump_frequency_score := LEAST(100, v_jump_frequency_score + (v_jump_rate * 40));

        IF v_max_jump_m > v_expected_range_m * 10 THEN
            v_jump_frequency_score := LEAST(100, v_jump_frequency_score + 20);
            v_flags := array_append(v_flags, 'EXTREME_JUMP');
        ELSIF v_max_jump_m > v_expected_range_m * 5 THEN
            v_jump_frequency_score := LEAST(100, v_jump_frequency_score + 10);
        END IF;

        IF v_jump_count >= 3 THEN
            v_flags := array_append(v_flags, 'REPEATED_LONG_JUMPS');
        ELSIF v_jump_count >= 1 THEN
            v_flags := array_append(v_flags, 'LONG_JUMP');
        END IF;
    END IF;

    ---------------------------------------------------------------------------
    -- FACTOR 3: Cluster Switching (15% weight)
    -- Frequent switching between distinct location clusters
    ---------------------------------------------------------------------------
    IF v_transition_count >= 3 THEN
        IF v_cluster_switch_rate >= 0.6 THEN
            v_cluster_switch_score := 80;
        ELSIF v_cluster_switch_rate >= 0.4 THEN
            v_cluster_switch_score := 60;
        ELSIF v_cluster_switch_rate >= 0.25 THEN
            v_cluster_switch_score := 40;
        END IF;

        IF v_unique_clusters >= 6 THEN
            v_cluster_switch_score := LEAST(100, v_cluster_switch_score + 10);
            v_flags := array_append(v_flags, 'MULTI_CLUSTER');
        END IF;

        IF v_cluster_switch_rate >= 0.4 THEN
            v_flags := array_append(v_flags, 'CLUSTER_SWITCHING');
        END IF;
    END IF;

    ---------------------------------------------------------------------------
    -- Co-occurrence (disabled for performance)
    ---------------------------------------------------------------------------
    -- Disabled for performance - would need pre-computed data
    v_co_occurrence_score := 0;

    ---------------------------------------------------------------------------
    -- FACTOR 4: Multi-location Density (15% weight)
    -- High observations at MULTIPLE distinct locations (not just one)
    ---------------------------------------------------------------------------
    IF v_unique_locations >= 3 THEN
        DECLARE
            v_obs_spread_ratio NUMERIC;
        BEGIN
            -- Ratio of max single location obs to total obs
            v_obs_spread_ratio := v_max_obs_single_location::NUMERIC / NULLIF(v_observation_count, 0);

            IF v_obs_spread_ratio < 0.5 THEN
                -- Observations are spread across locations
                v_multi_location_score := LEAST(100,
                    (v_unique_locations * 10) * (1 - v_obs_spread_ratio)
                );
                IF v_unique_locations >= 10 THEN
                    v_flags := array_append(v_flags, 'MULTI_LOCATION_TRACKING');
                END IF;
            ELSIF v_obs_spread_ratio < 0.8 THEN
                -- Moderately spread
                v_multi_location_score := LEAST(50, v_unique_locations * 5);
            END IF;
        END;
    END IF;

    ---------------------------------------------------------------------------
    -- FACTOR 5: Signal Pattern (10% weight)
    -- Variable or weak signal at multiple locations suggests following vehicle
    ---------------------------------------------------------------------------
    IF v_signal_stddev IS NOT NULL AND v_unique_locations >= 2 THEN
        IF v_signal_stddev > 15 AND v_signal_mean < -70 THEN
            v_signal_pattern_score := 80;
            v_flags := array_append(v_flags, 'VARIABLE_WEAK_SIGNAL');
        ELSIF v_signal_stddev > 10 THEN
            v_signal_pattern_score := 40;
            v_flags := array_append(v_flags, 'VARIABLE_SIGNAL');
        ELSIF v_signal_mean < -80 AND v_unique_locations >= 3 THEN
            v_signal_pattern_score := 50;
            v_flags := array_append(v_flags, 'WEAK_MULTI_LOCATION');
        END IF;
    END IF;

    ---------------------------------------------------------------------------
    -- FACTOR 6: Temporal Persistence (5% weight)
    -- Multiple days observed (minor factor)
    ---------------------------------------------------------------------------
    IF v_unique_days >= 7 THEN
        v_temporal_score := 100;
        v_flags := array_append(v_flags, 'PERSISTENT_MULTI_DAY');
    ELSIF v_unique_days >= 3 THEN
        v_temporal_score := 60;
    ELSIF v_unique_days >= 2 THEN
        v_temporal_score := 30;
    END IF;

    ---------------------------------------------------------------------------
    -- Confidence (0.0 - 1.0)
    -- Higher when multiple independent signals and sufficient data exist
    ---------------------------------------------------------------------------
    v_confidence := LEAST(1,
        (CASE WHEN v_observation_count >= 20 THEN 0.25 ELSE 0 END) +
        (CASE WHEN v_unique_days >= 7 THEN 0.25 ELSE 0 END) +
        (CASE WHEN v_unique_locations >= 5 THEN 0.25 ELSE 0 END) +
        (CASE WHEN v_jump_count >= 3 THEN 0.25 ELSE 0 END)
    );

    ---------------------------------------------------------------------------
    -- Calculate Composite Score
    ---------------------------------------------------------------------------
    v_composite_score := ROUND(
        (v_range_violation_score * 0.30) +
        (v_jump_frequency_score * 0.25) +
        (v_cluster_switch_score * 0.15) +
        (v_multi_location_score * 0.15) +
        (v_signal_pattern_score * 0.10) +
        (v_temporal_score * 0.05)
    , 1);

    -- Determine threat level
    v_threat_level := CASE
        WHEN v_composite_score >= 80 THEN 'CRITICAL'
        WHEN v_composite_score >= 60 THEN 'HIGH'
        WHEN v_composite_score >= 40 THEN 'MED'
        WHEN v_composite_score >= 20 THEN 'LOW'
        ELSE 'NONE'
    END;

    -- Generate summary
    v_summary := CASE
        WHEN v_composite_score >= 80 THEN
            'Critical threat: ' || v_jump_count || ' long jumps, max ' ||
            ROUND(COALESCE(v_max_jump_m, 0)) || 'm; range ' ||
            ROUND(COALESCE(v_max_distance_m, 0) / v_expected_range_m, 1) || 'x expected'
        WHEN v_composite_score >= 60 THEN
            'High threat: ' || v_jump_count || ' long jumps, max ' ||
            ROUND(COALESCE(v_max_jump_m, 0)) || 'm; range ' ||
            ROUND(COALESCE(v_max_distance_m, 0) / v_expected_range_m, 1) || 'x expected'
        WHEN v_composite_score >= 40 THEN
            'Medium threat: Suspicious movement pattern detected across ' ||
            v_unique_locations || ' locations'
        WHEN v_composite_score >= 20 THEN
            'Low threat: Some anomalous patterns detected'
        ELSE
            'No significant threat indicators'
    END;

    RETURN jsonb_build_object(
        'score', v_composite_score,
        'level', v_threat_level,
        'summary', v_summary,
        'confidence', ROUND(v_confidence, 2),
        'flags', v_flags,
        'factors', jsonb_build_object(
            'range_violation', ROUND(v_range_violation_score, 1),
            'co_occurrence', ROUND(v_co_occurrence_score, 1),
            'jump_frequency', ROUND(v_jump_frequency_score, 1),
            'cluster_switching', ROUND(v_cluster_switch_score, 1),
            'multi_location', ROUND(v_multi_location_score, 1),
            'signal_pattern', ROUND(v_signal_pattern_score, 1),
            'temporal', ROUND(v_temporal_score, 1)
        ),
        'metrics', jsonb_build_object(
            'network_type', v_network_type,
            'expected_range_m', v_expected_range_m,
            'max_distance_m', ROUND(COALESCE(v_max_distance_m, 0), 1),
            'jump_threshold_m', v_jump_threshold_m,
            'transition_count', v_transition_count,
            'jump_count', v_jump_count,
            'jump_rate', ROUND(v_jump_rate, 3),
            'max_jump_m', ROUND(COALESCE(v_max_jump_m, 0), 1),
            'unique_clusters', v_unique_clusters,
            'cluster_switches', v_cluster_switches,
            'cluster_switch_rate', ROUND(v_cluster_switch_rate, 3),
            'median_gap_hours', ROUND(COALESCE(v_median_gap_hours, 0), 1),
            'observation_count', v_observation_count,
            'unique_locations', v_unique_locations,
            'unique_days', v_unique_days,
            'co_occurrence_count', v_co_occurrence_count,
            'signal_stddev', ROUND(COALESCE(v_signal_stddev, 0), 1),
            'signal_mean', ROUND(COALESCE(v_signal_mean, 0), 1),
            'max_obs_single_location', v_max_obs_single_location
        )
    );
END;
$$;

COMMENT ON FUNCTION calculate_threat_score_v3(TEXT) IS
'Threat Scoring v3.0 - Forensically sound methodology (OPTIMIZED) that:
1. Uses radio range-based distance analysis (not home-dependent)
2. Adds jump-frequency and cluster-switching signals for repeated long-distance movement
3. Excludes cellular networks (range too large)
4. Analyzes signal strength variability
5. Only flags high observation counts if spread across multiple locations
6. Weights: range_violation(30%), jump_frequency(25%), cluster_switching(15%), multi_location(15%), signal_pattern(10%), temporal(5%)';
