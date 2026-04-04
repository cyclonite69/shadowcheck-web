BEGIN;

WITH latest_obs AS (
    SELECT DISTINCT ON (o.bssid)
        o.bssid,
        NULLIF(o.ssid, '') AS ssid,
        COALESCE(NULLIF(o.radio_type, ''), 'WIFI') AS type,
        COALESCE(o.radio_frequency, 0) AS frequency,
        COALESCE(NULLIF(o.radio_capabilities, ''), '') AS capabilities,
        COALESCE(NULLIF(o.radio_service, ''), '') AS service,
        COALESCE(NULLIF(o.radio_rcois, ''), '') AS rcois,
        COALESCE(o.radio_lasttime_ms, o.time_ms, o.observed_at_ms, 0) AS lasttime_ms,
        o.lat AS lastlat,
        o.lon AS lastlon,
        o.device_id AS source_device
    FROM app.observations o
    WHERE o.bssid IS NOT NULL
    ORDER BY o.bssid, o.observed_at DESC, o.id DESC
),
best_obs AS (
    SELECT DISTINCT ON (o.bssid)
        o.bssid,
        o.level AS bestlevel,
        o.lat AS bestlat,
        o.lon AS bestlon,
        COALESCE(o.altitude, 0) AS altitude_m,
        COALESCE(o.accuracy, 0) AS accuracy_meters
    FROM app.observations o
    WHERE o.bssid IS NOT NULL
    ORDER BY o.bssid, o.level DESC, o.observed_at DESC, o.id DESC
),
obs_bounds AS (
    SELECT
        o.bssid,
        MIN(COALESCE(o.altitude, 0)) AS min_altitude_m,
        MAX(COALESCE(o.altitude, 0)) AS max_altitude_m,
        MAX(COALESCE(o.altitude, 0)) - MIN(COALESCE(o.altitude, 0)) AS altitude_span_m,
        COUNT(DISTINCT DATE_TRUNC('day', o.observed_at))::integer AS unique_days,
        COUNT(DISTINCT CONCAT_WS(':', o.lat::text, o.lon::text))::integer AS unique_locations,
        MAX(o.observed_at) AS updated_at
    FROM app.observations o
    WHERE o.bssid IS NOT NULL
    GROUP BY o.bssid
)
INSERT INTO app.networks (
    bssid,
    ssid,
    type,
    frequency,
    capabilities,
    service,
    rcois,
    mfgrid,
    lasttime_ms,
    lastlat,
    lastlon,
    bestlevel,
    bestlat,
    bestlon,
    source_device,
    min_altitude_m,
    max_altitude_m,
    altitude_span_m,
    last_altitude_m,
    altitude_m,
    altitude_accuracy_m,
    unique_days,
    unique_locations,
    is_sentinel,
    accuracy_meters
)
SELECT
    lo.bssid,
    COALESCE(lo.ssid, '') AS ssid,
    lo.type,
    lo.frequency,
    lo.capabilities,
    lo.service,
    lo.rcois,
    0 AS mfgrid,
    lo.lasttime_ms,
    lo.lastlat,
    lo.lastlon,
    bo.bestlevel,
    bo.bestlat,
    bo.bestlon,
    lo.source_device,
    ob.min_altitude_m,
    ob.max_altitude_m,
    ob.altitude_span_m,
    bo.altitude_m AS last_altitude_m,
    bo.altitude_m,
    bo.accuracy_meters AS altitude_accuracy_m,
    GREATEST(ob.unique_days, 1),
    GREATEST(ob.unique_locations, 1),
    false AS is_sentinel,
    bo.accuracy_meters
FROM latest_obs lo
JOIN best_obs bo ON bo.bssid = lo.bssid
JOIN obs_bounds ob ON ob.bssid = lo.bssid
WHERE NOT EXISTS (
    SELECT 1
    FROM app.networks n
    WHERE n.bssid = lo.bssid
);

COMMIT;
