# Geospatial Documentation

This document describes the spatial calculations, clustering mechanics, and network hydration strategies utilized within the Geospatial Explorer and WiGLE map panels.

---

## 1. Geospatial Layer Integration

- **Shared layer controls**: The existing map-toolbar Layers dropdown controls WiGLE v2/v3 results, KML points, viewport-filtered field observations, agency offices, federal courthouses, ALPR cameras, and ShotSpotter zones/sensors. Visibility, per-layer opacity, and stack ordering persist in `shadowcheck_geospatial_layers`.
- **WiGLE result layers**: Fetching hooks, field-observation viewport refresh, GeoJSON conversion, clustered layer construction, and WiGLE map interactions live under `client/src/components/geospatial/layers/`. The WiGLE page imports these shared modules as well, while small compatibility exports preserve imports from the former `wigle/` paths.
- **Rendering and data lifecycle**: WiGLE results are fetched only when enabled, use the page's current filter capability projection, and restore sources/layers on Mapbox style reload. Field observations refresh on `moveend`; overlay sources are reused by both map pages.
- **Opacity and ordering**: The shared layer appearance hook applies opacity relative to each Mapbox layer's original paint value and reorders the grouped Mapbox layer IDs without changing their data sources.
- **Materialized Views**:
  - `app.api_network_explorer_mv`: Powers the explorer grid by pre-calculating geocoded values, threat scores, and lists of adjacent sibling BSSIDs (`sibling_bssids`).
  - `app.mv_sibling_groups`: Computes and aggregates connected components groupings to display sibling clusters on the map.
- **Query Path**:
  - React hook `useSiblingLinks` calls `networkApi.getNetworkSiblingLinks(anchorBssid)` and `networkApi.getNetworkSiblingLinksBatch(bssids)` to fetch link coordinates.
  - Sibling missing network details are loaded in batch chunks of 100 via `networkApi.getNetworksByBssids(chunkBssids)`.
- **Precomputed Adjacency**:
  - Sibling hydration uses a fallback strategy inside `siblingGroupGraph.ts`. If a network already contains `sibling_bssids` in the loaded list, `buildAdjacencyFromPrecomputed` builds adjacent link segments locally to bypass redundant API lookup requests.
