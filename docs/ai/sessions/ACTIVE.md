# Active Workstreams — 2026-04-25

Update this file manually when handing off a task or starting a new session. Agents read it at session start to avoid stepping on in-progress work.

---

## Current Status

| Agent       | Area              | Task                                                                              | Status  |
| ----------- | ----------------- | --------------------------------------------------------------------------------- | ------- |
| Claude Code | wigle aggregation | Phase 5 — tooltip unification for aggregated layer                                | NEXT UP |
| —           | admin routes      | Route path regression fixed; 6 pre-existing test failures remain (see BACKLOG.md) | DONE    |
| —           | wigle aggregation | Phases 1–4 complete and pushed                                                    | DONE    |

---

## Do Not Touch

_Clear this section when the work ships._

- `client/src/components/WiglePage.tsx` — aggregated layer wiring in progress (Phase 5 next)
- `server/src/api/routes/v1/wigle/aggregated.ts` — Phase 1 landed; do not re-architect without reading the ADR
- `client/src/components/wigle/useWigleObservations.ts` — Adding diagnostics to debug field data rendering issue. Added mapReady and fieldData toggle logs.

### Findings (Diagnostic - 2026-04-25)

1. **`useWigleFieldData` usage:** No remaining imports or calls in `WiglePage.tsx`.
2. **`useWigleObservations` Props in `WiglePage.tsx`:** `mapRef`, `mapReady`, `layers`, `clusteringEnabled`, `aggregatedFCRef`.
3. **Hook Interface:** `useWigleObservations` does **not** have `zoom` or `bbox` in its interface. The hook accesses `mapRef.current.getBounds()` and `mapRef.current.getZoom()` internally within the fetch effect.
4. **`mapReady`:** Yes, it is the same state passed from `useWigleMapInit` used by other hooks, becoming true after initialization.
5. **Effect Dependencies:** `[aggregatedFCRef, clusteringEnabled, layers.kml, layers.showFieldData, layers.v2, layers.v3, mapReady, mapRef]`. If `mapReady` is false or sources (including `layers.showFieldData`) are falsy, it bails/returns empty.\_

---

## Recently Completed (last 5 sessions)

| Commit     | What shipped                                                                         |
| ---------- | ------------------------------------------------------------------------------------ |
| `2eae6751` | fix(admin): restore /admin/ prefix in import sub-routes                              |
| `b8fdf5cf` | feat(wigle): wire useWigleObservations into WiglePage (Phase 4)                      |
| `<prev>`   | test(wigle): 21 unit/route tests for aggregated observations endpoint                |
| `<prev>`   | feat(wigle): aggregatedLayers.ts + setPointRadius update                             |
| `<prev>`   | feat(wigle): useWigleObservations hook (Phase 2) + getAggregatedObservations service |
| `<prev>`   | feat(wigle): GET /api/wigle/observations/aggregated endpoint (Phase 1)               |
