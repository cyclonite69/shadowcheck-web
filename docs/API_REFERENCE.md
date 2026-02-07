# API Reference

Complete REST API documentation for ShadowCheck SIGINT Forensics Platform.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Protected endpoints require authentication via session cookie or API key:

### Session-Based (Browser)

Sessions are managed via HTTP-only cookies. Client uses `credentials: 'include'`.

### API Key

```http
x-api-key: your-api-key-here
```

### Bearer Token

```http
Authorization: Bearer <token>
```

Set via: `API_KEY=your-secret-key` in `.env`

## Rate Limiting

- **1000 requests per 15 minutes** per IP
- Returns `429 Too Many Requests` when exceeded

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

Filtered network list with universal filter support.

**Parameters:**

- `page` (int, default: 1)
- `limit` (int, default: 100, max: 5000)
- Universal filter parameters (see [Universal Filter System](universal-filter-system.md))

**Response:**

```json
{
  "data": [...],
  "pagination": { "page": 1, "total": 173326 },
  "filters": { ... }
}
```

### GET /api/v2/networks/filtered/geospatial

Filtered networks optimized for geospatial display.

**Parameters:**

- Same as `/api/v2/networks/filtered`
- `bbox` (optional) - Bounding box filter [minLon, minLat, maxLon, maxLat]

### GET /api/v2/networks/filtered/observations

Filtered observations with network context.

### GET /api/v2/networks/filtered/analytics

Aggregated analytics for filtered networks.

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

Fetch WiGLE v3 networks for map testing.

### POST /api/wigle/search-api 🔒

Search WiGLE API directly.

### POST /api/wigle/detail/:netid 🔒

Get WiGLE detail for network.

### POST /api/wigle/detail/bt/:netid 🔒

Get Bluetooth detail.

### POST /api/wigle/import/v3 🔒

Import WiGLE v3 data.

### GET /api/wigle/observations/:netid

Get WiGLE observations for network.

**Note:** WiGLE observations now use the correct 'app' schema namespace instead of 'public'.

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

Import SQLite database.

### GET /api/admin/network-summary/:bssid 🔒

Get complete network summary.

### GET /api/admin/test

Test admin routes.

### GET /api/admin/simple-test

Simple test route.

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

Geocoding statistics.

### POST /api/admin/geocoding/run 🔒

Run geocoding.

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

## Network Types

- `W`: WiFi
- `E`: BLE
- `B`: Bluetooth
- `L`: LTE
- `N`: 5G NR
- `G`: GSM

## Threat Scoring

- **50**: Seen at home AND away
- **30**: Distance > 1km
- **20**: 10+ days
- **15**: 100+ observations
- **-20**: Strong signal (stationary)

Default threshold: **40**

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
