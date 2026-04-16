-- Migration 012: Add centroid/weighted coordinate fields to api_network_explorer_mv
-- Purpose: Expose precomputed network-level centroids alongside the existing best-observation
--          lat/lon so the geospatial and network-list API paths can return them without
--          a separate JOIN at query time (optional optimisation — the query-time JOIN to
--          app.network_locations is the primary mechanism; this bakes the values into the MV
--          for the explorer fast-path).
--
-- Idempotent: uses DROP + CREATE (MV is already refreshed on every deploy via scs_rebuild.sh).
-- Depends on: migration 011 (network_locations table + refresh function).

BEGIN;

-- 1. Recreate the MV with centroid columns from network_locations
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
  ) ASC
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
  -- New: centroid coordinates from network_locations
  nloc.centroid_lat,
  nloc.centroid_lon,
  nloc.weighted_lat,
  nloc.weighted_lon,
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
    public.st_setsrid(public.st_makepoint(
      COALESCE(nloc.weighted_lon, nloc.centroid_lon, bo.lon),
      COALESCE(nloc.weighted_lat, nloc.centroid_lat, bo.lat)
    ), 4326)::public.geography,
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
  LEFT JOIN app.network_locations nloc ON UPPER(nloc.bssid) = UPPER(n.bssid)
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
  rm.manufacturer, bo.lat, bo.lon, osp.stationary_confidence,
  nloc.centroid_lat, nloc.centroid_lon, nloc.weighted_lat, nloc.weighted_lon;

-- 2. Recreate all indexes
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

-- 3. Grants
GRANT SELECT ON app.api_network_explorer_mv TO shadowcheck_user;
GRANT SELECT ON app.api_network_explorer_mv TO grafana_reader;
GRANT SELECT ON app.api_network_explorer_mv TO PUBLIC;

-- 4. Initial refresh
REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;

COMMIT;
