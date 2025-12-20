# PHASE 4: DATABASE OBJECT CLASSIFICATION

**Generated**: 2025-12-20
**Purpose**: Classify all database objects into DROP/KEEP/LEGACY categories based on usage audit + API dependency analysis

---

## Classification Criteria

### 🟢 KEEP - Actively Used (DO NOT DROP)

- Referenced by active API endpoints
- Used by live database views/functions
- Critical infrastructure (sequences, primary keys)
- High usage statistics (>10 scans since last restart)

### 🟡 LEGACY/DORMANT - Historical/Uncertain

- Low usage (<10 scans) but referenced somewhere
- May contain historical data
- Staging/ETL tables that run periodically
- **INVESTIGATE BEFORE DROPPING**

### 🔴 SAFE TO DROP - Unused Infrastructure

- Zero usage AND not referenced by any active code
- Orphaned indexes on active tables
- Duplicate/redundant indexes
- **SAFE TO DROP** (but backup first!)

---

## TABLES (20 total)

### 🟢 KEEP - Core Active Tables (14)

| Schema   | Table                       | Size    | Reason                                                                                                |
| -------- | --------------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `public` | `observations`              | 750+ MB | Primary data source - used by `api_network_explorer`, all `/api/threats/*`, timeline, heatmap, routes |
| `public` | `access_points`             | 200+ MB | Used by `api_network_explorer`, referenced by multiple views                                          |
| `app`    | `radio_manufacturers`       | 11 MB   | OUI enrichment - joined in `api_network_explorer`                                                     |
| `public` | `staging_locations_all_raw` | 250+ MB | Observations staging - high write volume                                                              |
| `app`    | `networks`                  | ?       | Used by `/api/threats/*`, `/api/networks/*`                                                           |
| `app`    | `network_tags`              | ?       | User tagging system - used by `/api/threats/*`                                                        |
| `app`    | `location_markers`          | ?       | Home location - critical for threat scoring                                                           |
| `public` | `wigle_networks_enriched`   | ?       | WiGLE API enrichment data                                                                             |

### 🟡 LEGACY/DORMANT - Low Usage, Investigate (6)

| Schema   | Table                  | Size   | Scans   | Status                                                                                     | Recommendation                                     |
| -------- | ---------------------- | ------ | ------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `public` | `mv_network_timeline`  | 44 MB  | 2 seq   | **ACTIVE API** (`/api/explorer/timeline/:bssid`) - low usage due to specific BSSID queries | **KEEP** - Refresh materialized view               |
| `public` | `mv_heatmap_tiles`     | 40 KB  | 2 seq   | **ACTIVE API** (`/api/explorer/heatmap`) - low usage, small size                           | **KEEP** - Refresh materialized view               |
| `public` | `mv_device_routes`     | 6 MB   | 5 seq   | **ACTIVE API** (`/api/explorer/routes`) - low usage                                        | **KEEP** - Refresh materialized view               |
| `public` | `ssid_history`         | 4.4 MB | 6 total | Historical SSID tracking - low usage                                                       | **INVESTIGATE** - Check if used by any ETL/reports |
| `public` | `staging_routes`       | 7.5 MB | 7 seq   | ETL staging table - may be used by batch jobs                                              | **INVESTIGATE** - Check ETL scripts                |
| `public` | `access_points_legacy` | 29 MB  | 9 total | Legacy schema - replaced by `access_points`                                                | **CANDIDATE FOR DROP** - Verify no references      |

**NOTE**: `mv_network_timeline`, `mv_heatmap_tiles`, `mv_device_routes` appear in low-usage list BUT are actively used by API endpoints. Low scan count is due to:

- Materialized views queried infrequently
- Specific use cases (timeline by BSSID, heatmap tiles)
- **THESE ARE LIVE APIs - DO NOT DROP**

---

## INDEXES (47 total, 25 never used)

### 🔴 SAFE TO DROP - Never Used, High Impact (11 indexes, 290+ MB total)

| Index                                  | Table                       | Size       | Reason                                            | Risk Level                               |
| -------------------------------------- | --------------------------- | ---------- | ------------------------------------------------- | ---------------------------------------- |
| `idx_raw_locations_natural_key`        | `staging_locations_all_raw` | **115 MB** | Staging table - may use sequential scans          | **LOW** - Staging table                  |
| `idx_observations_geom`                | `observations_legacy`       | **45 MB**  | **LEGACY TABLE** - entire table is legacy         | **LOW** - Legacy table                   |
| `idx_obs_geom_gist`                    | `observations`              | **22 MB**  | **DUPLICATE** - `idx_observations_v2_geom` exists | **MEDIUM** - Verify queries use v2 index |
| `idx_observations_v2_geom`             | `observations`              | **22 MB**  | Never used - **but geom queries are critical**    | **HIGH** - Verify before dropping        |
| `idx_observations_bssid`               | `observations_legacy`       | **20 MB**  | **LEGACY TABLE**                                  | **LOW**                                  |
| `idx_mv_network_timeline_bssid_bucket` | `mv_network_timeline`       | **16 MB**  | Matview - queries may use seq scan                | **MEDIUM** - Check query plans           |
| `idx_observations_time`                | `observations_legacy`       | **16 MB**  | **LEGACY TABLE**                                  | **LOW**                                  |
| `idx_mv_network_latest_geom`           | `mv_network_latest`         | 6.8 MB     | Unused materialized view index                    | **MEDIUM**                               |
| `routes_natural_uniq`                  | `routes`                    | 6 MB       | Unique constraint - never queried                 | **HIGH** - May be for integrity          |
| `idx_mv_network_latest_observed_at`    | `mv_network_latest`         | 3 MB       | Unused matview index                              | **MEDIUM**                               |
| `idx_observations_time_brin`           | `observations_legacy`       | 32 KB      | **LEGACY TABLE** - BRIN index                     | **LOW**                                  |

**RECOMMENDATION**: Drop all `observations_legacy` indexes first (81 MB total) - table is confirmed legacy

### 🟡 INVESTIGATE - Never Used, May Be Needed (14 indexes, 15 MB total)

| Index                                | Table                       | Size    | Reason                                                       |
| ------------------------------------ | --------------------------- | ------- | ------------------------------------------------------------ |
| `mv_convergence_events_geom_idx`     | `mv_convergence_events`     | 2 MB    | Geospatial index - may be needed for future queries          |
| `idx_simrf_*` (4 indexes)            | `mv_simultaneous_rf_events` | ~4 MB   | RF event analysis - specialized use case                     |
| `idx_routes_*` (3 indexes)           | `routes`                    | ~8.7 MB | Routes analysis - may be used by analytics                   |
| `idx_radio_manufacturers_oui`        | `app.radio_manufacturers`   | 1.7 MB  | **ACTIVELY USED TABLE** - index not hit due to query pattern |
| `idx_mv_network_explorer_last_seen`  | `mv_network_explorer`       | 1.4 MB  | Materialized view - may be obsolete                          |
| `device_sources_code_key`            | `device_sources`            | 16 KB   | Unique constraint - for integrity                            |
| `idx_mv_device_routes_*` (2 indexes) | `mv_device_routes`          | 24 KB   | **ACTIVE API** - indexes not used (small table?)             |
| `idx_mv_heatmap_tiles_geom`          | `mv_heatmap_tiles`          | 8 KB    | **ACTIVE API** - heatmap geospatial index                    |

**RECOMMENDATION**: Keep indexes on active API tables (`mv_device_routes`, `mv_heatmap_tiles`, `radio_manufacturers`) even if unused

### 🟢 KEEP - Used Indexes (22 indexes)

All indexes with `idx_scan > 0` should be kept. Key active indexes:

- `idx_observations_bssid_time` - Primary access path for observations
- `idx_access_points_bssid` - Join optimization
- `access_points_pkey`, `observations_pkey` - Primary keys
- All indexes with usage > 10 scans

---

## VIEWS (4 total)

### 🟢 KEEP - Active Views (1)

| View                   | Used By                                        | Status                     |
| ---------------------- | ---------------------------------------------- | -------------------------- |
| `api_network_explorer` | `/api/explorer/networks-v2` (PRIMARY ENDPOINT) | **CRITICAL** - DO NOT DROP |

### 🟡 SYSTEM VIEWS - PostGIS Infrastructure (3)

| View                          | Purpose                   | Status                   |
| ----------------------------- | ------------------------- | ------------------------ |
| `geography_columns`           | PostGIS system view       | **SYSTEM** - Do not drop |
| `geometry_columns`            | PostGIS system view       | **SYSTEM** - Do not drop |
| `spatial_ref_sys` (if exists) | PostGIS spatial reference | **SYSTEM** - Do not drop |

---

## MATERIALIZED VIEWS (7 total)

### 🟢 KEEP - Active API Endpoints (3)

| Matview               | Size  | Scans | Used By                         | Status         |
| --------------------- | ----- | ----- | ------------------------------- | -------------- |
| `mv_network_timeline` | 44 MB | 2     | `/api/explorer/timeline/:bssid` | **ACTIVE API** |
| `mv_heatmap_tiles`    | 40 KB | 2     | `/api/explorer/heatmap`         | **ACTIVE API** |
| `mv_device_routes`    | 6 MB  | 5     | `/api/explorer/routes`          | **ACTIVE API** |

**NOTE**: These appear in "low usage" list but are LIVE API endpoints - DO NOT DROP

### 🟡 INVESTIGATE - Unused Materialized Views (4)

| Matview                     | Size | Scans | Status                                           | Recommendation                                                |
| --------------------------- | ---- | ----- | ------------------------------------------------ | ------------------------------------------------------------- |
| `mv_network_latest`         | ?    | ?     | Unknown usage                                    | **INVESTIGATE** - Check if replaced by `api_network_explorer` |
| `mv_network_explorer`       | ?    | ?     | Possibly replaced by `api_network_explorer` view | **CANDIDATE FOR DROP**                                        |
| `mv_convergence_events`     | ?    | ?     | RF analysis - specialized                        | **INVESTIGATE**                                               |
| `mv_simultaneous_rf_events` | ?    | ?     | RF analysis - specialized                        | **INVESTIGATE**                                               |

---

## FUNCTIONS (0 in public/app schemas)

No user-defined functions found in `public` or `app` schemas. All functions are system/PostGIS functions.

---

## SEQUENCES

**Status**: Not analyzed in Phase 3 audit
**Recommendation**: Keep all sequences - critical for auto-incrementing IDs

---

## DROP PRIORITY MATRIX

### Priority 1: SAFE TO DROP NOW (High Impact, Zero Risk)

**Estimated Space Reclaimed**: ~126 MB

```sql
-- Legacy table indexes (all observations_legacy indexes)
DROP INDEX IF EXISTS public.idx_observations_geom;        -- 45 MB
DROP INDEX IF EXISTS public.idx_observations_bssid;       -- 20 MB
DROP INDEX IF EXISTS public.idx_observations_time;        -- 16 MB
DROP INDEX IF EXISTS public.idx_observations_time_brin;   -- 32 KB
-- TOTAL: 81 MB

-- Staging table indexes (may rebuild if needed)
DROP INDEX IF EXISTS public.idx_raw_locations_natural_key;  -- 115 MB
-- TOTAL: 115 MB + 81 MB = 196 MB
```

**Validation Required**: Verify `observations_legacy` table is not referenced anywhere

---

### Priority 2: INVESTIGATE THEN DROP (Potential 100+ MB)

**Action Required**: Manual investigation before dropping

1. **Verify `observations_legacy` table is unused**:

   ```sql
   -- Check if observations_legacy has any recent activity
   SELECT schemaname, relname, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del
   FROM pg_stat_user_tables
   WHERE relname = 'observations_legacy';

   -- If all zeros, safe to drop entire table
   DROP TABLE IF EXISTS public.observations_legacy CASCADE;  -- Frees ~150+ MB
   ```

2. **Check `access_points_legacy` usage**:

   ```sql
   -- Verify replacement by access_points table
   SELECT COUNT(*) FROM public.access_points_legacy;
   SELECT COUNT(*) FROM public.access_points;

   -- If access_points has all data, drop legacy
   DROP TABLE IF EXISTS public.access_points_legacy CASCADE;  -- Frees ~29 MB
   ```

3. **Evaluate duplicate geom indexes on observations**:

   ```sql
   -- Check query plans - which index is used?
   EXPLAIN ANALYZE
   SELECT * FROM observations
   WHERE geom IS NOT NULL
   AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(-83.696, 43.023), 4326)::geography, 1000)
   LIMIT 100;

   -- If idx_obs_geom_gist is used, drop idx_observations_v2_geom (22 MB)
   -- If idx_observations_v2_geom is used, drop idx_obs_geom_gist (22 MB)
   ```

---

### Priority 3: KEEP - DO NOT DROP

**Critical Infrastructure** (Referenced by active APIs):

- ✅ `api_network_explorer` view
- ✅ `mv_network_timeline`, `mv_heatmap_tiles`, `mv_device_routes` (materialized views)
- ✅ `observations`, `access_points`, `radio_manufacturers` (tables)
- ✅ `app.networks`, `app.network_tags`, `app.location_markers` (threat APIs)
- ✅ All primary key indexes (`*_pkey`)
- ✅ All unique constraints (data integrity)

---

## FINAL CLASSIFICATION SUMMARY

| Category             | Tables | Indexes | Views | Matviews | Total Objects |
| -------------------- | ------ | ------- | ----- | -------- | ------------- |
| 🟢 **KEEP** (Active) | 14     | 22      | 1     | 3        | **40**        |
| 🟡 **INVESTIGATE**   | 2      | 14      | 0     | 4        | **20**        |
| 🔴 **SAFE TO DROP**  | 0\*    | 11      | 0     | 0        | **11**        |
| **TOTAL**            | 20     | 47      | 4\*\* | 7        | **78\***      |

\* Potentially 2 legacy tables (`observations_legacy`, `access_points_legacy`) can be dropped after investigation
\*\* Includes 3 PostGIS system views

---

## RISK ASSESSMENT

### ⚠️ HIGH RISK - Do Not Drop Without Investigation

1. **Geospatial indexes on `observations`**:
   - `idx_obs_geom_gist` and `idx_observations_v2_geom` are both unused BUT geospatial queries are critical
   - May indicate query planner is using sequential scans (performance issue)
   - **Action**: Run EXPLAIN ANALYZE on geospatial queries before dropping

2. **Materialized view indexes**:
   - Indexes on `mv_network_timeline`, `mv_heatmap_tiles`, `mv_device_routes` show zero usage
   - These matviews are **ACTIVE API endpoints**
   - May indicate:
     - Matviews are small enough for seq scans
     - Indexes were created but queries don't use them
     - Matviews need REFRESH
   - **Action**: REFRESH MATERIALIZED VIEW before dropping indexes

3. **`radio_manufacturers` OUI index**:
   - Table is actively used in `api_network_explorer` join
   - Index shows zero scans
   - May indicate hash join instead of index scan
   - **Action**: Keep index - query planner may use it for larger datasets

### ✅ LOW RISK - Safe to Drop

1. **All `observations_legacy` indexes** (81 MB):
   - Entire table is legacy schema
   - Replaced by `public.observations` (partitioned by year)
   - **Action**: Verify table is unused, then drop CASCADE

2. **Staging table indexes**:
   - `idx_raw_locations_natural_key` on `staging_locations_all_raw`
   - ETL may rebuild index as needed
   - **Action**: Drop and monitor ETL jobs

---

## NEXT STEPS (Phase 5)

1. **Generate DROP script** (transaction-wrapped, not executed)
2. **Classify into 3 groups**:
   - Immediate drop (low risk, high impact)
   - Investigate then drop (requires validation)
   - Never drop (critical infrastructure)
3. **Include rollback commands** (CREATE INDEX statements)
4. **Add validation queries** (check table references before dropping)

---

**Generated**: 2025-12-20
**Status**: ✅ CLASSIFICATION COMPLETE
**Next Phase**: Generate DROP script (Phase 5)
