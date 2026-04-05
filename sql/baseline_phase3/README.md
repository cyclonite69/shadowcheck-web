# Phase 3 Baseline Assembly

This directory holds the Phase 3 migration assembly files for the baseline refresh.

These files are intentionally outside [`sql/migrations`](/home/dbcooper/repos/shadowcheck-web/sql/migrations)
so the canonical runner does not apply them yet.

Unlike the Phase 2 drafts in [`sql/baseline_drafts`](/home/dbcooper/repos/shadowcheck-web/sql/baseline_drafts),
these files are concrete `psql` assembly artifacts. Each file uses `\ir` to include the
current fold-candidate migrations in the exact order that would be promoted during the
eventual switchover.

## Safety

- Not active in `sql/run-migrations.sh`
- No archive or delete step has happened yet
- Existing fresh-bootstrap and upgrade behavior is unchanged

## Assembly Mapping

1. `baseline_001_extensions_auth_schema.sql`
   - `20260216_consolidated_001_extensions_and_schemas.sql`
   - `20260216_consolidated_003_auth_and_users.sql`
2. `baseline_002_core_tables.sql`
   - `20260216_consolidated_002_core_tables.sql`
   - `20260216_consolidated_004_network_analysis.sql`
   - `20260216_consolidated_005_ml_and_scoring.sql`
3. `baseline_003_external_and_reference.sql`
   - `20260216_consolidated_006_wigle_integration.sql`
   - `20260216_consolidated_007_agency_offices.sql`
4. `baseline_004_functions_and_triggers.sql`
   - `20260216_consolidated_009_functions_and_triggers.sql`
   - `20260331_consolidated_011.sql`
5. `baseline_005_analysis_views_materialized_views.sql`
   - `20260216_consolidated_008_views_and_materialized_views.sql`
   - `20260331_consolidated_012_mv_centroid_fields.sql`
6. `baseline_006_indexes_grants_defaults.sql`
   - `20260216_consolidated_010_performance_indexes.sql`
7. `baseline_007_runtime_contracts.sql`
   - `20260404_add_geocoding_to_api_network_explorer_mv.sql`
   - `20260404_add_networks_orphans_table.sql`
   - `20260405_add_orphan_network_backfill_tracking.sql`

## Important Caveat

The source migrations are mixed-purpose files. This Phase 3 set is therefore an
assembly layer, not a fully re-homed statement split yet. For example:

- auth tables and `app.schema_migrations` still arrive through baseline 001
- some ML-related functions still arrive through baseline 002 because migration 005 mixes tables and functions
- migration 011 currently lands in baseline 004 because later views/materialized
  views depend on `app.network_locations` and other fold-tail objects it creates

That is acceptable for the Phase 3 assembly step because the goal here is to create
concrete baseline files, preserve fold coverage, and make the later archive/switchover
mechanical instead of ambiguous.

The April 2026 runtime-contract migrations now remain explicit in
[`baseline_007_runtime_contracts.sql`](/home/dbcooper/repos/shadowcheck-web/sql/baseline_phase3/baseline_007_runtime_contracts.sql)
instead of being implied by the older consolidated set. Validation must include
that file so the assembled baseline matches current app behavior.

## Promotion Rules

Before any promotion into [`sql/migrations`](/home/dbcooper/repos/shadowcheck-web/sql/migrations):

- fresh empty DB bootstrap must pass
- required reference-data loading must be explicit and reproducible
- local restore via `scripts/restore-local-backup.sh` must pass
- existing populated DB upgrade must pass
- `sql/seed-migrations-tracker.sql` must be updated with the promoted filenames
- superseded fold-candidate files must be archived in the same controlled step

## Reference Data

Phase 3 validation must now treat reference datasets as a separate concern from
schema bootstrap:

- `app.federal_courthouses`
  - canonical seed entrypoint: [`sql/seeds/02_reference_federal_courthouses.sql`](/home/dbcooper/repos/shadowcheck-web/sql/seeds/02_reference_federal_courthouses.sql)
- `app.agency_offices`
  - canonical ETL-owned dataset under [`etl/load/`](/home/dbcooper/repos/shadowcheck-web/etl/load)
- `app.radio_manufacturers`
  - still missing a canonical population artifact and therefore still a promotion blocker
