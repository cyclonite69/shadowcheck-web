-- PostgreSQL 18 + PostGIS performance optimizations for ARM (t4g.large, 2 vCPU, 8GB RAM)
--
-- Targets:
--   - BRIN indexes for time-series scans
--   - Covering indexes to avoid heap lookups
--   - Partial indexes for hot query paths
--   - Statistics targets for better query plans
--
-- Run as: docker exec -i shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db -f /sql/migrations/20260215_postgres18_postgis_optimizations.sql
-- Note: Database-level settings moved to sql/init/00_bootstrap.sql (environment config)
-- This migration only contains schema objects (indexes, statistics)
-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block

-- ============================================================
-- 1. BRIN Indexes for Time-Series Data
-- ============================================================
-- BRIN indexes are tiny (< 1MB) and perfect for time-ordered data.
-- They work by storing min/max per block range — ideal for sequential inserts.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_time_brin
    ON app.observations USING brin (time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_observed_at_ms_brin
    ON app.observations USING brin (observed_at_ms);

-- ============================================================
-- 2. Covering Indexes (avoid heap lookups)
-- ============================================================
-- network_entries view joins on bssid and selects ssid, type, bestlevel, lasttime_ms.
-- A covering index lets the view resolve entirely from the index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_networks_bssid_covering
    ON app.networks (bssid)
    INCLUDE (ssid, type, bestlevel, lasttime_ms);

-- Recent observations covering index — the most common query pattern
-- is time-descending per BSSID with lat/lon/level/accuracy columns.
-- Uses fixed date (must be recreated periodically to stay current).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_recent_covering
    ON app.observations (time DESC, bssid)
    INCLUDE (lat, lon, level, accuracy)
    WHERE time > '2026-01-15'::timestamptz;

-- ============================================================
-- 3. Partial Index for Hot Queries
-- ============================================================
-- Geospatial and threat queries filter on accuracy < 100m and recent data.
-- Uses fixed date (must be recreated periodically to stay current).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_high_accuracy_recent
    ON app.observations (bssid, time DESC)
    WHERE accuracy < 100 AND time > '2025-11-15'::timestamptz;

-- ============================================================
-- 4. GIST Index Optimization
-- ============================================================
-- Tune existing GIST indexes for better insert/query balance.
-- buffering=auto lets PostgreSQL decide per-insert whether to buffer.
-- fillfactor=90 leaves room for nearby inserts without page splits.
ALTER INDEX app.idx_obs_geom_gist SET (buffering = auto, fillfactor = 90);
ALTER INDEX app.idx_observations_geom_gist SET (buffering = auto, fillfactor = 90);

-- ============================================================
-- 5. Statistics Targets
-- ============================================================
-- Higher stats = better query plans for skewed distributions.
-- bssid has 41K+ distinct values; time has high cardinality.
ALTER TABLE app.observations ALTER COLUMN bssid SET STATISTICS 1000;
ALTER TABLE app.observations ALTER COLUMN time SET STATISTICS 1000;
ALTER TABLE app.networks ALTER COLUMN ssid SET STATISTICS 500;
ALTER TABLE app.networks ALTER COLUMN bssid SET STATISTICS 500;

-- Refresh statistics with new targets
ANALYZE app.observations;
ANALYZE app.networks;

-- ============================================================
-- 6. Future: Geography Conversion
-- ============================================================
-- observations.geom is geometry(Point,4326) — fine for rendering but
-- ST_Distance returns degrees, not meters. For accurate distance-based
-- threat detection, convert to geography(Point,4326) which uses meters.
COMMENT ON COLUMN app.observations.geom IS
    'Geometry point (SRID 4326). TODO: convert to geography(Point,4326) for meter-based ST_Distance calculations in threat scoring.';
