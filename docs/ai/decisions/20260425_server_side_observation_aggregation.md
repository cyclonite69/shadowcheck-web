# ADR: Server-Side Zoom-Aware Observation Aggregation

**Date:** 2026-04-25  
**Status:** DEFERRED — see BACKLOG.md

---

## Context

The WiGLE map page renders observations from four sources: field data (`app.observations`), WiGLE v2 (`app.wigle_v2_networks_search`), WiGLE v3 (`app.wigle_v3_observations`), and KML points (`app.kml_points`). At low zoom, Mapbox client-side clustering struggles with 300k–600k points per source. The goal was a single backend-aggregated layer that merges all sources into organic density hotspots scaled to the current zoom level.

---

## Decision

Implement a `/api/wigle/observations/aggregated` endpoint using `ST_ClusterDBSCAN` (PostGIS window function). DBSCAN eps radius scales with zoom level: large eps at low zoom merges wide regions into hotspots; small eps at high zoom approaches individual-point resolution. A CTE-based proportional count approach distributes the exact full-bbox `COUNT(*)` across sampled clusters, so bubble counts are accurate even when a row cap limits the DBSCAN input.

---

## Alternatives Considered

- **ST_SnapToGrid** (grid-based aggregation): rejected — produces spatially misleading rectangular grid artifacts that do not reflect real data density.
- **Materialized view pre-computed at standard zoom levels**: correct long-term solution but requires schema migration and import-pipeline changes.
- **Dedicated tile server (pg_tileserv / Martin)**: correct long-term solution but requires infrastructure changes outside the current API tier.

---

## Outcome (2026-04-25)

Implemented and reverted. ST_SnapToGrid produced spatially misleading grid artifacts. ST_ClusterDBSCAN produced organic clusters but timed out (504) at continent-scale bbox — live DBSCAN window function on 316k+ rows exceeds the nginx timeout. Requires materialized view pre-computation before re-attempting.

**Status: DEFERRED — see BACKLOG.md**
