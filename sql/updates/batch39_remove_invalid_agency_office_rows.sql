-- Batch 39: Remove invalid/duplicate agency_offices rows that were blocking backfill completion
-- See: docs/notes/agency_offices_removed_invalid_rows_2026-02-06.md

BEGIN;

DELETE FROM app.agency_offices WHERE id IN (720, 750);

COMMIT;

