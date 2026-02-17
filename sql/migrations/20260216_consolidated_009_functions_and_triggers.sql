-- ============================================================================
-- Consolidated Migration 009: Functions and Triggers
-- ============================================================================
-- Network operation functions, note/media functions, geospatial functions,
-- utility functions, and all trigger attachments.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- Tag operation functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.network_add_tag(network_tags jsonb, tag_name text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF NOT (network_tags ? tag_name) THEN
        RETURN network_tags || jsonb_build_array(tag_name);
    END IF;
    RETURN network_tags;
END;
$$;

CREATE OR REPLACE FUNCTION app.network_remove_tag(network_tags jsonb, tag_name text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(tag)
        FROM jsonb_array_elements_text(network_tags) AS tag
        WHERE tag != tag_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.network_has_tag(network_tags jsonb, tag_name text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN network_tags ? tag_name;
END;
$$;

CREATE OR REPLACE FUNCTION app.network_toggle_tag(target_bssid text, tag_name text, tag_notes text DEFAULT NULL::text)
RETURNS TABLE(action text, bssid text, tags jsonb)
LANGUAGE plpgsql AS $$
DECLARE
    current_tags JSONB;
    has_tag BOOLEAN;
    result_action TEXT;
BEGIN
    SELECT nt.tags INTO current_tags FROM app.network_tags nt WHERE nt.bssid = target_bssid;

    IF current_tags IS NULL THEN
        INSERT INTO app.network_tags (bssid, tags, notes, created_by)
        VALUES (target_bssid, jsonb_build_array(tag_name), tag_notes, 'admin');
        result_action := 'added';
        current_tags := jsonb_build_array(tag_name);
    ELSE
        has_tag := current_tags ? tag_name;
        IF has_tag THEN
            UPDATE app.network_tags
            SET tags = app.network_remove_tag(app.network_tags.tags, tag_name), updated_at = NOW()
            WHERE app.network_tags.bssid = target_bssid;
            result_action := 'removed';
            current_tags := app.network_remove_tag(current_tags, tag_name);
        ELSE
            UPDATE app.network_tags
            SET tags = app.network_add_tag(app.network_tags.tags, tag_name),
                notes = COALESCE(tag_notes, app.network_tags.notes), updated_at = NOW()
            WHERE app.network_tags.bssid = target_bssid;
            result_action := 'added';
            current_tags := app.network_add_tag(current_tags, tag_name);
        END IF;
    END IF;

    RETURN QUERY SELECT result_action, target_bssid, current_tags;
END;
$$;

CREATE OR REPLACE FUNCTION app.upsert_network_tag(
    p_bssid character varying, p_tag_type character varying,
    p_confidence numeric DEFAULT 0.5, p_notes text DEFAULT NULL::text,
    p_tagged_by character varying DEFAULT CURRENT_USER
) RETURNS TABLE(tag_id integer, bssid character varying, tag_type character varying, threat_score numeric, ml_confidence numeric, confidence numeric)
LANGUAGE plpgsql AS $$
DECLARE
    v_tag_id INTEGER;
    v_threat_score NUMERIC(5,4);
    v_ml_confidence NUMERIC(5,4);
    v_reasoning JSONB;
    v_existing_history JSONB;
BEGIN
    SELECT * INTO v_threat_score, v_ml_confidence, v_reasoning
    FROM app.calculate_threat_score(p_bssid, p_tag_type, p_confidence);

    SELECT tag_history INTO v_existing_history FROM app.network_tags WHERE bssid = p_bssid;
    IF v_existing_history IS NULL THEN v_existing_history := '[]'::jsonb; END IF;

    INSERT INTO app.network_tags (
        bssid, ssid, tag_type, confidence, notes, tagged_by,
        tagged_at, threat_score, ml_confidence, user_override,
        tag_history, model_version
    )
    SELECT p_bssid, n.ssid, p_tag_type, p_confidence, p_notes, p_tagged_by,
        NOW(), v_threat_score, v_ml_confidence, TRUE,
        v_existing_history || jsonb_build_object(
            'tag_type', p_tag_type, 'confidence', p_confidence,
            'timestamp', NOW(), 'reasoning', v_reasoning
        ), 1
    FROM app.networks_legacy n WHERE n.bssid = p_bssid
    ON CONFLICT (bssid, tag_type)
    DO UPDATE SET
        confidence = p_confidence,
        notes = COALESCE(p_notes, network_tags.notes),
        tagged_at = NOW(),
        threat_score = v_threat_score,
        ml_confidence = v_ml_confidence,
        user_override = TRUE,
        tag_history = network_tags.tag_history || jsonb_build_object(
            'tag_type', p_tag_type, 'confidence', p_confidence,
            'timestamp', NOW(), 'reasoning', v_reasoning
        )
    RETURNING network_tags.id, network_tags.bssid, network_tags.tag_type,
              network_tags.threat_score, network_tags.ml_confidence, network_tags.confidence
    INTO v_tag_id, bssid, tag_type, threat_score, ml_confidence, confidence;

    tag_id := v_tag_id;
    RETURN NEXT;
END;
$$;

-- --------------------------------------------------------------------------
-- Note functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.network_add_note(
    network_bssid character varying, note_content text,
    note_type character varying DEFAULT 'general'::character varying,
    user_name character varying DEFAULT 'default_user'::character varying
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
    note_id INTEGER;
BEGIN
    INSERT INTO app.network_notes (bssid, user_id, content, note_type)
    VALUES (network_bssid, user_name, note_content, note_type)
    RETURNING id INTO note_id;
    RETURN note_id;
END;
$$;

COMMENT ON FUNCTION app.network_add_note(character varying, text, character varying, character varying)
    IS 'Add note to network via right-click context menu';

CREATE OR REPLACE FUNCTION app.network_add_notation(target_bssid text, note_text text, note_type text DEFAULT 'general'::text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
    new_note JSONB;
    current_notes JSONB;
BEGIN
    new_note := jsonb_build_object(
        'id', extract(epoch from now())::bigint,
        'text', note_text, 'type', note_type,
        'timestamp', now(), 'author', 'user'
    );

    SELECT detailed_notes INTO current_notes FROM app.network_tags WHERE bssid = target_bssid;
    IF current_notes IS NULL THEN current_notes := '[]'::jsonb; END IF;
    current_notes := current_notes || new_note;

    INSERT INTO app.network_tags (bssid, detailed_notes, created_by)
    VALUES (target_bssid, current_notes, 'user')
    ON CONFLICT (bssid) DO UPDATE SET detailed_notes = current_notes, updated_at = NOW();

    RETURN new_note;
END;
$$;

CREATE OR REPLACE FUNCTION app.network_note_count(network_bssid character varying) RETURNS integer
LANGUAGE plpgsql AS $$
BEGIN
    RETURN (SELECT COUNT(*)::INTEGER FROM app.network_notes WHERE bssid = network_bssid);
END;
$$;

-- --------------------------------------------------------------------------
-- Media functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.delete_note_media(media_id_param integer) RETURNS character varying
LANGUAGE plpgsql AS $$
DECLARE
    file_path VARCHAR(512);
BEGIN
    SELECT nm.file_path INTO file_path FROM app.note_media nm WHERE nm.id = media_id_param;
    DELETE FROM app.note_media WHERE id = media_id_param;
    RETURN file_path;
END;
$$;

COMMENT ON FUNCTION app.delete_note_media(integer) IS 'Delete media and return file path';

CREATE OR REPLACE FUNCTION app.get_note_media(note_id_param integer)
RETURNS TABLE(id integer, file_path character varying, file_name character varying, file_size integer, media_type character varying, created_at timestamp without time zone)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT nm.id, nm.file_path, nm.file_name, nm.file_size, nm.media_type, nm.created_at
    FROM app.note_media nm WHERE nm.note_id = note_id_param
    ORDER BY nm.created_at DESC;
END;
$$;

COMMENT ON FUNCTION app.get_note_media(integer) IS 'Retrieve media for a specific note';

CREATE OR REPLACE FUNCTION app.network_media_count(target_bssid text)
RETURNS TABLE(images bigint, videos bigint, total bigint)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE media_type = 'image') as images,
        COUNT(*) FILTER (WHERE media_type = 'video') as videos,
        COUNT(*) as total
    FROM app.network_media WHERE bssid = target_bssid;
END;
$$;

-- --------------------------------------------------------------------------
-- Geospatial functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.get_home_location()
RETURNS TABLE(latitude double precision, longitude double precision)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT lm.latitude, lm.longitude FROM app.location_markers lm
    WHERE lm.marker_type = 'home' LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION app.nearby_networks(p_lat double precision, p_lon double precision, p_radius_meters integer DEFAULT 100)
RETURNS TABLE(bssid text, ssid text, type text, distance_meters double precision, signal_strength integer)
LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT n.bssid, n.ssid, n.type,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(n.bestlon, n.bestlat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
        ) AS distance_meters,
        n.bestlevel AS signal_strength
    FROM app.networks n
    WHERE n.bestlat IS NOT NULL AND n.bestlon IS NOT NULL
      AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(n.bestlon, n.bestlat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_meters)
    ORDER BY distance_meters;
END;
$$;

-- --------------------------------------------------------------------------
-- Utility functions
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app.refresh_all_materialized_views()
RETURNS TABLE(view_name text, status text, refresh_duration interval)
LANGUAGE plpgsql AS $$
DECLARE
    mv_record RECORD;
    start_time timestamp;
    end_time timestamp;
BEGIN
    FOR mv_record IN
        SELECT schemaname || '.' || matviewname AS full_name
        FROM pg_matviews WHERE schemaname = 'app' ORDER BY matviewname
    LOOP
        start_time := clock_timestamp();
        BEGIN
            EXECUTE format('REFRESH MATERIALIZED VIEW %I', mv_record.full_name);
            end_time := clock_timestamp();
            RETURN QUERY SELECT mv_record.full_name, 'success'::text, end_time - start_time;
        EXCEPTION WHEN OTHERS THEN
            end_time := clock_timestamp();
            RETURN QUERY SELECT mv_record.full_name, 'error: ' || SQLERRM, end_time - start_time;
        END;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_oui_groups()
RETURNS TABLE(oui character varying, vendor_name character varying, bssid_count integer, bssids text[], collective_threat_score numeric, threat_level character varying, has_randomization boolean, randomization_confidence numeric)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT odg.oui, odg.vendor_name, odg.device_count,
        ARRAY_PREPEND(odg.primary_bssid, odg.secondary_bssids),
        odg.collective_threat_score, odg.threat_level,
        odg.has_randomization, odg.randomization_confidence
    FROM app.oui_device_groups odg
    ORDER BY odg.collective_threat_score DESC;
END;
$$;

-- --------------------------------------------------------------------------
-- Trigger attachments
-- --------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER ml_model_config_update
    BEFORE UPDATE ON app.ml_model_config
    FOR EACH ROW EXECUTE FUNCTION app.ml_model_config_update_trigger();

CREATE OR REPLACE TRIGGER network_media_update
    BEFORE UPDATE ON app.network_media
    FOR EACH ROW EXECUTE FUNCTION app.network_media_update_trigger();

CREATE OR REPLACE TRIGGER network_tags_update
    BEFORE UPDATE ON app.network_tags
    FOR EACH ROW EXECUTE FUNCTION app.network_tags_update_trigger();

CREATE OR REPLACE TRIGGER network_threat_scores_update
    BEFORE UPDATE ON app.network_threat_scores
    FOR EACH ROW EXECUTE FUNCTION app.network_threat_scores_update_trigger();

CREATE OR REPLACE TRIGGER trigger_mark_threat_recompute
    AFTER INSERT ON app.observations
    FOR EACH ROW EXECUTE FUNCTION public.mark_network_for_threat_recompute();
