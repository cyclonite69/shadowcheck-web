# ADR: Server-Side Zoom-Aware Observation Aggregation

**Date:** 2026-04-25  
**Status:** Accepted  
**Deciders:** Zippy Skippy

---

## Context

The WiGLE geospatial page renders points from four data sources:

| Source   | Table                        | Rows    | Type            |
| -------- | ---------------------------- | ------- | --------------- |
| Field    | app.observations             | 655,542 | per-observation |
| WiGLE v2 | app.wigle_v2_networks_search | 86,007  | per-network     |
| WiGLE v3 | app.wigle_v3_observations    | 86,763  | per-observation |
| KML      | app.kml_points               | 316,445 | per-observation |

Previous architecture fetched raw points per-source with a 20,000 row hard cap,
used client-side Mapbox GL clustering, and had four separate fetch hooks. This
caused three problems:

1. 20k cap truncated data arbitrarily — zoomed-in Detroit viewport still hit the
   cap, missing observations
2. Client-side clustering computed on 300k+ points caused render choke
3. KML at full resolution (~316k unclustered) was borderline non-functional

Kepler.gl handles 600k points without issue because deck.gl uses instanced
rendering (one GPU draw call). Mapbox GL uses per-feature draw calls and cannot
match this at scale. Migrating to deck.gl was considered and rejected — the SIGINT
tooling (custom click handlers, filter integration, layer control, companion device
tracing) requires Mapbox's control model.

---

## Decision

Offload all spatial aggregation to the backend via a single unified endpoint:

```
GET /api/wigle/observations/aggregated
     ?west=&south=&east=&north=&zoom=&sources=field,wigle-v2,wigle-v3,kml
```

The endpoint uses PostGIS `ST_SnapToGrid` to aggregate all four sources into
grid cells sized proportionally to zoom level. At zoom ≥ 14 (street level) raw
points are returned. The frontend renders what the backend sends — no cluster
math in the browser.

**Zoom-to-grid mapping:**

| Zoom  | Grid size  | Typical cell |
| ----- | ---------- | ------------ |
| ≤ 7   | 0.5°       | ~55km        |
| 8–9   | 0.2°       | ~22km        |
| 10–11 | 0.05°      | ~5km         |
| 12–13 | 0.01°      | ~1km         |
| ≥ 14  | raw points | —            |

**Source toggles are preserved.** The `sources` param maps directly to frontend
layer toggles. Toggling v2 off excludes the `wigle_v2_networks_search` arm from
the UNION query entirely.

**Cluster toggle is preserved.** When clustering is disabled by the user,
the frontend passes `zoom=14` override to force raw point mode regardless of
actual map zoom. A guard prevents raw mode below zoom 12 to protect render
performance.

---

## Consequences

**Positive:**

- Eliminates arbitrary 20k cap — viewport completeness guaranteed
- Render performance bounded by cluster count not raw point count
- Single fetch hook replaces four separate hooks
- All sources benefit equally — no source-specific performance ceiling
- `avg_signal` available per cluster for v3/field/kml (null for v2)

**Negative:**

- v2 has no signal data — `avg_signal` always null for v2 clusters
- Additional backend query complexity — UNION across four tables
- v3 and field data lose per-point temporal detail at low zoom (expected —
  zoom in to see individual observations)

**Neutral:**

- `useWigleData`, `useWigleKmlData`, `useWigleFieldData` retained for the
  network **table** — only their map-rendering side effects are replaced
- `useWigleClusterLayers` gutted of source manipulation, retained for
  `clusteringEnabled` state only

---

## Alternatives Considered

**deck.gl overlay on Mapbox basemap:** Rejected. Would solve render performance
but requires maintaining two rendering pipelines and complicates the SIGINT
interaction model (click handlers, feature state, filter integration).

**Per-source aggregation endpoints:** Rejected. Four endpoints means four
concurrent fetches on every map move. Single UNION endpoint is one round trip.

**Tile server (pg_tileserv / Martin):** Considered for future. Would serve
pre-tiled MVT at the infrastructure level. Not adopted now — adds ops complexity
and the current PostGIS UNION approach is sufficient for current data volumes.

---

## Related

- `docs/schema/observations-sources.md` — live schema reference for all four tables
- `server/src/api/routes/v1/wigle/aggregated.ts` — Phase 1 implementation
- `client/src/components/wigle/useWigleObservations.ts` — Phase 2 unified hook
  (pending)
