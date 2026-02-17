# Archived Migrations

These 77 migration files are the **original incremental migrations** that were applied to the database over months of development. They have been superseded by the 10 consolidated baseline files in the parent directory (`20260216_consolidated_*.sql`).

## Why archived?

Many of these files are:

- **Superseded versions** (7 threat MV iterations, 4 uppercase SSID files later reverted)
- **One-off fixes** that are now incorporated into the final schema
- **Schema moves** (public → app) that only make sense on the original DB

Running all 77 in order on a fresh database would cause conflicts, apply then revert changes, and create dead objects. The 10 consolidated files represent the **final desired schema** derived from `pg_dump --schema-only` of the live database.

## For existing deployments

These files are already tracked in `app.schema_migrations`. The seed tracker (`sql/seed-migrations-tracker.sql`) marks both the old 77 and new 10 consolidated files as applied, so the migration runner skips all of them.

## Consolidated on: 2026-02-16
