\echo 'Phase 3 baseline 004: functions, triggers, and fold-tail dependency objects'

-- Concrete assembly artifact for the baseline refresh.
-- Not part of sql/run-migrations.sh yet.
--
-- Why migration 011 is here:
-- views/materialized views depend on functions such as app.network_has_tag()
-- from 009 and on fold-tail objects such as app.network_locations from 011.
-- Keeping 011 later makes the executable baseline order invalid.

\ir ../migrations/20260216_consolidated_009_functions_and_triggers.sql
\ir ../migrations/20260331_consolidated_011.sql
