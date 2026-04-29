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

---

## Refactor Backlog (Audit 2026-04-29)

| Priority | File                                             | Issue                             | Proposed Action                                                                           |
| -------- | ------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------- |
| 1        | client/src/components/admin/types/admin.types.ts | DEAD CODE                         | Delete — zero importers, exact duplicate of client/src/types/admin.ts                     |
| 2        | server/src/api/routes/v1/wigle/utils.ts          | DEAD CODE + DUPLICATION           | Delete — no importers, all three functions live in wigleDetailTransforms.ts               |
| 3        | server/src/errors/AppError.ts                    | DEAD CODE                         | Remove 10 unused subclasses; keep AppError, ValidationError, NotFoundError, DatabaseError |
| 4        | 5 wigle service files                            | DUPLICATION (credential encoding) | Move getEncodedWigleAuth() to wigleRequestUtils.ts; replace 5 inline Buffer.from calls    |
| 5        | server/src/services/v2Service.ts                 | ORCHESTRATOR CANDIDATE            | Extract types → v2Types.ts, SQL → v2Repository.ts, leave orchestration                    |
| 6        | server/src/services/exportService.ts             | REPOSITORY VIOLATION              | Extract all query()/adminQuery() calls to exportRepository.ts                             |
| 7        | server/src/services/mobileIngestService.ts       | REPOSITORY VIOLATION              | Extract 20+ adminQuery() calls to mobileIngestRepository.ts                               |
| 8        | server/src/services/keplerService.ts             | ORCHESTRATOR CANDIDATE            | Split into keplerTransforms.ts, keplerRepository.ts, thin service                         |
| 9        | server/src/api/routes/v1/wigle/search.ts         | THIN ROUTER VIOLATION             | Move saved-terms query to wigleSearchService.getSavedSsidTerms()                          |
| 10       | server/src/api/routes/v1/settings.ts             | THIN ROUTER VIOLATION             | Move AWS region upsert to adminSettingsService.setAwsRegion()                             |
