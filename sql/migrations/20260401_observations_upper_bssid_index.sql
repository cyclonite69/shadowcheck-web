-- Migration: Add functional index for UPPER(bssid) to fix observation query performance
-- 
-- Problem: Queries using UPPER(o.bssid) = ANY(...) were doing full table scans (316ms)
-- instead of using the btree index on bssid (2.6ms with direct comparison).
-- 
-- Solution: Create a functional index on UPPER(bssid) so the optimizer can use it
-- when the query also uses UPPER() in the WHERE clause.
--
-- This allows: UPPER(o.bssid) = ANY(array_of_uppercase_values)
-- to use the index instead of scanning all 606K rows.

BEGIN;

-- Create functional index for UPPER(bssid) lookups on observations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observations_upper_bssid 
  ON app.observations (UPPER(bssid));

-- Create functional index for UPPER(bssid) lookups on network_locations  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_network_locations_upper_bssid
  ON app.network_locations (UPPER(bssid));

-- Note: api_network_explorer_mv is a materialized view, so functional indexes
-- may need to be on the underlying tables. The JOINs with this MV will still
-- benefit from the functional indexes on observations table.

COMMIT;
