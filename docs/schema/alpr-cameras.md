# ALPR cameras

`app.alpr_cameras` stores the current source-of-truth set of OSM surveillance
camera nodes collected by the local ALPR sync daemon.

| Column              | Type                   | Meaning                                          |
| ------------------- | ---------------------- | ------------------------------------------------ |
| `osm_id`            | `BIGINT`               | OSM node identifier and primary key              |
| `geom`              | `geometry(Point,4326)` | Current WGS84 camera position                    |
| `source_properties` | `JSONB`                | Raw non-empty OSM tags from the latest refresh   |
| `last_seen`         | `TIMESTAMPTZ`          | Time the node was observed in the latest refresh |

The daemon processes a complete set of U.S. bounding-box chunks in one
transaction. Rows absent from the successful refresh are deleted, so the table
represents the current OSM source rather than an append-only history.

## API Endpoints

- `GET /api/v1/surveillance/alpr-cameras`: Returns a GeoJSON FeatureCollection of all ALPR cameras with properties projected from `source_properties`:
  - `id` / `osm_id`: OSM node identifier (`TEXT`)
  - `manufacturer`: Camera manufacturer (e.g. `Flock Safety`, `Motorola Solutions`, `Genetec`)
  - `direction`: Camera direction in degrees
  - `camera_type`: Mounting configuration (e.g. `fixed`)
  - `surveillance_zone`: Target zone (e.g. `traffic`)
  - `camera_mount`: Pole, wall, or structure mount
  - `operator`: Deploying agency or entity
  - `electricity`: Power source (e.g. `solar`)
