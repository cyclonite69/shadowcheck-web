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
