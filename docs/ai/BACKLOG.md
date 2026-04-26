# Known Debt

Items confirmed as pre-existing or deferred. Pick these up as standalone tasks — do not fix them opportunistically while working on something else.

---

## Test Failures (pre-existing)

- [ ] `adminImport.test.ts`: 6 spawn/fs mock failures — `import-sqlite` (successful import, import process error, kismet import), `import-sql` (sql import error), `import-kml` (payload parsing fails, process spawn error). Root cause: child process and temp-directory mocking not wired up correctly. Unrelated to route paths.

## UI / Frontend

- [ ] Courthouse sub-type colors not shown in UI legend — marker colors exist in code but legend component doesn't enumerate them.
- [ ] Agency cluster color split requires two GeoJSON sources — current single-source approach can't distinguish field offices from resident agencies in the cluster layer.

## Database / Performance

- [x] `wigle_v3_observations` GIST index — `idx_wigle_v3_obs_location USING gist (location)` already exists via baseline consolidation applied 2026-04-16. `wigle_v2_networks_search` likewise has `idx_wigle_v2_location USING gist (location)`. Backlog entry was stale (table has no `trilat`/`trilon` columns; those are on `wigle_v2_networks_search`).
- [x] `materialized-views.md` schema doc created.
- [x] `network-tables.md` schema doc created.
- [x] `indexes.md` schema doc created.

## Style / Map

- [ ] Backend observation aggregation: ST_ClusterDBSCAN approach is architecturally correct but requires either (a) a materialized view pre-computed at standard zoom levels and refreshed on import, or (b) a dedicated tile server (pg_tileserv/Martin). Live DBSCAN on full-table window functions times out (504) at continent-scale bbox. Do not re-attempt as a live query. ADR: `docs/ai/decisions/20260425_server_side_observation_aggregation.md`.
- [x] Field data rendering: `ensureFieldDataLayer` with `cluster: true` wired into `useWigleFieldData`. Pagination bug fixed (`386eeeab` — `includeTotal` param mismatch); page limit raised to 50K.

## Admin

- [x] `import/kml.js`: unused `logger` variable — fixed in `233c0732` by adding `logger.error(...)` in the catch block. Lint is clean.
