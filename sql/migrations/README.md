# Migration Guidance

`sql/migrations/` now contains the canonical 10-file consolidated sequence:

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

`sql/run-migrations.sh` applies these in filename sort order and tracks applied files in `app.schema_migrations`.

Later compatibility migrations that were briefly left active after the initial consolidation have also been folded back into the canonical files and moved under `sql/migrations/_archived/`.

Active fresh-install path: 10 consolidated migrations.
Archived reference path: original incremental migrations plus superseded compatibility/backfill migrations.
