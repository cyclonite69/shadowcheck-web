# API Reference

**Wiki version (diagrams):** [API Reference](../.github/wiki/API-Reference.md)

Complete REST API documentation for ShadowCheck SIGINT Forensics Platform.

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

- **1000 requests per 15 minutes** per IP
- Returns `429 Too Many Requests` when exceeded

---

## Infrastructure Endpoints

Public GeoJSON endpoints for geospatial visualization. Note: These are mounted at the root level to bypass standard API auth for map display.

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

### GET /federal-courthouses

Returns a GeoJSON FeatureCollection of all Federal Courthouses.

---

## Dashboard

### GET /api/dashboard-metrics

Platform statistics.

**Response:**

```json
{
  "totalNetworks": 173326,
  "threatsCount": 1842,
  "surveillanceCount": 256,
  "enrichedCount": 45123
}
```

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

List explorer networks.

### GET /api/explorer/networks-v2

Enhanced explorer with additional fields.

### GET /api/explorer/timeline/:bssid

Get observation timeline for network.

### GET /api/explorer/heatmap

Get heatmap data.

### GET /api/explorer/routes

Get route data.

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

- `limit` (int, default: 10, max: 100) - Number of results

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

### GET /api/analytics-public/filtered

Filtered analytics (public endpoint).

---

## Public Analytics

### GET /api/analytics-public/filtered

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

### POST /api/admin/home-location

Set home location and radius.

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

### GET /api/wigle/page/network/:netid

Local database lookup returning the full enriched network record used by the WiGLE page detail panel. Tries the materialized view first, falls back to a live four-query fan-out if the MV is unavailable or returns no row.

**Parameters:**

- `:netid` (path, required) — BSSID / network ID (MAC address format validated by `macParamMiddleware`)

**Response:** Enriched network object, or `404` if not found in the local WiGLE database.

---

## Kepler.gl Integration

### GET /api/kepler/data

Get data for Kepler.gl visualization.

### GET /api/kepler/observations

Get observations layer data.

### GET /api/kepler/networks

Get networks layer data.

---

## Geospatial Endpoints

### GET /api/geospatial/api/mapbox-token

Get Mapbox token.

### GET /api/geospatial/api/mapbox-style

Get Mapbox style configuration.

### GET /api/geospatial/api/mapbox-proxy

Proxy requests to Mapbox API.

### GET /api/geospatial/api/google-maps-token

Get Google Maps API token.

### GET /api/geospatial/api/google-maps-tile/:type/:z/:x/:y

Get Google Maps tiles.

---

## Utilities

### GET /api/mapbox-token

Get Mapbox token.

### GET /api/manufacturer/:bssid

Lookup manufacturer from MAC OUI.

### GET /api/observations/check-duplicates/:bssid

Check for duplicate observations.

### GET /api/demo/oui-grouping

OUI grouping demo page.

### POST /api/geocode

Geocode an address.

### POST /api/import/wigle

Import WiGLE data.

### GET /api/data-quality

Data quality metrics.

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

Related endpoints:

- `GET /api/admin/import-history`
- `GET /api/admin/device-sources`
- `GET /api/admin/orphan-networks`
- `POST /api/admin/orphan-networks/:bssid/check-wigle`

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

### GET /api/admin/test

Test admin routes.

### GET /api/admin/simple-test

Simple test route.

---

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

## Threat Scoring Admin

### POST /api/admin/threat-scoring/compute 🔒

Manual threat score computation.

### POST /api/admin/threat-scoring/recompute-all 🔒

Mark all for recomputation.

### GET /api/admin/threat-scoring/stats 🔒

Threat scoring statistics.

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

Remove tag.

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

---

## Network Media Admin

### POST /api/admin/network-media/upload 🔒

Upload media (image/video) to network.

### GET /api/admin/network-media/:bssid 🔒

Get media list for network.

### GET /api/admin/network-media/download/:id 🔒

Download media file.

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

---

## AWS Admin

### GET /api/admin/aws/overview 🔒

AWS resources overview.

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

### POST /api/auth/create-user 🔒

Create new user (admin only).

---

## Settings & Export

### GET /api/settings

Get settings.

### POST /api/settings

Update settings.

### POST /api/admin/backup

Run a full database backup (no auth yet).

### GET /api/csv

Export observations as CSV (full dataset).

### GET /api/json

Export observations + networks as JSON (full dataset).

### GET /api/geojson

Export observations as GeoJSON (full dataset).

> Note: Backups/exports are currently unauthenticated and intended for trusted environments only.

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

🔒 = Requires authentication (session or API key)
