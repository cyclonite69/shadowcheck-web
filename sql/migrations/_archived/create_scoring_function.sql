-- Sophisticated threat scoring algorithm for ML-ready iteration
-- This function calculates threat_score based on user tags, historical data, and network characteristics

CREATE OR REPLACE FUNCTION app.calculate_threat_score(
    p_bssid VARCHAR(17),
    p_new_tag_type VARCHAR(20),
    p_user_confidence NUMERIC DEFAULT 0.5
) RETURNS TABLE(
    new_threat_score NUMERIC(5,4),
    new_ml_confidence NUMERIC(5,4),
    reasoning JSONB
) AS $$
DECLARE
    v_existing_score NUMERIC(5,4);
    v_existing_confidence NUMERIC(5,4);
    v_tag_count INTEGER;
    v_base_score NUMERIC(5,4);
    v_weight NUMERIC(5,4);
    v_learning_rate NUMERIC(5,4) := 0.3;  -- How much each new tag influences score
    v_confidence_decay NUMERIC(5,4) := 0.9;  -- Confidence decay for old tags
    v_reasoning JSONB;
BEGIN
    -- Get existing tag data
    SELECT
        threat_score,
        ml_confidence,
        jsonb_array_length(COALESCE(tag_history, '[]'::jsonb))
    INTO v_existing_score, v_existing_confidence, v_tag_count
    FROM app.network_tags
    WHERE bssid = p_bssid;

    -- If no existing tag, start fresh
    IF v_existing_score IS NULL THEN
        v_existing_score := 0.5000;
        v_existing_confidence := 0.0;
        v_tag_count := 0;
    END IF;

    -- Map tag type to base score (granular for ML learning)
    v_base_score := CASE p_new_tag_type
        WHEN 'LEGIT' THEN 0.0000
        WHEN 'FALSE_POSITIVE' THEN 0.0500  -- Slightly uncertain
        WHEN 'INVESTIGATE' THEN 0.7000
        WHEN 'THREAT' THEN 1.0000
        ELSE 0.5000
    END;

    -- Calculate weight based on user confidence (higher confidence = more influence)
    v_weight := v_learning_rate * (0.5 + (p_user_confidence * 0.5));

    -- Exponential moving average for threat score
    -- new_score = (1 - weight) * old_score + weight * base_score
    new_threat_score := ROUND(
        ((1 - v_weight) * v_existing_score + v_weight * v_base_score)::numeric,
        4
    );

    -- ML confidence increases with more tags using sigmoid function
    -- confidence = 1 / (1 + exp(-k*(n-3)))  where k=0.3, n=tag_count
    -- This gives smooth transition: 0.1 → 0.5 → 0.9 as tags accumulate
    new_ml_confidence := ROUND(
        (1.0 / (1.0 + exp(-0.3 * ((v_tag_count + 1) - 3.0))))::numeric,
        4
    );

    -- Build reasoning JSON for transparency and ML feature extraction
    v_reasoning := jsonb_build_object(
        'previous_score', v_existing_score,
        'base_score_for_tag', v_base_score,
        'learning_rate', v_learning_rate,
        'weight_applied', v_weight,
        'user_confidence', p_user_confidence,
        'tag_count', v_tag_count + 1,
        'formula', 'exponential_moving_average',
        'timestamp', NOW()
    );

    RETURN QUERY SELECT new_threat_score, new_ml_confidence, v_reasoning;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to update tag with scoring
CREATE OR REPLACE FUNCTION app.upsert_network_tag(
    p_bssid VARCHAR(17),
    p_tag_type VARCHAR(20),
    p_confidence NUMERIC DEFAULT 0.5,
    p_notes TEXT DEFAULT NULL,
    p_tagged_by VARCHAR(50) DEFAULT CURRENT_USER
) RETURNS TABLE(
    tag_id INTEGER,
    bssid VARCHAR(17),
    tag_type VARCHAR(20),
    threat_score NUMERIC(5,4),
    ml_confidence NUMERIC(5,4),
    confidence NUMERIC(5,4)
) AS $$
DECLARE
    v_tag_id INTEGER;
    v_threat_score NUMERIC(5,4);
    v_ml_confidence NUMERIC(5,4);
    v_reasoning JSONB;
    v_existing_history JSONB;
BEGIN
    -- Calculate new threat score
    SELECT * INTO v_threat_score, v_ml_confidence, v_reasoning
    FROM app.calculate_threat_score(p_bssid, p_tag_type, p_confidence);

    -- Get existing tag history
    SELECT tag_history INTO v_existing_history
    FROM app.network_tags
    WHERE bssid = p_bssid;

    IF v_existing_history IS NULL THEN
        v_existing_history := '[]'::jsonb;
    END IF;

    -- Upsert the tag
    INSERT INTO app.network_tags (
        bssid, ssid, tag_type, confidence, notes, tagged_by,
        tagged_at, threat_score, ml_confidence, user_override,
        tag_history, model_version
    )
    SELECT
        p_bssid,
        n.ssid,
        p_tag_type,
        p_confidence,
        p_notes,
        p_tagged_by,
        NOW(),
        v_threat_score,
        v_ml_confidence,
        TRUE,
        v_existing_history || jsonb_build_object(
            'tag_type', p_tag_type,
            'confidence', p_confidence,
            'timestamp', NOW(),
            'reasoning', v_reasoning
        ),
        1
    FROM app.networks_legacy n
    WHERE n.bssid = p_bssid
    ON CONFLICT (bssid, tag_type)
    DO UPDATE SET
        confidence = p_confidence,
        notes = COALESCE(p_notes, network_tags.notes),
        tagged_at = NOW(),
        threat_score = v_threat_score,
        ml_confidence = v_ml_confidence,
        user_override = TRUE,
        tag_history = network_tags.tag_history || jsonb_build_object(
            'tag_type', p_tag_type,
            'confidence', p_confidence,
            'timestamp', NOW(),
            'reasoning', v_reasoning
        )
    RETURNING network_tags.id, network_tags.bssid, network_tags.tag_type,
              network_tags.threat_score, network_tags.ml_confidence, network_tags.confidence
    INTO v_tag_id, bssid, tag_type, threat_score, ml_confidence, confidence;

    tag_id := v_tag_id;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
