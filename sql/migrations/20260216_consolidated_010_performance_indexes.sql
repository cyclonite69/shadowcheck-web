-- ============================================================================
-- Consolidated Migration 010: Performance Indexes
-- ============================================================================
-- BRIN indexes, covering indexes, partial indexes, GIST tuning,
-- statistics targets, and analytics performance indexes.
-- Source: pg_dump --schema-only of live database (2026-02-16)
--
-- Note: Uses CREATE INDEX IF NOT EXISTS (not CONCURRENTLY) so this can
-- run inside the migration runner's transaction wrapper. On a fresh empty
-- DB, CONCURRENTLY provides no benefit anyway.
-- ============================================================================

-- --------------------------------------------------------------------------
-- BRIN indexes for time-series data
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_observations_observed_at_ms_brin ON app.observations USING brin (observed_at_ms);
CREATE INDEX IF NOT EXISTS idx_observations_time_brin ON app.observations_legacy USING brin (observed_at) WITH (pages_per_range='64');

-- --------------------------------------------------------------------------
-- Covering indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_networks_bssid_covering ON app.networks USING btree (bssid) INCLUDE (ssid, type, bestlevel, lasttime_ms);

-- --------------------------------------------------------------------------
-- Partial indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_observations_high_accuracy_recent ON app.observations USING btree (bssid, "time" DESC)
    WHERE ((accuracy < (100)::double precision) AND ("time" > '2025-11-15 00:00:00+00'::timestamp with time zone));

CREATE INDEX IF NOT EXISTS idx_observations_recent_covering ON app.observations USING btree ("time" DESC, bssid) INCLUDE (lat, lon, level, accuracy)
    WHERE ("time" > '2026-01-15 00:00:00+00'::timestamp with time zone);

CREATE INDEX IF NOT EXISTS idx_observations_bssid_geom_not_null ON app.observations USING btree (bssid)
    WHERE (geom IS NOT NULL);

-- --------------------------------------------------------------------------
-- GIST index tuning
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_obs_geom_gist ON app.observations USING gist (geom) WITH (buffering=auto, fillfactor='90');
CREATE INDEX IF NOT EXISTS idx_observations_geom_gist ON app.observations USING gist (geom) WITH (buffering=auto, fillfactor='90')
    WHERE (geom IS NOT NULL);

-- --------------------------------------------------------------------------
-- Observation directional indexes
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_observations_bssid_time_desc ON app.observations USING btree (bssid, "time" DESC);
CREATE INDEX IF NOT EXISTS obs_bssid_time_asc_idx ON app.observations USING btree (bssid, "time") WHERE (geom IS NOT NULL);
CREATE INDEX IF NOT EXISTS obs_bssid_time_desc_idx ON app.observations USING btree (bssid, "time" DESC) WHERE (geom IS NOT NULL);
CREATE INDEX IF NOT EXISTS obs_geom_gix ON app.observations USING gist (geom) WHERE (geom IS NOT NULL);

-- --------------------------------------------------------------------------
-- Post-consolidation updates (2026-02-27)
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_manufacturer
  ON app.api_network_explorer_mv USING btree (manufacturer);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_geom
  ON app.api_network_explorer_mv USING GIST (ST_SetSRID(ST_MakePoint(lon, lat), 4326));

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_frequency
  ON app.api_network_explorer_mv (frequency);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_signal
  ON app.api_network_explorer_mv (signal);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_first_seen
  ON app.api_network_explorer_mv (first_seen DESC);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_last_seen
  ON app.api_network_explorer_mv (last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observations
  ON app.api_network_explorer_mv (observations);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type_freq
  ON app.api_network_explorer_mv (type, frequency);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat_type
  ON app.api_network_explorer_mv (threat_score DESC, type);

CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_security
  ON app.api_network_explorer_mv (security);


-- ============================================================================
-- Folded from: 20260302_add_manufacturer_gin_index.sql
-- ============================================================================

-- Migration: Add GIN index for manufacturer ILIKE searches
-- Date: 2026-03-02
-- Purpose: Speed up manufacturer filter queries from 8s to <100ms

-- Enable pg_trgm extension for trigram-based pattern matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN index to manufacturer column in MV for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_manufacturer_gin 
ON app.api_network_explorer_mv 
USING gin (manufacturer gin_trgm_ops);

-- Also add to radio_manufacturers table for completeness
CREATE INDEX IF NOT EXISTS idx_radio_manufacturers_manufacturer_gin 
ON app.radio_manufacturers 
USING gin (manufacturer gin_trgm_ops);

COMMENT ON INDEX app.idx_api_network_explorer_mv_manufacturer_gin IS 
  'GIN index for fast ILIKE pattern matching on manufacturer names';


-- ============================================================================
-- Folded from: 20260302_add_stationary_confidence_to_mv.sql
-- ============================================================================

-- Migration: Add stationary_confidence to api_network_explorer_mv
-- Date: 2026-03-02
-- Purpose: Pre-compute stationary confidence in MV to eliminate expensive runtime CTE calculations

DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv;

CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
WITH obs_centroids AS (
  SELECT
    bssid,
    ST_Centroid(ST_Collect(ST_SetSRID(ST_MakePoint(lon, lat), 4326)))::geography AS centroid,
    MIN(time) AS first_time,
    MAX(time) AS last_time,
    COUNT(*) AS obs_count
  FROM app.observations
  WHERE lat IS NOT NULL
    AND lon IS NOT NULL
    AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
  GROUP BY bssid
),
obs_spatial AS (
  SELECT
    c.bssid,
    CASE
      WHEN c.obs_count < 2 THEN NULL
      ELSE ROUND(
        LEAST(1, GREATEST(0,
          (
            (1 - LEAST(MAX(ST_Distance(
              ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
              c.centroid
            )) / 500.0, 1)) * 0.5 +
            (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
            LEAST(c.obs_count / 50.0, 1) * 0.2
          )
        ))::numeric,
        3
      )
    END AS stationary_confidence
  FROM app.observations o
  JOIN obs_centroids c ON c.bssid = o.bssid
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
  GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
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


-- ============================================================================
-- Folded from: 20260302_deploy_threat_score_v4.sql
-- ============================================================================

-- Migration: Deploy Threat Score v4.0
-- Date: 2026-03-02
-- Purpose: Replace v2/v3 with v4 scoring engine featuring individual behavior detection and fleet correlation
--
-- Changes:
-- - Removed v2 and v3 scoring functions (legacy)
-- - Added v4 with following pattern detection (35%)
-- - Added parked surveillance detection (20%)
-- - Added location correlation scoring (15%)
-- - Added equipment profile scoring (10%)
-- - Added temporal persistence scoring (5%)
-- - Added fleet correlation bonus (15%)
--
-- Total: 85% individual behavior + 15% fleet bonus = 100 max score
--
-- Note: Scores are computed on-demand by the API. No recomputation needed.

-- Drop legacy functions
DROP FUNCTION IF EXISTS calculate_threat_score_v2(TEXT);
DROP FUNCTION IF EXISTS calculate_threat_score_v3(TEXT);
-- Threat Scoring v4.0 - Individual Behavior + Fleet Correlation
--
-- Purpose: Detect surveillance through behavioral patterns and fleet coordination
--
-- Key improvements over v3:
-- 1. Following Pattern Detection (35%) - Multiple distinct away locations
-- 2. Parked Surveillance Detection (20%) - Multiple detections at same spot
-- 3. Location Correlation (15%) - Home staging and routine location patterns
-- 4. Equipment Profile (10%) - Industrial gear and operational SSIDs
-- 5. Temporal Persistence (5%) - Long-term monitoring
-- 6. Fleet Correlation Bonus (15%) - Coordinated multi-vehicle operations
--
-- Composite Score Formula:
--   threat_score =
--     (following_pattern × 0.35) +
--     (parked_surveillance × 0.20) +
--     (location_correlation × 0.15) +
--     (equipment_profile × 0.10) +
--     (temporal_persistence × 0.05) +
--     (fleet_correlation_bonus × 0.15)
--
-- Maximum score: 100 (85 individual + 15 fleet bonus)

CREATE OR REPLACE FUNCTION calculate_threat_score_v4(p_bssid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = app, public, topology, tiger
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Base CTEs for data gathering
    WITH observations AS (
        SELECT
            o.id,
            o.bssid,
            o.lat,
            o.lon,
            o.time,
            o.level AS signal
        FROM app.observations o
        WHERE o.bssid = p_bssid
            AND o.lat IS NOT NULL
            AND o.lon IS NOT NULL
            AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
    ),
    home_location AS (
        SELECT
            latitude AS lat,
            longitude AS lon
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
    ),
    network_metadata AS (
        SELECT
            n.bssid,
            n.ssid,
            n.type
        FROM app.networks n
        WHERE n.bssid = p_bssid
    ),
    
    -- Task 2: Following Pattern Score (35%)
    location_classification AS (
        SELECT
            o.id,
            o.lat,
            o.lon,
            o.time,
            CASE
                WHEN h.lat IS NULL THEN NULL
                ELSE ST_Distance(
                    ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(h.lon, h.lat), 4326)::geography
                )
            END AS distance_from_home_m
        FROM observations o
        CROSS JOIN home_location h
    ),
    away_clusters AS (
        SELECT
            ST_ClusterDBSCAN(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                eps := 1000,  -- 1km radius
                minpoints := 1
            ) OVER () AS cluster_id,
            lat,
            lon
        FROM location_classification
        WHERE distance_from_home_m > 2000  -- Away = >2km from home
    ),
    away_cluster_count AS (
        SELECT COUNT(DISTINCT cluster_id) AS count
        FROM away_clusters
        WHERE cluster_id IS NOT NULL
    ),
    wigle_spread AS (
        SELECT
            COALESCE(MAX(
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(h.lon, h.lat), 4326)::geography
                ) / 1000.0
            ), 0) AS max_distance_km
        FROM app.wigle_v3_observations w
        CROSS JOIN home_location h
        WHERE UPPER(w.netid) = UPPER(p_bssid)
    ),
    following_score AS (
        SELECT
            LEAST(35, 
                (COALESCE(acc.count, 0) * 7) + 
                (ws.max_distance_km / 10.0)
            )::numeric AS score
        FROM away_cluster_count acc
        CROSS JOIN wigle_spread ws
    ),
    
    -- Task 3: Parked Surveillance Score (20%)
    observation_pairs AS (
        SELECT
            o1.id AS id1,
            o2.id AS id2,
            o1.lat AS lat1,
            o1.lon AS lon1,
            o2.lat AS lat2,
            o2.lon AS lon2,
            o1.time AS time1,
            o2.time AS time2,
            ST_Distance(
                ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
            ) AS distance_m,
            EXTRACT(EPOCH FROM (o2.time - o1.time)) / 60.0 AS time_diff_min
        FROM location_classification o1
        JOIN location_classification o2 ON o2.id > o1.id
        WHERE EXTRACT(EPOCH FROM (o2.time - o1.time)) BETWEEN 0 AND 600  -- Within 10 minutes
    ),
    parking_events AS (
        SELECT
            lat1,
            lon1,
            time1,
            COUNT(*) AS detections_in_window,
            AVG(distance_from_home_m) AS avg_distance_from_home
        FROM observation_pairs op
        JOIN location_classification lc ON lc.id = op.id1
        WHERE op.distance_m < 100  -- Within 100m
        GROUP BY lat1, lon1, time1
        HAVING COUNT(*) >= 2  -- 3+ total detections (original + 2 pairs)
    ),
    parking_score AS (
        SELECT
            LEAST(20,
                COUNT(*) * 4 * AVG(1.0 / (1.0 + COALESCE(avg_distance_from_home / 1000.0, 10)))
            )::numeric AS score
        FROM parking_events
    ),
    
    -- Task 4: Location Correlation Score (15%)
    home_staging AS (
        SELECT
            COUNT(CASE WHEN distance_from_home_m < 500 THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) AS home_staging_pct
        FROM location_classification
    ),
    location_clusters AS (
        SELECT COUNT(DISTINCT cluster_id) AS cluster_count
        FROM (
            SELECT ST_ClusterDBSCAN(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                eps := 500,  -- 500m radius for general clusters
                minpoints := 1
            ) OVER () AS cluster_id
            FROM location_classification
        ) clusters
        WHERE cluster_id IS NOT NULL
    ),
    correlation_score AS (
        SELECT
            LEAST(15,
                (COALESCE(hs.home_staging_pct, 0) * 0.7 + 
                 LEAST(1.0, COALESCE(lc.cluster_count, 0) / 5.0) * 0.3) * 15
            )::numeric AS score
        FROM home_staging hs
        CROSS JOIN location_clusters lc
    ),
    
    -- Task 5: Equipment Profile Score (10%)
    manufacturer_lookup AS (
        SELECT
            rm.manufacturer AS manufacturer
        FROM network_metadata nm
        LEFT JOIN app.radio_manufacturers rm 
            ON rm.prefix = UPPER(REPLACE(SUBSTRING(nm.bssid, 1, 8), ':', ''))
    ),
    equipment_score AS (
        SELECT
            (
                -- Manufacturer scoring (5 points)
                CASE
                    WHEN ml.manufacturer ILIKE '%AirLink%' 
                      OR ml.manufacturer ILIKE '%Cradlepoint%'
                      OR ml.manufacturer ILIKE '%Sierra Wireless%'
                      OR ml.manufacturer ILIKE '%Mitsumi%'
                      OR ml.manufacturer ILIKE '%Alps Alpine%'
                      OR ml.manufacturer ILIKE '%AlpsAlpine%'
                      OR ml.manufacturer ILIKE '%Magneti Marelli Sistemas%' THEN 5
                    ELSE 0
                END +
                -- SSID pattern scoring (3 points max)
                CASE
                    WHEN nm.ssid ~ '^PAS-\d+$' THEN 3
                    WHEN nm.ssid = 'mdt' THEN 3
                    WHEN nm.ssid ~ '^\d+$' THEN 2
                    WHEN nm.ssid ~* '(myChevrolet|myBuick|myGMC|MBUX|CADILLAC)' THEN 2
                    ELSE 0
                END
            )::numeric AS score
        FROM network_metadata nm
        CROSS JOIN manufacturer_lookup ml
    ),
    
    -- Task 6: Temporal Persistence Score (5%)
    temporal_score AS (
        SELECT
            LEAST(5, 
                (COUNT(DISTINCT DATE(time))::numeric / 100.0) * 5
            )::numeric AS score
        FROM observations
    ),
    
    -- Task 7: Fleet Correlation Bonus (15%)
    -- First calculate individual score for this network
    individual_total AS (
        SELECT
            (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + 
             COALESCE(es.score, 0) + COALESCE(ts.score, 0))::numeric AS score
        FROM following_score fs
        CROSS JOIN parking_score ps
        CROSS JOIN correlation_score cs
        CROSS JOIN equipment_score es
        CROSS JOIN temporal_score ts
    ),
    -- Count networks with same manufacturer scoring >50
    fleet_manufacturer_count AS (
        SELECT COUNT(DISTINCT n.bssid) AS count
        FROM app.networks n
        JOIN app.radio_manufacturers rm1 ON rm1.prefix = UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
        CROSS JOIN manufacturer_lookup ml
        WHERE rm1.manufacturer = ml.manufacturer
          AND n.bssid != p_bssid
          AND EXISTS (
              SELECT 1 FROM app.network_threat_scores nts
              WHERE nts.bssid = n.bssid
                AND COALESCE(nts.final_threat_score, 0) > 50
          )
    ),
    -- Find networks matching same SSID patterns
    fleet_ssid_patterns AS (
        SELECT COUNT(DISTINCT n.bssid) AS count
        FROM app.networks n
        CROSS JOIN network_metadata nm
        WHERE n.bssid != p_bssid
          AND (
              (nm.ssid ~ '^PAS-\d+$' AND n.ssid ~ '^PAS-\d+$') OR
              (nm.ssid = 'mdt' AND n.ssid = 'mdt') OR
              (nm.ssid ~ '^\d+$' AND n.ssid ~ '^\d+$')
          )
    ),
    -- Find networks within 10km with scores >50
    fleet_geographic_overlap AS (
        SELECT COUNT(DISTINCT n.bssid) AS count
        FROM app.networks n
        JOIN app.api_network_explorer_mv mv ON mv.bssid = n.bssid
        CROSS JOIN observations o
        WHERE n.bssid != p_bssid
          AND COALESCE(mv.threat_score, 0) > 50
          AND EXISTS (
              SELECT 1
              FROM app.observations o2
              WHERE o2.bssid = n.bssid
                AND o2.lat IS NOT NULL
                AND o2.lon IS NOT NULL
                AND ST_Distance(
                    ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
                    ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
                ) < 10000
          )
    ),
    fleet_score AS (
        SELECT
            (
                -- Manufacturer bonus
                CASE
                    WHEN fmc.count >= 20 THEN 10
                    WHEN fmc.count >= 10 THEN 8
                    WHEN fmc.count >= 5 THEN 5
                    ELSE 0
                END +
                -- SSID pattern bonus
                CASE WHEN fsp.count >= 3 THEN 3 ELSE 0 END +
                -- Geographic overlap bonus
                CASE WHEN fgo.count >= 2 THEN 2 ELSE 0 END
            )::numeric AS score
        FROM fleet_manufacturer_count fmc
        CROSS JOIN fleet_ssid_patterns fsp
        CROSS JOIN fleet_geographic_overlap fgo
    )
    
    -- Return complete structure with all scores and threat level
    SELECT jsonb_build_object(
        'bssid', p_bssid,
        'total_score', COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0),
        'threat_level', 
            CASE
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 81 THEN 'CRITICAL'
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 61 THEN 'HIGH'
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 41 THEN 'MEDIUM'
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 21 THEN 'LOW'
                ELSE 'NONE'
            END,
        'model_version', '4.0',
        'components', jsonb_build_object(
            'following_pattern', COALESCE(fs.score, 0),
            'parked_surveillance', COALESCE(ps.score, 0),
            'location_correlation', COALESCE(cs.score, 0),
            'equipment_profile', COALESCE(es.score, 0),
            'temporal_persistence', COALESCE(ts.score, 0),
            'fleet_correlation_bonus', COALESCE(fls.score, 0)
        )
    ) INTO v_result
    FROM following_score fs
    CROSS JOIN parking_score ps
    CROSS JOIN correlation_score cs
    CROSS JOIN equipment_score es
    CROSS JOIN temporal_score ts
    CROSS JOIN fleet_score fls;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION calculate_threat_score_v4(TEXT) IS 
'Threat Scoring v4.0 - Detects surveillance through individual behavior patterns and fleet correlation';

-- Verify deployment
SELECT 'v4 function deployed successfully - scores will be computed on-demand' AS status;


-- ============================================================================
-- Folded from: 20260303_cooccurrence_detection.sql
-- ============================================================================

-- Threat Model v4.1: Co-occurrence Detection
-- Purpose: Detect networks that appear together at multiple locations (coordinated surveillance)

-- Step 1: Create co-occurrence tracking table
CREATE TABLE IF NOT EXISTS app.network_cooccurrence (
    bssid1 VARCHAR(17) NOT NULL,
    bssid2 VARCHAR(17) NOT NULL,
    cooccurrence_count INT NOT NULL DEFAULT 0,
    locations_count INT NOT NULL DEFAULT 0,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (bssid1, bssid2),
    CHECK (bssid1 < bssid2)  -- Ensure consistent ordering
);

CREATE INDEX IF NOT EXISTS idx_cooccurrence_bssid1 ON app.network_cooccurrence(bssid1);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_bssid2 ON app.network_cooccurrence(bssid2);
CREATE INDEX IF NOT EXISTS idx_cooccurrence_count ON app.network_cooccurrence(cooccurrence_count DESC);

COMMENT ON TABLE app.network_cooccurrence IS 
'Tracks networks that appear together at multiple locations for coordinated surveillance detection';

-- Step 2: Populate co-occurrence data (mobile networks only)
INSERT INTO app.network_cooccurrence (bssid1, bssid2, cooccurrence_count, locations_count, first_seen, last_seen)
WITH mobile_networks AS (
    SELECT bssid
    FROM app.api_network_explorer_mv
    WHERE max_distance_meters > 150
    AND observations >= 2
    AND LENGTH(bssid) <= 17
),
network_pairs AS (
    SELECT 
        LEAST(o1.bssid, o2.bssid) AS bssid1,
        GREATEST(o1.bssid, o2.bssid) AS bssid2,
        ST_SnapToGrid(o1.geom, 0.0001) AS grid_point,  -- ~10m grid
        LEAST(o1.time, o2.time) AS seen_at
    FROM app.observations o1
    JOIN mobile_networks m1 ON m1.bssid = o1.bssid
    JOIN app.observations o2 
        ON ST_DWithin(o1.geom::geography, o2.geom::geography, 50)  -- Within 50m
        AND ABS(EXTRACT(EPOCH FROM (o1.time - o2.time))) <= 300  -- Within 5 minutes
    JOIN mobile_networks m2 ON m2.bssid = o2.bssid
    WHERE o1.bssid < o2.bssid
    GROUP BY LEAST(o1.bssid, o2.bssid), GREATEST(o1.bssid, o2.bssid), ST_SnapToGrid(o1.geom, 0.0001), LEAST(o1.time, o2.time)
)
SELECT 
    bssid1,
    bssid2,
    COUNT(*) AS cooccurrence_count,
    COUNT(DISTINCT grid_point) AS locations_count,
    MIN(seen_at) AS first_seen,
    MAX(seen_at) AS last_seen
FROM network_pairs
GROUP BY bssid1, bssid2
HAVING COUNT(DISTINCT grid_point) >= 3  -- At least 3 shared locations
ON CONFLICT (bssid1, bssid2) DO UPDATE SET
    cooccurrence_count = EXCLUDED.cooccurrence_count,
    locations_count = EXCLUDED.locations_count,
    first_seen = EXCLUDED.first_seen,
    last_seen = EXCLUDED.last_seen,
    updated_at = NOW();

SELECT 'Co-occurrence table populated' AS status;
SELECT 
    COUNT(*) AS total_pairs,
    COUNT(*) FILTER (WHERE cooccurrence_count >= 10) AS high_cooccurrence,
    MAX(cooccurrence_count) AS max_cooccurrence
FROM app.network_cooccurrence;


-- ============================================================================
-- Folded from: 20260303_exclude_ignored_networks.sql
-- ============================================================================

-- Exclude Ignored Networks from Threat Scoring
-- Purpose: Set ignored networks to NONE and exclude from future scoring

-- Step 1: Mark all ignored networks as NONE
INSERT INTO app.network_threat_scores
    (bssid, rule_based_score, rule_based_flags, final_threat_score,
     final_threat_level, model_version, scored_at, updated_at)
SELECT
    nt.bssid,
    0,
    jsonb_build_object('ignored', true),
    0,
    'NONE',
    '4.0-ignored',
    NOW(),
    NOW()
FROM app.network_tags nt
WHERE COALESCE(nt.is_ignored, false) = true
ON CONFLICT (bssid) DO UPDATE SET
    rule_based_score = 0,
    rule_based_flags = jsonb_build_object('ignored', true),
    final_threat_score = 0,
    final_threat_level = 'NONE',
    model_version = '4.0-ignored',
    updated_at = NOW();

-- Step 2: Update cache to mark as scored (no rescoring needed)
INSERT INTO app.threat_scores_cache (bssid, threat_score, threat_level, computed_at, needs_recompute)
SELECT 
    nt.bssid,
    0,
    'NONE',
    NOW(),
    false
FROM app.network_tags nt
WHERE COALESCE(nt.is_ignored, false) = true
ON CONFLICT (bssid) DO UPDATE SET
    threat_score = 0,
    threat_level = 'NONE',
    computed_at = NOW(),
    needs_recompute = false;

-- Step 3: Create trigger to auto-ignore when tag is added
CREATE OR REPLACE FUNCTION app.auto_ignore_tagged_network()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF COALESCE(NEW.is_ignored, false) = true THEN
        -- Set score to NONE
        INSERT INTO app.network_threat_scores
            (bssid, rule_based_score, rule_based_flags, final_threat_score,
             final_threat_level, model_version, scored_at, updated_at)
        VALUES
            (NEW.bssid, 0, jsonb_build_object('ignored', true), 0, 'NONE', '4.0-ignored', NOW(), NOW())
        ON CONFLICT (bssid) DO UPDATE SET
            rule_based_score = 0,
            rule_based_flags = jsonb_build_object('ignored', true),
            final_threat_score = 0,
            final_threat_level = 'NONE',
            model_version = '4.0-ignored',
            updated_at = NOW();
        
        -- Update cache
        INSERT INTO app.threat_scores_cache (bssid, threat_score, threat_level, computed_at, needs_recompute)
        VALUES (NEW.bssid, 0, 'NONE', NOW(), false)
        ON CONFLICT (bssid) DO UPDATE SET
            threat_score = 0,
            threat_level = 'NONE',
            computed_at = NOW(),
            needs_recompute = false;
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_ignore ON app.network_tags;
CREATE TRIGGER trigger_auto_ignore
    AFTER INSERT OR UPDATE OF is_ignored ON app.network_tags
    FOR EACH ROW
    EXECUTE FUNCTION app.auto_ignore_tagged_network();

-- Step 4: Update incremental scoring to skip ignored networks
COMMENT ON FUNCTION app.auto_ignore_tagged_network IS 
'Automatically sets ignored networks to NONE threat level';

SELECT 'Ignore function installed' AS status;
SELECT COUNT(*) AS ignored_networks
FROM app.network_tags
WHERE COALESCE(is_ignored, false) = true;


-- ============================================================================
-- Folded from: 20260303_fix_mv_quality_filters.sql
-- ============================================================================

-- Fix MV to Exclude Quality-Filtered Observations
-- Purpose: Apply quality filters to all observation queries in api_network_explorer_mv
-- Impact: Will reduce observation counts by ~10% and fix max_distance for stationary networks

\timing on

SELECT 'Fixing api_network_explorer_mv to exclude quality-filtered observations' AS status;

-- Drop and recreate the MV with quality filters
DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv CASCADE;

CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
WITH stationary_analysis AS (
    SELECT
        bssid,
        CASE
            WHEN COUNT(*) < 5 THEN NULL
            WHEN MAX(ST_Distance(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
                 FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
            )) < 100 THEN 0.95
            WHEN MAX(ST_Distance(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
                 FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
            )) < 500 THEN 0.70
            WHEN MAX(ST_Distance(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
                (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
                 FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
            )) < 1000 THEN 0.30
            ELSE 0.05
        END AS stationary_confidence
    FROM app.observations
    WHERE lat IS NOT NULL
      AND lon IS NOT NULL
      AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
    GROUP BY bssid
)
SELECT n.bssid, n.ssid, n.type, n.frequency,
    n.bestlevel AS signal,
    -- Lat/lon: furthest quality observation from home
    (SELECT o.lat FROM app.observations o
     WHERE o.bssid = n.bssid 
     AND o.lat IS NOT NULL AND o.lon IS NOT NULL
     AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
     ORDER BY ST_Distance(
         ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
         (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
          FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
     ) DESC LIMIT 1) AS lat,
    (SELECT o.lon FROM app.observations o
     WHERE o.bssid = n.bssid 
     AND o.lat IS NOT NULL AND o.lon IS NOT NULL
     AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
     ORDER BY ST_Distance(
         ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
         (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
          FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
     ) DESC LIMIT 1) AS lon,
    to_timestamp((n.lasttime_ms::numeric / 1000.0)::double precision) AS observed_at,
    n.capabilities AS security,
    COALESCE(t.threat_tag, 'untagged'::character varying) AS tag_type,
    count(o.id) AS observations,
    count(DISTINCT date(o.time)) AS unique_days,
    count(DISTINCT (round(o.lat::numeric, 3) || ',' || round(o.lon::numeric, 3))) AS unique_locations,
    max(o.accuracy) AS accuracy_meters,
    min(o.time) AS first_seen,
    max(o.time) AS last_seen,
    COALESCE(ts.final_threat_score, 0::numeric) AS threat_score,
    COALESCE(ts.final_threat_level, 'NONE'::character varying) AS threat_level,
    ts.model_version,
    -- Distance from home
    COALESCE((ST_Distance(
        (SELECT ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography
         FROM app.observations o
         WHERE o.bssid = n.bssid 
         AND o.lat IS NOT NULL AND o.lon IS NOT NULL
         AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
         ORDER BY ST_Distance(
             ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
             (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
              FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
         ) DESC LIMIT 1),
        (SELECT ST_SetSRID(ST_MakePoint(lm.longitude, lm.latitude), 4326)::geography
         FROM app.location_markers lm WHERE lm.marker_type = 'home' LIMIT 1)
    ) / 1000.0), 0::double precision) AS distance_from_home_km,
    -- Max distance between quality observations only
    (SELECT MAX(ST_Distance(
        ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
    ))
    FROM app.observations o1, app.observations o2
    WHERE o1.bssid = n.bssid AND o2.bssid = n.bssid
      AND o1.lat IS NOT NULL AND o1.lon IS NOT NULL
      AND o2.lat IS NOT NULL AND o2.lon IS NOT NULL
      AND (o1.is_quality_filtered = false OR o1.is_quality_filtered IS NULL)
      AND (o2.is_quality_filtered = false OR o2.is_quality_filtered IS NULL)) AS max_distance_meters,
    -- Manufacturer from radio_manufacturers
    rm.manufacturer,
    s.stationary_confidence
FROM app.networks n
LEFT JOIN app.network_tags t ON n.bssid = t.bssid::text
LEFT JOIN app.observations o ON n.bssid = o.bssid
LEFT JOIN app.network_threat_scores ts ON n.bssid = ts.bssid::text
LEFT JOIN LATERAL (
    SELECT r.manufacturer
    FROM app.radio_manufacturers r
    WHERE UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
          IN (r.oui, r.oui_assignment_hex, r.prefix_24bit)
    LIMIT 1
) rm ON true
LEFT JOIN stationary_analysis s ON n.bssid = s.bssid
WHERE o.lat IS NOT NULL 
AND o.lon IS NOT NULL
AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.bestlevel,
         n.lasttime_ms, n.capabilities, t.threat_tag, 
         ts.final_threat_score, ts.final_threat_level, ts.model_version,
         rm.manufacturer, s.stationary_confidence;

-- Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid ON app.api_network_explorer_mv(bssid);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type ON app.api_network_explorer_mv(type);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observed_at ON app.api_network_explorer_mv(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat ON app.api_network_explorer_mv(threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_manufacturer_gin ON app.api_network_explorer_mv (manufacturer);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_stationary ON app.api_network_explorer_mv(stationary_confidence) WHERE stationary_confidence IS NOT NULL;

SELECT 'MV definition updated - now run: REFRESH MATERIALIZED VIEW CONCURRENTLY app.api_network_explorer_mv;' AS next_step;


-- ============================================================================
-- Folded from: 20260303_incremental_scoring_v4.sql
-- ============================================================================

-- Incremental Threat Scoring v4 System
-- Purpose: Automatically mark networks for rescoring when observations change

-- Step 1: Trigger function to mark networks for rescoring
CREATE OR REPLACE FUNCTION app.mark_network_for_rescoring()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert or update the cache entry to mark for rescoring
    INSERT INTO app.threat_scores_cache (bssid, needs_recompute)
    VALUES (NEW.bssid, true)
    ON CONFLICT (bssid) DO UPDATE
    SET needs_recompute = true;
    
    RETURN NEW;
END;
$$;

-- Step 2: Attach trigger to observations table
DROP TRIGGER IF EXISTS trigger_mark_for_rescoring ON app.observations;
CREATE TRIGGER trigger_mark_for_rescoring
    AFTER INSERT ON app.observations
    FOR EACH ROW
    EXECUTE FUNCTION app.mark_network_for_rescoring();

COMMENT ON FUNCTION app.mark_network_for_rescoring IS 
'Marks networks for rescoring when new observations are added';

-- Step 3: Populate cache with existing networks
INSERT INTO app.threat_scores_cache (bssid, threat_score, threat_level, computed_at, needs_recompute)
SELECT 
    nts.bssid,
    nts.final_threat_score,
    nts.final_threat_level,
    nts.updated_at,
    false  -- Already scored
FROM app.network_threat_scores nts
ON CONFLICT (bssid) DO UPDATE
SET 
    threat_score = EXCLUDED.threat_score,
    threat_level = EXCLUDED.threat_level,
    computed_at = EXCLUDED.computed_at,
    needs_recompute = false;

SELECT 'Incremental scoring system initialized' AS status;
SELECT 
    COUNT(*) AS total_cached,
    COUNT(*) FILTER (WHERE needs_recompute = true) AS needs_rescoring
FROM app.threat_scores_cache;


-- ============================================================================
-- Folded from: 20260306_harden_db_roles_and_ownership.sql
-- ============================================================================

-- Harden DB roles and ownership model
-- Goal:
-- 1) Make shadowcheck_admin owner of app/public objects (best effort)
-- 2) Keep shadowcheck_user read-only except explicit auth/session exceptions
--
-- Notes:
-- - This migration contains no secrets and does not persist credentials.
-- - Ownership transfer may require elevated DB privileges; insufficient-privilege
--   cases are logged as NOTICE and skipped so migration remains rerunnable.

-- -----------------------------------------------------------------------------
-- 0) Preconditions
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shadowcheck_admin') THEN
    RAISE EXCEPTION 'Role shadowcheck_admin does not exist';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shadowcheck_user') THEN
    RAISE EXCEPTION 'Role shadowcheck_user does not exist';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 1) Ownership transfer to shadowcheck_admin (best effort)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  obj RECORD;
BEGIN
  BEGIN
    EXECUTE 'ALTER SCHEMA app OWNER TO shadowcheck_admin';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ALTER SCHEMA app OWNER TO shadowcheck_admin (insufficient privilege)';
  END;

  BEGIN
    EXECUTE 'ALTER SCHEMA public OWNER TO shadowcheck_admin';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping ALTER SCHEMA public OWNER TO shadowcheck_admin (insufficient privilege)';
  END;

  -- Tables, partitioned tables, views, materialized views, sequences, foreign tables
  FOR obj IN
    SELECT n.nspname AS schemaname, c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('app', 'public')
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  LOOP
    BEGIN
      IF obj.relkind IN ('r', 'p') THEN
        EXECUTE format('ALTER TABLE %I.%I OWNER TO shadowcheck_admin', obj.schemaname, obj.relname);
      ELSIF obj.relkind = 'v' THEN
        EXECUTE format('ALTER VIEW %I.%I OWNER TO shadowcheck_admin', obj.schemaname, obj.relname);
      ELSIF obj.relkind = 'm' THEN
        EXECUTE format('ALTER MATERIALIZED VIEW %I.%I OWNER TO shadowcheck_admin', obj.schemaname, obj.relname);
      ELSIF obj.relkind = 'S' THEN
        -- For SERIAL/IDENTITY-owned sequences, owner follows the parent table.
        -- PostgreSQL rejects direct ALTER SEQUENCE OWNER on these objects.
        IF EXISTS (
          SELECT 1
          FROM pg_depend d
          WHERE d.classid = 'pg_class'::regclass
            AND d.objid = format('%I.%I', obj.schemaname, obj.relname)::regclass
            AND d.refclassid = 'pg_class'::regclass
            AND d.refobjsubid > 0
            AND d.deptype IN ('a', 'i')
        ) THEN
          RAISE NOTICE 'Skipping ownership transfer for linked sequence %.% (owner follows parent table)',
            obj.schemaname,
            obj.relname;
        ELSE
          EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO shadowcheck_admin', obj.schemaname, obj.relname);
        END IF;
      ELSIF obj.relkind = 'f' THEN
        EXECUTE format('ALTER FOREIGN TABLE %I.%I OWNER TO shadowcheck_admin', obj.schemaname, obj.relname);
      END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping ownership transfer for %.% (insufficient privilege)', obj.schemaname, obj.relname;
    END;
  END LOOP;

  -- Functions/procedures
  FOR obj IN
    SELECT n.nspname AS schemaname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args,
           p.prokind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('app', 'public')
  LOOP
    BEGIN
      IF obj.prokind = 'p' THEN
        EXECUTE format(
          'ALTER PROCEDURE %I.%I(%s) OWNER TO shadowcheck_admin',
          obj.schemaname,
          obj.proname,
          obj.identity_args
        );
      ELSE
        EXECUTE format(
          'ALTER FUNCTION %I.%I(%s) OWNER TO shadowcheck_admin',
          obj.schemaname,
          obj.proname,
          obj.identity_args
        );
      END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping routine ownership transfer for %.%(%) (insufficient privilege)',
          obj.schemaname,
          obj.proname,
          obj.identity_args;
    END;
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 2) Tighten shadowcheck_user permissions
-- -----------------------------------------------------------------------------
-- Prevent object creation by shadowcheck_user.
REVOKE CREATE ON SCHEMA app FROM shadowcheck_user;
REVOKE CREATE ON SCHEMA public FROM shadowcheck_user;

-- Reset table/sequence/function privileges, then grant back read-only policy.
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM shadowcheck_user;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM shadowcheck_user;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM shadowcheck_user;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM shadowcheck_user;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM shadowcheck_user;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM shadowcheck_user;

GRANT USAGE ON SCHEMA app TO shadowcheck_user;
GRANT USAGE ON SCHEMA public TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_user;

-- Auth/session exceptions needed by runtime auth flows.
GRANT INSERT, UPDATE, DELETE ON TABLE app.user_sessions TO shadowcheck_user;
GRANT UPDATE (last_login) ON TABLE app.users TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE ON TABLE app.geocoding_cache TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.geocoding_cache_id_seq TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE ON TABLE app.geocoding_job_runs TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.geocoding_job_runs_id_seq TO shadowcheck_user;
GRANT SELECT, INSERT, UPDATE ON TABLE app.background_job_runs TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.background_job_runs_id_seq TO shadowcheck_user;
-- WiGLE import/runtime exceptions:
-- - writes to WiGLE v3 tables
-- - trigger app.update_networks_wigle_counts updates app.networks counters
GRANT INSERT, UPDATE, DELETE ON TABLE app.wigle_v3_network_details TO shadowcheck_user;
GRANT INSERT, UPDATE, DELETE ON TABLE app.wigle_v3_observations TO shadowcheck_user;
GRANT USAGE, SELECT ON SEQUENCE app.wigle_v3_observations_id_seq TO shadowcheck_user;
GRANT UPDATE (wigle_v3_observation_count, wigle_v3_last_import_at) ON TABLE app.networks TO shadowcheck_user;

-- -----------------------------------------------------------------------------
-- 3) Ensure shadowcheck_admin has full schema/object privileges
-- -----------------------------------------------------------------------------
GRANT CONNECT ON DATABASE shadowcheck_db TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO shadowcheck_admin;

-- -----------------------------------------------------------------------------
-- 4) Default privileges for future objects (created by shadowcheck_admin)
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT SELECT ON TABLES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT SELECT ON TABLES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT USAGE ON SEQUENCES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA app
  GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;
ALTER DEFAULT PRIVILEGES FOR ROLE shadowcheck_admin IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO shadowcheck_user;

SELECT 'db_role_hardening_complete' AS status;

CREATE INDEX IF NOT EXISTS idx_geocoding_cache_pending_address
  ON app.geocoding_cache (precision, address_attempts, geocoded_at, id)
  WHERE address IS NULL;

CREATE INDEX IF NOT EXISTS idx_geocoding_cache_pending_poi
  ON app.geocoding_cache (precision, poi_attempts, geocoded_at, id)
  WHERE address IS NOT NULL
    AND poi_name IS NULL
    AND poi_skip IS FALSE;


-- ============================================================================
-- Folded from: 20260307_snapshot_threat_score_v4_current.sql
-- ============================================================================

-- Migration: Snapshot current Threat Score v4 function
-- Date: 2026-03-07
-- Purpose: Preserve current live v4 scoring behavior in a forward migration.
--
-- Notes:
-- - Old migrations remain immutable.
-- - This migration redefines app.calculate_threat_score_v4 only.
-- - Includes current DBSCAN tuning using geometry degrees (0.01 and 0.005).

-- Threat Scoring v4.0 - Individual Behavior + Fleet Correlation
--
-- Purpose: Detect surveillance through behavioral patterns and fleet coordination
--
-- Key improvements over v3:
-- 1. Following Pattern Detection (35%) - Multiple distinct away locations
-- 2. Parked Surveillance Detection (20%) - Multiple detections at same spot
-- 3. Location Correlation (15%) - Home staging and routine location patterns
-- 4. Equipment Profile (10%) - Industrial gear and operational SSIDs
-- 5. Temporal Persistence (5%) - Long-term monitoring
-- 6. Fleet Correlation Bonus (15%) - Coordinated multi-vehicle operations
--
-- Composite Score Formula:
--   threat_score =
--     (following_pattern × 0.35) +
--     (parked_surveillance × 0.20) +
--     (location_correlation × 0.15) +
--     (equipment_profile × 0.10) +
--     (temporal_persistence × 0.05) +
--     (fleet_correlation_bonus × 0.15)
--
-- Maximum score: 100 (85 individual + 15 fleet bonus)

CREATE OR REPLACE FUNCTION app.calculate_threat_score_v4(p_bssid TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = app, public, topology, tiger
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Base CTEs for data gathering
    WITH observations AS (
        SELECT
            o.id,
            o.bssid,
            o.lat,
            o.lon,
            o.time,
            o.level AS signal
        FROM app.observations o
        WHERE o.bssid = p_bssid
            AND o.lat IS NOT NULL
            AND o.lon IS NOT NULL
            AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
    ),
    home_location AS (
        SELECT
            latitude AS lat,
            longitude AS lon
        FROM app.location_markers
        WHERE marker_type = 'home'
        LIMIT 1
    ),
    network_metadata AS (
        SELECT
            n.bssid,
            n.ssid,
            n.type
        FROM app.networks n
        WHERE n.bssid = p_bssid
    ),
    
    -- Task 2: Following Pattern Score (35%)
    location_classification AS (
        SELECT
            o.id,
            o.lat,
            o.lon,
            o.time,
            CASE
                WHEN h.lat IS NULL THEN NULL
                ELSE ST_Distance(
                    ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geometry,
                    ST_SetSRID(ST_MakePoint(h.lon, h.lat), 4326)::geography
                )
            END AS distance_from_home_m
        FROM observations o
        CROSS JOIN home_location h
    ),
    away_clusters AS (
        SELECT
            ST_ClusterDBSCAN(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geometry,
                eps := 0.01,  -- ~1km in degrees
                minpoints := 1
            ) OVER () AS cluster_id,
            lat,
            lon
        FROM location_classification
        WHERE distance_from_home_m > 2000  -- Away = >2km from home
    ),
    away_cluster_count AS (
        SELECT COUNT(DISTINCT cluster_id) AS count
        FROM away_clusters
        WHERE cluster_id IS NOT NULL
    ),
    wigle_spread AS (
        SELECT
            COALESCE(MAX(
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(w.longitude, w.latitude), 4326)::geometry,
                    ST_SetSRID(ST_MakePoint(h.lon, h.lat), 4326)::geography
                ) / 1000.0
            ), 0) AS max_distance_km
        FROM app.wigle_v3_observations w
        CROSS JOIN home_location h
        WHERE UPPER(w.netid) = UPPER(p_bssid)
    ),
    following_score AS (
        SELECT
            LEAST(35, 
                (COALESCE(acc.count, 0) * 7) + 
                (ws.max_distance_km / 10.0)
            )::numeric AS score
        FROM away_cluster_count acc
        CROSS JOIN wigle_spread ws
    ),
    
    -- Task 3: Parked Surveillance Score (20%)
    observation_pairs AS (
        SELECT
            o1.id AS id1,
            o2.id AS id2,
            o1.lat AS lat1,
            o1.lon AS lon1,
            o2.lat AS lat2,
            o2.lon AS lon2,
            o1.time AS time1,
            o2.time AS time2,
            ST_Distance(
                ST_SetSRID(ST_MakePoint(o1.lon, o1.lat), 4326)::geometry,
                ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
            ) AS distance_m,
            EXTRACT(EPOCH FROM (o2.time - o1.time)) / 60.0 AS time_diff_min
        FROM location_classification o1
        JOIN location_classification o2 ON o2.id > o1.id
        WHERE EXTRACT(EPOCH FROM (o2.time - o1.time)) BETWEEN 0 AND 600  -- Within 10 minutes
    ),
    parking_events AS (
        SELECT
            lat1,
            lon1,
            time1,
            COUNT(*) AS detections_in_window,
            AVG(distance_from_home_m) AS avg_distance_from_home
        FROM observation_pairs op
        JOIN location_classification lc ON lc.id = op.id1
        WHERE op.distance_m < 100  -- Within 100m
        GROUP BY lat1, lon1, time1
        HAVING COUNT(*) >= 2  -- 3+ total detections (original + 2 pairs)
    ),
    parking_score AS (
        SELECT
            LEAST(20,
                COUNT(*) * 4 * AVG(1.0 / (1.0 + COALESCE(avg_distance_from_home / 1000.0, 10)))
            )::numeric AS score
        FROM parking_events
    ),
    
    -- Task 4: Location Correlation Score (15%)
    home_staging AS (
        SELECT
            COUNT(CASE WHEN distance_from_home_m < 500 THEN 1 END)::numeric / 
            NULLIF(COUNT(*)::numeric, 0) AS home_staging_pct
        FROM location_classification
    ),
    location_clusters AS (
        SELECT COUNT(DISTINCT cluster_id) AS cluster_count
        FROM (
            SELECT ST_ClusterDBSCAN(
                ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geometry,
                eps := 0.005,  -- ~500m in degrees
                minpoints := 1
            ) OVER () AS cluster_id
            FROM location_classification
        ) clusters
        WHERE cluster_id IS NOT NULL
    ),
    correlation_score AS (
        SELECT
            LEAST(15,
                (COALESCE(hs.home_staging_pct, 0) * 0.7 + 
                 LEAST(1.0, COALESCE(lc.cluster_count, 0) / 5.0) * 0.3) * 15
            )::numeric AS score
        FROM home_staging hs
        CROSS JOIN location_clusters lc
    ),
    
    -- Task 5: Equipment Profile Score (10%)
    manufacturer_lookup AS (
        SELECT
            rm.manufacturer AS manufacturer
        FROM network_metadata nm
        LEFT JOIN app.radio_manufacturers rm 
            ON rm.prefix = UPPER(REPLACE(SUBSTRING(nm.bssid, 1, 8), ':', ''))
    ),
    equipment_score AS (
        SELECT
            (
                -- Manufacturer scoring (5 points)
                CASE
                    WHEN ml.manufacturer ILIKE '%AirLink%' 
                      OR ml.manufacturer ILIKE '%Cradlepoint%'
                      OR ml.manufacturer ILIKE '%Sierra Wireless%'
                      OR ml.manufacturer ILIKE '%Mitsumi%'
                      OR ml.manufacturer ILIKE '%Alps Alpine%'
                      OR ml.manufacturer ILIKE '%AlpsAlpine%'
                      OR ml.manufacturer ILIKE '%Magneti Marelli Sistemas%' THEN 5
                    ELSE 0
                END +
                -- SSID pattern scoring (3 points max)
                CASE
                    WHEN nm.ssid ~ '^PAS-\d+$' THEN 3
                    WHEN nm.ssid = 'mdt' THEN 3
                    WHEN nm.ssid ~ '^\d+$' THEN 2
                    WHEN nm.ssid ~* '(myChevrolet|myBuick|myGMC|MBUX|CADILLAC)' THEN 2
                    ELSE 0
                END
            )::numeric AS score
        FROM network_metadata nm
        CROSS JOIN manufacturer_lookup ml
    ),
    
    -- Task 6: Temporal Persistence Score (5%)
    temporal_score AS (
        SELECT
            LEAST(5, 
                (COUNT(DISTINCT DATE(time))::numeric / 100.0) * 5
            )::numeric AS score
        FROM observations
    ),
    
    -- Task 7: Fleet Correlation Bonus (15%)
    -- First calculate individual score for this network
    individual_total AS (
        SELECT
            (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + 
             COALESCE(es.score, 0) + COALESCE(ts.score, 0))::numeric AS score
        FROM following_score fs
        CROSS JOIN parking_score ps
        CROSS JOIN correlation_score cs
        CROSS JOIN equipment_score es
        CROSS JOIN temporal_score ts
    ),
    -- Count networks with same manufacturer scoring >50
    fleet_manufacturer_count AS (
        SELECT COUNT(DISTINCT n.bssid) AS count
        FROM app.networks n
        JOIN app.radio_manufacturers rm1 ON rm1.prefix = UPPER(REPLACE(SUBSTRING(n.bssid, 1, 8), ':', ''))
        CROSS JOIN manufacturer_lookup ml
        WHERE rm1.manufacturer = ml.manufacturer
          AND n.bssid != p_bssid
          AND EXISTS (
              SELECT 1 FROM app.network_threat_scores nts
              WHERE nts.bssid = n.bssid
                AND COALESCE(nts.final_threat_score, 0) > 50
          )
    ),
    -- Find networks matching same SSID patterns
    fleet_ssid_patterns AS (
        SELECT COUNT(DISTINCT n.bssid) AS count
        FROM app.networks n
        CROSS JOIN network_metadata nm
        WHERE n.bssid != p_bssid
          AND (
              (nm.ssid ~ '^PAS-\d+$' AND n.ssid ~ '^PAS-\d+$') OR
              (nm.ssid = 'mdt' AND n.ssid = 'mdt') OR
              (nm.ssid ~ '^\d+$' AND n.ssid ~ '^\d+$')
          )
    ),
    -- Find networks within 10km with scores >50
    fleet_geographic_overlap AS (
        SELECT COUNT(DISTINCT n.bssid) AS count
        FROM app.networks n
        JOIN app.api_network_explorer_mv mv ON mv.bssid = n.bssid
        CROSS JOIN observations o
        WHERE n.bssid != p_bssid
          AND COALESCE(mv.threat_score, 0) > 50
          AND EXISTS (
              SELECT 1
              FROM app.observations o2
              WHERE o2.bssid = n.bssid
                AND o2.lat IS NOT NULL
                AND o2.lon IS NOT NULL
                AND ST_Distance(
                    ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geometry,
                    ST_SetSRID(ST_MakePoint(o2.lon, o2.lat), 4326)::geography
                ) < 10000
          )
    ),
    fleet_score AS (
        SELECT
            (
                -- Manufacturer bonus
                CASE
                    WHEN fmc.count >= 20 THEN 10
                    WHEN fmc.count >= 10 THEN 8
                    WHEN fmc.count >= 5 THEN 5
                    ELSE 0
                END +
                -- SSID pattern bonus
                CASE WHEN fsp.count >= 3 THEN 3 ELSE 0 END +
                -- Geographic overlap bonus
                CASE WHEN fgo.count >= 2 THEN 2 ELSE 0 END
            )::numeric AS score
        FROM fleet_manufacturer_count fmc
        CROSS JOIN fleet_ssid_patterns fsp
        CROSS JOIN fleet_geographic_overlap fgo
    )
    
    -- Return complete structure with all scores and threat level
    SELECT jsonb_build_object(
        'bssid', p_bssid,
        'total_score', COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0),
        'threat_level', 
            CASE
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 81 THEN 'CRITICAL'
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 61 THEN 'HIGH'
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 41 THEN 'MEDIUM'
                WHEN (COALESCE(fs.score, 0) + COALESCE(ps.score, 0) + COALESCE(cs.score, 0) + COALESCE(es.score, 0) + COALESCE(ts.score, 0) + COALESCE(fls.score, 0)) >= 21 THEN 'LOW'
                ELSE 'NONE'
            END,
        'model_version', '4.0',
        'components', jsonb_build_object(
            'following_pattern', COALESCE(fs.score, 0),
            'parked_surveillance', COALESCE(ps.score, 0),
            'location_correlation', COALESCE(cs.score, 0),
            'equipment_profile', COALESCE(es.score, 0),
            'temporal_persistence', COALESCE(ts.score, 0),
            'fleet_correlation_bonus', COALESCE(fls.score, 0)
        )
    ) INTO v_result
    FROM following_score fs
    CROSS JOIN parking_score ps
    CROSS JOIN correlation_score cs
    CROSS JOIN equipment_score es
    CROSS JOIN temporal_score ts
    CROSS JOIN fleet_score fls;
    
    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION app.calculate_threat_score_v4(TEXT) IS 
'Threat Scoring v4.0 - Detects surveillance through individual behavior patterns and fleet correlation';

-- Verify deployment
SELECT 'threat score v4 function snapshot applied successfully' AS status;

-- ============================================================================
-- Folded from: 20260316_kismet_unique_constraints.sql
-- ============================================================================
DELETE FROM app.kismet_packets
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY hash, ts_sec, ts_usec ORDER BY id) AS row_num
        FROM app.kismet_packets
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_packets_forensic_id ON app.kismet_packets (hash, ts_sec, ts_usec);

DELETE FROM app.kismet_alerts
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, devmac, header ORDER BY id) AS row_num
        FROM app.kismet_alerts
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_alerts_forensic_id ON app.kismet_alerts (ts_sec, ts_usec, devmac, header);

DELETE FROM app.kismet_messages
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, md5(message) ORDER BY id) AS row_num
        FROM app.kismet_messages
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_messages_forensic_id ON app.kismet_messages (ts_sec, ts_usec, md5(message));

DELETE FROM app.kismet_datasources
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY datasource ORDER BY id) AS row_num
        FROM app.kismet_datasources
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_datasources_forensic_id ON app.kismet_datasources (datasource);

DELETE FROM app.kismet_snapshots
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, snaptype ORDER BY id) AS row_num
        FROM app.kismet_snapshots
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_snapshots_forensic_id ON app.kismet_snapshots (ts_sec, ts_usec, snaptype);

DELETE FROM app.kismet_data
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ts_sec, ts_usec, devmac, data_type ORDER BY id) AS row_num
        FROM app.kismet_data
    ) t WHERE row_num > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kismet_data_forensic_id ON app.kismet_data (ts_sec, ts_usec, devmac, data_type);

-- ============================================================================
-- Folded from: 20260323_standardize_radio_manufacturers.sql
-- ============================================================================
CREATE OR REPLACE FUNCTION app.professional_title_case(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    IF input_text IS NULL OR input_text = '' THEN
        RETURN input_text;
    END IF;

    result := INITCAP(input_text);

    result := REGEXP_REPLACE(result, '\yLlc\y', 'LLC', 'gi');
    result := REGEXP_REPLACE(result, '\yInc\y', 'Inc.', 'gi');
    result := REGEXP_REPLACE(result, '\yCorp\y', 'Corp.', 'gi');
    result := REGEXP_REPLACE(result, '\yLtd\y', 'Ltd.', 'gi');
    result := REGEXP_REPLACE(result, '\yCo\y', 'Co.', 'gi');
    result := REGEXP_REPLACE(result, '\yUsa\y', 'USA', 'gi');
    result := REGEXP_REPLACE(result, '\yUk\y', 'UK', 'gi');
    result := REGEXP_REPLACE(result, '\yGb\y', 'GB', 'gi');
    result := REGEXP_REPLACE(result, '\yJp\y', 'JP', 'gi');
    result := REGEXP_REPLACE(result, '\yFr\y', 'FR', 'gi');
    result := REGEXP_REPLACE(result, '\yDe\y', 'DE', 'gi');
    result := REGEXP_REPLACE(result, '\ySe\y', 'SE', 'gi');
    result := REGEXP_REPLACE(result, '\yKr\y', 'KR', 'gi');
    result := REGEXP_REPLACE(result, '\yTw\y', 'TW', 'gi');
    result := REGEXP_REPLACE(result, '\yCn\y', 'CN', 'gi');
    result := REGEXP_REPLACE(result, '\yAu\y', 'AU', 'gi');
    result := REGEXP_REPLACE(result, '\yNy\y', 'NY', 'gi');
    result := REGEXP_REPLACE(result, '\yCa\y', 'CA', 'gi');
    result := REGEXP_REPLACE(result, '\yTx\y', 'TX', 'gi');
    result := REGEXP_REPLACE(result, '\yMa\y', 'MA', 'gi');
    result := REGEXP_REPLACE(result, '\yMi\y', 'MI', 'gi');
    result := REGEXP_REPLACE(result, '\yOh\y', 'OH', 'gi');
    result := REGEXP_REPLACE(result, '\yPa\y', 'PA', 'gi');
    result := REGEXP_REPLACE(result, '\yFl\y', 'FL', 'gi');
    result := REGEXP_REPLACE(result, '\yGa\y', 'GA', 'gi');
    result := REGEXP_REPLACE(result, '\yNj\y', 'NJ', 'gi');
    result := REGEXP_REPLACE(result, '\yVa\y', 'VA', 'gi');
    result := REGEXP_REPLACE(result, '\yWa\y', 'WA', 'gi');
    result := REGEXP_REPLACE(result, '\yIbm\y', 'IBM', 'gi');
    result := REGEXP_REPLACE(result, '\yNec\y', 'NEC', 'gi');
    result := REGEXP_REPLACE(result, '\yTrw\y', 'TRW', 'gi');
    result := REGEXP_REPLACE(result, '\yGmbh\y', 'GmbH', 'gi');
    result := REGEXP_REPLACE(result, '\yAg\y', 'AG', 'gi');
    result := REGEXP_REPLACE(result, '\yAb\y', 'AB', 'gi');
    result := REGEXP_REPLACE(result, '\ySa\y', 'SA', 'gi');
    result := REGEXP_REPLACE(result, '\ySrl\y', 'SRL', 'gi');
    result := REGEXP_REPLACE(result, '\yBv\y', 'BV', 'gi');
    result := REGEXP_REPLACE(result, '\yPlc\y', 'PLC', 'gi');

    result := REPLACE(result, '..', '.');
    result := REPLACE(result, 'Inc..', 'Inc.');
    result := REPLACE(result, 'Corp..', 'Corp.');
    result := REGEXP_REPLACE(result, '\s+', ' ', 'g');
    result := TRIM(result);

    RETURN result;
END;
$$ LANGUAGE plpgsql;

UPDATE app.radio_manufacturers
SET
    manufacturer = app.professional_title_case(manufacturer),
    address = app.professional_title_case(address)
WHERE manufacturer IS NOT NULL;

DROP FUNCTION app.professional_title_case(TEXT);

-- ============================================================================
-- Folded from: 20260323_add_is_ignored_to_mv.sql
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS app.api_network_explorer_mv CASCADE;

CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS
WITH home_loc AS (
  SELECT public.st_setsrid(public.st_makepoint(longitude, latitude), 4326)::public.geography AS geog
  FROM app.location_markers
  WHERE marker_type = 'home'
  LIMIT 1
),
best_obs AS (
  SELECT DISTINCT ON (o.bssid)
    o.bssid, o.lat, o.lon
  FROM app.observations o
  CROSS JOIN home_loc h
  WHERE o.lat IS NOT NULL AND o.lon IS NOT NULL
    AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
  ORDER BY o.bssid,
    public.st_distance(
      public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::public.geography,
      h.geog
    ) DESC
),
obs_centroids AS (
  SELECT
    o.bssid,
    ST_SetSRID(ST_MakePoint(AVG(o.lon), AVG(o.lat)), 4326)::geography AS centroid,
    MIN(o."time") AS first_time,
    MAX(o."time") AS last_time,
    COUNT(*) AS obs_count
  FROM app.observations o
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
  GROUP BY o.bssid
),
obs_spatial AS (
  SELECT
    c.bssid,
    ROUND(
      LEAST(1, GREATEST(0,
        (
          (1 - LEAST(MAX(ST_Distance(
            ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography,
            c.centroid
          )) / 500.0, 1)) * 0.5 +
          (1 - LEAST(EXTRACT(EPOCH FROM (c.last_time - c.first_time)) / 3600 / 168, 1)) * 0.3 +
          LEAST(c.obs_count / 50.0, 1) * 0.2
        )
      ))::numeric,
      3
    ) AS stationary_confidence
  FROM app.observations o
  JOIN obs_centroids c ON c.bssid = o.bssid
  WHERE o.lat IS NOT NULL
    AND o.lon IS NOT NULL
    AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
  GROUP BY c.bssid, c.centroid, c.first_time, c.last_time, c.obs_count
)
SELECT n.bssid,
  n.ssid,
  n.type,
  n.frequency,
  n.bestlevel AS signal,
  bo.lat,
  bo.lon,
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
  COALESCE(t.is_ignored, FALSE) AS is_ignored,
  count(o.id) AS observations,
  count(DISTINCT date(o."time")) AS unique_days,
  count(DISTINCT ((round((o.lat)::numeric, 3) || ','::text) || round((o.lon)::numeric, 3))) AS unique_locations,
  max(o.accuracy) AS accuracy_meters,
  min(o."time") AS first_seen,
  max(o."time") AS last_seen,
  CASE WHEN COALESCE(t.is_ignored, FALSE) THEN 0::numeric
       ELSE COALESCE(ts.final_threat_score, 0::numeric)
  END AS threat_score,
  CASE WHEN COALESCE(t.is_ignored, FALSE) THEN 'NONE'::character varying
       ELSE COALESCE(ts.final_threat_level, 'NONE'::character varying)
  END AS threat_level,
  ts.model_version,
  COALESCE(
    public.st_distance(
      public.st_setsrid(public.st_makepoint(bo.lon, bo.lat), 4326)::public.geography,
      (SELECT geog FROM home_loc)
    ) / 1000.0::double precision,
    0::double precision
  ) AS distance_from_home_km,
  COALESCE(
    public.st_distance(
      public.st_setsrid(public.st_makepoint(
        ST_XMin(ST_Extent(public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::geometry)),
        ST_YMin(ST_Extent(public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::geometry))
      ), 4326)::public.geography,
      public.st_setsrid(public.st_makepoint(
        ST_XMax(ST_Extent(public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::geometry)),
        ST_YMax(ST_Extent(public.st_setsrid(public.st_makepoint(o.lon, o.lat), 4326)::geometry))
      ), 4326)::public.geography
    ),
    0
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
  LEFT JOIN best_obs bo ON (n.bssid = bo.bssid)
WHERE (o.lat IS NOT NULL AND o.lon IS NOT NULL)
  AND (o.is_quality_filtered = false OR o.is_quality_filtered IS NULL)
GROUP BY n.bssid, n.ssid, n.type, n.frequency, n.bestlevel,
  n.lasttime_ms, n.capabilities, n.wigle_v3_observation_count, n.wigle_v3_last_import_at,
  w3.wigle_v3_observation_count, w3.wigle_v3_last_import_at,
  t.threat_tag, t.is_ignored,
  ts.final_threat_score, ts.final_threat_level, ts.model_version,
  rm.manufacturer, s.stationary_confidence, bo.lat, bo.lon
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_network_explorer_mv_bssid
  ON app.api_network_explorer_mv USING btree (bssid);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_type
  ON app.api_network_explorer_mv USING btree (type);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_observed_at
  ON app.api_network_explorer_mv USING btree (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_threat
  ON app.api_network_explorer_mv USING btree (threat_score DESC);
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_stationary
  ON app.api_network_explorer_mv USING btree (stationary_confidence)
  WHERE stationary_confidence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_ignored
  ON app.api_network_explorer_mv USING btree (is_ignored)
  WHERE is_ignored = TRUE;

COMMENT ON MATERIALIZED VIEW app.api_network_explorer_mv IS
  'Network explorer view - excludes quality-filtered observations. is_ignored=TRUE networks have threat_score=0 and threat_level=NONE. Includes pre-computed stationary confidence.';

GRANT SELECT ON app.api_network_explorer_mv TO grafana_reader;
GRANT SELECT ON app.api_network_explorer_mv TO shadowcheck_user;

REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;

-- ============================================================================
-- Folded from: 20260325_regrant_app_schema_permissions.sql
-- ============================================================================
GRANT USAGE ON SCHEMA app TO shadowcheck_user;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO shadowcheck_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO shadowcheck_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO shadowcheck_user;

DO $$
DECLARE
    mv RECORD;
BEGIN
    FOR mv IN
        SELECT schemaname, matviewname
        FROM pg_matviews
        WHERE schemaname = 'app'
    LOOP
        EXECUTE format(
            'GRANT SELECT ON %I.%I TO shadowcheck_user',
            mv.schemaname,
            mv.matviewname
        );
    END LOOP;
END
$$;

DO $$
DECLARE
    mv RECORD;
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'grafana_reader') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA app TO grafana_reader';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA app TO grafana_reader';
        EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO grafana_reader';
        EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO grafana_reader';

        FOR mv IN
            SELECT schemaname, matviewname
            FROM pg_matviews
            WHERE schemaname = 'app'
        LOOP
            EXECUTE format(
                'GRANT SELECT ON %I.%I TO grafana_reader',
                mv.schemaname,
                mv.matviewname
            );
        END LOOP;
    END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_api_network_explorer_mv_ssid_trgm
  ON app.api_network_explorer_mv USING gin (ssid gin_trgm_ops);
