-- ============================================================================
-- Consolidated Migration 008: Views and Materialized Views
-- ============================================================================
-- All application views and materialized views.
-- Source: pg_dump --schema-only of live database (2026-02-16)
-- ============================================================================

-- --------------------------------------------------------------------------
-- network_entries view (primary network data view for API)
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.network_entries AS
SELECT n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.capabilities AS security,
    n.service,
    n.rcois,
    n.mfgrid,
    n.lasttime_ms,
    n.lastlat,
    n.lastlon,
    n.bestlevel AS signal,
    n.bestlat AS lat,
    n.bestlon AS lon,
    count(o.id) AS observations,
    min(o."time") AS first_seen,
    max(o."time") AS last_seen,
    max(o."time") AS observed_at,
    max(o.accuracy) AS accuracy_meters,
    avg(CASE WHEN ((o.altitude >= (-500)::double precision) AND (o.altitude <= (10000)::double precision)) THEN o.altitude ELSE NULL::double precision END) AS altitude_m,
    min(CASE WHEN ((o.altitude >= (-500)::double precision) AND (o.altitude <= (10000)::double precision)) THEN o.altitude ELSE NULL::double precision END) AS min_altitude_m,
    max(CASE WHEN ((o.altitude >= (-500)::double precision) AND (o.altitude <= (10000)::double precision)) THEN o.altitude ELSE NULL::double precision END) AS max_altitude_m,
    NULL::double precision AS altitude_accuracy_m,
    COALESCE((max(CASE WHEN ((o.altitude >= (-500)::double precision) AND (o.altitude <= (10000)::double precision)) THEN o.altitude ELSE NULL::double precision END)
            - min(CASE WHEN ((o.altitude >= (-500)::double precision) AND (o.altitude <= (10000)::double precision)) THEN o.altitude ELSE NULL::double precision END)), (0)::double precision) AS altitude_span_m,
    (0)::double precision AS max_distance_meters,
    (SELECT observations.altitude FROM app.observations
     WHERE ((observations.bssid = n.bssid) AND ((observations.altitude >= (-500)::double precision) AND (observations.altitude <= (10000)::double precision)))
     ORDER BY observations."time" DESC LIMIT 1) AS last_altitude_m,
    (SELECT observations.accuracy FROM app.observations
     WHERE (observations.bssid = n.bssid)
     ORDER BY observations."time" DESC LIMIT 1) AS last_accuracy_m,
    NULL::integer AS channel,
    NULL::text AS wps,
    NULL::text AS battery,
    NULL::text AS auth,
    count(DISTINCT date(o."time")) AS unique_days,
    count(DISTINCT ((round((o.lat)::numeric, 3) || ','::text) || round((o.lon)::numeric, 3))) AS unique_locations,
    false AS is_sentinel,
    "left"(replace(n.bssid, ':'::text, ''::text), 6) AS oui,
    NULL::text[] AS insecure_flags,
    NULL::text[] AS security_flags,
    count(DISTINCT o.source_tag) AS unique_source_count,
    avg(o.level) AS avg_signal,
    min(o.level) AS min_signal,
    max(o.level) AS max_signal
FROM (app.networks n
    LEFT JOIN app.observations o ON ((o.bssid = n.bssid)))
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.capabilities, n.service, n.rcois, n.mfgrid,
         n.lasttime_ms, n.lastlat, n.lastlon, n.bestlevel, n.bestlat, n.bestlon;

-- --------------------------------------------------------------------------
-- api_network_explorer view
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.api_network_explorer AS
SELECT n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.bestlevel AS signal,
    n.bestlat AS lat,
    n.bestlon AS lon,
    n.lasttime_ms AS observed_at,
    n.capabilities AS security,
    COALESCE(t.threat_tag, 'untagged'::character varying) AS tag_type,
    t.updated_at AS tagged_at,
    nt.notes_count,
    nm.media_count
FROM (((app.networks n
    LEFT JOIN app.network_tags t ON ((n.bssid = (t.bssid)::text)))
    LEFT JOIN (SELECT network_notes.bssid, count(*) AS notes_count FROM app.network_notes GROUP BY network_notes.bssid) nt ON ((n.bssid = (nt.bssid)::text)))
    LEFT JOIN (SELECT network_media.bssid, count(*) AS media_count FROM app.network_media GROUP BY network_media.bssid) nm ON ((n.bssid = (nm.bssid)::text)));

-- --------------------------------------------------------------------------
-- network_summary_with_notes view
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.network_summary_with_notes AS
SELECT n.bssid, n.ssid, n.type, n.frequency, n.bestlevel, n.bestlat, n.bestlon, n.lasttime_ms,
    nn.content AS latest_note, nn.created_at AS note_created_at
FROM (app.networks n
    LEFT JOIN LATERAL (SELECT network_notes.content, network_notes.created_at
        FROM app.network_notes WHERE ((network_notes.bssid)::text = n.bssid)
        ORDER BY network_notes.created_at DESC LIMIT 1) nn ON (true));

-- --------------------------------------------------------------------------
-- network_tags_expanded view
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.network_tags_expanded AS
SELECT id, bssid, is_ignored, ignore_reason, threat_tag, threat_confidence,
    notes, wigle_lookup_requested, wigle_lookup_at, wigle_result,
    created_at, updated_at, created_by, tag_history, tags,
    CASE WHEN (jsonb_array_length(tags) > 0) THEN ARRAY(SELECT jsonb_array_elements_text(nt.tags))
         ELSE ARRAY[]::text[] END AS tag_array,
    app.network_has_tag(tags, 'THREAT'::text) AS is_threat,
    app.network_has_tag(tags, 'INVESTIGATE'::text) AS is_investigate,
    app.network_has_tag(tags, 'FALSE_POSITIVE'::text) AS is_false_positive,
    app.network_has_tag(tags, 'SUSPECT'::text) AS is_suspect
FROM app.network_tags nt;

-- --------------------------------------------------------------------------
-- network_tags_full view
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.network_tags_full AS
SELECT id, bssid, is_ignored, ignore_reason, threat_tag, threat_confidence,
    notes, wigle_lookup_requested, wigle_lookup_at, wigle_result,
    created_at, updated_at, created_by, tag_history, tags, detailed_notes,
    CASE WHEN (jsonb_array_length(tags) > 0) THEN ARRAY(SELECT jsonb_array_elements_text(nt.tags))
         ELSE ARRAY[]::text[] END AS tag_array,
    app.network_has_tag(tags, 'THREAT'::text) AS is_threat,
    app.network_has_tag(tags, 'INVESTIGATE'::text) AS is_investigate,
    app.network_has_tag(tags, 'FALSE_POSITIVE'::text) AS is_false_positive,
    app.network_has_tag(tags, 'SUSPECT'::text) AS is_suspect,
    COALESCE(jsonb_array_length(detailed_notes), 0) AS notation_count,
    (SELECT count(*) FROM app.network_media nm WHERE (((nm.bssid)::text = (nt.bssid)::text) AND ((nm.media_type)::text = 'image'::text))) AS image_count,
    (SELECT count(*) FROM app.network_media nm WHERE (((nm.bssid)::text = (nt.bssid)::text) AND ((nm.media_type)::text = 'video'::text))) AS video_count,
    (SELECT count(*) FROM app.network_media nm WHERE ((nm.bssid)::text = (nt.bssid)::text)) AS total_media_count
FROM app.network_tags nt;

-- --------------------------------------------------------------------------
-- v_real_access_points view
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW app.v_real_access_points AS
SELECT id, bssid, latest_ssid, ssid_variants, first_seen, last_seen,
    total_observations, is_5ghz, is_6ghz, is_hidden, is_sentinel
FROM app.access_points WHERE (NOT is_sentinel);

-- --------------------------------------------------------------------------
-- Materialized Views
-- --------------------------------------------------------------------------

-- api_network_explorer_mv
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'app' AND matviewname = 'api_network_explorer_mv') THEN
        CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
        SELECT n.bssid, n.ssid, n.type, n.frequency,
            n.bestlevel AS signal, n.bestlat AS lat, n.bestlon AS lon,
            to_timestamp((((n.lasttime_ms)::numeric / 1000.0))::double precision) AS observed_at,
            n.capabilities AS security,
            COALESCE(t.threat_tag, 'untagged'::character varying) AS tag_type,
            count(o.id) AS observations,
            count(DISTINCT date(o."time")) AS unique_days,
            count(DISTINCT ((round((o.lat)::numeric, 3) || ','::text) || round((o.lon)::numeric, 3))) AS unique_locations,
            max(o.accuracy) AS accuracy_meters,
            min(o."time") AS first_seen,
            max(o."time") AS last_seen,
            COALESCE(ts.final_threat_score, (0)::numeric) AS threat_score,
            COALESCE(ts.final_threat_level, 'NONE'::character varying) AS threat_level,
            ts.model_version,
            COALESCE((public.st_distance((public.st_setsrid(public.st_makepoint(n.bestlon, n.bestlat), 4326))::public.geography,
                (SELECT (public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326))::public.geography
                 FROM app.location_markers lm WHERE (lm.marker_type = 'home'::text) LIMIT 1)) / (1000.0)::double precision), (0)::double precision) AS distance_from_home_km,
            (SELECT MAX(public.st_distance(
                public.st_setsrid(public.st_makepoint(o1.lon, o1.lat), 4326)::public.geography,
                public.st_setsrid(public.st_makepoint(o2.lon, o2.lat), 4326)::public.geography
            ))
            FROM app.observations o1, app.observations o2
            WHERE o1.bssid = n.bssid AND o2.bssid = n.bssid
              AND o1.lat IS NOT NULL AND o1.lon IS NOT NULL
              AND o2.lat IS NOT NULL AND o2.lon IS NOT NULL) AS max_distance_meters
        FROM (((app.networks n
            LEFT JOIN app.network_tags t ON ((n.bssid = (t.bssid)::text)))
            LEFT JOIN app.observations o ON ((n.bssid = o.bssid)))
            LEFT JOIN app.network_threat_scores ts ON ((n.bssid = (ts.bssid)::text)))
        WHERE ((n.bestlat IS NOT NULL) AND (n.bestlon IS NOT NULL) 
               AND (n.bestlat != 0 OR n.bestlon != 0))
        GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.bestlevel, n.bestlat, n.bestlon,
                 n.lasttime_ms, n.capabilities, t.threat_tag, ts.final_threat_score, ts.final_threat_level, ts.model_version
        WITH NO DATA;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid ON app.api_network_explorer_mv USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type ON app.api_network_explorer_mv USING btree (type);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observed_at ON app.api_network_explorer_mv USING btree (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat ON app.api_network_explorer_mv USING btree (threat_score DESC);

-- api_network_latest_mv
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'app' AND matviewname = 'api_network_latest_mv') THEN
        CREATE MATERIALIZED VIEW app.api_network_latest_mv AS
        SELECT bssid, ssid, type, bestlevel, bestlat, bestlon, lasttime_ms
        FROM app.networks n
        WHERE ((lasttime_ms)::numeric > (EXTRACT(epoch FROM (now() - '24:00:00'::interval)) * (1000)::numeric))
        WITH NO DATA;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_network_latest_mv_bssid ON app.api_network_latest_mv USING btree (bssid);

-- analytics_summary_mv
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'app' AND matviewname = 'analytics_summary_mv') THEN
        CREATE MATERIALIZED VIEW app.analytics_summary_mv AS
        SELECT type,
            count(*) AS network_count,
            count(DISTINCT ssid) AS unique_ssids,
            avg(bestlevel) AS avg_signal,
            min(lasttime_ms) AS earliest_seen,
            max(lasttime_ms) AS latest_seen
        FROM app.networks n
        GROUP BY type
        WITH NO DATA;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analytics_summary_mv_type ON app.analytics_summary_mv USING btree (type);

-- mv_network_timeline
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'app' AND matviewname = 'mv_network_timeline') THEN
        CREATE MATERIALIZED VIEW app.mv_network_timeline AS
        SELECT n.bssid, n.ssid, n.type,
            date_trunc('hour'::text, o."time") AS hour_bucket,
            count(*) AS observation_count,
            avg(o.level) AS avg_signal,
            min(o.level) AS min_signal,
            max(o.level) AS max_signal
        FROM (app.networks n JOIN app.observations o ON ((n.bssid = o.bssid)))
        GROUP BY n.bssid, n.ssid, n.type, (date_trunc('hour'::text, o."time"))
        WITH NO DATA;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mv_network_timeline_bssid ON app.mv_network_timeline USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_mv_network_timeline_hour ON app.mv_network_timeline USING btree (hour_bucket);
