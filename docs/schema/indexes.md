# Database Indexes — Performance Reference

Last verified: 2026-04-25 via live DB (`app` schema on `shadowcheck_postgres`).

This document tracks critical indexes and the specific query patterns they optimize.

---

## Spatial Indexes (GIST)

PostGIS spatial queries require GIST indexes on geometry columns.

| Table                          | Index Name                         | Column     | Queries Served                          |
| ------------------------------ | ---------------------------------- | ---------- | --------------------------------------- |
| `app.observations`             | `idx_obs_geom_gist`                | `geom`     | Map view filtering, spatial aggregation |
| `app.wigle_v2_networks_search` | `idx_wigle_v2_location`            | `location` | WiGLE v2 map layer                      |
| `app.wigle_v3_observations`    | `idx_wigle_v3_obs_location`        | `location` | WiGLE v3 map layer                      |
| `app.kml_points`               | `idx_kml_points_location`          | `location` | KML map layer                           |
| `app.agency_offices`           | `idx_agency_offices_location`      | `location` | Office proximity search                 |
| `app.federal_courthouses`      | `idx_federal_courthouses_location` | `location` | Courthouse overlay                      |

---

## Identifier & Lookup Indexes (B-Tree)

### `app.observations`

- `idx_observations_bssid_time_desc` — `(bssid, time DESC)`: Optimized for fetching latest activity per network.
- `idx_obs_device_time` — `(device_id, time)`: Optimized for device-specific chronological exports.

### `app.wigle_v3_observations`

- `idx_wigle_v3_obs_netid` — `(netid)`: Rapid lookup of WiGLE v3 history for a specific BSSID.

### `app.kml_points`

- `idx_kml_points_bssid` — `(bssid)`: Join performance between KML data and local observations.

---

## Materialized View Indexes

To ensure fast frontend lookups, MVs have their own unique and non-unique indexes.

### `app.api_network_explorer_mv`

- `idx_api_network_explorer_mv_bssid` (UNIQUE, btree): Primary key lookup for network details.
- `idx_api_network_explorer_mv_type` (btree): Filter by network type (W/E/B/L/N/G).
- `idx_api_network_explorer_mv_observed_at` (btree, DESC): Time-based sorting for the network list.
- `idx_api_network_explorer_mv_threat` (btree, DESC): Range scans for threat-score filtering and ordering.
- `idx_api_network_explorer_mv_rule_score` (btree, DESC): Range scans on the rule-based sub-score.
- `idx_api_network_explorer_mv_ml_score` (btree, DESC): Range scans on the ML threat sub-score.
- `idx_api_network_explorer_mv_stationary` (btree, partial `WHERE stationary_confidence IS NOT NULL`): Filters and sorts on pre-computed stationary confidence.
- `idx_api_network_explorer_mv_ignored` (btree, partial `WHERE is_ignored = TRUE`): Fast exclusion of analyst-ignored networks.
- `idx_api_network_explorer_mv_manufacturer` (btree): Equality lookups by manufacturer name.
- `idx_api_network_explorer_mv_manufacturer_gin` (GIN, `gin_trgm_ops`): Fast `ILIKE` pattern matching on manufacturer.
- `idx_api_network_explorer_mv_ssid_trgm` (GIN, `gin_trgm_ops`): Fast `ILIKE` pattern matching on SSID.
- `idx_api_network_explorer_mv_frequency` (btree): Filter by channel frequency.
- `idx_api_network_explorer_mv_signal` (btree): Filter by signal strength.
- `idx_api_network_explorer_mv_first_seen` (btree, DESC): Sort by first observation timestamp.
- `idx_api_network_explorer_mv_last_seen` (btree, DESC): Sort by most-recent observation timestamp.
- `idx_api_network_explorer_mv_observations` (btree): Filter/sort by observation count.
- `idx_api_network_explorer_mv_type_freq` (btree, composite): Combined network-type + frequency filter.
- `idx_api_network_explorer_mv_threat_type` (btree, composite): Combined threat-score + type filter for threat-dashboard queries.
- `idx_api_network_explorer_mv_security` (btree): Filter by security/encryption classification.
- `idx_api_network_explorer_mv_geom` (GIST, functional): Spatial index on `ST_SetSRID(ST_MakePoint(lon, lat), 4326)` for geographic queries.

### `app.api_wigle_networks_mv`

- `idx_wigle_networks_mv_bssid` (UNIQUE, btree): Primary lookup by BSSID.
- `idx_wigle_networks_mv_display_coords` (btree, partial `WHERE display_lat IS NOT NULL AND display_lon IS NOT NULL`): Spatial filtering for the WiGLE map layer.
- `idx_wigle_networks_mv_nonstationary` (btree, partial `WHERE public_nonstationary_flag = TRUE`): Fast access to networks flagged as non-stationary.
- `idx_wigle_networks_mv_has_v3` (btree, composite on `has_wigle_v3_observations, wigle_v3_observation_count`): Filter by WiGLE v3 observation presence and count.
- `idx_wigle_networks_mv_has_local_match` (btree, partial `WHERE has_local_match = TRUE`): Fast access to WiGLE networks that have a local observation match.
