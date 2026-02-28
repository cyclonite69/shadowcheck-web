# WiGLE / Geospatial / Kepler Data Alignment Investigation

## Scope

This document captures the current database storage model for WiGLE + geospatial network data, identifies column-name mismatches across pages, and recommends a unified tooltip strategy for readability.

## Database object inventory (current migrations)

### Core tables used by Geospatial + Kepler

- `app.networks`: canonical per-BSSID network record and denormalized fields including `wigle_v3_observation_count` and `wigle_v3_last_import_at`.
- `app.observations`: per-observation time/position/signal records (`geom`, `lat`, `lon`, `time`, `accuracy`, etc.).

### WiGLE-specific tables

- `app.wigle_v2_networks_search`: imported WiGLE v2 search rows with `trilat`, `trilong`, `firsttime`, `lasttime`, `lastupdt`, `encryption`, `location` (PostGIS point), and source metadata.
- `app.wigle_v3_network_details`: v3 network metadata keyed by `netid` with street/city/region/country and WiGLE timing fields.
- `app.wigle_v3_observations`: v3 observation records linked by `netid` and geospatial point.

### Views / materialized views

- `app.api_network_explorer_mv`: primary query surface for explorer/kepler-style aggregated rows. It joins `networks` + observation aggregates and exposes movement, distance, threat, and denormalized WiGLE fields.
- `app.network_entries`: network list style view used by API/network listing workflows.
- Additional analytical MVs (e.g., `app.mv_network_timeline`) support timeline/aggregation use cases.

### Indexes and performance objects relevant to this work

- Spatial indexes on observation geometry (`GIST`) and WiGLE point geometry.
- Time-series + directional indexes (`bssid,time` asc/desc, BRIN on time fields).
- MV indexes for explorer filtering/sorting (`threat_score`, `observed_at`, `frequency`, `signal`, quality columns).
- Trigger function `app.update_networks_wigle_counts()` keeps `app.networks.wigle_v3_observation_count` synchronized from v3 observation inserts/deletes.

## Column mismatch findings

Data across pages is semantically aligned but exposed with different column names:

- Coordinates: `lat/lon`, `latitude/longitude`, `trilat/trilong`, `trilon`.
- Signal: `signal`, `level`, `bestlevel`, `rssi`.
- Security: `security`, `encryption`, `capabilities`.
- Time: `time`, `timestamp`, `first_seen`, `last_seen`, `firsttime`, `lasttime`, `lastupdt`, `observed_at`.
- Observation counts: `observation_count`, `obs_count`, `observations`, `wigle_v3_observation_count`.
- Distance-from-home: `distance_from_home_km` vs `distance_from_home`.

## Alignment approach

A frontend canonical normalizer (`normalizeTooltipData`) now maps the above aliases into one tooltip shape used by:

- Geospatial map popups
- WiGLE map popups
- Kepler map popups

This prevents per-page drift and makes future DB/API schema evolution safer.

## Tooltip behavior research + recommendation

Problem observed: hover tooltips can clip at viewport boundaries, causing top/bottom truncation.

Recommendation implemented:

- Use click-to-open Mapbox popups for Kepler (same `.sc-popup` treatment as other maps).
- Keep tooltip stationary until closed, with native popup tip/pointer anchored to the clicked observation.

Why this helps:

- Popups are spatially anchored and easier to read.
- Pointer/tip preserves visual linkage to the selected point.
- Existing popup styling already supports large content and consistent theme.

## Next optional improvements

- Add a shared server-side DTO for `TooltipNetworkRecord` to normalize names before payloads reach the client.
- Add DB comments or a schema dictionary table documenting canonical semantic fields and aliases.
- Add pagination + lazy details in tooltip body for very dense observation records.

## UX direction: Should WiGLE and agency popups be different?

Yes, slightly:

- **Network popups (Kepler / Geospatial / WiGLE network points):** keep rich technical detail for analysts (security, signal, temporal spans, movement). These are investigative records.
- **WiGLE observation-only points:** keep a compact provenance-focused card (source context + correlation status + distance from your centroid) so it reads as _evidence support_, not as a full network profile.
- **Agency points:** keep action-oriented operational card (office type, address/phone/website, distance, nearby WiGLE indicator) optimized for dispatch/lookup behavior.

This gives consistent visual shell + pointer anchoring, but content density tuned by object type.
