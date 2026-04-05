# Seed Guidance

`sql/seeds` holds reproducible, intentional data loads that are not part of the
default `sql/run-migrations.sh` schema path.

Use this directory for data that should be present in a fully prepared
environment, but which is operationally distinct from core schema DDL.

## Current Seed Ownership

### Migration-owned / SQL-owned

- `01_create_admin_user.sql`
  - fallback-only bootstrap helper
- `02_reference_federal_courthouses.sql`
  - canonical seed entrypoint for the static `app.federal_courthouses` dataset

### ETL-owned

- `app.agency_offices`
  - loaded by ETL under [`etl/load/`](/home/dbcooper/repos/shadowcheck-web/etl/load)
  - not treated as a static SQL seed because the data is curated and refreshed by
    source-specific loaders

### Missing Canonical Source

- `app.radio_manufacturers`
  - application-critical dataset
  - schema exists in bootstrap/migrations
  - canonical population artifact is still missing from the repo
  - Phase 3 promotion remains blocked until this dataset has either:
    - a canonical SQL seed/import artifact under `sql/`, or
    - a canonical ETL loader plus documented mandatory post-bootstrap step

## Reference Validation Order

For fresh Phase 3 validation, treat the work as three separate steps:

1. schema bootstrap and migration replay
2. required reference-data load
3. SQLite observation import and application verification

Do not treat step 3 as evidence that step 2 is solved.
