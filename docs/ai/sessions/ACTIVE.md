# Active Workstreams — 2026-04-25

Update this file manually when handing off a task or starting a new session. Agents read it at session start to avoid stepping on in-progress work.

---

## Current Status

| Agent       | Area              | Task                                                        | Status  |
| ----------- | ----------------- | ----------------------------------------------------------- | ------- |
| Claude Code | wigle aggregation | Phase 5 — tooltip unification for aggregated layer          | NEXT UP |
| —           | wigle aggregation | Phases 1–5 bugs fixed: route order, bbox clamp, extent API  | DONE    |
| —           | admin API testing | Endpoint registry migrated to `apiTestEndpoints.ts`         | DONE    |
| —           | admin routes      | Route path regression; 6 pre-existing failures (BACKLOG.md) | DONE    |

---

## Do Not Touch

_Clear this section when the work ships._

- `client/src/components/WiglePage.tsx` — aggregated layer wiring active; Phase 5 (tooltip) next
- `server/src/api/routes/v1/wigle/aggregated.ts` — route order fix landed; do not re-architect without reading the ADR

---

## Canonical Files (new this session)

- **`client/src/config/apiTestEndpoints.ts`** — single source of truth for all API endpoint registry entries. Every new route MUST get an entry here before merge.

---

## Recently Completed (last 5 sessions)

| Commit     | What shipped                                                                          |
| ---------- | ------------------------------------------------------------------------------------- |
| `b056d6af` | docs(agents): add endpoint and query documentation standards to all three agent files |
| `28c8136a` | docs(wigle): JSDoc on aggregated and extent route handlers + query builders           |
| `c459fbfa` | feat(admin): API test tab data-driven via `client/src/config/apiTestEndpoints.ts`     |
| `35fdddcc` | feat(wigle): GET /api/wigle/observations/extent + Fit Bounds button                   |
| `b16467f9` | fix(wigle): clamp bbox to [-180,180]/[-90,90] before aggregated fetch                 |
| `2d97f06e` | fix(wigle): mount aggregated route before observations/:netid wildcard                |
| `2eae6751` | fix(admin): restore /admin/ prefix in import sub-routes                               |
| `b8fdf5cf` | feat(wigle): wire useWigleObservations into WiglePage (Phase 4)                       |
