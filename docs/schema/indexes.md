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

- `idx_api_network_explorer_mv_bssid` (UNIQUE): Primary key lookup for network details.
- `idx_api_network_explorer_mv_threat`: Range scans for threat-based filtering.
- `idx_api_network_explorer_mv_observed_at`: Time-based sorting.

### `app.api_wigle_networks_mv`

- `idx_wigle_networks_mv_bssid` (UNIQUE): Primary lookup.
- `idx_wigle_networks_mv_display_coords`: Spatial filtering for WiGLE networks.
