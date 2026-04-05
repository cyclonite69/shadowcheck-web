\echo 'Phase 3 baseline 003: external evidence and reference datasets'

-- Concrete assembly artifact for the baseline refresh.
-- Not part of sql/run-migrations.sh yet.

\ir ../migrations/20260216_consolidated_006_wigle_integration.sql
\ir ../migrations/20260216_consolidated_007_agency_offices.sql

-- Bootstrap creates app.radio_manufacturers with prefix_24bit but not the later
-- compatibility column name "prefix" that fold-tail views and MVs expect.
ALTER TABLE app.radio_manufacturers
  ADD COLUMN IF NOT EXISTS prefix TEXT GENERATED ALWAYS AS (prefix_24bit) STORED;
