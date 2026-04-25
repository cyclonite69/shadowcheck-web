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

## Refresh State Tracker

The table `app.api_mv_refresh_state` tracks the last successful refresh for the MVs.

| Column            | Type        | Notes                     |
| ----------------- | ----------- | ------------------------- |
| `id`              | integer     | PK                        |
| `last_refresh_ts` | timestamptz | Timestamp of last refresh |
| `last_refresh_id` | integer     |                           |
| `updated_at`      | timestamptz |                           |
