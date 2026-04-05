# Reference Dataset Contract

This note records the actual source-of-truth and bootstrap expectations for the
reference datasets that the application treats as present.

It exists because the current Phase 3 baseline validation exposed a gap between:

- schema creation in the canonical migration path
- actual data population required by the app

## Best-Practice Rule

Each reference dataset must have one explicit contract:

1. canonical migration/seed data
2. canonical post-bootstrap ETL loader

Anything else is operational drift and should be treated as a bug.

## Dataset Inventory

### `app.radio_manufacturers`

Current app expectation:

- required for manufacturer joins in explorer, filtering, threat scoring, and Grafana
- current live DB contains ~74k rows

Current repo reality:

- bootstrap creates only a table shell in [`sql/init/00_bootstrap.sql`](/home/dbcooper/repos/shadowcheck-web/sql/init/00_bootstrap.sql)
- older historical migration [`create_radio_manufacturers.sql`] existed only as schema creation
- standardization logic exists in `20260323_standardize_radio_manufacturers.sql` (now folded)
- no canonical row-source file or loader is present in the current repo tree

Status:

- schema contract exists
- population contract is missing

Required fix:

- choose one canonical population path and encode it in repo:
  - preferred for this dataset: migration-owned seed/import artifact under `sql/`
  - alternative: explicit ETL loader plus documented mandatory post-bootstrap step

Promotion blocker:

- Phase 3 baseline cannot be considered production-ready until the repo contains a reproducible radio manufacturer population path

### `app.agency_offices`

Current app expectation:

- used as a geospatial infrastructure/reference dataset
- current live DB contains ~391 rows

Current repo reality:

- schema comes from [`sql/migrations/20260216_consolidated_007_agency_offices.sql`](/home/dbcooper/repos/shadowcheck-web/sql/migrations/20260216_consolidated_007_agency_offices.sql)
- data is populated by ETL/load scripts such as:
  - [`etl/load/fbi-locations.ts`](/home/dbcooper/repos/shadowcheck-web/etl/load/fbi-locations.ts)
  - [`etl/load/fbi-field-offices-gov.ts`](/home/dbcooper/repos/shadowcheck-web/etl/load/fbi-field-offices-gov.ts)
  - [`etl/load/fbi-resident-agencies-gov.ts`](/home/dbcooper/repos/shadowcheck-web/etl/load/fbi-resident-agencies-gov.ts)
  - training facility loader(s) in `etl/load/`

Status:

- schema contract exists
- population contract exists, but it is ETL-owned rather than migration-owned

Recommended treatment:

- keep ETL-owned
- document it as a required post-bootstrap reference-data load for any fresh environment that needs full geospatial intelligence features

### `app.federal_courthouses`

Current app expectation:

- used as a geospatial infrastructure/reference dataset
- current live DB contains 357 rows

Current repo reality:

- a self-contained schema + data script exists in
  [`server/src/db/migrations/create_federal_courthouses.sql`](/home/dbcooper/repos/shadowcheck-web/server/src/db/migrations/create_federal_courthouses.sql)
- the script creates the table, indexes, trigger, and inserts the courthouse rows
- the script is outside the canonical `sql/migrations` runner path

Status:

- schema contract exists
- population contract exists
- canonical ownership is wrong

Required fix:

- move this into the canonical migration/seed story for fresh bootstrap
- interim Phase 3 entrypoint now exists at
  [`sql/seeds/02_reference_federal_courthouses.sql`](/home/dbcooper/repos/shadowcheck-web/sql/seeds/02_reference_federal_courthouses.sql)

## Phase 3 Decision

For the baseline refresh, use this ownership model:

- `radio_manufacturers`: canonical seed/import artifact under `sql/`
- `agency_offices`: canonical ETL post-bootstrap load
- `federal_courthouses`: canonical migration/seed under `sql/migrations` or `sql/seeds`

## Next Concrete Work

1. Recover or recreate the canonical `radio_manufacturers` source artifact.
2. Fully re-home `federal_courthouses` payload under `sql/` rather than a wrapper.
3. Add a validation checklist that distinguishes:
   - fresh schema bootstrap
   - required reference-data load
   - SQLite observation import
