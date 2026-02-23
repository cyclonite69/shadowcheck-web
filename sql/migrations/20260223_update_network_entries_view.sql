-- Update network_entries view to include capabilities and WiGLE v3 denormalized fields

CREATE OR REPLACE VIEW app.network_entries AS
SELECT n.bssid,
    n.ssid,
    n.type,
    n.frequency,
    n.capabilities AS capabilities,
    n.capabilities AS security,
    n.wigle_v3_observation_count,
    n.wigle_v3_last_import_at,
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
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.capabilities,
    n.wigle_v3_observation_count, n.wigle_v3_last_import_at,
    n.service, n.rcois, n.mfgrid,
    n.lasttime_ms, n.lastlat, n.lastlon, n.bestlevel, n.bestlat, n.bestlon;
