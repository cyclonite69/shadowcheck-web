# Migration Guidance

`sql/run-migrations.sh` is the canonical migration entrypoint. It applies every
`*.sql` file in [`sql/migrations`](/home/dbcooper/repos/shadowcheck-web/sql/migrations)
in filename sort order and tracks applied files in `app.schema_migrations`.

Fresh installs must use the full active sequence currently present in this
directory, not just the original consolidated 2026-02-16 baseline files. The
follow-on migrations are part of the live schema contract.

Current active path:

1. `20260216_consolidated_001_extensions_and_schemas.sql`
2. `20260216_consolidated_002_core_tables.sql`
3. `20260216_consolidated_003_auth_and_users.sql`
4. `20260216_consolidated_004_network_analysis.sql`
5. `20260216_consolidated_005_ml_and_scoring.sql`
6. `20260216_consolidated_006_wigle_integration.sql`
7. `20260216_consolidated_007_agency_offices.sql`
8. `20260216_consolidated_008_views_and_materialized_views.sql`
9. `20260216_consolidated_009_functions_and_triggers.sql`
10. `20260216_consolidated_010_performance_indexes.sql`
11. `20260331_consolidated_011.sql`
12. `20260331_consolidated_012_mv_centroid_fields.sql`
13. `20260401_observations_upper_bssid_index.sql`
14. `20260402_add_kml_staging_tables.sql`
15. `20260403_add_anchor_points.sql`
16. `20260403_fix_api_network_explorer_distance_from_home.sql`
17. `20260404_align_kml_staging_permissions.sql`
18. `20260404_backfill_networks_from_child_tables.sql`
19. `20260404_retarget_bssid_fks_to_networks.sql`
20. `20260404_drop_access_points.sql`
21. `20260404_add_geocoding_to_api_network_explorer_mv.sql`
22. `20260404_add_networks_orphans_table.sql`
23. `20260405_add_orphan_network_backfill_tracking.sql`

## Baseline Refresh Plan

Phase 1 is planning only. Do not archive or delete active migrations yet.

### Recommended Cut Line

Fold candidates stop at:

- `20260331_consolidated_012_mv_centroid_fields.sql`

Keep these additive for now:

- `20260401_observations_upper_bssid_index.sql`
- `20260402_add_kml_staging_tables.sql`
- `20260403_add_anchor_points.sql`
- `20260403_fix_api_network_explorer_distance_from_home.sql`
- `20260404_align_kml_staging_permissions.sql`
- `20260404_backfill_networks_from_child_tables.sql`
- `20260404_retarget_bssid_fks_to_networks.sql`
- `20260404_drop_access_points.sql`
- `20260404_add_geocoding_to_api_network_explorer_mv.sql`
- `20260404_add_networks_orphans_table.sql`
- `20260405_add_orphan_network_backfill_tracking.sql`

### Draft Refreshed Baseline Shape

Use a refreshed baseline set rather than a single mega-file:

1. `baseline_001_extensions_auth_schema.sql`
2. `baseline_002_core_tables.sql`
3. `baseline_003_external_and_reference.sql`
4. `baseline_004_analysis_views_materialized_views.sql`
5. `baseline_005_functions_and_triggers.sql`
6. `baseline_006_indexes_grants_defaults.sql`
7. `baseline_007_runtime_contracts.sql`

### Fold Candidates

These are the current candidates for a refreshed baseline fold:

1. `20260216_consolidated_001_extensions_and_schemas.sql`
2. `20260216_consolidated_002_core_tables.sql`
3. `20260216_consolidated_003_auth_and_users.sql`
4. `20260216_consolidated_004_network_analysis.sql`
5. `20260216_consolidated_005_ml_and_scoring.sql`
6. `20260216_consolidated_006_wigle_integration.sql`
7. `20260216_consolidated_007_agency_offices.sql`
8. `20260216_consolidated_008_views_and_materialized_views.sql`
9. `20260216_consolidated_009_functions_and_triggers.sql`
10. `20260216_consolidated_010_performance_indexes.sql`
11. `20260331_consolidated_011.sql`
12. `20260331_consolidated_012_mv_centroid_fields.sql`

### Verification Gates Before Any Archive Step

All of these must pass before phase 2:

- fresh empty DB bootstrap
- required reference-data load path is explicit and reproducible
- local restore via `scripts/restore-local-backup.sh`
- manual migration from an existing populated database
- `app.api_network_explorer_mv` contains centroid and `geocoded_*` columns
- `app.networks_orphans` exists
- `app.orphan_network_backfills` exists
- app login works with runtime grants
- SQLite import succeeds
- orphan admin panel works

Reference-data expectation during validation:

- `app.federal_courthouses` should load from
  [`sql/seeds/02_reference_federal_courthouses.sql`](/home/dbcooper/repos/shadowcheck-web/sql/seeds/02_reference_federal_courthouses.sql)
- `app.agency_offices` remains ETL-owned and should be validated separately from schema bootstrap
- `app.radio_manufacturers` still lacks a canonical repo-owned population artifact and remains a blocker for final promotion

### Phase 2 Preconditions

Do not archive older files until all of the following are in place:

- refreshed baselines exist
- `sql/seed-migrations-tracker.sql` is updated
- deploy docs/scripts are updated for the new baseline story
- local and EC2-like proofs are recorded

### Phase 3 Artifacts

Phase 3 assembly files now live in [`sql/baseline_phase3`](/home/dbcooper/repos/shadowcheck-web/sql/baseline_phase3).

They are intentionally outside the live runner path. Their purpose is to turn the
Phase 2 draft split into concrete executable `psql` artifacts without yet changing
fresh-bootstrap or upgrade behavior.

Current Phase 3 mapping:

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

This mapping preserves complete fold coverage through the current cut line while
making the future archive/switchover step explicit.
