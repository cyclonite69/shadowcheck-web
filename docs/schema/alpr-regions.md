# ALPR regions

`app.alpr_regions` stores durable per-metro sync outcome for the ALPR/Overpass
pipeline. Region identity and bounding boxes are seeded from the
`ALPR_REGIONS` code constant in `src/alpr/regions.ts`.

| Column               | Type          | Meaning                                                               |
| -------------------- | ------------- | --------------------------------------------------------------------- |
| `region_id`          | `TEXT` PK     | Stable metro key (e.g. `seattle`) — matches `AlprRegion.id`           |
| `name`               | `TEXT`        | Display label (`AlprRegion.label`)                                    |
| `state`              | `TEXT`        | US state / DC code                                                    |
| `bbox`               | `JSONB`       | `[west, south, east, north]`                                          |
| `sync_status`        | `TEXT`        | `idle` \| `running` \| `success` \| `failed`                          |
| `last_sync_at`       | `TIMESTAMPTZ` | When the last attempt reached a terminal status                       |
| `last_chunk_count`   | `INT`         | Overpass grid chunks used on last success                             |
| `last_element_count` | `INT`         | Candidate records after in-memory osm_id dedupe on last success       |
| `cooldown_until`     | `TIMESTAMPTZ` | Observability only (1h after success, 6h after failure); not enforced |
| `updated_at`         | `TIMESTAMPTZ` | Last row mutation                                                     |

Writers: `src/alpr/alprRegionState.ts`, called from web `syncAlprRegion` and
daemon `runRegion`. The global rotation cursor in `app.settings`
(`alpr_sync_region_cursor`) is separate and unchanged.
