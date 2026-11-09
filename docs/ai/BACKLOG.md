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

## Frontend Modularity

- [ ] `VisIntUploader.tsx` hook extraction deferred — file is 465 LOC after Phase 1 modularity pass (tag rules, sub-components extracted). Upload state lifecycle (`useVisIntUpload`) and correlation/commit orchestration (`useVisIntCorrelation`) were identified as the next extraction targets but deferred to avoid mixing a state-lifecycle refactor into a presentational-modularity pass. Pick up as a standalone modularity task; target is two custom hooks covering the `useState`/`useCallback` clusters currently inline in the component body.

## Test Safety

- [ ] **`DB_NAME` ambient env leak** — `DB_NAME=shadowcheck_db` can be present in the shell environment (e.g. from a prior `source .env` or a dotenv-loading dev script), silently overriding the `shadowcheck_test` default in both `tests/globalSetup.js` and `tests/setup.ts`. The `globalSetup.js` guard (explicit throw if `DB_NAME !== 'shadowcheck_test'`) is the only line of defense and correctly blocked a bare `npm test` invocation (caught 2026-08-31). `tests/setup.ts` has the same `||` default pattern but no guard — if a test path ever bypasses `globalSetup`, it connects to whatever `DB_NAME` is set to. Two fixes needed: (1) find and remove the source of the ambient `DB_NAME` export from the dev workflow (`.env` auto-sourcing, dotenv CLI invocation, etc.); (2) add the same explicit guard to `tests/setup.ts` so there's a second hard stop if `globalSetup` is ever skipped or bypassed.

## Security / Dependencies

- [ ] `glob` moderate AbortSignal cancellation bypass — newly reported by `npm audit`, unresolved. Affected locked paths are `node_modules/glob` (13.0.6) and `node_modules/test-exclude/node_modules/glob` (10.5.0). Audit's `--force` suggestion would downgrade Jest to 25.1.0; evaluate a compatible parent upgrade separately.
- [ ] `minimatch` moderate DoS vulnerability — unresolved. Do not force v11 through the current dependency tree: locked parents constrain copies to v10 (`@eslint/config-array@0.23.5` requires `^10.2.4`; `@typescript-eslint/typescript-estree@8.72.1` requires `^10.2.2`; `eslint@10.13.0` requires `^10.2.5`; `glob@13.0.6` requires `^10.2.2`; `nodemon@3.1.14` requires `^10.2.1`; `test-exclude@7.0.2` requires `^10.2.2`, and its nested `glob@10.5.0` separately resolves v9). `glob@14.0.4` supports `minimatch ^11.0.5`, but upgrading the affected parent packages is a coordinated compatibility task. ESLint's support change is merged in [eslint/eslint#21492](https://github.com/eslint/eslint/pull/21492), while the lock still uses `eslint@10.13.0` and `@eslint/config-array@0.23.5`; compatible releases for the remaining parents are not confirmed. Vulnerable lockfile paths: `node_modules/@eslint/config-array/node_modules/minimatch` (10.2.5), `node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch` (10.2.6), `node_modules/eslint/node_modules/minimatch` (10.2.6), `node_modules/glob/node_modules/minimatch` (10.2.6), `node_modules/nodemon/node_modules/minimatch` (10.2.4), `node_modules/test-exclude/node_modules/minimatch` (10.2.6), and `node_modules/test-exclude/node_modules/glob/node_modules/minimatch` (9.0.9). Root `minimatch@3.1.5` is outside the advisory range.
- [ ] `deepmerge` low severity prototype poisoning vulnerability — unresolved, development-only path `jest-config@30.5.2` → `deepmerge@4.3.1`. The advisory lists no patched version; keep tracked until upstream publishes one.
- [ ] `ws` uninitialized memory disclosure vulnerability — deferred. Same constraint (requires upgrading Express ecosystem dependencies via `--force`).
