\echo 'Phase 3 baseline 006: indexes, grants, and defaults'

-- Concrete assembly artifact for the baseline refresh.
-- Not part of sql/run-migrations.sh yet.
-- Migration 011 moved earlier into baseline 004 because later views/materialized
-- views depend on objects it creates.

\ir ../migrations/20260216_consolidated_010_performance_indexes.sql
