# API Reference

**Sub-Guides:**

- **[Exhaustive Express Route Inventory](api/route-inventory.md)** — The complete list of all route mounts, modules, and classifications.
- **[Manual-Only Safety Guide](api/manual-only-endpoints.md)** — Dangerous/destructive operations and test automation rules.
- **Wiki version (diagrams):** [API Reference](../.github/wiki/API-Reference.md)

This document serves as the curated, operator-facing REST API reference for the ShadowCheck platform. For a complete mapping of all developer routes, see the route inventory linked above.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Protected endpoints require authentication. Two methods are supported:

### Session-Based (Browser)

Sessions are managed via HTTP-only cookies. After a successful `POST /api/auth/login` the server sets an HTTP-only `session_token` cookie. The client must pass `credentials: 'include'` on every subsequent request.

### Bearer Token

```http
Authorization: Bearer <token>
```

Pass the token returned by `POST /api/auth/login` in the `Authorization` header for non-browser clients.

> **Note:** `x-api-key` header authentication is **not** implemented. The middleware (`authMiddleware.ts`) accepts only the `session_token` cookie and `Authorization: Bearer` header.

## Rate Limiting

- **50,000 requests per 15 minutes** per IP (localhost and private IPs are exempt)
- Returns `429 Too Many Requests` when exceeded

---

## Infrastructure & Reference Layers

Public GeoJSON endpoints for geospatial visualization. Note: `/agency-offices` and `/federal-courthouses` are mounted at the root level to bypass standard API auth for map display. The ALPR/ShotSpotter layers require standard user authentication.

### GET /agency-offices

Returns a GeoJSON FeatureCollection of all FBI Field Offices and Resident Agencies.

**Response:**

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-83.0458, 42.3314] },
      "properties": {
        "name": "Detroit Field Office",
        "office_type": "field_office",
        "address": "477 Michigan Ave, Detroit, MI 48226"
      }
    }
  ]
}
```

### GET /agency-offices/count

Returns public, read-only agency office counts grouped by office type.

### GET /federal-courthouses

Returns a GeoJSON FeatureCollection of all Federal Courthouses.

---

### GET /api/v1/surveillance/deflock-cameras 🔒

Returns a GeoJSON FeatureCollection of Flock Safety ALPR (Automatic License Plate Reader)
camera locations. Each feature includes lightweight promoted source metadata when present:
`source_id`, `camera_type`, `agency`, `operator`, `name`, address components,
`manufacturer`, `direction`, `camera_mount`, surveillance fields, `electricity`, and
`website`. The complete original FLOCK/OSM property object is retained in the database
for provenance but is not included in this map payload.

---

### GET /api/v1/surveillance/shotspotter-zones 🔒

Returns a GeoJSON FeatureCollection of acoustic gunshot detection coverage zones.

---

### GET /api/v1/surveillance/shotspotter-sensors 🔒

Returns a GeoJSON FeatureCollection of ShotSpotter acoustic sensor points (from the WIRED 2024 leaked dataset).

---

## Dashboard

### GET /api/dashboard/metrics

Platform statistics (canonical v1 route).

**Response:**

```json
{
  "totalNetworks": 173326,
  "threatsCount": 1842,
  "surveillanceCount": 256,
  "enrichedCount": 45123
}
```

> **Note:** `GET /api/dashboard-metrics` was a legacy alias for this route and has been removed. Use `/api/dashboard/metrics` (v1) or `/api/v2/dashboard/metrics` (v2).

### GET /api/dashboard/threats

Returns the current dashboard threat list. Requires an authenticated user.

### GET /api/dashboard/summary

Returns summary counts for networks, threats, critical threats, and active surveillance. Requires an authenticated user.

### GET /api/v2/dashboard/metrics

Dashboard statistics (v2).

---

## Threats

### GET /api/threats/quick

Fast paginated threat detection.

**Parameters:**

- `page` (int, default: 1)
- `limit` (int, default: 100, max: 5000)
- `minSeverity` (int, default: 40, range: 0-100)

**Response:**

```json
{
  "threats": [
    {
      "bssid": "AA:BB:CC:DD:EE:FF",
      "ssid": "Hidden Network",
      "type": "W",
      "threat_score": 75,
      "distance_range_km": 2.5,
      "observation_count": 45,
      "unique_days": 8,
      "seen_at_home": true,
      "seen_away_from_home": true,
      "max_speed_kmh": 65,
      "manufacturer": "Apple Inc."
    }
  ],
  "pagination": {
    "page": 1,
    "total": 1842,
    "totalPages": 19
  }
}
```

### GET /api/threats/detect

Advanced threat detection with speed calculations.

### GET /api/reports/threat/:bssid

Generate a threat report for one network in JSON, Markdown, HTML, or PDF format.

### GET /api/v2/threats/map

Threat data optimized for map display.

### GET /api/v2/threats/severity-counts

Threat counts by severity level.

---

## Networks

### GET /api/networks

List networks with pagination and filtering.

**Parameters:**

- `page` (int, default: 1) - Page number
- `limit` (int, default: 100, max: 5000) - Results per page
- `sort` (string) - Sort field (bssid, ssid, last_seen, threat_score, etc.)
- `order` (string) - Sort order (ASC, DESC)
- `location_mode` (string) - Data source mode:
  - `latest_observation` - Uses latest observation data (recommended)
  - `aggregated` - Uses materialized view aggregated data
- `distance_from_home` (float) - Filter by distance from home location

**Response:**

```json
{
  "networks": [
    {
      "bssid": "AA:BB:CC:DD:EE:FF",
      "ssid": "MyNetwork",
      "type": "W",
      "signal": -45,
      "frequency": 2437,
      "channel": 6,
      "manufacturer": "Apple Inc.",
      "max_distance_meters": 1250.5,
      "threat_score": 25,
      "last_seen": "2026-01-30T06:30:19.059Z"
    }
  ],
  "pagination": {
    "page": 1,
    "total": 173326,
    "totalPages": 1734
  }
}
```

**Note:** The API now uses latest observation data by default for accurate real-time information. Manufacturer fields are populated via OUI prefix matching from BSSID MAC addresses.

### GET /api/networks/observations/:bssid

Get all observations for a network.

**Response:** `observations[].time` is a JavaScript-safe numeric epoch timestamp in
milliseconds.

### GET /api/networks/search/:ssid

Search by SSID.

### GET /api/networks/tagged

List tagged networks.

### POST /api/network-tags/:bssid 🔒

Tag a network (requires authentication).

**Request:**

```json
{
  "threat_tag": "LEGIT",
  "threat_confidence": 0.95,
  "notes": "Home router"
}
```

**Tag Types:**

- `LEGIT`: Safe
- `FALSE_POSITIVE`: Incorrectly flagged
- `INVESTIGATE`: Needs review
- `THREAT`: Confirmed threat

### DELETE /api/network-tags/:bssid 🔒

Remove tag.

### GET /api/manufacturer/:bssid

Lookup manufacturer from MAC OUI.

### POST /api/networks/tag-threats 🔒

Tag multiple networks as threats.

---

### GET /api/networks/nearest-agencies/:bssid

Retrieves the nearest law enforcement agency offices for a specific network observation point.

---

### POST /api/networks/nearest-agencies/batch 🔒

Batch retrieves nearest agencies for multiple BSSIDs.

**Request:**

```json
{
  "bssids": ["00:11:22:33:44:55"]
}
```

---

### POST /api/networks/nearest-courthouses/batch 🔒

Batch retrieves nearest federal courthouses for multiple BSSIDs.

---

### GET /api/networks/:bssid/notes 🔒

Get notes for a network (user-facing view).

---

### POST /api/networks/:bssid/notes 🔒

Add a new note to a network.

---

### PATCH /api/networks/:bssid/notes/:noteId 🔒

Update an existing note for a network. Requires admin privileges.

---

### DELETE /api/networks/:bssid/notes/:noteId 🔒

Delete a note by its ID. Requires admin privileges.

---

## v2 Networks API

### GET /api/v2/networks

List networks with pagination.

### GET /api/v2/networks/:bssid

Get specific network details.

### GET /api/v2/networks/filtered

Filtered network list with universal filter support. Powers the Geospatial Explorer and filtered table views.

**Parameters:**

- `page` (int, default: 1)
- `limit` (int, default: 100, max: 5000)
- `sort` (string) - Field to sort by (ssid, bssid, observed_at, threat_score, etc.)
- `order` (string) - Sort direction (ASC, DESC)
- `filters` (JSON string) - Universal filter payload (see below)
- `enabled` (JSON string) - Map of which filters are active

**Universal Filter Payload Structure:**

```json
{
  "filters": {
    "ssid": "Target SSID",
    "bssid": "00:11:22:*",
    "threatLevel": ["HIGH", "CRITICAL"],
    "timeframe": {
      "scope": "LAST_SEEN",
      "relativeWindow": "30d"
    },
    "wigle_v3_observation_count_min": 10,
    "geocodedCity": "Detroit"
  },
  "enabled": {
    "ssid": true,
    "threatLevel": true,
    "timeframe": true
  }
}
```

**Response:**

```json
{
  "ok": true,
  "data": [...],
  "pagination": { "page": 1, "total": 173326, "totalPages": 1734 },
  "filters": { "applied": [...], "ignored": [...], "warnings": [...] }
}
```

### GET /api/v2/networks/filtered/geospatial

Filtered networks optimized for geospatial display (GeoJSON-like points).

**Parameters:**

- Same as `/api/v2/networks/filtered`
- `bbox` (string) - Bounding box filter "minLon,minLat,maxLon,maxLat"

### GET /api/v2/networks/filtered/observations

Filtered observations with network context. Returns high-volume observation stream for heatmaps and routes.

### GET /api/v2/networks/filtered/analytics

Aggregated analytics (counts, averages) derived from the current filter set.

---

## Network Tags API

### GET /api/network-tags/:bssid

Get tags for a network.

### POST /api/network-tags/:bssid 🔒

Add tag to network.

**Request:**

```json
{
  "threat_tag": "THREAT",
  "threat_confidence": 0.9,
  "notes": "Suspicious activity"
}
```

### PATCH /api/network-tags/:bssid/ignore 🔒

Mark as false positive.

### PATCH /api/network-tags/:bssid/threat 🔒

Mark as confirmed threat.

### PATCH /api/network-tags/:bssid/notes 🔒

Update notes.

### PATCH /api/network-tags/:bssid/investigate 🔒

Mark for investigation.

### DELETE /api/network-tags/:bssid 🔒

Remove tag.

### GET /api/network-tags

List all tagged networks.

### GET /api/network-tags/export/ml 🔒

Export tags for ML training.

---

## Explorer API

### GET /api/explorer/networks

List explorer networks (legacy endpoint).

### GET /api/explorer/networks-v2

Enhanced explorer with additional geocoding and physical-measurement fields, compiled from the database explorer materialized view.

### GET /api/explorer/network/:bssid

Retrieves the complete, geocoded materialized view record for a single network. Alias fields (`first_observed_at`, `last_observed_at`) are provided to match standard geospatial payloads.

---

## Analytics

### GET /api/analytics/network-types

Network type distribution.

### GET /api/analytics/signal-strength

Signal strength histogram.

### GET /api/analytics/temporal-activity

Hourly observation patterns over time.

**Parameters:**

- `range`: `24h`, `7d`, `30d`, `90d`, `all` (default: `all`)

**Response:**

```json
{
  "data": [
    {
      "hour": 0,
      "observations": 1250
    }
  ]
}
```

### GET /api/analytics/radio-type-over-time

Network types distribution over time periods.

**Parameters:**

- `range`: `24h`, `7d`, `30d`, `90d`, `all` (default: `all`)

**Response:**

```json
{
  "data": [
    {
      "period": "2026-01-29",
      "wifi": 1500,
      "bluetooth": 250,
      "cellular": 100
    }
  ]
}
```

### GET /api/analytics/threat-trends

Threat score trends over time.

**Parameters:**

- `range`: `24h`, `7d`, `30d`, `90d`, `all` (default: `all`)

**Response:**

```json
{
  "data": [
    {
      "period": "2026-01-29",
      "avg_threat_score": 35.2,
      "threat_count": 45
    }
  ]
}
```

### GET /api/analytics/top-networks

Top networks by observation count.

**Parameters:**

- `limit` (int, default: 100, max: 500) - Number of results

**Response:**

```json
{
  "data": [
    {
      "bssid": "AA:BB:CC:DD:EE:FF",
      "ssid": "Popular Network",
      "observations": 2500
    }
  ]
}
```

### GET /api/analytics/security

Security analysis metrics.

### GET /api/analytics/dashboard

Dashboard analytics.

### GET /api/analytics/bulk

Bulk analytics data.

### GET /api/analytics/threat-distribution

Threat distribution analysis.

**Note:** All analytics endpoints now properly handle null values and use appropriate data sources (materialized views for aggregated data, observations table for temporal data).

## Public Analytics

### GET /analytics-public/filtered

Filtered analytics (public endpoint).

---

## Machine Learning

### POST /api/ml/train 🔒

Train threat detection model.

### GET /api/ml/status

Model training status.

### POST /api/ml/score-all 🔒

Score all networks.

### GET /api/ml/scores/:bssid

Get ML scores for a network.

### GET /api/ml/scores/level/:level

Get networks by score level.

---

## Location Markers

### GET /api/location-markers

Get all markers.

### GET /api/location-markers/home

Get home location.

### POST /api/location-markers/home

Set home location.

### DELETE /api/location-markers/home

Remove home marker.

### GET /api/home-location

Get current home location.

### GET /api/admin/home-location 🔒

Get the current home location and radius for the admin panel. Requires admin access.

### POST /api/admin/home-location

Set home location and radius.

---

## VISINT Evidence Correlation

Visual Intelligence (VISINT) endpoints correlate uploaded field images against local
observations. Both endpoints accept `multipart/form-data`. Full pipeline documentation
(EXIF extraction, scoring, tag derivation, safety contract) is in
[docs/features/visint-evidence-pipeline.md](../features/visint-evidence-pipeline.md).

> **Safety:** Both endpoints are marked `manualOnly: true` in `apiTestEndpoints.ts`.
> Automated test runners must not call them against the working database.

### POST /api/observations/correlate-visint 🔒

Auto-correlates an uploaded image against `app.observations` via PostGIS spatial-temporal
query. **Defaults to preview mode** — pass `commit=true` to persist.

**Request:** `multipart/form-data`

| Field           | Required | Notes                                                   |
| --------------- | -------- | ------------------------------------------------------- |
| `image`         | ✅       | JPEG or PNG, max 25 MB                                  |
| `commit`        | No       | `"true"` to persist. Default: `"false"` (preview only). |
| `radius_meters` | No       | Spatial radius (default 50 m)                           |
| `window_hours`  | No       | Time window ± (default 2 h)                             |
| `limit`         | No       | Max candidates (default 5)                              |

**Response (preview):**

```json
{
  "ok": true,
  "status": "MATCHED",
  "observation_id": "1234",
  "detection_score": 2,
  "dist_meters": 12.5,
  "delta_minutes": 4.3,
  "tags_applied": ["SHOTSPOTTER_SENSOR", "VISINT_VERIFIED"],
  "exif": { "lat": 40.712, "lon": -74.006, "ts": "2026-06-01 14:23:00-05:00" },
  "candidates": [...]
}
```

**Error codes:** `ExifMissingError` (400), `ExifToolUnavailableError` (503),
`VISINT_INVALID_NUMERIC_PARAMS` (400), payload too large (413).

---

### POST /api/observations/attach-visint 🔒

Commits a VISINT image to a specific operator-selected BSSID. Always writes to
`app.network_media` and `app.network_tags`. Requires `confirm_fallback=true` when
targeting the `VISINT_UNMATCHED` sentinel.

**Request:** `multipart/form-data`

| Field              | Required | Notes                                         |
| ------------------ | -------- | --------------------------------------------- |
| `image`            | ✅       | JPEG or PNG, max 25 MB                        |
| `bssid`            | No       | Target BSSID. Defaults to `VISINT_UNMATCHED`. |
| `detection_score`  | No       | Score from correlate response                 |
| `manual_override`  | No       | `"true"` for ground-truth evidence path       |
| `device_type`      | No       | `SHOTSPOTTER_SENSOR` or `FLOCK_SAFETY_CAMERA` |
| `confirm_fallback` | No       | Required when `bssid=VISINT_UNMATCHED`        |

**Response:**

```json
{ "ok": true, "success": true, "tags_applied": ["VISINT_CONFIRMED", "GROUND_TRUTH_IMAGE"] }
```

---

## WiGLE Integration

### GET /api/networks/:bssid/wigle-observations

Get WiGLE observation data for a specific network.

**Response:**

```json
{
  "bssid": "AA:BB:CC:DD:EE:FF",
  "observations": [
    {
      "lat": 40.7128,
      "lon": -74.006,
      "accuracy": 10,
      "timestamp": "2026-01-30T06:30:19.059Z"
    }
  ],
  "stats": {
    "total": 15,
    "accuracy_avg": 12.5
  }
}
```

### POST /api/networks/wigle-observations/batch

Batch fetch WiGLE observations for multiple networks.

**Request:**

```json
{
  "bssids": ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]
}
```

**Response:**

```json
{
  "results": [
    {
      "bssid": "AA:BB:CC:DD:EE:FF",
      "observations": [...],
      "stats": {...}
    }
  ]
}
```

### GET /api/wigle/api-status

Check WiGLE API connectivity and status.

**Response:**

```json
{
  "status": "connected",
  "api_key_valid": true,
  "rate_limit_remaining": 95
}
```

### GET /api/wigle/user-stats

Retrieve cached WiGLE account statistics and rank.

### GET /api/wigle/live/:bssid

Live WiGLE data for a BSSID.

### GET /api/wigle/network/:bssid

Local WiGLE database lookup.

### GET /api/wigle/search

Search WiGLE database.

### GET /api/wigle/networks-v2

Fetch WiGLE v2 networks for map testing.

### GET /api/wigle/networks-v3

Fetch WiGLE v3 networks for map testing. **Forensic Note:** Results are automatically enriched with local threat scores, geocoding, and capture metrics when a BSSID match exists in the local database.

### GET /api/wigle/kml-points

Returns filtered, paginated KML point data for map display. Requires an authenticated user.

### GET /api/wigle/kml-bssid-summary

Retrieve aggregate KML observation statistics for one BSSID.

### GET /api/wigle/search-api 🔒

Search the remote WiGLE API with query parameters. This admin endpoint is manual-only on the API Test Page.

### POST /api/wigle/search-api 🔒

Search WiGLE API directly.

### POST /api/wigle/detail/:netid 🔒

Get WiGLE detail for network. **Forensic Note:** Returns enriched local forensic data if the network is present in the local database.

### POST /api/wigle/detail/bt/:netid 🔒

Get Bluetooth detail.

### POST /api/wigle/import/v3 🔒

Import WiGLE v3 data into local tables (`app.wigle_v3_observations`, `app.wigle_v3_network_details`).

### GET /api/wigle/observations/:netid

Get WiGLE observations for network.

**Parameters:**

- `limit` (int, optional, max: 100000) — Number of observations to return
- `offset` (int, optional, max: 10000000) — Pagination offset

**Response:**

```json
{
  "ok": true,
  "count": 15,
  "total": 42,
  "observations": [...]
}
```

**Note:** WiGLE observations now use the correct 'app' schema namespace instead of 'public'.

### GET /api/wigle/quota-status 🔒

Return the current WiGLE request-ledger quota status (daily call counts, remaining budget, reset time). Requires admin role.

**Response:**

```json
{
  "ok": true,
  "quota": {
    "used": 42,
    "limit": 500,
    "resetAt": "2026-04-29T00:00:00.000Z"
  }
}
```

### GET /api/wigle/ledger 🔒

List WiGLE request-ledger events and import runs with cursor pagination.

### GET /api/wigle/search-api/import-runs 🔒

List and query WiGLE V2 search import runs. Requires admin role.

**Parameters:**

- `limit` (int, default: 20)
- `offset` (int, default: 0)
- `status` (string, optional) — Filter by state: `running`, `paused`, `failed`, `completed`, `cancelled`
- `state` (string, optional) — Filter by US state code (e.g., `VA`)
- `searchTerm` (string, optional) — Filter search query terms
- `incompleteOnly` (boolean, optional) — Only show active/failed runs
- `sortBy` (string, optional) — Sort column
- `sortDir` (string, optional) — Sort direction (`asc` | `desc`)

### GET /api/wigle/search-api/import-runs/completeness/summary 🔒

Retrieve import-run completeness reporting by search term and state.

### GET /api/wigle/search-api/import-runs/:id 🔒

Retrieve one WiGLE import run by ID.

### GET /api/wigle/search-api/import-runs/resumable/latest 🔒

Retrieve the latest resumable WiGLE import run matching the query.

### POST /api/wigle/search-api/import-runs/:id/resume 🔒

Resume a paused or failed WiGLE import run from its last saved cursor checkpoint. Requires admin role.

### POST /api/wigle/search-api/import-runs/:id/pause 🔒

Pause a running WiGLE import run at the next page iteration boundary. Requires admin role.

### POST /api/wigle/search-api/import-runs/:id/cancel 🔒

Permanently cancel/stop an import run. Requires admin role.

### GET /api/wigle/search-api/saved-ssid-terms 🔒

List saved SSID search terms used by WiGLE imports.

### PATCH /api/wigle/soft-limits 🔒

Update soft limits in the running server process dynamically. Requires admin role.

**Body:**

```json
{
  "search": 75,
  "detail": 200,
  "stats": 50
}
```

### GET /api/wigle/page/network/:netid

Local database lookup returning the full enriched network record used by the WiGLE page detail panel. Tries the materialized view first, falls back to a live four-query fan-out if the MV is unavailable or returns no row.

**Parameters:**

- `:netid` (path, required) — BSSID / network ID (MAC address format validated by `macParamMiddleware`)

**Response:** Enriched network object, or `404` if not found in the local WiGLE database.

---

### GET /api/wigle/enrichment/stats 🔒

Get statistics on the number of networks that need WiGLE database enrichment. Requires admin role.

### GET /api/wigle/enrichment/catalog 🔒

Get a list of recent enrichment runs and execution history. Requires admin role.

### POST /api/wigle/enrichment/start 🔒

Start a new WiGLE v3 offline database enrichment batch run. Requires admin role.

### POST /api/wigle/enrichment/resume/:runId 🔒

Resume a paused or failed enrichment run by ID. Requires admin role.

### POST /api/wigle/enrichment/force-clear/:runId 🔒

Force clear an enrichment run state to allow starting new runs. Requires admin role.

---

## Kepler.gl Integration

### GET /api/kepler/data

Get data for Kepler.gl visualization.

### GET /api/kepler/observations

Get observations layer data.

### GET /api/kepler/networks

Get networks layer data.

---

## Geospatial & Map Proxies

### GET /api/mapbox-token

Get the currently configured Mapbox access token.

### GET /api/mapbox-style

Get the styled Mapbox layer configurations (e.g. satellite background).

### GET /api/mapbox-proxy

Proxies style asset requests directly to Mapbox API.

### GET /api/google-maps-token

Get the currently configured Google Maps API token.

### GET /api/google-maps-tile/:type/:z/:x/:y

Proxies Google Maps tiles to bypass browser CORS gates.

---

## Utilities

### GET /api/manufacturer/:bssid

Lookup manufacturer from MAC OUI.

### GET /api/observations/check-duplicates/:bssid

Check for duplicate observations.

### POST /api/geocode

Geocode an address.

### POST /api/import/wigle

Import WiGLE data.

### GET /api/data-quality

Data quality metrics.

### GET /data-quality

Legacy root-mounted alias for data quality metrics.

---

## Health Check

### GET /api/health

System health check.

**Response:**

```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "memory": "ok"
  }
}
```

---

## Admin

### POST /api/admin/cleanup-duplicates 🔒

Remove duplicate observations.

### POST /api/admin/refresh-colocation 🔒

Refresh colocation data.

### POST /api/admin/surveillance-detections/dry-run 🔒

Run the surveillance-detection pipeline in dry-run (preview) mode. No data is persisted when `dry-run=true`.

### PUT /api/admin/users/:id/active 🔒

Set the active state for a user (activate/deactivate account). Request body: `{ "active": true|false }`.

### PUT /api/admin/users/:id/password 🔒

Force a user password reset. Admins may set a temporary password or trigger a reset email.

### POST /api/admin/wigle-kml-sync/sync 🔒

Trigger an immediate WiGLE KML synchronization job (admin-only).

### POST /api/auth/change-password

Change the current authenticated user's password. Requires current password confirmation.

### GET /api/demo/context-menu

Return demo context-menu payload used by UI prototypes (non-production/demo use).

### GET /api/manufacturer/:bssid/networks

List networks associated with the given manufacturer's OUI (useful for vendor grouping and analytics).

### GET /api/media/:filename

Serve a stored media file (image/video) by filename.

### DELETE /api/settings/mapbox/:label 🔒

Remove a configured Mapbox token identified by `:label` from the runtime config.

### POST /api/settings/smarty 🔒

Update Smarty (address verification) integration settings (admin-only).

### POST /api/admin/add-note 🔒

Add a free-form administrative note to the system audit log (admin-only). Useful for tagging runs, import notes, or operator annotations.

### POST /api/admin/import-sqlite 🔒

Import a SQLite backup file into the canonical observation pipeline.

Behavior:

- records the run in `app.import_history`
- optionally takes a pre-import PostgreSQL backup
- imports observations into `app.observations`
- preserves parent-only network rows in `app.networks_orphans`
- leaves canonical `app.networks` observation-backed only

Admin UI:

- `Admin -> Data Import -> Import SQLite`

### POST /api/admin/import-kml 🔒

Import KML files (WiGLE/KML) into the observations pipeline and summarize imported BSSIDs.

### POST /api/admin/import-sql 🔒

Run a raw SQL import script into the staging schema (admin-only, use with caution).

### POST /api/admin/import/mobile/:uploadId/start 🔒

Start processing of a previously uploaded mobile capture (by uploadId) into the ETL pipeline.

Related endpoints:

- `GET /api/admin/import-history`
- `GET /api/admin/device-sources`
- `GET /api/admin/orphan-networks`
- `POST /api/admin/orphan-networks/:bssid/check-wigle`

### GET /api/admin/demo/oui-grouping 🔒

Retrieve a demo OUI grouping visualization used by the admin demo pages (non-production).

### GET /api/admin/networks/:bssid/detection-evidence 🔒

Fetch detection evidence for a specific network BSSID, including observations and scoring factors used by the detection pipeline.

### GET /api/admin/secrets 🔒

List secret keys currently known to the Secrets Manager integration (admin-only).

### DELETE /api/admin/secrets/:key 🔒

Remove a secret entry by key from the runtime Secrets Manager cache. Use with caution.

### POST /api/admin/secrets/:key 🔒

Create or update a secret key in the runtime cache (does not persist to AWS unless configured).

### POST /api/admin/settings/jobs/:jobName/run 🔒

Trigger a named background job immediately (admin-only). `:jobName` is the registered job identifier.

### POST /api/admin/settings/local-stack/:action 🔒

Perform local-stack actions for development (e.g., `start`, `stop`, `restart`) — admin-only and intended for safe, non-production environments.

### POST /api/admin/siblings/cancel 🔒

Cancel a running sibling-detection background job.

### GET /api/admin/siblings/component/:bssid 🔒

Retrieve the sibling component (connected graph) for a single BSSID.

### DELETE /api/admin/siblings/pairs 🔒

Bulk delete sibling pairs using request criteria (destructive; admin-only).

### GET /api/admin/import-history 🔒

List recent administrative data import runs.

### GET /api/admin/device-sources 🔒

List configured observation device sources.

### GET /api/admin/kml-imports 🔒

List local KML import files and their processing status.

### GET /api/admin/wigle-kml-sync/status 🔒

Retrieve WiGLE KML sync readiness and local KML import totals.

### GET /api/admin/wigle-kml-sync/transactions 🔒

List remote WiGLE KML upload transactions.

### GET /api/admin/orphan-networks 🔒

List preserved orphan network rows from `app.networks_orphans` plus backfill status from `app.orphan_network_backfills`.

### POST /api/admin/orphan-networks/:bssid/check-wigle 🔒

Perform a lightweight WiGLE check for a single orphan row.

Behavior:

- on match, imports into:
  - `app.wigle_v3_network_details`
  - `app.wigle_v3_observations`
- on miss, records `no_wigle_match` in `app.orphan_network_backfills`
- does not automatically promote data into canonical `app.networks`

### GET /api/admin/network-summary/:bssid 🔒

Get complete network summary.

### GET /api/admin/db-stats 🔒

Retrieve database table, storage, and activity statistics.

### GET /api/admin/test

Test admin routes.

## Network Siblings Admin

### POST /api/admin/siblings/override 🔒

Set or override the sibling relationship between two networks.

**Request:**

```json
{
  "bssidA": "AA:BB:CC:DD:EE:FF",
  "bssidB": "11:22:33:44:55:66",
  "relation": "sibling",
  "notes": "Same AP, sequential MACs"
}
```

- `bssidA`, `bssidB` (string, required) — MAC addresses to pair; must be different
- `relation` (string) — `"sibling"` (default) or `"not_sibling"`
- `notes` (string, optional) — Free-text annotation

**Response:**

```json
{
  "ok": true,
  "pair": {
    "bssidA": "AA:BB:CC:DD:EE:FF",
    "bssidB": "11:22:33:44:55:66",
    "relation": "sibling"
  }
}
```

### GET /api/admin/siblings/linked/:bssid 🔒

Retrieve all known sibling links for a single BSSID.

**Parameters:**

- `:bssid` (path, required) — MAC address to look up

**Response:**

```json
{
  "ok": true,
  "bssid": "AA:BB:CC:DD:EE:FF",
  "links": [...]
}
```

### POST /api/admin/siblings/linked-batch 🔒

Retrieve sibling links for multiple BSSIDs in a single request.

**Request:**

```json
{
  "bssids": ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"]
}
```

**Response:**

```json
{
  "ok": true,
  "links": [...]
}
```

### POST /api/admin/siblings/refresh 🔒

Start a background sibling-detection refresh job.

**Request (all fields optional):**

```json
{
  "batchSize": 500,
  "maxOctetDelta": 3,
  "maxDistanceM": 200,
  "minCandidateConf": 0.5,
  "minStrongConf": 0.85,
  "maxBatches": 100
}
```

**Response:** `202 Accepted` when the job starts; `409 Conflict` if already running.

### GET /api/admin/siblings/refresh/status 🔒

Poll the running sibling refresh job status.

**Response:**

```json
{
  "ok": true,
  "status": { ... }
}
```

### GET /api/admin/siblings/stats 🔒

Aggregate statistics for the sibling detection dataset.

**Response:**

```json
{
  "ok": true,
  "stats": { ... }
}
```

---

## OUI Management Admin

### GET /api/admin/oui/groups 🔒

List OUI groups.

### GET /api/admin/oui/:oui/details 🔒

OUI details.

### GET /api/admin/oui/randomization/suspects 🔒

Suspect randomization.

### POST /api/admin/oui/analyze 🔒

Analyze OUI data.

---

## Network Tags Admin

### GET /api/admin/network-tags/:bssid 🔒

Get tags for network.

### GET /api/admin/network-tags/search 🔒

Search by tags.

### POST /api/admin/network-tags/toggle 🔒

Toggle tag.

### DELETE /api/admin/network-tags/remove 🔒

Remove a specific tag from a network. Unlike the general tag clearing endpoint, this endpoint selectively removes a single tag from the BSSID's tag list.

**Request Body:**

```json
{
  "bssid": "AA:BB:CC:DD:EE:FF",
  "tag": "SUSPECT"
}
```

**Response:**

```json
{
  "ok": true,
  "message": "Tag 'SUSPECT' removed from network AA:BB:CC:DD:EE:FF",
  "network": {
    "bssid": "AA:BB:CC:DD:EE:FF",
    "tags": ["THREAT"],
    "notes": "Network notes content"
  }
}
```

---

## Network Notes Admin

### POST /api/admin/network-notes/add 🔒

Add note to network.

### GET /api/admin/network-notes/:bssid 🔒

Get all notes for a network.

### DELETE /api/admin/network-notes/:noteId 🔒

Delete note.

### POST /api/admin/network-notes/:noteId/media 🔒

Upload media to note.

### GET /api/admin/network-notes/:noteId/media 🔒

Get media attachments for a specific note.

### DELETE /api/admin/network-notes/media/:mediaId 🔒

Delete a media attachment associated with a network note.

---

## Network Media Admin

### POST /api/admin/network-media/upload 🔒

Upload media (image/video) to network.

### GET /api/admin/network-media/:bssid 🔒

Get media list for network.

### GET /api/admin/network-media/download/:id 🔒

Download media file.

### GET /api/admin/network-media/:id/inline 🔒

Serve media inline, using the stored thumbnail when `thumbnail=true`. Requires admin access.

---

## Network Notations Admin

### POST /api/admin/network-notations/add 🔒

Add notation to network.

### GET /api/admin/network-notations/:bssid 🔒

Get all notations for network.

---

## Settings Admin

### GET /api/admin/settings 🔒

List all settings.

### GET /api/admin/settings/:key 🔒

Get setting.

### PUT /api/admin/settings/:key 🔒

Update setting.

### POST /api/admin/settings/ml-blending/toggle 🔒

Toggle ML blending.

### GET /api/admin/settings/jobs/status 🔒

Retrieve background job runtime status and recent history.

### GET /api/admin/settings/runtime 🔒

Retrieve runtime feature flags and environment-backed settings.

---

## Geocoding Admin

### GET /api/admin/geocoding/stats 🔒

Retrieve geocoding cache statistics and coverage.

**Parameters:**

- `precision` (int, default: 5) - S2/Geohash precision level for clustering.

**Response:**

```json
{
  "ok": true,
  "stats": {
    "total": 125430,
    "cached": 85420,
    "coverage": 68.1,
    "pending": 40010,
    "lastUpdated": "2026-03-27T14:30:00.000Z"
  }
}
```

### POST /api/admin/geocoding/run 🔒

Start a background job to update the geocoding cache.

**Request:**

```json
{
  "provider": "mapbox",
  "mode": "address-only",
  "limit": 1000,
  "precision": 5,
  "perMinute": 200,
  "permanent": true
}
```

**Options:**

- `provider`: `mapbox`, `nominatim`, `overpass`, `opencage`, `geocodio`, `locationiq`.
- `mode`: `address-only`, `poi-only`, `full`.
- `limit`: Maximum records to process.
- `perMinute`: Rate limit for the provider.

### POST /api/admin/geocoding/requeue 🔒

Requeue failed or stalled geocoding jobs for reprocessing.

### GET /api/admin/geocoding/daemon 🔒

Get status of the persistent geocoding daemon.

### POST /api/admin/geocoding/daemon 🔒

Start the geocoding daemon for continuous background enrichment.

### DELETE /api/admin/geocoding/daemon 🔒

Stop the geocoding daemon.

### POST /api/admin/geocoding/test 🔒

Test a geocoding provider with a sample coordinate.

---

## pgAdmin Control

### GET /api/admin/pgadmin/status 🔒

pgAdmin status.

### POST /api/admin/pgadmin/start 🔒

Start pgAdmin.

### POST /api/admin/pgadmin/stop 🔒

Stop pgAdmin.

### POST /api/admin/pgadmin/destroy 🔒

Destroy all pgAdmin containers and associated temporary state (admin-only, destructive). Use with caution.

---

## AWS Admin

### GET /api/admin/aws/overview 🔒

AWS resources overview.

### POST /api/admin/aws/instances/:instanceId/reboot 🔒

Request a reboot of an EC2 instance (admin only).

### POST /api/admin/aws/instances/:instanceId/start 🔒

Start an EC2 instance.

### POST /api/admin/aws/instances/:instanceId/stop 🔒

Stop an EC2 instance.

### POST /api/admin/aws/instances/:instanceId/terminate 🔒

Terminate an EC2 instance (destructive).

---

## Backup Admin

### POST /api/admin/backup 🔒

Run full database backup.

### GET /api/admin/backup/s3 🔒

List S3 backups.

### DELETE /api/admin/backup/s3/:key 🔒

Delete S3 backup.

---

## Authentication

### POST /api/auth/login

User login.

**Request:**

```json
{
  "username": "admin",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "success": true,
  "token": "abc123...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### POST /api/auth/logout 🔒

User logout.

### GET /api/auth/me

Get current user.

### GET /api/admin/users 🔒

List user profiles available to administrators.

### POST /api/admin/users 🔒

Create a new user profile (admin only).

---

## Settings & Export

### GET /api/settings/aws 🔒

Retrieve the currently configured AWS configuration settings (region, profile).

### POST /api/settings/aws 🔒

Update the AWS configurations.

### POST /api/settings/reload-secrets 🔒

Reload cached secrets dynamically from AWS Secrets Manager.

### GET /api/settings/list 🔒

List configured secret-setting keys.

### GET /api/settings/wigle 🔒

Retrieve the configured WiGLE credential status.

### GET /api/settings/smarty 🔒

Retrieve the configured Smarty credential status.

### GET /api/settings/mapbox-unlimited 🔒

Retrieve the configured Mapbox Unlimited provider setting. This admin settings endpoint is manual-only on the API Test Page.

### POST /api/settings/mapbox-unlimited 🔒

Update the Mapbox Unlimited provider setting. This admin settings endpoint is manual-only on the API Test Page.

### GET /api/settings/google-maps 🔒

Retrieve the configured Google Maps API key setting. This admin settings endpoint is manual-only on the API Test Page.

### POST /api/settings/google-maps 🔒

Update the Google Maps API key setting. This admin settings endpoint is manual-only on the API Test Page.

### GET /api/settings/opencage 🔒

Retrieve the configured OpenCage API key setting. This admin settings endpoint is manual-only on the API Test Page.

### POST /api/settings/opencage 🔒

Update the OpenCage API key setting. This admin settings endpoint is manual-only on the API Test Page.

### GET /api/settings/geocodio 🔒

Retrieve the configured Geocodio API key setting. This admin settings endpoint is manual-only on the API Test Page.

### POST /api/settings/geocodio 🔒

Update the Geocodio API key setting. This admin settings endpoint is manual-only on the API Test Page.

### GET /api/settings/locationiq 🔒

Retrieve the configured LocationIQ API key setting. This admin settings endpoint is manual-only on the API Test Page.

### POST /api/settings/locationiq 🔒

Update the LocationIQ API key setting. This admin settings endpoint is manual-only on the API Test Page.

### GET /api/settings/mapbox 🔒

Retrieve the configured Mapbox token setting. This admin settings endpoint is manual-only on the API Test Page.

### POST /api/settings/mapbox 🔒

Update the Mapbox token setting. This admin settings endpoint is manual-only on the API Test Page.

---

### POST /api/admin/backup

Run a full database backup (no auth yet).

### GET /api/backup 🔒

Download a legacy JSON backup of observations, networks, and network tags. Requires admin access.

### POST /api/restore 🔒

Upload a legacy JSON backup file for restore staging. Requires admin access and performs destructive restore preparation.

### GET /api/csv

Export observations as CSV (full dataset).

### GET /api/json

Export observations + networks as JSON (full dataset).

### GET /api/geojson

Export observations as GeoJSON (full dataset).

> Note: Backups/exports are currently unauthenticated and intended for trusted environments only.

### GET /api/json/full 🔒

Download a full app-schema snapshot in JSON format. Requires admin access.

### GET /api/kml 🔒

Download observations for requested BSSIDs in KML format. Requires an authenticated user.

---

## Mobile Ingest API

API-key authorized endpoints used by mobile capture units to request upload links and log completed SQLite captures.

### POST /v1/ingest/request-upload

Canonical mobile ingest endpoint for generating a presigned S3 upload URL. Requires `SHADOWCHECK_API_KEY` in headers.

### POST /api/v1/ingest/request-upload

Generates a presigned S3 upload URL for uploading a mobile SQLite database file. Requires `SHADOWCHECK_API_KEY` in headers.

**Request:**

```json
{
  "fileName": "capture_20260611.sqlite",
  "case_id": "case_101",
  "filesize": 10485760
}
```

**Response:**

```json
{
  "success": true,
  "uploadUrl": "https://shadowcheck-bucket.s3.amazonaws.com/uploads/...",
  "s3Key": "uploads/case_101/20260611/capture_20260611.sqlite"
}
```

---

### POST /v1/ingest/complete

Canonical mobile ingest endpoint for registering a completed S3 SQLite upload. Requires `SHADOWCHECK_API_KEY` in headers.

### POST /api/v1/ingest/complete

Registers a successfully uploaded S3 SQLite key for the ETL background ingestion queue. Requires `SHADOWCHECK_API_KEY` in headers.

**Request:**

```json
{
  "s3Key": "uploads/case_101/20260611/capture_20260611.sqlite",
  "sourceTag": "mobile-unit-alpha",
  "deviceModel": "Pixel 9 Pro",
  "deviceId": "dev_abc123"
}
```

---

## Claude AI

AWS Bedrock-backed analysis endpoints. No authentication is required by the route handlers themselves, but `req.user` (if present) is used to scope insight history.

### POST /api/claude/analyze-networks

Submit a list of networks for AI threat analysis. Calls AWS Bedrock (Claude Haiku), persists the result, and returns analysis + recent history.

**Request:**

```json
{
  "networks": [
    {
      "bssid": "AA:BB:CC:DD:EE:FF",
      "ssid": "TestNet",
      "type": "W",
      "threat_score": 75,
      "observation_count": 42,
      "unique_days": 7,
      "seen_at_home": true,
      "seen_away": true
    }
  ],
  "question": "Is this network a surveillance threat?"
}
```

- `networks` (array, required) — Non-empty array of network objects
- `question` (string, optional) — Analysis question; defaults to a standard threat-identification prompt

**Response:**

```json
{
  "ok": true,
  "analysis": "...",
  "suggestions": [...],
  "insightId": 42,
  "history": [...],
  "meta": {
    "networksAnalyzed": 1,
    "model": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
  }
}
```

### GET /api/claude/insights

Retrieve AI analysis history for the current user (or anonymous session).

**Parameters:**

- `limit` (int, default: 20, max: 100) — Number of history records to return

**Response:**

```json
{
  "ok": true,
  "history": [...],
  "count": 5
}
```

### PATCH /api/claude/insights/:id/useful

Record user feedback on an AI insight.

**Parameters:**

- `:id` (path, required) — Insight ID (positive integer)

**Request:**

```json
{
  "useful": true
}
```

**Response:**

```json
{
  "ok": true,
  "id": 42,
  "useful": true
}
```

### GET /api/claude/test

Connectivity check for the AWS Bedrock integration.

**Response:**

```json
{
  "ok": true,
  "connected": true
}
```

---

## Network Types

- `W`: WiFi
- `E`: BLE
- `B`: Bluetooth
- `L`: LTE
- `N`: 5G NR
- `G`: GSM

## Threat Scoring (v4.0)

ShadowCheck v4.0 uses a behavioral scoring engine with the following weighted components:

| Component                | Weight | Criteria                                                             |
| :----------------------- | :----- | :------------------------------------------------------------------- |
| **Following Pattern**    | 35%    | Multiple clusters >2km from home; max distance spread.               |
| **Parked Surveillance**  | 20%    | Repeated detections within 100m and 10-minute windows.               |
| **Location Correlation** | 15%    | Percentage of observations near home vs. distinct clusters.          |
| **Equipment Profile**    | 10%    | Manufacturer OUI matching (industrial/vehicular) and SSID patterns.  |
| **Temporal Persistence** | 5%     | Number of distinct days observed.                                    |
| **Fleet Bonus**          | 15%    | Correlation with other high-score networks (same manufacturer/SSID). |

**Thresholds:**

- **CRITICAL**: 81+
- **HIGH**: 61-80
- **MEDIUM**: 41-60
- **LOW**: 21-40
- **NONE**: <21

Default display threshold: **40**

## Services & Query Builders

### Analytics Service (`server/src/services/analytics/`)

**Purpose:** Build analytics queries for different data domains

**Modules:**

- `coreAnalytics.ts` - Temporal, signal, radio type queries (~140 lines)
- `threatAnalytics.ts` - Security & threat analysis queries (~120 lines)
- `networkAnalytics.ts` - Network-specific queries (~100 lines)
- `helpers.ts` - Normalization & formatting utilities (~85 lines)
- `index.ts` - Service coordinator (re-exports)

**Why modularized:** Each analytics domain is independent. New query types are added to their domain file.

**Usage:**

```javascript
import { buildTemporalAnalytics } from '../services/analytics';
const query = buildTemporalAnalytics({ startDate, endDate });
```

### Validation Schemas (`server/src/validation/schemas/`)

**Purpose:** Validate data by type and domain

**Modules:**

- `networkSchemas.ts` - BSSID, SSID, channels (~404 lines)
- `geospatialSchemas.ts` - Coordinates, radius, altitude (~342 lines)
- `temporalSchemas.ts` - Timestamps, date ranges (~283 lines)
- `commonSchemas.ts` - String, number, email, URL (~458 lines)
- `complexValidators.ts` - Complex validation logic (~447 lines)
- `schemas.ts` - Index that re-exports all (coordinator)

**Why modularized:** Each validation domain is independent. Validators are grouped logically for maintainability.

**Usage:**

```javascript
import { validateBSSID, validateCoordinates } from '../validation/schemas';
```

## Error Codes

| Code | Description  |
| ---- | ------------ |
| 400  | Bad Request  |
| 401  | Unauthorized |
| 403  | Forbidden    |
| 404  | Not Found    |
| 429  | Rate Limited |
| 500  | Server Error |

---

### POST /api/settings/wigle 🔒

Update WiGLE integration settings (admin-only).

### GET /api/settings/wigle/test 🔒

Run a test WiGLE connectivity check using current credentials (admin-only).

### POST /api/tag-network 🔒

Apply one or more tags to a network. Request body: `{ "bssid": "AA:BB:CC:DD:EE:FF", "tags": ["THREAT"] }`.

### DELETE /api/tag-network/:bssid 🔒

Remove tags from a network or clear all tags for the provided BSSID (admin-only).

### POST /api/v2/networks/batch

Batch fetch multiple v2 networks by BSSID list. Use for large multi-BSSID queries.

### GET /api/v2/networks/filtered/debug

Debug endpoint returning additional diagnostic metadata (SQL/explain) for filtered v2 queries. Developer/admin use only.

### GET /api/v2/networks/filtered/unmatched-media

Returns networks that have unmatched VISINT media (images not yet correlated to an observation).

### GET /api/v2/networks/filtered/matched-media

Returns networks that have matched VISINT media (images correlated to an observation).

### POST /api/v2/networks/filtered/observations

POST variant of the filtered observations endpoint for large filter payloads (accepts complex JSON filters).

### POST /api/wigle/detail/batch 🔒

Fetch WiGLE detail records for multiple netids in a single batch request (admin-only).

### POST /api/wigle/quota-reset 🔒

Reset WiGLE quota counters and ledger state (admin-only).

### POST /api/wigle/search-api/bt-import-start 🔒

Kick off a Bluetooth import run using the WiGLE search API (admin-only).

---

### POST /api/wigle/search-api/import-all 🔒

Trigger a full import across all saved WiGLE search terms. Starts a background import run and returns a run identifier (admin-only).

### DELETE /api/wigle/search-api/import-runs/:id 🔒

Delete a saved WiGLE import run and its associated artifacts by run ID. Destructive; admin-only.

### DELETE /api/wigle/search-api/import-runs/cluster-cleanup 🔒

Remove temporary cluster-cleanup artifacts produced during import post-processing (admin-only).

### POST /api/wigle/search-api/import-runs/resume-latest 🔒

Resume the most recent resumable WiGLE import run. Useful for automated recovery after failures (admin-only).

### POST /api/wigle/search-api/saved-ssid-terms 🔒

Create or update a saved SSID search term used for scheduled WiGLE imports.

### DELETE /api/wigle/search-api/saved-ssid-terms/:id 🔒

Delete a saved SSID search term by ID (admin-only).

### GET /health

Legacy root health-check endpoint (alias for `GET /api/health`). Returns basic service checks (database, memory).

🔒 = Requires authentication (session or API key)
