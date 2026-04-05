-- ============================================================================
-- Canonical seed entrypoint for app.federal_courthouses
-- ============================================================================
--
-- This dataset is static reference data and should be reproducible from the
-- canonical sql/ tree. The current source payload still lives in the historical
-- server migration below; this wrapper makes the seed path explicit for Phase 3
-- validation without yet changing the live migration runner.
--
-- Intended usage:
--   psql ... -f sql/seeds/02_reference_federal_courthouses.sql
--
-- Follow-up cleanup:
--   move the underlying SQL payload fully under sql/ during the eventual
--   migration/seed switchover.
-- ============================================================================

\ir ../../server/src/db/migrations/create_federal_courthouses.sql

-- Basic verification for operators running the seed manually.
SELECT COUNT(*) AS federal_courthouse_count FROM app.federal_courthouses;
