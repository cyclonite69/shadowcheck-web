# Active Workstreams — 2026-04-28

Update this file manually when handing off a task or starting a new session. Agents read it at session start to avoid stepping on in-progress work.

---

## Current Status

| Agent | Area              | Task                                                        | Status |
| ----- | ----------------- | ----------------------------------------------------------- | ------ |
| —     | wigle tooltip     | Phase 5 — tooltip unification for aggregated layer          | DONE   |
| —     | docs audit        | Full docs audit + enrichment (Phase 1–4)                    | DONE   |
| —     | wigle aggregation | Phases 1–4 bugs fixed: route order, bbox clamp, extent API  | DONE   |
| —     | admin API testing | Endpoint registry migrated to `apiTestEndpoints.ts`         | DONE   |
| —     | admin routes      | Route path regression; 6 pre-existing failures (BACKLOG.md) | DONE   |

---

## Do Not Touch

_Nothing currently locked._

---

## Canonical Files (new this session)

- **`client/src/config/apiTestEndpoints.ts`** — single source of truth for all API endpoint registry entries. Every new route MUST get an entry here before merge.

---

## Recently Completed (last 5 sessions)

| Commit     | What shipped                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| —          | feat(tooltip): add WiGLE source badge, local match badge, precision warning, pattern chips to shared renderNetworkTooltip; delete dead wigleTooltipNormalizer/Renderer files                 |
| —          | docs: full audit + enrichment — FILTERS.md pipe syntax, schema indexes/MVs/tables, API auth fix, Vite 8, admin tabs, DATABASE_RADIO_ARCHITECTURE warning, DATA_QUALITY_FILTERING orphan note |
| `4f88b3dd` | fix(tooltip): unify WiGLE observation popup to shared renderNetworkTooltip pipeline                                                                                                          |
| `ccbafab2` | feat: unify tooltip rendering across KML, WiGLE V2/V3, and Geospatial                                                                                                                        |
| `b056d6af` | docs(agents): add endpoint and query documentation standards to all three agent files                                                                                                        |
| `28c8136a` | docs(wigle): JSDoc on aggregated and extent route handlers + query builders                                                                                                                  |
| `c459fbfa` | feat(admin): API test tab data-driven via `client/src/config/apiTestEndpoints.ts`                                                                                                            |
