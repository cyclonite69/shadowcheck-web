# Network Tables — Schema Reference

Last verified: 2026-04-25 via live DB (`app` schema on `shadowcheck_postgres`).

This file provides a detailed reference for the primary tables containing wireless network observations and metadata.

---

## `app.wigle_v2_networks_search` — WiGLE v2 API Data

**Row count:** ~86,007  
**PK:** `id bigint`  
**Note:** Per-network-location record.

| Column       | Type                 | Notes                        |
| ------------ | -------------------- | ---------------------------- |
| `id`         | bigint               | PK                           |
| `location`   | geometry(Point,4326) | **spatial column**           |
| `trilat`     | numeric              | WiGLE trilaterated latitude  |
| `trilong`    | numeric              | WiGLE trilaterated longitude |
| `ssid`       | character varying    |                              |
| `bssid`      | character varying    | **network identifier**       |
| `firsttime`  | timestamptz          |                              |
| `lasttime`   | timestamptz          |                              |
| `lastupdt`   | timestamptz          |                              |
| `type`       | character varying    |                              |
| `encryption` | character varying    |                              |
| `channel`    | integer              |                              |
| `frequency`  | integer              |                              |
| `name`       | character varying    |                              |
| `comment`    | text                 |                              |
| `source`     | character varying    |                              |
| `country`    | character            |                              |
| `region`     | character varying    |                              |
| `city`       | character varying    |                              |
| `road`       | character varying    |                              |

**Key indexes:**

- `idx_wigle_v2_location` — GIST on `location`
- `idx_wigle_v2_bssid` — btree on `bssid`

---

## `app.wigle_v3_network_details` — WiGLE v3 Enriched Metadata

**Row count:** ~1,854  
**PK:** `netid text` (implicit)

| Column           | Type             | Notes          |
| ---------------- | ---------------- | -------------- |
| `netid`          | text             | **PK / BSSID** |
| `name`           | text             |                |
| `type`           | text             |                |
| `comment`        | text             |                |
| `ssid`           | text             |                |
| `trilat`         | double precision |                |
| `trilon`         | double precision |                |
| `encryption`     | text             |                |
| `channel`        | integer          |                |
| `first_seen`     | timestamptz      |                |
| `last_seen`      | timestamptz      |                |
| `last_update`    | timestamptz      |                |
| `street_address` | jsonb            |                |
| `city`           | text             |                |
| `region`         | text             |                |
| `country`        | text             |                |

---

## `app.wigle_v3_observations` — WiGLE v3 Per-Observation Data

**Row count:** ~86,763  
**PK:** `id integer`

| Column        | Type                 | Notes                     |
| ------------- | -------------------- | ------------------------- |
| `id`          | integer              | PK                        |
| `netid`       | text                 | **BSSID**                 |
| `latitude`    | double precision     |                           |
| `longitude`   | double precision     |                           |
| `signal`      | integer              | **signal strength (dBm)** |
| `observed_at` | timestamptz          |                           |
| `location`    | geometry(Point,4326) | **spatial column**        |

**Key indexes:**

- `idx_wigle_v3_obs_location` — GIST on `location`
- `idx_wigle_v3_obs_netid` — btree on `netid`

---

## `app.kml_points` — KML Import Data

**Row count:** ~316,445  
**PK:** `id bigint`

| Column         | Type                 | Notes                     |
| -------------- | -------------------- | ------------------------- |
| `id`           | bigint               | PK                        |
| `kml_file_id`  | bigint               | FK → `kml_files`          |
| `bssid`        | text                 | **network identifier**    |
| `observed_at`  | timestamptz          |                           |
| `signal_dbm`   | double precision     | **signal strength (dBm)** |
| `location`     | geometry(Point,4326) | **spatial column**        |
| `network_type` | text                 |                           |

**Key indexes:**

- `idx_kml_points_location` — GIST on `location`
- `idx_kml_points_bssid` — btree on `bssid`
