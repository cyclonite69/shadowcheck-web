\echo 'Phase 3 baseline 002: core tables and schema-heavy application objects'

-- Concrete assembly artifact for the baseline refresh.
-- Not part of sql/run-migrations.sh yet.
-- Source migration 005 mixes tables and functions, so this baseline intentionally
-- carries both until the final re-homing/archive step.

\ir ../migrations/20260216_consolidated_002_core_tables.sql
\ir ../migrations/20260216_consolidated_004_network_analysis.sql
\ir ../migrations/20260216_consolidated_005_ml_and_scoring.sql
