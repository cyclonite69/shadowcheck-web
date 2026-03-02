-- Migration: Add stationary_confidence to api_network_explorer_mv
-- Date: 2026-03-02
-- Purpose: Pre-compute stationary confidence in MV to eliminate expensive runtime CTE calculations

DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv;

CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
WITH obs_spatial AS (
  SELECT
    o.bssid,
    CASE
      WHEN COUNT(*) < 2 THEN NULL
      ELSE ROUND(
        LEAST(1, GREATEST(0,
          (
            (1 - LEAST(MAX(ST_Distance(
              ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
              ST_Centroid(ST_Collect(ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)))::geography
            )) / 500.0, 1)) * 0.5 +
            (1 - LEAST(EXTRACT(EPOCH FROM (MAX(o.time) - MIN(o.time))) / 3600 / 168, 1)) * 0.3 +
            LEAST(COUNT(*) / 50.0, 1) * 0.2
          )
        ))::numeric,
        3
      )
    END AS stationary_confidence
  FROM app.observations o
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
  GROUP BY o.bssid
)
SELECT n.bssid,
  n.ssid,
  n.type,
  n.frequency,
  n.bestlevel AS signal,
  (SELECT o.lat
   FROM app.observations o
   WHERE o.bssid = n.bssid
     AND o.lat IS NOT NULL
     AND o.lon IS NOT NULL
     AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
   ORDER BY public.st_distance(
     public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::public.geography,
     (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
      FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
   ) DESC LIMIT 1) AS lat,
  (SELECT o.lon
   FROM app.observations o
   WHERE o.bssid = n.bssid
     AND o.lat IS NOT NULL
     AND o.lon IS NOT NULL
     AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
   ORDER BY public.st_distance(
     public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::public.geography,
     (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
      FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
   ) DESC LIMIT 1) AS lon,
  to_timestamp((((n.lasttime_ms)::numeric / 1000.0))::double precision) AS observed_at,
  n.capabilities AS capabilities,
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
  count(o.id) AS observations,
  count(DISTINCT date(o."time")) AS unique_days,
  count(DISTINCT ((round((o.lat)::numeric, 3) || ','::text) || round((o.lon)::numeric, 3))) AS unique_locations,
  max(o.accuracy) AS accuracy_meters,
  min(o."time") AS first_seen,
  max(o."time") AS last_seen,
  COALESCE(ts.final_threat_score, (0)::numeric) AS threat_score,
  COALESCE(ts.final_threat_level, 'NONE'::character varying) AS threat_level,
  ts.model_version,
  COALESCE((public.st_distance(
    (SELECT public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::public.geography
     FROM app.observations o
     WHERE o.bssid = n.bssid
       AND o.lat IS NOT NULL
       AND o.lon IS NOT NULL
       AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
     ORDER BY public.st_distance(
       public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::public.geography,
       (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
        FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
     ) DESC LIMIT 1),
    (SELECT public.st_setsrid(public.st_makepoint(lm.longitude, lm.latitude), 4326)::public.geography
     FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
  ) / (1000.0)::double precision), (0)::double precision) AS distance_from_home_km,
  (SELECT MAX(public.st_distance(
    public.st_setsrid(public.st_makepoint(o1.lon, o1.lat), 4326)::public.geography,
    public.st_setsrid(public.st_makepoint(o2.lon, o2.lat), 4326)::public.geography
  ))
   FROM app.observations o1, app.observations o2
   WHERE o1.bssid = n.bssid
     AND o2.bssid = n.bssid
     AND o1.lat IS NOT NULL
     AND o1.lon IS NOT NULL
     AND o2.lat IS NOT NULL
     AND o2.lon IS NOT NULL
     AND (o1.is_quality_filtered = false OR o1.is_quality_filtered IS NULL)
     AND (o2.is_quality_filtered = false OR o2.is_quality_filtered IS NULL)
  ) AS max_distance_meters,
  rm.manufacturer AS manufacturer,
  s.stationary_confidence
FROM app.networks n
  LEFT JOIN app.network_tags t ON (n.bssid = t.bssid::text)
  LEFT JOIN app.observations o ON (n.bssid = o.bssid)
  LEFT JOIN app.network_threat_scores ts ON (n.bssid = ts.bssid::text)
  LEFT JOIN (
    SELECT
      netid,
      COUNT(*)::integer AS wigle_v3_observation_count,
      MAX(COALESCE(last_update, observed_at, imported_at)) AS wigle_v3_last_import_at
    FROM app.wigle_v3_observations
    GROUP BY netid
  ) w3 ON (UPPER(n.bssid) = UPPER(w3.netid))
  LEFT JOIN app.radio_manufacturers rm ON (UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', '')) = rm.prefix)
  LEFT JOIN obs_spatial s ON (n.bssid = s.bssid)
WHERE (o.lat IS NOT NULL AND o.lon IS NOT NULL)
  AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.bestlevel,
  n.lasttime_ms, n.capabilities, n.wigle_v3_observation_count, n.wigle_v3_last_import_at,
  w3.wigle_v3_observation_count, w3.wigle_v3_last_import_at,
  t.threat_tag, ts.final_threat_score, ts.final_threat_level, ts.model_version, rm.manufacturer, s.stationary_confidence
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid ON app.api_network_explorer_mv USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type ON app.api_network_explorer_mv USING btree (type);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observed_at ON app.api_network_explorer_mv USING btree (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat ON app.api_network_explorer_mv USING btree (threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_stationary ON app.api_network_explorer_mv USING btree (stationary_confidence) WHERE stationary_confidence IS NOT NULL;

COMMENT ON MATERIALIZED VIEW app.api_network_explorer_mv IS
  'Network explorer view - excludes quality-filtered observations for accurate distance/threat calculations. Includes pre-computed stationary confidence.';

REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;
