# Materialized Views — Schema Reference

Last verified: 2026-04-25 via live DB (`app` schema on `shadowcheck_postgres`).

Materialized views are used to pre-aggregate and enrich network data for the frontend and analytics modules.

---

## `app.api_network_explorer_mv`

**Purpose:** Primary view for the Network Explorer. Enriches local observations with geocoding, stationary confidence scoring, and threat metrics.

**Source Tables:**

- `app.observations`
- `app.location_markers`
- `app.geocoding_cache`

**Refresh Cadence:** ~Hourly (via `api_mv_refresh_state` tracker).

---

## `app.api_wigle_networks_mv`

**Purpose:** Consolidates WiGLE v2/v3 data with local matches for cross-source analysis.

**Source Tables:**

- `app.wigle_v2_networks_search`
- `app.wigle_v3_observations`
- `app.wigle_v3_network_details`
- `app.observations` (for local match flags)

**Refresh Cadence:** ~Daily / On-demand.

---

## `app.analytics_summary_mv`

**Purpose:** High-level summary stats for the dashboard analytics (counts, unique BSSIDs, device activity).

**Source Tables:**

- `app.observations`
- `app.device_sources`

**Refresh Cadence:** ~Daily.

---

## `app.api_network_latest_mv`

**Purpose:** Lightweight snapshot of networks active within the last 24 hours, used for quick "recently seen" lookups without querying the full `api_network_explorer_mv`.

**Source Tables:**

- `app.networks`

**Refresh Cadence:** On-demand / as needed.

**Indexes:**

- `idx_api_network_latest_mv_bssid` (btree): Lookup by BSSID.

---

## `app.mv_network_timeline`

**Purpose:** Hourly bucketed aggregation of observation counts and signal statistics per network, used for timeline charts and temporal analysis.

**Source Tables:**

- `app.networks`
- `app.observations`

**Refresh Cadence:** On-demand.

**Indexes:**

- `idx_mv_network_timeline_bssid` (btree): Filter timeline rows by BSSID.
- `idx_mv_network_timeline_hour` (btree): Filter/sort by hour bucket.

---

## `app.agency_offices_summary`

**Purpose:** Per-`office_type` summary counts (total offices, coordinate coverage, ZIP+4 completeness, phone and website presence) for reference-data quality dashboards.

**Source Tables:**

- `app.agency_offices`

**Refresh Cadence:** On-demand (after reference data imports).

**Indexes:**

- `idx_agency_offices_summary_type` (UNIQUE, btree): One row per office type.

---

## Refresh State Tracker

The table `app.api_mv_refresh_state` tracks the last successful refresh for the MVs.

| Column            | Type        | Notes                     |
| ----------------- | ----------- | ------------------------- |
| `id`              | integer     | PK                        |
| `last_refresh_ts` | timestamptz | Timestamp of last refresh |
| `last_refresh_id` | integer     |                           |
| `updated_at`      | timestamptz |                           |
