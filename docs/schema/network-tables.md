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

| Column            | Type                 | Notes                                                        |
| ----------------- | -------------------- | ------------------------------------------------------------ |
| `id`              | bigint               | PK (identity)                                                |
| `kml_file_id`     | bigint               | FK → `kml_files` (CASCADE DELETE)                            |
| `folder_name`     | text                 | KML folder label (e.g. "Wifi Networks", "Cellular Networks") |
| `name`            | text                 | Placemark name from the source KML                           |
| `network_id`      | text                 | Identifier parsed from KML description (Network ID field)    |
| `bssid`           | text                 | **WiFi BSSID**; null for non-WiFi rows                       |
| `encryption`      | text                 | Encryption type as parsed from KML                           |
| `attributes`      | text                 | Raw attribute string from the KML Placemark description      |
| `observed_at`     | timestamptz          |                                                              |
| `signal_dbm`      | double precision     | **signal strength (dBm)**                                    |
| `accuracy_m`      | double precision     | GPS accuracy in metres                                       |
| `network_type`    | text                 | e.g. WIFI, BLE, LTE                                          |
| `location`        | geometry(Point,4326) | **spatial column** from KML coordinates                      |
| `raw_description` | text                 | Original KML Placemark description before field parsing      |
| `raw_kml`         | jsonb                | Raw parsed KML payload; defaults to `{}`                     |

**Key indexes:**

- `idx_kml_points_location` — GIST on `location` (partial: `WHERE location IS NOT NULL`)
- `idx_kml_points_bssid` — btree on `bssid` (partial: `WHERE bssid IS NOT NULL`)
- `idx_kml_points_kml_file_id` — btree on `kml_file_id`; join performance with `kml_files`
- `idx_kml_points_network_id` — btree on `network_id` (partial: `WHERE network_id IS NOT NULL`)
- `idx_kml_points_observed_at` — btree on `observed_at DESC` (partial: `WHERE observed_at IS NOT NULL`); time-range queries
- `idx_kml_points_network_type` — btree on `network_type` (partial: `WHERE network_type IS NOT NULL`); filter by radio type

---

## `app.network_sibling_pairs` — Sibling Heuristic Pairs

Stores candidate sibling relationships detected via background jobs.

- **PK:** `(bssid1, bssid2)` where `bssid1 < bssid2` (lexicographically)
- **Key Columns**:
  - `bssid1`, `bssid2` (varchar(17), foreign key to `app.networks`)
  - `confidence` (numeric(6,3), CHECK constraint `network_sibling_pairs_conf_chk` allows `0.000` to `2.000`; heuristic generator clamps to `<= 1.000`)
  - `pair_strength` (text: `'candidate'`, `'strong'`, `'verified'`)
  - `rule` (text, e.g., `last_octet_sequential`, `Mist Systems VAP (Class A)`)
  - `source` (text, e.g., `detection_pipeline_v2`)
- **Key References**: [siblingDetectionQueries.ts](../../server/src/services/admin/siblingDetectionQueries.ts) for query construction and confidence demotions.

---

## `app.network_sibling_overrides` — Sibling Analyst Overrides

User-declared overrides that supersede heuristic matching results.

- **PK:** `(bssid1, bssid2)` where `bssid1 < bssid2`
- **Key Columns**:
  - `bssid1`, `bssid2` (varchar(17))
  - `relation` (text: `'sibling'` to confirm, `'not_sibling'` to suppress)
  - `confidence` (numeric(6,3), CHECK constraint `network_sibling_overrides_conf_chk` allows `0.000` to `2.000`, default `1.000`)
  - `is_active` (boolean)
  - `updated_by` (text, default `'analyst'`)
- **Function**: `app.set_network_sibling_override(p_bssid_a, p_bssid_b, p_relation, p_updated_by, p_notes, p_confidence)` normalizes input order using `LEAST`/`GREATEST` before upserting.

---

## `app.network_siblings_effective` — Connected Sibling View

A view merging heuristic pairs and overrides:

1. Surfaces manual overrides where `relation = 'sibling'` immediately as `source = 'manual'`.
2. Includes heuristic pairs from `app.network_sibling_pairs` where `confidence >= 0.92` only if they are not suppressed by an active `not_sibling` override.

---

## `app.surveillance_detections` — Threat Classification Records

Stores identified surveillance gear signatures (cameras, body-worn sensors, gunshot alerts).

- **PK:** `id` (serial)
- **Unique Constraint:** `(bssid)`
- **Key Columns**:
  - `bssid` (text, references `app.networks`)
  - `detected_at` (timestamptz)
  - `device_type` (text, e.g., `FLOCK_SAFETY_CAMERA`, `SHOTSPOTTER_SENSOR`, `AXON_BODY_CAMERA`)
  - `confidence` (numeric, 0.0 to 1.0)
  - `threat_score` (numeric, 0.0 to 100.0)
  - `detection_method` (text, e.g., `oui_match`, `ssid_pattern`)
  - `false_positive` (boolean) and `fp_reason` (text)
- **References**: [surveillanceDetectionRepository.ts](../../server/src/repositories/surveillanceDetectionRepository.ts)

---

## `app.oui_device_groups` — OUI Device Profiling

Static lookup mapping MAC prefix (OUI) allocations to device threat categories.

- **PK:** `id` (integer)
- **Key Columns**:
  - `oui` (varchar(8), e.g., `'00:14:3E'`)
  - `vendor_name` (varchar(256))
  - `surveillance_type` (varchar(50), e.g., `'FLOCK_SAFETY_CAMERA'`, `'AXON_BODY_CAMERA'`)
  - `surveillance_confidence` (varchar(20), e.g., `'HIGH'`, `'MEDIUM'`)

---

## `app.network_media` — Attached Evidence Payloads

Stores VisINT and forensic photo evidence attachments.

- **PK:** `id`
- **Key Columns**:
  - `bssid` (text)
  - `media_type` (text, strictly `'image'` or `'video'`)
  - `filename`, `file_size`, `mime_type`
  - `media_data` (bytea binary blob)
  - `thumbnail` (bytea preview blob, optional)
  - `description` (text, contains correlation distances or manual notes)
  - `exif_lat` (numeric(10,8), GPS latitude extracted from image EXIF)
  - `exif_lon` (numeric(11,8), GPS longitude extracted from image EXIF)
  - `exif_captured_at` (timestamptz, image capture timestamp from EXIF)
  - `exif_make`, `exif_model` (varchar, optional camera manufacturer/model)
  - `exif_altitude` (numeric(9,3), optional GPS altitude in meters)
  - `exif_bearing` (numeric(6,3), optional GPS image direction in degrees)
  - `exif_width`, `exif_height` (integer, optional original image dimensions)

### `app.network_media_summary`

Read-only view that exposes `media_count` grouped by matched `bssid`. Rows attached to
the `VISINT_UNMATCHED` sentinel are excluded.

---

## `app.deflock_cameras` & `app.shotspotter_sensors` — Leak Overlay Feeds

Reference datasets mapping public Flock cameras and WIRED-leaked ShotSpotter coordinates.

- **`app.deflock_cameras`**:
  - `id` (PK, serial)
  - `lat`, `lon` (numeric)
  - `geom` (geometry(Point,4326))
  - `camera_type`, `agency`, `operator`, `name`, `address`, `street`, `housenumber`,
    `postcode`, `city`, `state`, `country`, `manufacturer`, `manufacturer_wikidata`,
    `direction`, `camera_mount`, `surveillance`, `surveillance_type`,
    `surveillance_zone`, `electricity`, `website`, `source_id`, `source` (promoted metadata)
  - `source_properties` (JSONB containing the complete original FLOCK/OSM feature
    properties for provenance and future queries)
  - FLOCK snapshot imports use exact full-precision `(lat, lon)` identity, merge
    duplicate coordinates with first-non-empty-value precedence, refresh existing
    `FLOCK_REPO` rows, and remove stale `FLOCK_REPO` rows absent from a fully
    validated snapshot. Rows from other sources are not deleted.
- **`app.shotspotter_sensors`**:
  - `id` (PK, serial)
  - `lat`, `lon` (double precision)
  - `geom` (geometry(Point,4326))
  - `sensor_id`, `city`, `state`, `country`, `status`, `source` (metadata)
- **Matching Views**:
  - `app.surveillance_deflock_matches`: Matches detections within 100m of a camera.
  - `app.surveillance_shotspotter_sensor_matches`: Matches detections within 200m of a sensor.
