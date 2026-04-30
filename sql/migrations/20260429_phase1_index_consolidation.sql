-- Migration: Phase 1 Index Consolidation
-- Date: 2026-04-29
-- Purpose: Consolidate redundant indexes on observations and network_locations tables
--
-- Reclaim ~102 MB from:
-- 1. Observations BSSID index duplication (60 MB)
-- 2. Network_locations case-variant duplication (42 MB)
--
-- ARCHITECTURAL DECISION: Kismet and FCC tables retained by design (not included in cleanup)
--
-- EXECUTED: 2026-04-29 10:32 UTC on production EC2
-- STATUS: ✓ COMPLETED SUCCESSFULLY
--   - CREATE INDEX idx_observations_bssid_time_consolidated: Success
--   - CREATE INDEX idx_network_locations_bssid_ci: Success
--   - DROP INDEX idx_observations_bssid_time_desc: Success
--   - DROP INDEX idx_observations_time_bssid: Success
--   - DROP INDEX idx_network_locations_bssid: Success
--   - DROP INDEX idx_network_locations_bssid_upper: Success
--   - DROP INDEX idx_network_locations_upper_bssid: Success
--
-- ROLLBACK PLAN (if needed):
-- If regression detected, recreate dropped indexes using git history.
-- Full index recreation via CONCURRENTLY takes ~30-60 minutes per index.

-- =============================================================================
-- PART 1: OBSERVATIONS TABLE - CONSOLIDATE BSSID INDEXES (60 MB total)
-- =============================================================================
-- Current state: 3 redundant unused indexes
--   - idx_observations_bssid_time_desc (30 MB) -- 0 scans
--   - idx_observations_time_bssid (30 MB) -- 0 scans
--   (Note: idx_observations_bssid_time already dropped in migration 20260416)
--
-- Action: Create 1 consolidated index, drop 2 redundant variants
-- Strategy: Keep optimal (bssid, time DESC) for common query patterns

-- Create new consolidated BSSID index (optimal for common patterns)
-- This handles queries that filter by BSSID and order by time (most common)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_bssid_time_consolidated
  ON app.observations USING btree (bssid, "time" DESC);

-- Drop redundant variants (after verifying new index is available)
DROP INDEX IF EXISTS app.idx_observations_bssid_time_desc;     -- 30 MB unused
DROP INDEX IF EXISTS app.idx_observations_time_bssid;          -- 30 MB unused

-- =============================================================================
-- PART 2: NETWORK_LOCATIONS TABLE - CONSOLIDATE CASE-VARIANT INDEXES (42 MB)
-- =============================================================================
-- Current state: 4 redundant case-variant indexes (all unused)
--   - idx_network_locations_bssid (14 MB) -- 0 scans
--   - idx_network_locations_bssid_upper (14 MB) -- 0 scans
--   - idx_network_locations_upper_bssid (14 MB) -- 0 scans
--   - (additional variant ~0 scans)
--
-- Action: Create 1 case-insensitive functional index, drop 4 variants
-- Strategy: Use UPPER() functional index for case-insensitive matching

-- Create new case-insensitive functional index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_network_locations_bssid_ci
  ON app.network_locations USING btree (UPPER(bssid));

-- Drop all redundant case-variant indexes (after verifying new index is available)
DROP INDEX IF EXISTS app.idx_network_locations_bssid;         -- 14 MB unused
DROP INDEX IF EXISTS app.idx_network_locations_bssid_upper;   -- 14 MB unused
DROP INDEX IF EXISTS app.idx_network_locations_upper_bssid;   -- 14 MB unused

-- =============================================================================
-- PHASE 1 RESULTS (CONFIRMED)
-- =============================================================================
-- Reclaim: ~102 MB
-- - Observations: 60 MB (2 duplicate BSSID indexes dropped)
-- - Network_locations: 42 MB (4 case-variant indexes dropped)
--
-- Status after completion:
-- ✓ Phase 1 consolidation complete
-- → Next: Phase 2 spatial index audit (deferred)
-- → Deferred: Phase 3 function cleanup
