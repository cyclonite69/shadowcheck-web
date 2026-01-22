# Observations Rebuild Pipeline (SQLite Ground Truth)

This pipeline rebuilds observations from scratch using the latest SQLite-derived
location and radio data. It creates a new `observations_v2` table and does not
modify the legacy `observations` table.

## Sources of Truth

- `staging_locations_all_raw`: loaded directly from SQLite `location` tables.
- `staging_networks`: loaded from SQLite-derived network CSVs.

## Steps

1. Ensure schema prerequisites are applied:
   - `etl/01_schema/01_create_extensions.sql`
   - `etl/01_schema/02_create_postgis_extensions.sql`
   - `etl/01_schema/03_create_staging_tables.sql`
   - `etl/01_schema/04_create_raw_locations.sql`
   - `etl/01_schema/07_create_observations_v2.sql`
2. Load raw locations from SQLite:
   - `etl/00_extract_locations_from_sqlite.sh`
3. Load SQLite-derived network metadata:
   - `etl/run_networks_etl.sh` or the per-device loaders in `etl/02_load/`
4. Rebuild observations:
   - `etl/04_promote/05_rebuild_observations_v2.sql`

## Notes

- No Phase 4 alignment/enrichment is used.
- `observations_v2` is fully rebuilt each run via `TRUNCATE` + insert.
