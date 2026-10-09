# ALPR cameras

`app.alpr_cameras` stores the current set of OSM surveillance camera nodes,
including ALPR cameras, imported from a national OSM PBF extract by
`scripts/alpr/ingest-national-osm.ts`.

| Column              | Type                   | Meaning                                          |
| ------------------- | ---------------------- | ------------------------------------------------ |
| `osm_id`            | `BIGINT`               | OSM node identifier and primary key              |
| `geom`              | `geometry(Point,4326)` | Current WGS84 camera position                    |
| `source_properties` | `JSONB`                | Raw non-empty OSM tags from the latest refresh   |
| `last_seen`         | `TIMESTAMPTZ`          | Time the node was observed in the latest refresh |

The national importer filters OSM nodes tagged `man_made=surveillance`,
`surveillance:type=ALPR|camera`, or `camera:type=*`, then streams GeoJSON
features into parameterized batches (default 2,000; supported range 1,000–5,000).
It is dry-run by default. Applying the import upserts by OSM node ID and runs
`VACUUM ANALYZE` after ingestion. It writes rollback snapshots before each
batch; use `scripts/alpr/rollback-national-osm.ts` with the snapshot file to
restore prior rows and remove rows inserted by that import.

The primary key on `osm_id` provides idempotency. `idx_alpr_cameras_geom_gist`
supports spatial bounding-box lookups.

## API Endpoints

- `GET /api/v1/surveillance/alpr-cameras`: Returns a GeoJSON FeatureCollection of all cameras with properties projected from `source_properties`. An optional `bbox=west,south,east,north` query limits results spatially (for example, `?bbox=-74.05,40.65,-73.85,40.85`):
  - `id` / `osm_id`: OSM node identifier (`TEXT`)
  - `manufacturer`: Camera manufacturer (e.g. `Flock Safety`, `Motorola Solutions`, `Genetec`)
  - `direction`: Camera direction in degrees
  - `camera_type`: Mounting configuration (e.g. `fixed`)
  - `surveillance_zone`: Target zone (e.g. `traffic`)
  - `camera_mount`: Pole, wall, or structure mount
  - `operator`: Deploying agency or entity
  - `electricity`: Power source (e.g. `solar`)
