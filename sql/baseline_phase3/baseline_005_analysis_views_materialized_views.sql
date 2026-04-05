\echo 'Phase 3 baseline 005: views and materialized views'

-- Concrete assembly artifact for the baseline refresh.
-- Not part of sql/run-migrations.sh yet.

\ir ../migrations/20260216_consolidated_008_views_and_materialized_views.sql
\ir ../migrations/20260331_consolidated_012_mv_centroid_fields.sql
