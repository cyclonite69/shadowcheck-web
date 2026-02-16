-- Migration: Create Materialized Views + Imports Tracking Table
-- This replaces trigger-based computed columns with MVs for better import performance
-- Date: 2025-12-03

-- ============================================================================
-- PART 1: CREATE IMPORTS TRACKING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.imports (
  import_id BIGSERIAL PRIMARY KEY,
  source_file TEXT NOT NULL,
  import_type TEXT NOT NULL, -- 'wigle', 'kismet', 'manual'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'failed'
  total_records INTEGER DEFAULT 0,
  imported_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  metadata JSONB, -- Store import stats, errors, etc.
  created_by TEXT DEFAULT CURRENT_USER
);

CREATE INDEX IF NOT EXISTS idx_imports_status ON app.imports(status);
CREATE INDEX IF NOT EXISTS idx_imports_started_at ON app.imports(started_at DESC);

-- ============================================================================
-- PART 2: DROP OLD TRIGGER (we're moving to MVs)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_upsert_network_from_observation ON app.observations;
-- Keep the function for now in case we need it, but it won't auto-fire

-- ============================================================================
-- PART 3: CREATE MATERIALIZED VIEWS FOR COMPUTED FIELDS
-- ============================================================================

-- MV 1: Network Statistics (replaces bestlevel, bestlat, lasttime, etc.)
DROP MATERIALIZED VIEW IF EXISTS app.network_stats_mv CASCADE;
CREATE MATERIALIZED VIEW app.network_stats_mv AS
SELECT
  n.bssid,
  n.ssid,
  n.type,
  n.encryption,
  n.capabilities,
  n.frequency,
  n.channel,

  -- Signal statistics
  MAX(o.signal_dbm) AS bestlevel,
  AVG(o.signal_dbm) AS avg_signal,
  MIN(o.signal_dbm) AS min_signal,

  -- Location statistics (best = strongest signal)
  (SELECT o2.latitude FROM app.observations o2
   WHERE o2.bssid = n.bssid
     AND o2.latitude IS NOT NULL
     AND o2.signal_dbm IS NOT NULL
   ORDER BY o2.signal_dbm DESC, o2.observed_at DESC
   LIMIT 1) AS bestlat,
  (SELECT o2.longitude FROM app.observations o2
   WHERE o2.bssid = n.bssid
     AND o2.longitude IS NOT NULL
     AND o2.signal_dbm IS NOT NULL
   ORDER BY o2.signal_dbm DESC, o2.observed_at DESC
   LIMIT 1) AS bestlon,

  -- Last seen location
  (SELECT o2.latitude FROM app.observations o2
   WHERE o2.bssid = n.bssid AND o2.latitude IS NOT NULL
   ORDER BY o2.observed_at DESC LIMIT 1) AS lastlat,
  (SELECT o2.longitude FROM app.observations o2
   WHERE o2.bssid = n.bssid AND o2.longitude IS NOT NULL
   ORDER BY o2.observed_at DESC LIMIT 1) AS lastlon,

  -- Time statistics
  MIN(o.observed_at) AS first_seen,
  MAX(o.observed_at) AS last_seen,
  EXTRACT(EPOCH FROM MAX(o.observed_at))::BIGINT * 1000 AS lasttime,

  -- Observation counts
  COUNT(*) AS observation_count,
  COUNT(DISTINCT DATE(o.observed_at)) AS unique_days,
  COUNT(DISTINCT ST_SnapToGrid(ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geometry, 0.001)) AS unique_locations,

  -- Accuracy statistics
  AVG(o.accuracy_meters) AS avg_accuracy,
  MIN(o.accuracy_meters) AS best_accuracy

FROM app.networks n
LEFT JOIN app.observations o ON n.bssid = o.bssid
WHERE o.latitude IS NOT NULL
  AND o.longitude IS NOT NULL
  AND o.latitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
  AND o.longitude::text NOT IN ('Infinity', '-Infinity', 'NaN')
  AND o.latitude BETWEEN -90 AND 90
  AND o.longitude BETWEEN -180 AND 180
GROUP BY n.bssid, n.ssid, n.type, n.encryption, n.capabilities, n.frequency, n.channel;

-- Create unique index for fast lookups
CREATE UNIQUE INDEX idx_network_stats_mv_bssid ON app.network_stats_mv(bssid);
CREATE INDEX idx_network_stats_mv_bestlevel ON app.network_stats_mv(bestlevel) WHERE bestlevel IS NOT NULL;
CREATE INDEX idx_network_stats_mv_lasttime ON app.network_stats_mv(lasttime);
CREATE INDEX idx_network_stats_mv_type ON app.network_stats_mv(type);

-- ============================================================================
-- PART 4: CREATE THREAT ANALYSIS MV
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS app.threat_analysis_mv CASCADE;
CREATE MATERIALIZED VIEW app.threat_analysis_mv AS
WITH home_location AS (
  SELECT
    ST_SetSRID(location::geometry, 4326)::geography AS home_point,
    ST_X(location::geometry) AS home_lon,
    ST_Y(location::geometry) AS home_lat
  FROM app.location_markers
  WHERE marker_type = 'home'
  LIMIT 1
)
SELECT
  ns.bssid,
  ns.ssid,
  ns.type,
  ns.observation_count,
  ns.unique_days,
  ns.unique_locations,
  ns.bestlevel,
  ns.lasttime,

  -- Distance from home
  CASE
    WHEN h.home_point IS NOT NULL AND ns.bestlat IS NOT NULL AND ns.bestlon IS NOT NULL
    THEN ST_Distance(
      h.home_point,
      ST_SetSRID(ST_MakePoint(ns.bestlon, ns.bestlat), 4326)::geography
    ) / 1000.0
    ELSE NULL
  END AS distance_from_home_km,

  -- Check if seen at home
  CASE
    WHEN h.home_point IS NOT NULL
    THEN EXISTS (
      SELECT 1 FROM app.observations o
      WHERE o.bssid = ns.bssid
        AND ST_Distance(
          h.home_point,
          ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography
        ) < 100
      LIMIT 1
    )
    ELSE FALSE
  END AS seen_at_home,

  -- Check if seen away from home
  CASE
    WHEN h.home_point IS NOT NULL
    THEN EXISTS (
      SELECT 1 FROM app.observations o
      WHERE o.bssid = ns.bssid
        AND ST_Distance(
          h.home_point,
          ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography
        ) > 500
      LIMIT 1
    )
    ELSE FALSE
  END AS seen_away_from_home,

  -- Calculate threat score
  CASE WHEN h.home_point IS NOT NULL THEN
    (CASE WHEN EXISTS (
      SELECT 1 FROM app.observations o WHERE o.bssid = ns.bssid
      AND ST_Distance(h.home_point, ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography) < 100
    ) AND EXISTS (
      SELECT 1 FROM app.observations o WHERE o.bssid = ns.bssid
      AND ST_Distance(h.home_point, ST_SetSRID(ST_MakePoint(o.longitude, o.latitude), 4326)::geography) > 500
    ) THEN 40 ELSE 0 END) +
    (CASE WHEN ns.unique_locations > 3 THEN 25 ELSE 0 END) +
    (CASE WHEN ns.unique_days >= 7 THEN 15 WHEN ns.unique_days >= 3 THEN 10 WHEN ns.unique_days >= 2 THEN 5 ELSE 0 END) +
    (CASE WHEN ns.observation_count >= 50 THEN 10 WHEN ns.observation_count >= 20 THEN 5 ELSE 0 END)
  ELSE 0 END AS threat_score

FROM app.network_stats_mv ns
CROSS JOIN home_location h
WHERE ns.observation_count >= 2;

CREATE UNIQUE INDEX idx_threat_analysis_mv_bssid ON app.threat_analysis_mv(bssid);
CREATE INDEX idx_threat_analysis_mv_score ON app.threat_analysis_mv(threat_score DESC) WHERE threat_score >= 30;
CREATE INDEX idx_threat_analysis_mv_type ON app.threat_analysis_mv(type);

-- ============================================================================
-- PART 5: CREATE HELPER FUNCTION TO REFRESH ALL MVS
-- ============================================================================

CREATE OR REPLACE FUNCTION app.refresh_all_materialized_views()
RETURNS TABLE(view_name TEXT, refresh_duration INTERVAL) AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
BEGIN
  -- Refresh network_stats_mv
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY app.network_stats_mv;
  end_time := clock_timestamp();
  view_name := 'network_stats_mv';
  refresh_duration := end_time - start_time;
  RETURN NEXT;

  -- Refresh threat_analysis_mv
  start_time := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY app.threat_analysis_mv;
  end_time := clock_timestamp();
  view_name := 'threat_analysis_mv';
  refresh_duration := end_time - start_time;
  RETURN NEXT;

  RAISE NOTICE 'All materialized views refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VALIDATION
-- ============================================================================

SELECT 'Migration 02 complete: MVs created, imports table ready' AS status;
SELECT COUNT(*) AS networks_in_mv FROM app.network_stats_mv;
SELECT COUNT(*) AS threats_in_mv FROM app.threat_analysis_mv WHERE threat_score >= 30;
