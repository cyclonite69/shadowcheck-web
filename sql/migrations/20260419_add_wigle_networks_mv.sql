-- Migration: 20260419_add_wigle_networks_mv.sql
-- Creates app.api_wigle_networks_mv — a WiGLE-native canonical record for the
-- WiGLE page tooltip pipeline. Keeps local explorer data out of the core public
-- record. Local linkage is limited to a boolean existence flag.
--
-- Temporal/spatial truth comes exclusively from WiGLE sources:
--   - first_seen / last_seen: MIN/MAX of wigle_v3_observations.observed_at
--   - centroid / spread: aggregated from wigle_v3_observations
--   - display coordinate: v2 trilat → v3 centroid → v3 summary (explicit precedence)
--
-- Public-pattern signals (non-stationary, SSID variants) are observable patterns
-- from WiGLE data, not identity claims. They are labelled separately from any
-- LAN-core threat scoring.

SET search_path TO app, public;

DROP MATERIALIZED VIEW IF EXISTS app.api_wigle_networks_mv;

CREATE MATERIALIZED VIEW app.api_wigle_networks_mv AS

WITH v3_obs_agg AS (
  SELECT
    obs.netid,
    COUNT(*)::int                                                        AS wigle_v3_observation_count,
    MIN(obs.observed_at)                                                 AS wigle_v3_first_seen,
    MAX(obs.observed_at)                                                 AS wigle_v3_last_seen,
    AVG(obs.latitude)::double precision                                  AS wigle_v3_centroid_lat,
    AVG(obs.longitude)::double precision                                 AS wigle_v3_centroid_lon,
    MIN(obs.latitude)                                                    AS wigle_v3_min_lat,
    MAX(obs.latitude)                                                    AS wigle_v3_max_lat,
    MIN(obs.longitude)                                                   AS wigle_v3_min_lon,
    MAX(obs.longitude)                                                   AS wigle_v3_max_lon,
    -- Bounding-box diagonal as spread proxy; requires >1 observation to be meaningful
    CASE
      WHEN COUNT(*) > 1 THEN
        ROUND(
          ST_Distance(
            ST_MakePoint(MIN(obs.longitude), MIN(obs.latitude))::geography,
            ST_MakePoint(MAX(obs.longitude), MAX(obs.latitude))::geography
          )::numeric,
          1
        )
      ELSE 0
    END::double precision                                                AS wigle_v3_spread_m,
    COUNT(DISTINCT NULLIF(TRIM(obs.ssid), ''))::int                      AS wigle_v3_ssid_variant_count
  FROM app.wigle_v3_observations obs
  GROUP BY obs.netid
)

SELECT
  -- ─── Identity ──────────────────────────────────────────────────────────────
  UPPER(COALESCE(d.netid, v2.bssid))                                    AS bssid,

  -- ─── Descriptive (v2 preferred for normalised display values) ──────────────
  COALESCE(v2.ssid, d.ssid, d.name)                                     AS ssid_display,
  COALESCE(v2.name, d.name)                                             AS network_name,
  COALESCE(v2.type, d.type)                                             AS network_type,
  COALESCE(v2.encryption, d.encryption)                                 AS encryption,
  COALESCE(v2.channel, d.channel)                                       AS channel,
  v2.frequency                                                           AS frequency,
  COALESCE(v2.qos, d.qos)                                               AS qos,
  d.comment                                                              AS comment,
  CASE WHEN d.netid IS NOT NULL THEN 'wigle-v3' ELSE 'wigle-v2' END    AS wigle_source,

  -- ─── v2 provenance fields (kept under prefixed names) ──────────────────────
  v2.firsttime                                                           AS wigle_v2_firsttime,
  v2.lasttime                                                            AS wigle_v2_lasttime,
  v2.trilat                                                              AS wigle_v2_trilat_lat,
  v2.trilong                                                             AS wigle_v2_trilat_lon,
  v2.city                                                                AS wigle_v2_city,
  v2.region                                                              AS wigle_v2_region,
  v2.road                                                                AS wigle_v2_road,
  v2.housenumber                                                         AS wigle_v2_housenumber,
  (v2.bssid IS NOT NULL)                                                AS has_wigle_v2_record,

  -- ─── v3-derived temporal (from observation aggregation, NOT summary row) ───
  agg.wigle_v3_first_seen,
  agg.wigle_v3_last_seen,
  agg.wigle_v3_observation_count,
  agg.wigle_v3_ssid_variant_count,
  (agg.wigle_v3_observation_count IS NOT NULL)                          AS has_wigle_v3_observations,

  -- ─── v3-derived spatial ────────────────────────────────────────────────────
  agg.wigle_v3_centroid_lat,
  agg.wigle_v3_centroid_lon,
  agg.wigle_v3_min_lat,
  agg.wigle_v3_max_lat,
  agg.wigle_v3_min_lon,
  agg.wigle_v3_max_lon,
  agg.wigle_v3_spread_m,

  -- ─── Chosen display coordinate with explicit source label ──────────────────
  -- Precedence: v2 trilaterated → v3 centroid (obs-derived) → v3 summary point
  CASE
    WHEN v2.trilat IS NOT NULL AND v2.trilong IS NOT NULL THEN v2.trilat::double precision
    WHEN agg.wigle_v3_centroid_lat IS NOT NULL              THEN agg.wigle_v3_centroid_lat
    ELSE d.trilat
  END                                                                    AS display_lat,
  CASE
    WHEN v2.trilat IS NOT NULL AND v2.trilong IS NOT NULL THEN v2.trilong::double precision
    WHEN agg.wigle_v3_centroid_lon IS NOT NULL              THEN agg.wigle_v3_centroid_lon
    ELSE d.trilon
  END                                                                    AS display_lon,
  CASE
    WHEN v2.trilat IS NOT NULL AND v2.trilong IS NOT NULL THEN 'wigle-v2-trilat'
    WHEN agg.wigle_v3_centroid_lat IS NOT NULL              THEN 'wigle-v3-centroid'
    WHEN d.trilat IS NOT NULL                               THEN 'wigle-v3-summary'
    ELSE NULL
  END                                                                    AS display_coordinate_source,

  -- ─── Manufacturer (OUI join; no local data) ────────────────────────────────
  rm.manufacturer                                                        AS manufacturer,

  -- ─── Public-pattern signals (observable patterns, not identity claims) ─────
  -- Non-stationary: bounding-box diagonal > 500 m suggests the device has moved
  (COALESCE(agg.wigle_v3_spread_m, 0) > 500)                           AS public_nonstationary_flag,
  -- SSID variants: multiple distinct SSIDs across v3 observations
  (COALESCE(agg.wigle_v3_ssid_variant_count, 0) > 1)                   AS public_ssid_variant_flag,

  -- ─── Precision / provenance caveats ────────────────────────────────────────
  -- Flag records with v3 observations but fewer than 3 (low spatial confidence)
  (agg.wigle_v3_observation_count IS NOT NULL
    AND agg.wigle_v3_observation_count < 3)                             AS wigle_precision_warning,

  -- ─── Local linkage only — no local temporal/spatial values ─────────────────
  -- Existence flag derived from app.observations bssid match
  EXISTS (
    SELECT 1
    FROM app.observations lo
    WHERE UPPER(lo.bssid) = UPPER(COALESCE(d.netid, v2.bssid))
    LIMIT 1
  )                                                                      AS has_local_match

FROM app.wigle_v3_network_details d
FULL OUTER JOIN app.wigle_v2_networks_search v2
  ON UPPER(d.netid) = UPPER(v2.bssid)
LEFT JOIN v3_obs_agg agg
  ON agg.netid = d.netid
LEFT JOIN app.radio_manufacturers rm
  ON rm.bit_length = 24
  AND rm.prefix = UPPER(LEFT(REPLACE(COALESCE(d.netid, v2.bssid), ':', ''), 6))

WITH DATA;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX idx_wigle_networks_mv_bssid
  ON app.api_wigle_networks_mv (bssid);

-- Spatial index on display coordinate for map queries
CREATE INDEX idx_wigle_networks_mv_display_coords
  ON app.api_wigle_networks_mv (display_lat, display_lon)
  WHERE display_lat IS NOT NULL AND display_lon IS NOT NULL;

-- Pattern signal indexes for filtered queries
CREATE INDEX idx_wigle_networks_mv_nonstationary
  ON app.api_wigle_networks_mv (public_nonstationary_flag)
  WHERE public_nonstationary_flag = TRUE;

CREATE INDEX idx_wigle_networks_mv_has_v3
  ON app.api_wigle_networks_mv (has_wigle_v3_observations, wigle_v3_observation_count);

CREATE INDEX idx_wigle_networks_mv_has_local_match
  ON app.api_wigle_networks_mv (has_local_match)
  WHERE has_local_match = TRUE;

-- ─── Grants ──────────────────────────────────────────────────────────────────

GRANT SELECT ON app.api_wigle_networks_mv TO shadowcheck_user;
GRANT SELECT ON app.api_wigle_networks_mv TO shadowcheck_admin;

-- ─── Refresh function ────────────────────────────────────────────────────────
-- Called after enrichment runs or bulk WiGLE imports.
-- CONCURRENTLY requires the unique index and avoids locking reads during refresh.

CREATE OR REPLACE FUNCTION app.refresh_wigle_networks_mv()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_wigle_networks_mv;
END;
$$;

GRANT EXECUTE ON FUNCTION app.refresh_wigle_networks_mv() TO shadowcheck_admin;
