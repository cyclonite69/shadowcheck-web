# ShadowCheck TODO

This file is the lightweight shared backlog for active engineering work that
should not get lost between sessions.

Use it for:

- current focus items that need follow-through
- deferred work we intend to circle back to
- cross-cutting work such as migrations, testing, documentation, and admin UX

Do not use it for:

- long-form design rationale
- permanent architecture documentation
- resolved one-off notes that belong in commit history

## Current Focus

### Migration Refresh

- [ ] Make Phase 3 baseline validation pass on a fresh bootstrap.
- [ ] Recover or recreate a canonical population artifact for `app.radio_manufacturers`.
- [ ] Re-home `federal_courthouses` seed payload fully under `sql/`.
- [ ] Validate fresh bootstrap, restore, import, and upgrade as separate contracts before any migration promotion.

### Test Discipline

- [ ] Add a doc-coverage checker so code changes fail CI when required docs are not updated.
- [ ] Keep regression coverage aligned with admin/import UX changes, migration behavior changes, and API surface changes.

### Admin Import UX

- [ ] Finish the orphan-networks infinite scroll implementation cleanly, with matching regression coverage.
- [ ] Surface the selected SQLite/Kismet filename clearly in the SQLite import card.

### API Tooling

- [ ] Bring the API Tests tab into alignment with the actual mounted route surface.
- [ ] Refactor API test presets into modular grouped ownership so the tab can grow without another cleanup pass.

## Priority Follow-ups

### High Priority

- [ ] Restore the geocoding cache pipeline, non-functional since approximately 2026-04-23: implement `upsertGeocodeCacheBatch` in `server/src/services/geocoding/cacheDatabase.ts` so it writes `app.geocoding_cache` using the completed column-by-column address-only and POI-only specification with `ON CONFLICT (precision, lat_round, lon_round)`. Before implementation, explicitly decide `mode='both'` behavior (recommended: throw rather than infer undefined semantics), confirm Geocodio `accuracy` fits the `numeric(5,4)` confidence column, then add the four red tests for address success/failure and POI success/failure against the stub before implementing.
- [ ] Resolve surveillance device-class fallback behavior: `L3HARRIS_STINGRAY`, `GENERAL_DYNAMICS_C4ISR`, and `TADIRAN_COMMS` currently surface through the `device_class` COALESCE fallback in `SqlFragmentLibrary.ts` from a bare OUI match without corroboration or scoring. No captured devices currently match, so no live mislabeling was found in audit, but the mechanism is live. Decide whether to split a weak “defense-vendor OUI” label from specific product labels, which should remain unpopulated without corroborating evidence, and demote badge severity out of the critical/red tier.

### Medium Priority / Process Debt

- [ ] Decide whether to retroactively split scoring-policy files from commit `5da1ee7c` (`feat(surveillance): camera detection and evidence filters`); they were intended as a separate commit in the original plan but remain merged without a final decision.
- [ ] Populate `render_budget` and `render_budget_exceeded` in the server response builder; the client observations path checks these fields, but the server never populates them. Low urgency and unrelated to the timeframe default change; identified during the 2026-09-12 audit.
- [ ] Re-approve or close out the remaining Stage 2 hook-extraction plan in `client/src/components/geospatial/hooks/`: `useObservationPointContextMenu` was extracted and committed, while the original Batch D plan also listed `useCoreObservationLayers`, `useMapLayers`, `useMapLayersToggle`, `useMapStyleControls`, `useNetworkContextMenu`, `useSiblingLinks`, and `useWigleLayers`.

### Open Question

- [ ] Determine the target usage for a low-cost bulk-search integration for ShadowCheck—SSID/device identity lookups, address enrichment, or vendor-document scraping—before selecting a tool.

### Standing Reminder

- [ ] No commits from the current session (client remediation, surveillance filters/scoring, pgAdmin fix, timeframe default, camera-filter independence, and BSSID width fix) have been pushed to `origin/master`; pushing requires explicit approval and is not implied by commits landing.

## Backlog

### Data & Analysis

- [ ] Revisit enrichment boundaries and presentation for Kismet-derived data.
- [ ] Revisit sibling detection quality, correctness, and operator workflow.
- [ ] Revisit network co-occurrence logic and validation.
- [ ] Revisit anchor point modeling, ingestion, and explorer behavior.

### Product & Admin UX

- [ ] Polish reporting workflows and presentation quality.
- [ ] Fix notes media attachments end-to-end.
- [ ] Revisit Networks Explorer formatting and verify all newly exposed columns populate, render, and sort correctly.
- [ ] Update the universal query builder and filter menu to support newly exposed columns consistently.

### Documentation & Process

- [ ] Keep the “Ten Commandments” as the canonical short-form engineering rules and reference them rather than duplicating policy text.
- [ ] Add more invariant-style rules only when they represent repeated failure modes or true architectural boundaries.

## Notes

- Prefer checking items off here rather than deleting context abruptly.
- Add new items when they are real follow-up work, not passing thoughts.

## Winston console transport — structured fields silently dropped

`[v2/filtered] Slow query detected` is logged with structured fields
(`totalTime`, `queryTime`, `resultCount`, `siblingCount`, `filterCount`)
passed to `logger.warn()` in `server/src/api/routes/v2/filtered/handlers/list.ts:105`,
but the console transport format doesn't render them — only the message
string appears in `docker logs` output. Fields are present in the Winston
call but swallowed before reaching stdout. Fix: update the console
transport format in `server/src/logging/logger.ts` to include metadata
fields, or switch to JSON transport for structured output.
Found: 2026-09-10 during OOM/502 incident investigation.

Confirmed again 2026-09-19 during ALPR Austin sync (`jobId`/`regionId`/`error`
meta on `ALPR background sync failed` present in `server/data/logs/error.log`
JSON, absent from `docker logs`). Intentionally **not** fixed in the same
patch as `formatErrorWithCause` — console printf is global and out of scope
for the ALPR cause-truncation fix. Use the Winston JSON file log as the
real debugging surface until this item is closed.

## ESLint flat config — many TypeScript paths never linted

Surfaced 2026-09-19 during ALPR cause-serialization work. Running
`npx eslint` on `server/src/utils/formatErrorWithCause.ts`,
`server/src/services/admin/alprSyncService.ts`, and `src/alpr/overpassClient.ts`
returns `File ignored because no matching configuration was supplied` —
0 errors means eslint never looked, not that the files are clean.

Root cause: `eslint.config.js` only applies TypeScript rules to a narrow
allowlist (`server/src/services/filterQueryBuilder/**` plus a handful of
unit tests). Broader paths including `src/alpr/`, `server/src/services/admin/`,
`server/src/utils/`, and most of `tests/` are outside that allowlist.

Consequence: every "eslint — PASS" claim on ALPR work (chunking, regions
table, cause fix) has been checking nothing for those files.

Not fixed in the cause/nchc patch (same treatment as the console-transport
item). Follow-up: expand `files` globs in `eslint.config.js` (or add an
override) so `src/alpr/**`, `server/src/services/admin/**`,
`server/src/utils/**`, and `tests/**` are actually linted, then clear the
backlog of violations.
