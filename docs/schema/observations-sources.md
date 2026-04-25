# Observations Sources — Schema Reference

Last verified: 2026-04-25 via live DB (`app` schema on `shadowcheck_postgres`).

This file exists so agents do not need SSM round trips to discover table shapes.
Update it whenever a migration changes columns, indexes, or row counts significantly.

---

## Summary Table

| Layer         | Table                          | Rows (approx) | Geom col   | Signal col                | Time col               | Network ID col              |
| ------------- | ------------------------------ | ------------- | ---------- | ------------------------- | ---------------------- | --------------------------- |
| Field (local) | `app.observations`             | ~655,542      | `geom`     | `level` (int, dBm)        | `time` / `observed_at` | `bssid`                     |
| WiGLE v2      | `app.wigle_v2_networks_search` | ~86,007       | `location` | — none —                  | `lasttime`             | `bssid`                     |
| WiGLE v3      | `app.wigle_v3_observations`    | ~86,763       | `location` | `signal` (int, dBm)       | `observed_at`          | `netid` (= BSSID value, FK) |
| KML           | `app.kml_points`               | ~316,445      | `location` | `signal_dbm` (float, dBm) | `observed_at`          | `bssid`                     |

All geometry columns are `geometry(Point,4326)` with GIST indexes. No migrations required for spatial queries.

---

## `app.observations` — Field / Local Data

**Row count:** ~655,542  
**PK:** `id bigint` (sequence `observations_v2_id_seq`)

| Column                | Type                 | Notes                                |
| --------------------- | -------------------- | ------------------------------------ |
| `id`                  | bigint               | PK                                   |
| `device_id`           | text                 | FK → `device_sources(code)`          |
| `bssid`               | text                 | uppercase enforced via CHECK         |
| `ssid`                | text                 |                                      |
| `radio_type`          | text                 |                                      |
| `radio_frequency`     | integer              |                                      |
| `radio_capabilities`  | text                 |                                      |
| `level`               | integer              | **signal strength (dBm)**            |
| `lat`                 | double precision     |                                      |
| `lon`                 | double precision     |                                      |
| `altitude`            | double precision     |                                      |
| `accuracy`            | double precision     |                                      |
| `time`                | timestamptz          | **primary time column**              |
| `observed_at`         | timestamptz          | generated always as (`time`) stored  |
| `observed_at_ms`      | bigint               | epoch ms                             |
| `geom`                | geometry(Point,4326) | **spatial column**                   |
| `source_tag`          | text                 | device/source identifier (see below) |
| `source_pk`           | text                 | original PK from source device       |
| `external`            | boolean              | default false                        |
| `mfgrid`              | integer              | manufacturer grid                    |
| `is_temporal_cluster` | boolean              | quality flag                         |
| `is_duplicate_coord`  | boolean              | quality flag                         |
| `is_extreme_signal`   | boolean              | quality flag                         |
| `is_quality_filtered` | boolean              | quality flag                         |

**Key indexes:**

- `idx_obs_geom_gist` — GIST on `geom` (buffering=auto, fillfactor=90)
- `idx_observations_v2_geom` — GIST on `geom` (secondary)
- `idx_observations_bssid_time_desc` — btree `(bssid, time DESC)`
- `idx_obs_device_time` — btree `(device_id, time)`

### `source_tag` values (as of 2026-04-25)

| source_tag                 | Count   | Description                      |
| -------------------------- | ------- | -------------------------------- |
| `s22_backup`               | 496,882 | Samsung S22 backup scan dataset  |
| `s22_main`                 | 109,026 | Samsung S22 primary scan dataset |
| `android_shadowcheck_test` | 25,842  | Android test device              |
| `j24`                      | 20,933  | Device j24                       |
| `g63`                      | 2,509   | Device g63                       |
| `s22_backup_2`             | 350     | Samsung S22 backup supplemental  |

`source_tag` values are device/import identifiers — they are **not** `'v2'`, `'v3'`, `'kml'`, or `'field'`. Those layer names are frontend-only concepts.

---

## `app.wigle_v2_networks_search` — WiGLE v2 API Data

**Row count:** ~86,007  
**PK:** `id bigint`  
**Unique constraint:** `(bssid, trilat, trilong, lastupdt)`  
**Note:** Per-network-location record, NOT per individual observation. No per-obs signal strength.

| Column        | Type                 | Notes                        |
| ------------- | -------------------- | ---------------------------- |
| `id`          | bigint               | PK                           |
| `bssid`       | varchar(17)          | **network identifier**       |
| `ssid`        | varchar(255)         |                              |
| `name`        | varchar(255)         | friendly name                |
| `type`        | varchar(50)          | network type (WiFi, etc.)    |
| `encryption`  | varchar(50)          |                              |
| `channel`     | integer              |                              |
| `frequency`   | integer              |                              |
| `trilat`      | numeric(12,10)       | WiGLE trilaterated latitude  |
| `trilong`     | numeric(13,10)       | WiGLE trilaterated longitude |
| `location`    | geometry(Point,4326) | **spatial column**           |
| `firsttime`   | timestamptz          | first observed               |
| `lasttime`    | timestamptz          | **primary time column**      |
| `lastupdt`    | timestamptz          | last updated in WiGLE        |
| `region`      | varchar(100)         |                              |
| `city`        | varchar(100)         |                              |
| `road`        | varchar(255)         |                              |
| `housenumber` | varchar(255)         |                              |
| `country`     | char(2)              |                              |
| `comment`     | text                 |                              |
| `source`      | varchar(255)         |                              |

**Key indexes:**

- `idx_wigle_v2_location` — GIST on `location`
- `idx_wigle_v2_bssid` — btree on `bssid`
- `idx_wigle_v2_lasttime` — btree on `lasttime DESC`
- `idx_wigle_v2_country_region_encryption_lasttime` — composite (WHERE trilat/trilong NOT NULL)

---

## `app.wigle_v3_observations` — WiGLE v3 Per-Observation Data

**Row count:** ~86,763  
**PK:** `id integer` (sequence)  
**Unique constraint:** `(netid, latitude, longitude, observed_at)`  
**FK:** `netid → app.wigle_v3_network_details(netid)` ON DELETE CASCADE

| Column        | Type                 | Notes                                  |
| ------------- | -------------------- | -------------------------------------- |
| `id`          | integer              | PK                                     |
| `netid`       | text                 | **network identifier** (= BSSID value) |
| `latitude`    | double precision     |                                        |
| `longitude`   | double precision     |                                        |
| `altitude`    | double precision     |                                        |
| `accuracy`    | double precision     |                                        |
| `signal`      | integer              | **signal strength (dBm)**              |
| `observed_at` | timestamptz          | **primary time column**                |
| `last_update` | timestamptz          |                                        |
| `ssid`        | text                 |                                        |
| `frequency`   | integer              |                                        |
| `channel`     | integer              |                                        |
| `encryption`  | text                 |                                        |
| `noise`       | integer              |                                        |
| `snr`         | integer              |                                        |
| `month`       | text                 | WiGLE month bucket                     |
| `location`    | geometry(Point,4326) | **spatial column**                     |
| `imported_at` | timestamptz          | default now()                          |

**Key indexes:**

- `idx_wigle_v3_obs_location` — GIST on `location`
- `idx_wigle_v3_obs_netid` — btree on `netid`
- `idx_wigle_v3_obs_time` — btree on `observed_at`

### Related table: `app.wigle_v3_network_details`

**Row count:** ~1,854 — per-network lookup (one row per netid).  
Join to get enriched fields (manufacturer, public flags, geocoded address, etc.) for tooltip rendering. Not needed for spatial aggregation queries.

---

## `app.kml_points` — KML Import Data

**Row count:** ~316,445  
**PK:** `id bigint` (identity)  
**FK:** `kml_file_id → kml_files(id)` ON DELETE CASCADE

| Column            | Type                 | Notes                             |
| ----------------- | -------------------- | --------------------------------- |
| `id`              | bigint               | PK                                |
| `kml_file_id`     | bigint               | FK → `kml_files`                  |
| `bssid`           | text                 | **network identifier** (nullable) |
| `network_id`      | text                 | raw network ID from KML           |
| `encryption`      | text                 |                                   |
| `signal_dbm`      | double precision     | **signal strength (dBm)**         |
| `accuracy_m`      | double precision     |                                   |
| `network_type`    | text                 |                                   |
| `observed_at`     | timestamptz          | **primary time column**           |
| `location`        | geometry(Point,4326) | **spatial column** (nullable)     |
| `folder_name`     | text                 |                                   |
| `name`            | text                 |                                   |
| `attributes`      | text                 |                                   |
| `raw_description` | text                 |                                   |
| `raw_kml`         | jsonb                | default `'{}'`                    |

**Key indexes:**

- `idx_kml_points_location` — GIST on `location` WHERE location IS NOT NULL
- `idx_kml_points_bssid` — btree on `bssid` WHERE bssid IS NOT NULL
- `idx_kml_points_observed_at` — btree on `observed_at DESC` WHERE observed_at IS NOT NULL
- `idx_kml_points_network_type` — btree on `network_type` WHERE network_type IS NOT NULL

**Important:** `location` is nullable. Always add `WHERE location IS NOT NULL` in spatial queries.

---

## UNION Query Pattern

For aggregated spatial queries across all four sources:

```sql
-- field observations
SELECT ST_SnapToGrid(geom,     $grid_size) AS cell, COUNT(*) AS n, AVG(level)      AS avg_signal, 'field'    AS source
FROM app.observations
WHERE geom && ST_MakeEnvelope($west, $south, $east, $north, 4326)
GROUP BY 1

UNION ALL

-- WiGLE v2 (no per-obs signal)
SELECT ST_SnapToGrid(location, $grid_size),          COUNT(*),     NULL            AS avg_signal, 'wigle-v2' AS source
FROM app.wigle_v2_networks_search
WHERE location && ST_MakeEnvelope($west, $south, $east, $north, 4326)
GROUP BY 1

UNION ALL

-- WiGLE v3
SELECT ST_SnapToGrid(location, $grid_size),          COUNT(*),     AVG(signal)     AS avg_signal, 'wigle-v3' AS source
FROM app.wigle_v3_observations
WHERE location && ST_MakeEnvelope($west, $south, $east, $north, 4326)
GROUP BY 1

UNION ALL

-- KML (location nullable)
SELECT ST_SnapToGrid(location, $grid_size),          COUNT(*),     AVG(signal_dbm) AS avg_signal, 'kml'      AS source
FROM app.kml_points
WHERE location && ST_MakeEnvelope($west, $south, $east, $north, 4326)
  AND location IS NOT NULL
GROUP BY 1
```

Outer query: group by `(cell, source)`, emit `ST_X(cell)` / `ST_Y(cell)` for GeoJSON coordinates.
