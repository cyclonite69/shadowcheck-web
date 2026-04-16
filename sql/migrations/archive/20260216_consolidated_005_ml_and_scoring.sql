-- ============================================================================
-- Consolidated Migration 005: ML Model Tables and Scoring Functions
-- ============================================================================
-- ML config, metadata, training history, and scoring/trigger functions.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- ml_model_config
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ml_model_config (
    model_type character varying(50) NOT NULL,
    coefficients jsonb NOT NULL,
    intercept numeric NOT NULL,
    feature_names jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE app.ml_model_config IS 'Stores trained ML model coefficients for threat scoring';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ml_model_config_pkey') THEN
        ALTER TABLE ONLY app.ml_model_config ADD CONSTRAINT ml_model_config_pkey PRIMARY KEY (model_type);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- ml_model_metadata
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ml_model_metadata (
    model_type character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    trained_at timestamp with time zone DEFAULT now(),
    training_samples integer NOT NULL,
    threat_count integer,
    false_positive_count integer,
    legitimate_count integer,
    accuracy numeric(3,2),
    feature_names jsonb NOT NULL,
    model_config jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ml_model_metadata_pkey') THEN
        ALTER TABLE ONLY app.ml_model_metadata ADD CONSTRAINT ml_model_metadata_pkey PRIMARY KEY (model_type);
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- ml_training_history
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app.ml_training_history (
    id bigint NOT NULL,
    model_type character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    trained_at timestamp with time zone DEFAULT now(),
    training_samples integer,
    threat_count integer,
    false_positive_count integer,
    legitimate_count integer,
    accuracy numeric(3,2),
    coefficients jsonb NOT NULL,
    intercept numeric,
    feature_names jsonb NOT NULL,
    model_config jsonb,
    notes text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS app.ml_training_history_id_seq
    START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE app.ml_training_history_id_seq OWNED BY app.ml_training_history.id;
ALTER TABLE ONLY app.ml_training_history ALTER COLUMN id SET DEFAULT nextval('app.ml_training_history_id_seq'::regclass);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ml_training_history_pkey') THEN
        ALTER TABLE ONLY app.ml_training_history ADD CONSTRAINT ml_training_history_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ml_training_history_model ON app.ml_training_history USING btree (model_type, trained_at DESC);

-- --------------------------------------------------------------------------
-- Scoring functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.calculate_threat_score(p_bssid character varying, p_new_tag_type character varying, p_user_confidence numeric DEFAULT 0.5)
RETURNS TABLE(new_threat_score numeric, new_ml_confidence numeric, reasoning jsonb)
LANGUAGE plpgsql AS $$
DECLARE
    v_existing_score NUMERIC(5,4);
    v_existing_confidence NUMERIC(5,4);
    v_tag_count INTEGER;
    v_base_score NUMERIC(5,4);
    v_weight NUMERIC(5,4);
    v_learning_rate NUMERIC(5,4) := 0.3;
    v_confidence_decay NUMERIC(5,4) := 0.9;
    v_reasoning JSONB;
BEGIN
    SELECT threat_score, ml_confidence, jsonb_array_length(COALESCE(tag_history, '[]'::jsonb))
    INTO v_existing_score, v_existing_confidence, v_tag_count
    FROM app.network_tags WHERE bssid = p_bssid;

    IF v_existing_score IS NULL THEN
        v_existing_score := 0.5000; v_existing_confidence := 0.0; v_tag_count := 0;
    END IF;

    v_base_score := CASE p_new_tag_type
        WHEN 'LEGIT' THEN 0.0000
        WHEN 'FALSE_POSITIVE' THEN 0.0500
        WHEN 'INVESTIGATE' THEN 0.7000
        WHEN 'THREAT' THEN 1.0000
        ELSE 0.5000
    END;

    v_weight := v_learning_rate * (0.5 + (p_user_confidence * 0.5));

    new_threat_score := ROUND(((1 - v_weight) * v_existing_score + v_weight * v_base_score)::numeric, 4);
    new_ml_confidence := ROUND((1.0 / (1.0 + exp(-0.3 * ((v_tag_count + 1) - 3.0))))::numeric, 4);

    v_reasoning := jsonb_build_object(
        'previous_score', v_existing_score, 'base_score_for_tag', v_base_score,
        'learning_rate', v_learning_rate, 'weight_applied', v_weight,
        'user_confidence', p_user_confidence, 'tag_count', v_tag_count + 1,
        'formula', 'exponential_moving_average', 'timestamp', NOW()
    );

    RETURN QUERY SELECT new_threat_score, new_ml_confidence, v_reasoning;
END;
$$;

CREATE OR REPLACE FUNCTION app.calculate_threat_score_v3(p_bssid text)
RETURNS TABLE(bssid text, threat_score integer, threat_level text, factors jsonb)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_score integer := 0;
    v_factors jsonb := '{}';
    v_home_lat double precision;
    v_home_lon double precision;
    v_seen_at_home boolean := false;
    v_seen_away boolean := false;
    v_distance_range double precision := 0;
    v_observation_count integer := 0;
    v_days_seen integer := 0;
BEGIN
    SELECT latitude, longitude INTO v_home_lat, v_home_lon
    FROM app.location_markers WHERE marker_type = 'home' LIMIT 1;

    SELECT COUNT(*), COUNT(DISTINCT DATE(time))
    INTO v_observation_count, v_days_seen
    FROM app.observations WHERE observations.bssid = p_bssid;

    IF v_home_lat IS NOT NULL THEN
        SELECT MAX(ST_Distance(
            ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography
        )) INTO v_distance_range
        FROM app.observations
        WHERE observations.bssid = p_bssid AND lat IS NOT NULL AND lon IS NOT NULL;

        SELECT EXISTS(
            SELECT 1 FROM app.observations
            WHERE observations.bssid = p_bssid
              AND ST_DWithin(
                  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography, 100)
        ) INTO v_seen_at_home;

        SELECT EXISTS(
            SELECT 1 FROM app.observations
            WHERE observations.bssid = p_bssid
              AND ST_Distance(
                  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                  ST_SetSRID(ST_MakePoint(v_home_lon, v_home_lat), 4326)::geography) > 200
        ) INTO v_seen_away;
    END IF;

    IF v_seen_at_home AND v_seen_away THEN
        v_score := v_score + 40;
        v_factors := v_factors || '{"home_and_away": 40}';
    END IF;
    IF v_distance_range > 200 THEN
        v_score := v_score + 25;
        v_factors := v_factors || jsonb_build_object('distance_range', 25);
    END IF;
    IF v_days_seen >= 3 THEN
        v_score := v_score + LEAST(15, v_days_seen);
        v_factors := v_factors || jsonb_build_object('multiple_days', LEAST(15, v_days_seen));
    END IF;
    IF v_observation_count >= 10 THEN
        v_score := v_score + LEAST(10, v_observation_count / 10);
        v_factors := v_factors || jsonb_build_object('observation_count', LEAST(10, v_observation_count / 10));
    END IF;

    RETURN QUERY SELECT p_bssid, v_score,
        CASE WHEN v_score >= 80 THEN 'CRITICAL' WHEN v_score >= 60 THEN 'HIGH'
             WHEN v_score >= 40 THEN 'MED' WHEN v_score >= 20 THEN 'LOW' ELSE 'NONE' END,
        v_factors;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_threat_score(p_rule_based_score numeric, p_ml_score numeric, p_threat_tag text, p_threat_confidence numeric)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_ml_enabled BOOLEAN;
    v_ml_weight NUMERIC;
    v_base_score NUMERIC;
    v_final_score NUMERIC;
BEGIN
    SELECT (value::text)::boolean INTO v_ml_enabled FROM app.settings WHERE key = 'ml_blending_enabled';
    SELECT (value::text)::numeric INTO v_ml_weight FROM app.settings WHERE key = 'ml_blending_weight';
    v_ml_enabled := COALESCE(v_ml_enabled, false);
    v_ml_weight := COALESCE(v_ml_weight, 0.3);

    IF p_threat_tag = 'FALSE_POSITIVE' THEN RETURN 0; END IF;

    IF v_ml_enabled AND p_ml_score IS NOT NULL AND p_ml_score > 0 THEN
        v_base_score := (COALESCE(p_rule_based_score, 0) * (1 - v_ml_weight)) + (COALESCE(p_ml_score, 0) * v_ml_weight);
    ELSE
        v_base_score := COALESCE(p_rule_based_score, 0);
    END IF;

    IF p_threat_tag = 'THREAT' THEN
        v_final_score := LEAST(100, v_base_score + COALESCE(p_threat_confidence, 0) * 20);
    ELSE
        v_final_score := v_base_score;
    END IF;

    RETURN v_final_score;
END;
$$;

-- --------------------------------------------------------------------------
-- Trigger functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.network_tags_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    IF OLD.threat_tag IS DISTINCT FROM NEW.threat_tag THEN
        NEW.tag_history = COALESCE(OLD.tag_history, '[]'::jsonb) || jsonb_build_object(
            'previous_tag', OLD.threat_tag, 'new_tag', NEW.threat_tag,
            'changed_at', NOW(), 'confidence', OLD.threat_confidence
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.network_threat_scores_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.ml_model_config_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.network_media_update_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- mark_network_for_threat_recompute (in public schema, used by observation insert trigger)
-- Fixed: uses app.threat_scores_cache instead of public.threat_scores_cache
CREATE OR REPLACE FUNCTION public.mark_network_for_threat_recompute() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    INSERT INTO app.threat_scores_cache (bssid, needs_recompute)
    VALUES (NEW.bssid, TRUE)
    ON CONFLICT (bssid) DO UPDATE SET needs_recompute = TRUE;
    RETURN NEW;
END;
$function$;
