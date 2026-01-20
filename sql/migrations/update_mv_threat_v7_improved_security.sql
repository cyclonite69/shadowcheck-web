-- Update materialized view with improved WiFi security parsing
-- This fixes the high number of "Unknown" security types

-- Drop dependent view first
DROP VIEW IF EXISTS public.api_network_explorer;

-- Drop and recreate materialized view with improved security parsing
DROP MATERIALIZED VIEW IF EXISTS public.api_network_explorer_mv;

-- Get the current materialized view definition and update the security parsing
CREATE MATERIALIZED VIEW public.api_network_explorer_mv AS
SELECT DISTINCT ON (obs.bssid) obs.bssid,
    COALESCE(obs.ssid, ap.latest_ssid) AS ssid,
    obs.first_seen,
    obs.last_seen,
    obs.observed_at,
    obs.observations,
    obs.lat,
    obs.lon,
    obs.accuracy AS accuracy_meters,
    obs.level AS signal,
    obs.radio_frequency AS frequency,
    obs.radio_capabilities AS capabilities,
        CASE
            WHEN (obs.radio_frequency >= 5925) THEN true
            ELSE false
        END AS is_6ghz,
        CASE
            WHEN ((obs.radio_frequency >= 5000) AND (obs.radio_frequency < 5925)) THEN true
            ELSE false
        END AS is_5ghz,
        CASE
            WHEN ((COALESCE(obs.ssid, ap.latest_ssid) = ''::text) OR (COALESCE(obs.ssid, ap.latest_ssid) IS NULL)) THEN true
            ELSE false
        END AS is_hidden,
    COALESCE(mm.inferred_type, '?'::text) AS type,
    -- Improved security parsing for modern WiFi standards
    CASE
        -- Open networks (no encryption)
        WHEN COALESCE(obs.radio_capabilities, '') = '' THEN 'OPEN'
        WHEN UPPER(obs.radio_capabilities) ~ '^\s*\[ESS\]\s*$' THEN 'OPEN'
        WHEN UPPER(obs.radio_capabilities) ~ '^\s*\[IBSS\]\s*$' THEN 'OPEN'
        
        -- WPA3 Enhanced Open (OWE)
        WHEN UPPER(obs.radio_capabilities) ~ 'RSN-OWE' THEN 'WPA3-OWE'
        
        -- WPA3 SAE (Personal)
        WHEN UPPER(obs.radio_capabilities) ~ 'RSN-SAE' THEN 'WPA3-SAE'
        
        -- WPA3 Enterprise
        WHEN UPPER(obs.radio_capabilities) ~ '(WPA3|SAE)' AND UPPER(obs.radio_capabilities) ~ '(EAP|MGT|ENT)' THEN 'WPA3-E'
        
        -- WPA3 (general)
        WHEN UPPER(obs.radio_capabilities) ~ '(WPA3|SAE)' THEN 'WPA3'
        
        -- WPA2 Enterprise
        WHEN UPPER(obs.radio_capabilities) ~ '(WPA2|RSN)' AND UPPER(obs.radio_capabilities) ~ '(EAP|MGT|ENT)' THEN 'WPA2-E'
        
        -- WPA2 (general) - includes RSN which is WPA2
        WHEN UPPER(obs.radio_capabilities) ~ '(WPA2|RSN)' THEN 'WPA2'
        
        -- Legacy WPA
        WHEN UPPER(obs.radio_capabilities) ~ 'WPA-' AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA2%' THEN 'WPA'
        WHEN UPPER(obs.radio_capabilities) LIKE '%WPA%' AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA2%' AND UPPER(obs.radio_capabilities) NOT LIKE '%WPA3%' AND UPPER(obs.radio_capabilities) NOT LIKE '%RSN%' THEN 'WPA'
        
        -- WEP
        WHEN UPPER(obs.radio_capabilities) LIKE '%WEP%' THEN 'WEP'
        
        -- Catch remaining encrypted networks by encryption method
        WHEN UPPER(obs.radio_capabilities) ~ '(CCMP|TKIP|AES)' THEN 'WPA2'
        
        -- Non-WiFi devices should not have WiFi security types
        WHEN COALESCE(mm.inferred_type, '?') != 'W' THEN 'N/A'
        
        ELSE 'Unknown'
    END AS security,
        CASE
            WHEN (obs.geom IS NOT NULL) THEN (st_distance((st_setsrid(st_makepoint(home.home_lon, home.home_lat), 4326))::geography, (obs.geom)::geography) / (1000.0)::double precision)
            ELSE NULL::double precision
        END AS distance_from_home_km,
    mm.min_altitude_m,
    mm.max_altitude_m,
    (mm.max_altitude_m - mm.min_altitude_m) AS altitude_span_m,
    mm.max_distance_meters,
    mm.unique_days,
    mm.unique_locations,
    rm.manufacturer,
    obs.geom AS last_geom,
    obs.altitude AS last_altitude_m,
    COALESCE(ap.is_sentinel, false) AS is_sentinel,
        CASE
            WHEN ((tsc.computed_at IS NOT NULL) AND (tsc.computed_at > (now() - '24:00:00'::interval))) THEN jsonb_build_object('score', COALESCE(tsc.threat_score, (0)::numeric), 'level', COALESCE(tsc.threat_level, 'NONE'::text), 'summary', COALESCE(tsc.threat_summary, 'Cached threat score'::text), 'flags', COALESCE(tsc.threat_flags, ARRAY[]::text[]), 'computed_at', tsc.computed_at, 'source', 'cache')
            ELSE
            CASE
                WHEN (COALESCE(mm.inferred_type, '?'::text) = ANY (ARRAY['L'::text, 'G'::text, 'N'::text])) THEN jsonb_build_object('score', 0, 'level', 'NONE', 'summary', 'Cellular excluded', 'flags', ARRAY['CELLULAR'::text], 'source', 'fallback')
                WHEN (COALESCE(mm.max_distance_meters, (0)::double precision) > (2000)::double precision) THEN jsonb_build_object('score', 75, 'level', 'HIGH', 'summary', 'High mobility detected', 'flags', ARRAY['MOBILE_HIGH'::text], 'source', 'fallback')
                WHEN (COALESCE(mm.max_distance_meters, (0)::double precision) > (1000)::double precision) THEN jsonb_build_object('score', 50, 'level', 'MED', 'summary', 'Medium mobility detected', 'flags', ARRAY['MOBILE_MED'::text], 'source', 'fallback')
                WHEN (COALESCE(mm.max_distance_meters, (0)::double precision) > (500)::double precision) THEN jsonb_build_object('score', 25, 'level', 'LOW', 'summary', 'Low mobility detected', 'flags', ARRAY['MOBILE_LOW'::text], 'source', 'fallback')
                ELSE jsonb_build_object('score', 0, 'level', 'NONE', 'summary', 'No threat detected', 'flags', ARRAY[]::text[], 'source', 'fallback')
            END
        END AS threat
   FROM (( SELECT DISTINCT ON (observations.bssid) observations.bssid,
            observations.ssid,
            observations.time AS first_seen,
            observations.time AS last_seen,
            observations.time AS observed_at,
            count(*) OVER (PARTITION BY observations.bssid) AS observations,
            observations.lat,
            observations.lon,
            observations.accuracy,
            observations.level,
            observations.radio_frequency,
            observations.radio_capabilities,
            st_setsrid(st_makepoint(observations.lon, observations.lat), 4326) AS geom,
            observations.altitude,
            row_number() OVER (PARTITION BY observations.bssid ORDER BY observations.time DESC) AS rn
           FROM observations
          WHERE (observations.bssid IS NOT NULL)) obs
     LEFT JOIN ( SELECT access_points.bssid,
            access_points.latest_ssid,
            access_points.is_sentinel
           FROM access_points) ap ON ((obs.bssid = ap.bssid)))
     LEFT JOIN ( SELECT mm_1.bssid,
            mm_1.inferred_type,
            mm_1.min_altitude_m,
            mm_1.max_altitude_m,
            mm_1.max_distance_meters,
            mm_1.unique_days,
            mm_1.unique_locations
           FROM ( SELECT observations.bssid,
                        CASE
                            WHEN (upper(COALESCE(observations.radio_capabilities, ''::text)) ~ '(WPA|WEP|WPS|RSN|ESS|CCMP|TKIP)'::text) THEN 'W'::text
                            WHEN (upper(COALESCE(observations.radio_type, ''::text)) = 'BT'::text) THEN 'B'::text
                            WHEN (upper(COALESCE(observations.radio_type, ''::text)) = 'BLE'::text) THEN 'E'::text
                            WHEN (upper(COALESCE(observations.radio_type, ''::text)) ~ '(LTE|GSM|UMTS|CDMA)'::text) THEN 'L'::text
                            WHEN (upper(COALESCE(observations.radio_type, ''::text)) ~ '(GPS|GNSS)'::text) THEN 'G'::text
                            WHEN (upper(COALESCE(observations.radio_type, ''::text)) ~ '(NFC|RFID)'::text) THEN 'N'::text
                            ELSE '?'::text
                        END AS inferred_type,
                    min(observations.altitude) AS min_altitude_m,
                    max(observations.altitude) AS max_altitude_m,
                    max(st_distance((st_setsrid(st_makepoint((-84.5120)::double precision, (39.1031)::double precision), 4326))::geography, (st_setsrid(st_makepoint(observations.lon, observations.lat), 4326))::geography)) AS max_distance_meters,
                    count(DISTINCT date_trunc('day'::text, observations.time)) AS unique_days,
                    count(DISTINCT st_snaptogrid(st_setsrid(st_makepoint(observations.lon, observations.lat), 4326), (0.0001)::double precision)) AS unique_locations
                   FROM observations
                  WHERE (observations.bssid IS NOT NULL)
                  GROUP BY observations.bssid) mm_1) mm ON ((obs.bssid = mm.bssid)))
     LEFT JOIN ( SELECT DISTINCT ON (resolved_manufacturers.manufacturer_id) resolved_manufacturers.manufacturer_id,
            resolved_manufacturers.manufacturer
           FROM resolved_manufacturers
          ORDER BY resolved_manufacturers.manufacturer_id, resolved_manufacturers.manufacturer) rm ON ((get_manufacturer_id(obs.bssid) = rm.manufacturer_id)))
     LEFT JOIN threat_score_cache tsc ON ((obs.bssid = tsc.bssid)),
    ( SELECT (-84.5120)::double precision AS home_lon,
            (39.1031)::double precision AS home_lat) home
  WHERE (obs.rn = 1)
  ORDER BY obs.bssid, obs.last_seen DESC;

-- Recreate the dependent view
CREATE VIEW public.api_network_explorer AS
SELECT bssid,
    ssid,
    first_seen,
    last_seen,
    observed_at,
    observations,
    lat,
    lon,
    accuracy_meters,
    signal,
    frequency,
    capabilities,
    is_6ghz,
    is_5ghz,
    is_hidden,
    type,
    security,
    distance_from_home_km,
    min_altitude_m,
    max_altitude_m,
    altitude_span_m,
    max_distance_meters,
    unique_days,
    unique_locations,
    manufacturer,
    last_geom,
    last_altitude_m,
    is_sentinel,
    threat
FROM api_network_explorer_mv;

-- Recreate indexes
CREATE UNIQUE INDEX api_network_explorer_mv_bssid_idx ON public.api_network_explorer_mv USING btree (bssid);
CREATE INDEX api_network_explorer_mv_last_seen_idx ON public.api_network_explorer_mv USING btree (last_seen);
CREATE INDEX api_network_explorer_mv_max_distance_idx ON public.api_network_explorer_mv USING btree (max_distance_meters DESC);
CREATE INDEX api_network_explorer_mv_threat_level_idx ON public.api_network_explorer_mv USING btree ((threat ->> 'level'));
CREATE INDEX api_network_explorer_mv_threat_score_idx ON public.api_network_explorer_mv USING btree (((threat ->> 'score')::numeric) DESC);
CREATE INDEX idx_api_network_explorer_mv_security ON public.api_network_explorer_mv USING btree (security);
CREATE INDEX idx_api_network_explorer_mv_type ON public.api_network_explorer_mv USING btree (type);
