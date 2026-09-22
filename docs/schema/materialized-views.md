# Materialized Views — Schema Reference

Last verified: 2026-04-25 via live DB (`app` schema on `shadowcheck_postgres`).

Materialized views are used to pre-aggregate and enrich network data for the frontend and analytics modules.

---

## `app.api_network_explorer_mv`

**Purpose:** Primary view for the Network Explorer. Enriches local observations with geocoding, stationary confidence scoring, threat metrics, and precomputed sibling-radio summary fields for Geospatial reads.

**Source Tables:**

- `app.observations`
- `app.location_markers`
- `app.geocoding_cache`
- `app.network_sibling_pairs`

**Sibling Summary Columns:**

- `has_siblings` boolean
- `sibling_count` integer
- `sibling_max_confidence` numeric
- `has_strong_sibling` boolean
- `sibling_bssids` text[]

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

## Removed materialized views

`app.api_network_latest_mv` and `app.mv_network_timeline` were dropped with
`CASCADE` in `baseline_005_analysis_views_materialized_views.sql` and are no
longer current schema objects. Network timeline data is provided by
`GET /api/v2/networks/:bssid` from `app.observations`.

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
