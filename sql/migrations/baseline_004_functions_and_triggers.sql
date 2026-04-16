-- ==========================================================================
-- BASELINE 004: Functions and Triggers
-- ==========================================================================
-- This baseline consolidates the following migrations:
-- - 20260216_consolidated_009_functions_and_triggers.sql
-- - 20260331_consolidated_011.sql


-- ======== SOURCE: 20260216_consolidated_009_functions_and_triggers.sql ========

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

CREATE OR REPLACE FUNCTION app.set_network_sibling_override(
    p_bssid_a text,
    p_bssid_b text,
    p_relation text,
    p_updated_by text,
    p_notes text DEFAULT NULL,
    p_confidence numeric DEFAULT 1.000
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    v_bssid1 text;
    v_bssid2 text;
BEGIN
    v_bssid1 := LEAST(upper(trim(p_bssid_a)), upper(trim(p_bssid_b)));
    v_bssid2 := GREATEST(upper(trim(p_bssid_a)), upper(trim(p_bssid_b)));

    INSERT INTO app.network_sibling_overrides (
        bssid1, bssid2, relation, confidence, notes, updated_by, updated_at, is_active
    )
    VALUES (
        v_bssid1, v_bssid2, lower(trim(p_relation)), p_confidence, p_notes, p_updated_by, now(), true
    )
    ON CONFLICT (bssid1, bssid2) DO UPDATE
    SET
        relation = EXCLUDED.relation,
        confidence = EXCLUDED.confidence,
        notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at,
        is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION app.refresh_network_sibling_pairs(
    p_max_octet_delta int DEFAULT 6,
    p_max_distance_m numeric DEFAULT 5000,
    p_min_candidate_conf numeric DEFAULT 0.70,
    p_min_strong_conf numeric DEFAULT 0.92,
    p_seed_limit int DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    v_rowcount bigint := 0;
BEGIN
    IF to_regprocedure('app.find_sibling_radios(text,integer,numeric)') IS NULL
       AND to_regprocedure('app.find_sibling_radios(text,integer,double precision)') IS NULL THEN
        RAISE EXCEPTION 'Missing function app.find_sibling_radios(text, integer, numeric/double precision)';
    END IF;

    WITH seeds AS (
        SELECT ne.bssid
        FROM app.api_network_explorer_mv ne
        WHERE ne.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
        ORDER BY ne.bssid
        LIMIT COALESCE(p_seed_limit, 2147483647)
    ),
    hits AS (
        SELECT s.bssid AS seed_bssid, r.*
        FROM seeds s
        CROSS JOIN LATERAL app.find_sibling_radios(s.bssid, p_max_octet_delta, p_max_distance_m) r
    ),
    dedup AS (
        SELECT DISTINCT ON (LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid))
            LEAST(seed_bssid, sibling_bssid) AS bssid1,
            GREATEST(seed_bssid, sibling_bssid) AS bssid2,
            rule,
            confidence,
            d_last_octet,
            d_third_octet,
            target_ssid AS ssid1,
            sibling_ssid AS ssid2,
            frequency_target AS frequency1,
            frequency_sibling AS frequency2,
            distance_m
        FROM hits
        ORDER BY LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid), confidence DESC
    ),
    scored AS (
        SELECT
            d.*,
            lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) AS n1,
            lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g')) AS n2,
            (
                lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g'))
                =
                lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g'))
            ) AS ssid_same,
            (
                lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) IN (
                    'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
                    'mtasmartbus','kajeetsmartbus','somguest','somiot'
                )
            ) AS ssid_common,
            CASE
                WHEN d.distance_m IS NULL THEN 0
                WHEN (
                    lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g'))
                    =
                    lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g'))
                )
                AND (
                    lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) IN (
                        'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
                        'mtasmartbus','kajeetsmartbus','somguest','somiot'
                    )
                ) THEN
                    CASE
                        WHEN d.distance_m <= 25 THEN 0
                        WHEN d.distance_m <= 75 THEN 0.05
                        WHEN d.distance_m <= 150 THEN 0.12
                        WHEN d.distance_m <= 300 THEN 0.28
                        WHEN d.distance_m <= 500 THEN 0.45
                        WHEN d.distance_m <= 1000 THEN 0.70
                        ELSE 1.00
                    END
                WHEN d.distance_m <= 100 THEN 0
                WHEN d.distance_m <= 500 THEN 0.03
                WHEN d.distance_m <= 1500 THEN 0.08
                ELSE 0.15
            END AS distance_penalty
        FROM dedup d
    ),
    final_pairs AS (
        SELECT
            s.bssid1,
            s.bssid2,
            s.rule,
            (
                s.confidence
                - s.distance_penalty
                + CASE
                    WHEN s.n1 <> '' AND s.n2 <> '' AND s.ssid_same AND s.ssid_common THEN
                        CASE WHEN coalesce(s.distance_m, 999999) <= 75 THEN 0.03 ELSE 0 END
                    WHEN s.n1 <> '' AND s.n2 <> ''
                     AND (s.n1 = s.n2 OR s.n1 LIKE s.n2 || '%' OR s.n2 LIKE s.n1 || '%') THEN 0.07
                    ELSE 0
                  END
                - CASE
                    WHEN s.rule = 'ssid_exact' AND s.ssid_same AND s.ssid_common AND coalesce(s.distance_m, 999999) > 150
                    THEN 0.35
                    ELSE 0
                  END
            ) AS final_conf,
            s.d_last_octet,
            s.d_third_octet,
            s.ssid1,
            s.ssid2,
            s.frequency1,
            s.frequency2,
            s.distance_m
        FROM scored s
    )
    INSERT INTO app.network_sibling_pairs (
        bssid1, bssid2, rule, confidence,
        d_last_octet, d_third_octet, ssid1, ssid2,
        frequency1, frequency2, distance_m,
        quality_scope, computed_at
    )
    SELECT
        f.bssid1,
        f.bssid2,
        f.rule,
        f.final_conf,
        f.d_last_octet,
        f.d_third_octet,
        f.ssid1,
        f.ssid2,
        f.frequency1,
        f.frequency2,
        f.distance_m,
        'default',
        now()
    FROM final_pairs f
    WHERE f.final_conf >= p_min_candidate_conf
    ON CONFLICT (bssid1, bssid2) DO UPDATE
    SET
        rule = EXCLUDED.rule,
        confidence = EXCLUDED.confidence,
        d_last_octet = EXCLUDED.d_last_octet,
        d_third_octet = EXCLUDED.d_third_octet,
        ssid1 = EXCLUDED.ssid1,
        ssid2 = EXCLUDED.ssid2,
        frequency1 = EXCLUDED.frequency1,
        frequency2 = EXCLUDED.frequency2,
        distance_m = EXCLUDED.distance_m,
        quality_scope = EXCLUDED.quality_scope,
        computed_at = EXCLUDED.computed_at;

    GET DIAGNOSTICS v_rowcount = ROW_COUNT;
    RETURN v_rowcount;
END;
$$;

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
        SELECT schemaname, matviewname
        FROM pg_matviews
        WHERE schemaname = 'app'
        ORDER BY matviewname
    LOOP
        start_time := clock_timestamp();
        BEGIN
            EXECUTE format(
                'REFRESH MATERIALIZED VIEW %I.%I',
                mv_record.schemaname,
                mv_record.matviewname
            );
            end_time := clock_timestamp();
            RETURN QUERY SELECT mv_record.schemaname || '.' || mv_record.matviewname, 'success'::text, end_time - start_time;
        EXCEPTION WHEN OTHERS THEN
            end_time := clock_timestamp();
            RETURN QUERY SELECT mv_record.schemaname || '.' || mv_record.matviewname, 'error: ' || SQLERRM, end_time - start_time;
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

-- Fix: ensure trigger function references app.threat_scores_cache (not public) (2026-02-20)
CREATE OR REPLACE FUNCTION public.mark_network_for_threat_recompute()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    INSERT INTO app.threat_scores_cache (bssid, needs_recompute)
    VALUES (NEW.bssid, TRUE)
    ON CONFLICT (bssid) DO UPDATE SET needs_recompute = TRUE;
    RETURN NEW;
END;
$function$;

DROP TABLE IF EXISTS public.threat_scores_cache;

-- --------------------------------------------------------------------------
-- Post-consolidation updates (2026-02-22 through 2026-02-27)
-- --------------------------------------------------------------------------

-- WiGLE v3 denormalization trigger and backfill.
CREATE OR REPLACE FUNCTION app.update_networks_wigle_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_netid text := COALESCE(NEW.netid, OLD.netid);
BEGIN
  UPDATE app.networks n
  SET wigle_v3_observation_count = w.cnt,
      wigle_v3_last_import_at = NOW()
  FROM (
    SELECT COUNT(*)::integer AS cnt
    FROM app.wigle_v3_observations
    WHERE netid = target_netid
  ) w
  WHERE UPPER(n.bssid) = UPPER(target_netid);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wigle_v3_count_update ON app.wigle_v3_observations;
CREATE TRIGGER trg_wigle_v3_count_update
AFTER INSERT OR DELETE ON app.wigle_v3_observations
FOR EACH ROW EXECUTE FUNCTION app.update_networks_wigle_counts();

WITH counts AS (
  SELECT netid, COUNT(*)::integer AS cnt
  FROM app.wigle_v3_observations
  GROUP BY netid
)
UPDATE app.networks n
SET wigle_v3_observation_count = c.cnt,
    wigle_v3_last_import_at = NOW()
FROM counts c
WHERE UPPER(n.bssid) = UPPER(c.netid);

UPDATE app.networks n
SET wigle_v3_observation_count = 0
WHERE n.wigle_v3_observation_count IS DISTINCT FROM 0
  AND NOT EXISTS (
    SELECT 1
    FROM app.wigle_v3_observations w
    WHERE UPPER(w.netid) = UPPER(n.bssid)
  );

-- ======== SOURCE: 20260331_consolidated_011.sql ========

-- ============================================================================
-- Consolidated Migration 011
-- ============================================================================
-- Squashes 12 individual migrations applied between 2026-03-27 and 2026-03-30.
-- All statements are idempotent (IF NOT EXISTS / OR REPLACE / ON CONFLICT).
-- Safe to apply on a fresh DB or skip on existing DBs where the originals ran.
--
-- Replaces:
--   20260327_grant_network_threat_scores_runtime_permissions.sql
--   20260327_tune_sibling_pair_scoring.sql
--   20260328_add_critical_infra_dashboard_indexes.sql
--   20260328_fix_mv_scoring_columns.sql
--   20260329_add_missing_network_columns.sql
--   20260329_deploy_optimized_sibling_detection.sql
--   20260329_fix_job_runs_constraint.sql
--   20260329_fix_users_table.sql
--   20260330_add_upper_bssid_functional_indexes.sql
--   20260330_backfill_network_altitude_columns.sql
--   20260330_create_network_locations.sql
--   20260330_install_refresh_network_locations.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Runtime permissions
-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE app.network_threat_scores TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.network_threat_scores_id_seq TO shadowcheck_user;


-- ----------------------------------------------------------------------------
-- 2. Wigle dashboard indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_wigle_v2_country_region_encryption_lasttime
  ON app.wigle_v2_networks_search (country, region, encryption, lasttime DESC)
  WHERE trilat IS NOT NULL AND trilong IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wigle_v2_bssid_oui24_expr
  ON app.wigle_v2_networks_search ((LEFT(UPPER(REPLACE(bssid, ':', '')), 6)))
  WHERE country = 'US';


-- ----------------------------------------------------------------------------
-- 3. api_network_explorer_mv — add scoring + is_ignored + stationary_confidence
-- ----------------------------------------------------------------------------

DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv CASCADE;

CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
WITH best_obs AS (
  SELECT DISTINCT ON (o.bssid)
    o.bssid,
    o.lat,
    o.lon
  FROM app.observations o
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
  ORDER BY o.bssid, public.st_distance(
    public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::public.geography,
    (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
     FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
  ) DESC
),
obs_spatial AS (
  SELECT
    bssid,
    CASE
      WHEN count(*) < 3 THEN 0
      WHEN stddev(lat) < 0.0001 AND stddev(lon) < 0.0001 THEN 0.95
      WHEN stddev(lat) < 0.0005 AND stddev(lon) < 0.0005 THEN 0.75
      ELSE 0.25
    END AS stationary_confidence
  FROM app.observations
  WHERE lat IS NOT NULL AND lon IS NOT NULL
    AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
  GROUP BY bssid
)
SELECT
  n.bssid,
  n.ssid,
  n.type,
  n.frequency,
  n.bestlevel AS signal,
  bo.lat,
  bo.lon,
  to_timestamp((((n.lasttime_ms)::numeric / 1000.0))::double precision) AS observed_at,
  n.capabilities,
  CASE
    WHEN COALESCE(n.capabilities, '') = '' THEN 'OPEN'
    WHEN UPPER(n.capabilities) LIKE '%WEP%' THEN 'WEP'
    WHEN UPPER(n.capabilities) ~ '^\s*\[ESS\]\s*$' THEN 'OPEN'
    WHEN UPPER(n.capabilities) ~ '^\s*\[IBSS\]\s*$' THEN 'OPEN'
    WHEN UPPER(n.capabilities) ~ 'RSN-OWE' THEN 'WPA3-OWE'
    WHEN UPPER(n.capabilities) ~ 'RSN-SAE' THEN 'WPA3-P'
    WHEN UPPER(n.capabilities) ~ '(WPA3|SAE)' AND UPPER(n.capabilities) ~ '(EAP|MGT)' THEN 'WPA3-E'
    WHEN UPPER(n.capabilities) ~ '(WPA3|SAE)' THEN 'WPA3'
    WHEN UPPER(n.capabilities) ~ '(WPA2|RSN)' AND UPPER(n.capabilities) ~ '(EAP|MGT)' THEN 'WPA2-E'
    WHEN UPPER(n.capabilities) ~ '(WPA2|RSN)' THEN 'WPA2'
    WHEN UPPER(n.capabilities) ~ 'WPA-' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
    WHEN UPPER(n.capabilities) LIKE '%WPA%' AND UPPER(n.capabilities) NOT LIKE '%WPA2%' AND UPPER(n.capabilities) NOT LIKE '%WPA3%' AND UPPER(n.capabilities) NOT LIKE '%RSN%' THEN 'WPA'
    WHEN UPPER(n.capabilities) LIKE '%WPS%' AND UPPER(n.capabilities) NOT LIKE '%WPA%' AND UPPER(n.capabilities) NOT LIKE '%RSN%' THEN 'WPS'
    WHEN UPPER(n.capabilities) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
    ELSE 'UNKNOWN'
  END AS security,
  COALESCE(w3.wigle_v3_observation_count, n.wigle_v3_observation_count, 0) AS wigle_v3_observation_count,
  COALESCE(w3.wigle_v3_last_import_at, n.wigle_v3_last_import_at) AS wigle_v3_last_import_at,
  COALESCE(t.threat_tag, 'untagged'::character varying) AS tag_type,
  COALESCE(t.is_ignored, FALSE) AS is_ignored,
  count(o.id) AS observations,
  count(DISTINCT date(o."time")) AS unique_days,
  count(DISTINCT ((round((o.lat)::numeric, 3) || ','::text) || round((o.lon)::numeric, 3))) AS unique_locations,
  max(o.accuracy) AS accuracy_meters,
  min(o."time") AS first_seen,
  max(o."time") AS last_seen,
  CASE WHEN COALESCE(t.is_ignored, FALSE) THEN 0::numeric ELSE COALESCE(ts.final_threat_score, 0::numeric) END AS threat_score,
  CASE WHEN COALESCE(t.is_ignored, FALSE) THEN 'NONE'::character varying ELSE COALESCE(ts.final_threat_level, 'NONE'::character varying) END AS threat_level,
  COALESCE(ts.rule_based_score, 0::numeric) AS rule_based_score,
  COALESCE(ts.ml_threat_score, 0::numeric) AS ml_threat_score,
  COALESCE((ts.ml_feature_values->>'evidence_weight')::numeric, 0) AS ml_weight,
  COALESCE((ts.ml_feature_values->>'ml_boost')::numeric, 0) AS ml_boost,
  ts.model_version,
  COALESCE((public.st_distance(
    public.st_setsrid(public.st_makepoint(bo.lon, bo.lat), 4326)::public.geography,
    (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
     FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
  ) / 1000.0::double precision), 0::double precision) AS distance_from_home_km,
  (SELECT MAX(public.st_distance(
    public.st_setsrid(public.st_makepoint(o1.lon, o1.lat), 4326)::public.geography,
    public.st_setsrid(public.st_makepoint(o2.lon, o2.lat), 4326)::public.geography
  ))
   FROM app.observations o1, app.observations o2
   WHERE o1.bssid = n.bssid AND o2.bssid = n.bssid
     AND o1.lat IS NOT NULL AND o1.lon IS NOT NULL
     AND o2.lat IS NOT NULL AND o2.lon IS NOT NULL
     AND (o1.is_quality_filtered = false OR o1.is_quality_filtered IS NULL)
     AND (o2.is_quality_filtered = false OR o2.is_quality_filtered IS NULL)
  ) AS max_distance_meters,
  rm.manufacturer,
  osp.stationary_confidence
FROM app.networks n
  LEFT JOIN app.network_tags t ON n.bssid = t.bssid::text
  LEFT JOIN app.observations o ON n.bssid = o.bssid
  LEFT JOIN app.network_threat_scores ts ON n.bssid = ts.bssid::text
  LEFT JOIN best_obs bo ON n.bssid = bo.bssid
  LEFT JOIN obs_spatial osp ON n.bssid = osp.bssid
  LEFT JOIN (
    SELECT netid,
      COUNT(*)::integer AS wigle_v3_observation_count,
      MAX(COALESCE(last_update, observed_at, imported_at)) AS wigle_v3_last_import_at
    FROM app.wigle_v3_observations
    GROUP BY netid
  ) w3 ON UPPER(n.bssid) = UPPER(w3.netid)
  LEFT JOIN app.radio_manufacturers rm ON UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', '')) = rm.prefix
WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
  AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
GROUP BY
  n.bssid, n.ssid, n.type, n.frequency, n.bestlevel, n.lasttime_ms, n.capabilities,
  n.wigle_v3_observation_count, n.wigle_v3_last_import_at,
  w3.wigle_v3_observation_count, w3.wigle_v3_last_import_at,
  t.threat_tag, t.is_ignored,
  ts.final_threat_score, ts.final_threat_level, ts.rule_based_score,
  ts.ml_threat_score, ts.ml_feature_values, ts.model_version,
  rm.manufacturer, bo.lat, bo.lon, osp.stationary_confidence;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid
  ON app.api_network_explorer_mv (bssid);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type
  ON app.api_network_explorer_mv (type);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observed_at
  ON app.api_network_explorer_mv (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat
  ON app.api_network_explorer_mv (threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_rule_score
  ON app.api_network_explorer_mv (rule_based_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_ml_score
  ON app.api_network_explorer_mv (ml_threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_stationary
  ON app.api_network_explorer_mv (stationary_confidence)
  WHERE stationary_confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_ignored
  ON app.api_network_explorer_mv (is_ignored)
  WHERE is_ignored = TRUE;

GRANT SELECT ON app.api_network_explorer_mv TO shadowcheck_user;
GRANT SELECT ON app.api_network_explorer_mv TO grafana_reader;
GRANT SELECT ON app.api_network_explorer_mv TO PUBLIC;

REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;


-- ----------------------------------------------------------------------------
-- 4. Missing columns on app.networks
-- ----------------------------------------------------------------------------

ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS min_altitude_m      double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS max_altitude_m      double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_span_m     double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS last_altitude_m     double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_m          double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS altitude_accuracy_m double precision DEFAULT 0;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS unique_days         integer          DEFAULT 1;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS unique_locations    integer          DEFAULT 1;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS is_sentinel         boolean          DEFAULT false;
ALTER TABLE app.networks ADD COLUMN IF NOT EXISTS accuracy_meters     double precision DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 5. Sibling detection — find_sibling_radios v3
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.find_sibling_radios(
  p_bssid text,
  p_max_octet_delta integer DEFAULT 6,
  p_max_distance_m double precision DEFAULT 1500.0
)
RETURNS TABLE(
  target_bssid text, sibling_bssid text,
  target_ssid text, sibling_ssid text,
  frequency_target integer, frequency_sibling integer,
  d_last_octet integer, d_third_octet integer,
  distance_m double precision, rule text, confidence numeric
)
LANGUAGE sql STABLE
AS $function$
WITH t AS (
  SELECT
    n.bssid, n.ssid, n.frequency,
    COALESCE(n.bestlat, n.lastlat) AS lat,
    COALESCE(n.bestlon, n.lastlon) AS lon,
    upper(split_part(n.bssid, ':', 1)) AS o1,
    upper(split_part(n.bssid, ':', 2)) AS o2
  FROM app.networks n
  WHERE upper(n.bssid) = upper(p_bssid)
  LIMIT 1
),
c AS (
  SELECT
    t.bssid AS target_bssid,
    n.bssid AS sibling_bssid,
    t.ssid AS target_ssid,
    n.ssid AS sibling_ssid,
    t.frequency AS frequency_target,
    n.frequency AS frequency_sibling,
    NULL::integer AS d_last_octet,
    NULL::integer AS d_third_octet,
    CASE
      WHEN t.lat IS NOT NULL AND t.lon IS NOT NULL
        AND COALESCE(n.bestlat, n.lastlat) IS NOT NULL
        AND COALESCE(n.bestlon, n.lastlon) IS NOT NULL
      THEN ST_Distance(
        ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::public.geography,
        ST_SetSRID(ST_MakePoint(COALESCE(n.bestlon, n.lastlon), COALESCE(n.bestlat, n.lastlat)), 4326)::public.geography
      )
      ELSE NULL
    END AS distance_m,
    CASE
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) = lower(n.ssid) THEN 'ssid_exact'
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) LIKE lower(n.ssid) || '%' THEN 'ssid_prefix_target'
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(n.ssid) LIKE lower(t.ssid) || '%' THEN 'ssid_prefix_sibling'
      WHEN (t.ssid IS NULL OR t.ssid = '') AND (n.ssid IS NULL OR n.ssid = '') THEN 'empty_ssid_match'
      ELSE 'mac_only_match'
    END AS rule,
    CASE
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) = lower(n.ssid) THEN 0.85
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(t.ssid) LIKE lower(n.ssid) || '%' THEN 0.70
      WHEN t.ssid IS NOT NULL AND n.ssid IS NOT NULL AND t.ssid <> '' AND n.ssid <> '' AND lower(n.ssid) LIKE lower(t.ssid) || '%' THEN 0.70
      WHEN (t.ssid IS NULL OR t.ssid = '') AND (n.ssid IS NULL OR n.ssid = '') THEN 0.40
      ELSE 0.30
    END AS base_confidence
  FROM t
  JOIN app.networks n
    ON upper(n.bssid) <> upper(t.bssid)
    AND upper(split_part(n.bssid, ':', 1)) = t.o1
    AND upper(split_part(n.bssid, ':', 2)) = t.o2
)
SELECT
  target_bssid, sibling_bssid, target_ssid, sibling_ssid,
  frequency_target, frequency_sibling, d_last_octet, d_third_octet, distance_m, rule,
  GREATEST(0, LEAST(1.000, round((
    COALESCE(base_confidence, 0)
    + CASE
        WHEN frequency_target = frequency_sibling THEN 0.10
        WHEN abs(frequency_target - frequency_sibling) <= 25 THEN 0.05
        ELSE 0
      END
    + CASE
        WHEN distance_m IS NULL THEN 0
        WHEN distance_m <= 50 THEN 0.10
        WHEN distance_m <= 250 THEN 0.05
        WHEN distance_m <= 500 THEN 0.01
        ELSE -0.25
      END
    - CASE
        WHEN lower(regexp_replace(coalesce(target_ssid, ''), '[^a-z0-9]+', '', 'g')) IN (
          'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
          'mtasmartbus','kajeetsmartbus','somguest','somiot'
        ) AND coalesce(distance_m, 0) > 100 THEN 0.45
        ELSE 0
      END
  )::numeric, 3))) AS confidence
FROM c
WHERE rule IS NOT NULL
  AND (distance_m IS NULL OR distance_m <= p_max_distance_m)
ORDER BY confidence DESC, distance_m NULLS LAST, sibling_bssid;
$function$;


-- ----------------------------------------------------------------------------
-- 6. Sibling detection — refresh_network_sibling_pairs (tune + incremental)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.refresh_network_sibling_pairs(
  p_max_octet_delta int DEFAULT 6,
  p_max_distance_m numeric DEFAULT 5000,
  p_min_candidate_conf numeric DEFAULT 0.70,
  p_min_strong_conf numeric DEFAULT 0.92,
  p_seed_limit int DEFAULT NULL,
  p_incremental boolean DEFAULT true
)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
  v_rowcount bigint := 0;
BEGIN
  IF to_regprocedure('app.find_sibling_radios(text,integer,numeric)') IS NULL
     AND to_regprocedure('app.find_sibling_radios(text,integer,double precision)') IS NULL THEN
    RAISE EXCEPTION 'Missing function app.find_sibling_radios(text, integer, numeric/double precision)';
  END IF;

  WITH seeds AS (
    SELECT ne.bssid
    FROM app.api_network_explorer_mv ne
    WHERE ne.bssid ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
      AND (
        NOT p_incremental
        OR NOT EXISTS (
          SELECT 1 FROM app.network_sibling_pairs p
          WHERE (p.bssid1 = ne.bssid OR p.bssid2 = ne.bssid)
            AND p.computed_at > now() - interval '7 days'
        )
      )
    ORDER BY ne.bssid
    LIMIT COALESCE(p_seed_limit, 5000)
  ),
  hits AS (
    SELECT s.bssid AS seed_bssid, r.*
    FROM seeds s
    CROSS JOIN LATERAL app.find_sibling_radios(s.bssid, p_max_octet_delta, p_max_distance_m) r
  ),
  dedup AS (
    SELECT DISTINCT ON (LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid))
      LEAST(seed_bssid, sibling_bssid) AS bssid1,
      GREATEST(seed_bssid, sibling_bssid) AS bssid2,
      rule, confidence, d_last_octet, d_third_octet,
      target_ssid AS ssid1, sibling_ssid AS ssid2,
      frequency_target AS frequency1, frequency_sibling AS frequency2, distance_m
    FROM hits
    ORDER BY LEAST(seed_bssid, sibling_bssid), GREATEST(seed_bssid, sibling_bssid), confidence DESC
  ),
  scored AS (
    SELECT
      d.*,
      lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) AS n1,
      lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g')) AS n2,
      (lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g'))
       = lower(regexp_replace(coalesce(d.ssid2, ''), '[^a-z0-9]+', '', 'g'))) AS ssid_same,
      (lower(regexp_replace(coalesce(d.ssid1, ''), '[^a-z0-9]+', '', 'g')) IN (
        'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
        'mtasmartbus','kajeetsmartbus','somguest','somiot'
      )) AS ssid_common,
      CASE
        WHEN d.distance_m IS NULL THEN 0
        WHEN (lower(regexp_replace(coalesce(d.ssid1,''),'[^a-z0-9]+','','g'))
              = lower(regexp_replace(coalesce(d.ssid2,''),'[^a-z0-9]+','','g')))
          AND (lower(regexp_replace(coalesce(d.ssid1,''),'[^a-z0-9]+','','g')) IN (
            'greatlakesmobile','mdt','xfinitywifi','xfinitymobile',
            'mtasmartbus','kajeetsmartbus','somguest','somiot'))
        THEN CASE
          WHEN d.distance_m <= 25  THEN 0
          WHEN d.distance_m <= 75  THEN 0.05
          WHEN d.distance_m <= 150 THEN 0.12
          WHEN d.distance_m <= 300 THEN 0.28
          WHEN d.distance_m <= 500 THEN 0.45
          WHEN d.distance_m <= 1000 THEN 0.70
          ELSE 1.00
        END
        WHEN d.distance_m <= 100  THEN 0
        WHEN d.distance_m <= 500  THEN 0.03
        WHEN d.distance_m <= 1500 THEN 0.08
        ELSE 0.15
      END AS distance_penalty
    FROM dedup d
  ),
  partner_stats AS (
    SELECT radio_bssid,
      COUNT(*) FILTER (WHERE ssid_same AND ssid_common) AS common_partner_count
    FROM (
      SELECT s.bssid1 AS radio_bssid, s.ssid_same, s.ssid_common FROM scored s
      UNION ALL
      SELECT s.bssid2 AS radio_bssid, s.ssid_same, s.ssid_common FROM scored s
    ) rp
    GROUP BY radio_bssid
  ),
  family_stats AS (
    SELECT fn.ssid_norm, fp.family_pair_count, COUNT(*) AS family_radio_count
    FROM (
      SELECT DISTINCT s.n1 AS ssid_norm, s.bssid1 AS radio_bssid
      FROM scored s WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
      UNION
      SELECT DISTINCT s.n1, s.bssid2 FROM scored s
      WHERE s.ssid_same AND s.ssid_common AND s.n1 <> ''
    ) fn
    JOIN (
      SELECT n1 AS ssid_norm, COUNT(*) AS family_pair_count
      FROM scored WHERE ssid_same AND ssid_common AND n1 <> ''
      GROUP BY n1
    ) fp ON fp.ssid_norm = fn.ssid_norm
    GROUP BY fn.ssid_norm, fp.family_pair_count
  ),
  final_pairs AS (
    SELECT
      s.bssid1, s.bssid2, s.rule,
      GREATEST(0, (
        s.confidence - s.distance_penalty
        + CASE
            WHEN s.n1 <> '' AND s.n2 <> '' AND s.ssid_same AND s.ssid_common
              THEN CASE WHEN coalesce(s.distance_m,999999) <= 75 THEN 0.03 ELSE 0 END
            WHEN s.n1 <> '' AND s.n2 <> ''
              AND (s.n1 = s.n2 OR s.n1 LIKE s.n2||'%' OR s.n2 LIKE s.n1||'%') THEN 0.07
            ELSE 0
          END
        - CASE
            WHEN s.rule = 'ssid_exact' AND s.ssid_same AND s.ssid_common
              AND coalesce(s.distance_m,999999) > 150 THEN 0.35
            ELSE 0
          END
        - CASE WHEN s.ssid_same AND s.ssid_common THEN
            CASE
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 12 THEN 0.55
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 8  THEN 0.40
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 5  THEN 0.25
              WHEN GREATEST(COALESCE(ps1.common_partner_count,0), COALESCE(ps2.common_partner_count,0)) >= 3  THEN 0.12
              ELSE 0
            END ELSE 0 END
        - CASE WHEN s.ssid_same AND s.ssid_common THEN
            CASE
              WHEN COALESCE(fs.family_radio_count,0) >= 18 THEN 0.25
              WHEN COALESCE(fs.family_radio_count,0) >= 10 THEN 0.15
              WHEN COALESCE(fs.family_radio_count,0) >= 6  THEN 0.08
              ELSE 0
            END ELSE 0 END
      )) AS final_conf,
      s.d_last_octet, s.d_third_octet,
      s.ssid1, s.ssid2, s.frequency1, s.frequency2, s.distance_m
    FROM scored s
    LEFT JOIN partner_stats ps1 ON ps1.radio_bssid = s.bssid1
    LEFT JOIN partner_stats ps2 ON ps2.radio_bssid = s.bssid2
    LEFT JOIN family_stats fs ON fs.ssid_norm = s.n1
  )
  INSERT INTO app.network_sibling_pairs (
    bssid1, bssid2, rule, confidence,
    d_last_octet, d_third_octet, ssid1, ssid2,
    frequency1, frequency2, distance_m, quality_scope, computed_at
  )
  SELECT
    f.bssid1, f.bssid2, f.rule, f.final_conf,
    f.d_last_octet, f.d_third_octet, f.ssid1, f.ssid2,
    f.frequency1, f.frequency2, f.distance_m, 'default', now()
  FROM final_pairs f
  WHERE f.final_conf >= p_min_candidate_conf
  ON CONFLICT (bssid1, bssid2) DO UPDATE SET
    rule = EXCLUDED.rule, confidence = EXCLUDED.confidence,
    d_last_octet = EXCLUDED.d_last_octet, d_third_octet = EXCLUDED.d_third_octet,
    ssid1 = EXCLUDED.ssid1, ssid2 = EXCLUDED.ssid2,
    frequency1 = EXCLUDED.frequency1, frequency2 = EXCLUDED.frequency2,
    distance_m = EXCLUDED.distance_m, quality_scope = EXCLUDED.quality_scope,
    computed_at = EXCLUDED.computed_at;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  RETURN v_rowcount;
END;
$$;


-- ----------------------------------------------------------------------------
-- 7. background_job_runs constraint
-- ----------------------------------------------------------------------------

ALTER TABLE app.background_job_runs
  DROP CONSTRAINT IF EXISTS background_job_runs_job_name_check;

ALTER TABLE app.background_job_runs
  ADD CONSTRAINT background_job_runs_job_name_check
  CHECK (job_name IN ('backup', 'mlScoring', 'mvRefresh', 'siblingDetection'));


-- ----------------------------------------------------------------------------
-- 8. users table — force_password_change column
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'app' AND table_name = 'users'
                 AND column_name = 'force_password_change') THEN
    ALTER TABLE app.users ADD COLUMN force_password_change boolean DEFAULT false;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 9. Functional UPPER(bssid) indexes
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_network_tags_bssid_upper
  ON app.network_tags (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_network_notes_bssid_upper
  ON app.network_notes (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_networks_bssid_upper
  ON app.networks (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid_upper
  ON app.api_network_explorer_mv (UPPER(bssid));
CREATE INDEX IF NOT EXISTS idx_network_threat_scores_bssid_upper
  ON app.network_threat_scores (UPPER(bssid));


-- ----------------------------------------------------------------------------
-- 10. Backfill altitude columns on app.networks
-- ----------------------------------------------------------------------------

UPDATE app.networks n
SET
  min_altitude_m  = agg.min_alt,
  max_altitude_m  = agg.max_alt,
  altitude_span_m = agg.max_alt - agg.min_alt,
  last_altitude_m = agg.last_alt
FROM (
  SELECT bssid,
    MIN(altitude) AS min_alt,
    MAX(altitude) AS max_alt,
    (array_agg(altitude ORDER BY "time" DESC))[1] AS last_alt
  FROM app.observations
  WHERE altitude IS NOT NULL AND altitude BETWEEN -500 AND 10000
  GROUP BY bssid
) agg
WHERE n.bssid = agg.bssid;


-- ----------------------------------------------------------------------------
-- 11. app.network_locations table
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS app.network_locations (
  bssid            text PRIMARY KEY,
  centroid_lat     double precision,
  centroid_lon     double precision,
  weighted_lat     double precision,
  weighted_lon     double precision,
  obs_count        integer     NOT NULL DEFAULT 0,
  last_computed_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_locations_bssid
  ON app.network_locations (bssid);
CREATE INDEX IF NOT EXISTS idx_network_locations_bssid_upper
  ON app.network_locations (UPPER(bssid));

GRANT SELECT ON app.network_locations TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.network_locations TO shadowcheck_admin;


-- ----------------------------------------------------------------------------
-- 12. refresh_network_locations() function + initial population
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.refresh_network_locations()
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO app.network_locations (
    bssid, centroid_lat, centroid_lon, weighted_lat, weighted_lon, obs_count, last_computed_at
  )
  WITH bounds AS (
    SELECT bssid, MIN(level) AS min_level, MAX(level) AS max_level
    FROM app.observations
    WHERE lat IS NOT NULL AND lon IS NOT NULL AND level IS NOT NULL
      AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
    GROUP BY bssid
  ),
  weighted AS (
    SELECT
      o.bssid,
      AVG(o.lat) AS centroid_lat,
      AVG(o.lon) AS centroid_lon,
      CASE
        WHEN b.max_level = b.min_level THEN AVG(o.lat)
        ELSE SUM(((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)) * o.lat)
             / NULLIF(SUM((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)), 0)
      END AS weighted_lat,
      CASE
        WHEN b.max_level = b.min_level THEN AVG(o.lon)
        ELSE SUM(((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)) * o.lon)
             / NULLIF(SUM((o.level - b.min_level)::double precision
                  / NULLIF((b.max_level - b.min_level)::double precision, 0)), 0)
      END AS weighted_lon,
      COUNT(*)::integer AS obs_count
    FROM app.observations o
    JOIN bounds b ON b.bssid = o.bssid
    WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL AND o.level IS NOT NULL
      AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
    GROUP BY o.bssid, b.min_level, b.max_level
  )
  SELECT bssid, centroid_lat, centroid_lon, weighted_lat, weighted_lon, obs_count, NOW()
  FROM weighted
  ON CONFLICT (bssid) DO UPDATE SET
    centroid_lat     = EXCLUDED.centroid_lat,
    centroid_lon     = EXCLUDED.centroid_lon,
    weighted_lat     = EXCLUDED.weighted_lat,
    weighted_lon     = EXCLUDED.weighted_lon,
    obs_count        = EXCLUDED.obs_count,
    last_computed_at = EXCLUDED.last_computed_at;
END;
$$;

GRANT EXECUTE ON FUNCTION app.refresh_network_locations() TO shadowcheck_admin;

SELECT app.refresh_network_locations();
