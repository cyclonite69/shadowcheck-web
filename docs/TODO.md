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
