# ShadowCheck Database Object Usage Audit Report

**Date:** 2026-03-28
**Uptime:** 6 hours
**Database:** shadowcheck_db

## Executive Summary

This audit identifies database objects (tables, views, indexes) that are currently unused or represent redundant technical debt. The analysis is based on PostgreSQL usage statistics (`pg_stat_user_tables`, `pg_stat_user_indexes`) collected over a 6-hour window and cross-referenced with the codebase.

---

## 1. Tables: Legacy & Unused

The following tables have zero scans and zero rows, or are confirmed legacy based on code analysis.

| Schema   | Table                       | Size   | Status  | Recommendation                                                   |
| :------- | :-------------------------- | :----- | :------ | :--------------------------------------------------------------- |
| `public` | `kismet_packets`            | 123 MB | Legacy  | **DROP** - Duplicate of `app.kismet_packets`.                    |
| `public` | `kismet_devices`            | 12 MB  | Legacy  | **DROP** - Duplicate of `app.kismet_devices`.                    |
| `public` | `kismet_*` (others)         | ~3 MB  | Legacy  | **DROP** - All kismet tables in public schema are redundant.     |
| `app`    | `network_sibling_baseline`  | 320 KB | Unused  | **DROP** - Replaced by `app.network_sibling_overrides`.          |
| `app`    | `ssid_history`              | 4.6 MB | Unused  | **DROP** - Not used by API or metrics (hardcoded to 0).          |
| `app`    | `staging_locations_all_raw` | 146 MB | DORMANT | **INVESTIGATE** - 0 rows, 0 scans. Likely transient ETL staging. |
| `app`    | `threat_scores_cache`       | 28 MB  | DORMANT | **DROP** - 0 rows, 0 scans.                                      |
| `app`    | `staging_routes`            | 3.7 MB | DORMANT | **DROP** - 0 rows, 0 scans.                                      |

---

## 2. Views & Materialized Views: Legacy

| Schema | View                             | Status | Recommendation                                 |
| :----- | :------------------------------- | :----- | :--------------------------------------------- |
| `app`  | `network_sibling_pairs_filtered` | Unused | **DROP** - Helper view not referenced in code. |
| `app`  | `v_real_access_points`           | Unused | **DROP** - Only exists in migrations.          |
| `app`  | `network_summary_with_notes`     | Unused | **DROP** - Only exists in migrations.          |
| `app`  | `api_mv_refresh_state`           | Unused | **DROP** - Only exists in migrations.          |

---

## 3. Redundant & Unused Indexes (Technical Debt)

The `app.observations` table has significant index bloat. Many indexes are redundant or overlapping.

### Immediate Drop Candidates (Redundant)

| Table              | Index                              | Size  | Reason                                                              |
| :----------------- | :--------------------------------- | :---- | :------------------------------------------------------------------ |
| `app.observations` | `idx_observations_bssid_time_desc` | 28 MB | **Redundant** - Identical to `idx_observations_bssid_time`.         |
| `app.observations` | `idx_observations_bssid_time`      | 28 MB | **Unused** - `idx_observations_time_bssid` is preferred by planner. |
| `app.observations` | `observations_v2_natural_uniq`     | 65 MB | **Overhead** - Unique constraint rarely hit via scan.               |

### Unused Functional Indexes

| Table              | Index                         | Size  | Recommendation                                              |
| :----------------- | :---------------------------- | :---- | :---------------------------------------------------------- |
| `app.observations` | `idx_obs_geom_gist`           | 24 MB | **INVESTIGATE** - GIS index not used in last 6h.            |
| `app.observations` | `idx_obs_time_lat_lon`        | 24 MB | **DROP** - Covered by `obs_time_idx` and `idx_obs_lat_lon`. |
| `app.networks`     | `idx_networks_bssid_covering` | 11 MB | **DROP** - Btree scan on PK is usually faster.              |

---

## 4. Unused Features (Dormant)

The following tables exist but contain no data and have no activity. They may belong to features that are either deprecated or not yet fully implemented.

- `app.mac_randomization_suspects`
- `app.ai_insights`
- `app.network_cooccurrence`
- `app.ml_training_history`

---

## 5. Summary Matrix

| Object Type | Total Count | Unused/Legacy | Redundant | Actionable Items |
| :---------- | :---------- | :------------ | :-------- | :--------------- |
| **Tables**  | 60          | 15            | 0         | 15               |
| **Views**   | 10          | 4             | 0         | 4                |
| **Indexes** | 175         | 158\*         | 12        | 25               |

_\* Note: High "unused" index count is skewed by the 6-hour observation window._

---

## Next Steps

1. **Validation**: Run `EXPLAIN ANALYZE` on primary API queries before dropping any `observations` indexes.
2. **Backup**: Perform a full schema backup (`scripts/db-backup-commands.sh`) before any drops.
3. **Execution**: Generate a consolidated `DROP` script for the items in Section 1 and 2.
