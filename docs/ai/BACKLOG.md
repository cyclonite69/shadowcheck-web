# Known Debt

Items confirmed as pre-existing or deferred. Pick these up as standalone tasks — do not fix them opportunistically while working on something else.

---

## Test Failures (pre-existing)

- [ ] `adminImport.test.ts`: 6 spawn/fs mock failures — `import-sqlite` (successful import, import process error, kismet import), `import-sql` (sql import error), `import-kml` (payload parsing fails, process spawn error). Root cause: child process and temp-directory mocking not wired up correctly. Unrelated to route paths.

## UI / Frontend

- [ ] Courthouse sub-type colors not shown in UI legend — marker colors exist in code but legend component doesn't enumerate them.
- [ ] Agency cluster color split requires two GeoJSON sources — current single-source approach can't distinguish field offices from resident agencies in the cluster layer.

## Database / Performance

- [ ] `wigle_v3_observations` uses btree index on `(trilat, trilon)` — should be a GIST index on a geometry column for PostGIS spatial queries. Migration needed.
- [x] `materialized-views.md` schema doc created.
- [x] `network-tables.md` schema doc created.
- [x] `indexes.md` schema doc created.

## Style / Map

- [ ] `useWigleMapFeatures` style-reload path: field data layer restore still references `fieldDataFCRef` even though field data is now handled by the aggregated layer. Low risk (null ref is safe) but should be cleaned up.

## Admin

- [ ] `import/kml.js`: unused `logger` variable (pre-existing lint warning). Rename to `_logger` or remove.
