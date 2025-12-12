# Migration Guidance (Canonical Order & Duplicates)

This repo has accumulated overlapping SQL files. Use the order below to avoid schema conflicts and skip deprecated duplicates. Numbering/timestamps are planned; until then, run in this sequence.

## Canonical Base Sequence

1. `00_init_schema.sql`
2. `01_create_import_schema.sql`
3. `01_add_minimum_required_columns.sql`
4. `02_create_mvs_and_imports_table.sql`
5. `03_fix_location_markers_schema.sql`
6. `100_enforce_uppercase_ssid_public.sql` (supersedes 00/99 uppercase files)
7. `101_enforce_uppercase_bssid.sql`
8. `create_uuid_tracking.sql`
9. `create_tracking_dashboard.sql`
10. `create_network_aggregation_triggers.sql`
11. `create_trilateration_trigger.sql`
12. `add_performance_indexes.sql`
13. `migrate_network_tags_v2.sql`

## Optional / Enrichment & Analytics (run after base)

- `add_trilat_to_networks.sql`
- `add_trilateration_enrichment.sql`
- `populate_ap_locations.sql`
- `classify_device_types.sql`, `classify_government_networks.sql`
- `detect_colocation.sql`, `detect_suspicious_duplicates.sql`, `contextual_classification.sql`, `contextual_queries.sql`
- `add_business_names.sql`, `add_geocode_enrichment.sql`, `extract_business_from_ssid.sql`
- `add_ml_threat_score.sql`
- `create_ml_model_table.sql`
- `create_colocation_view.sql`, `uuid_tracking_queries.sql`

## Functions / Helpers

- Use migration versions of shared functions: `create_scoring_function.sql`, `fix_kismet_functions.sql` (same names exist under `sql/functions/`; prefer the migration copies or reference the function files explicitly—avoid running both).

## Deprecated / Do Not Run

- `00_create_legacy_tables.sql` (legacy bootstrap)
- `00_enforce_uppercase_ssid.sql` and `99_enforce_uppercase_ssid.sql` (superseded by `100_enforce_uppercase_ssid_public.sql`)

## Next Steps (future clean-up)

- Rename migrations to timestamped files for strict ordering (e.g., `20251211_0001_init_schema.sql`, etc.).
- Move deprecated files into `sql/migrations/archive/` after confirming no environments depend on them.
- Update ETL/enrichment migrations as they evolve—add them after the optional block above.

This guidance keeps one canonical path to a consistent schema while we refactor the React/Vite front-end and retain legacy HTML until parity is reached.
