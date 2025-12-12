# API Reference

Complete REST API documentation for ShadowCheck SIGINT Forensics Platform.

## Base URL

```
http://localhost:3001/api
```

## Authentication

Protected endpoints require API key:

```http
x-api-key: your-api-key-here
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

---

## Networks

### GET /api/networks

List networks with pagination.

**Parameters:**

- `page`, `limit`, `sort`, `order`

### GET /api/networks/observations/:bssid

Get all observations for a network.

### GET /api/networks/search/:ssid

Search by SSID.

### POST /api/tag-network 🔒

Tag a network (requires API key).

**Request:**

```json
{
  "bssid": "AA:BB:CC:DD:EE:FF",
  "tag_type": "LEGIT",
  "confidence": 95,
  "notes": "Home router"
}
```

**Tag Types:**

- `LEGIT`: Safe (threat: 0.0)
- `FALSE_POSITIVE`: Incorrectly flagged (0.05)
- `INVESTIGATE`: Needs review (0.7)
- `THREAT`: Confirmed threat (1.0)

### DELETE /api/tag-network/:bssid 🔒

Remove tag.

### GET /api/networks/tagged

List tagged networks.

---

## Analytics

### GET /api/analytics/network-types

Network type distribution.

### GET /api/analytics/signal-strength

Signal strength histogram.

### GET /api/analytics/temporal-activity

Hourly observation patterns.

### GET /api/analytics/security

WiFi security type distribution.

### GET /api/analytics/radio-type-over-time

Network types over time.

**Parameters:**

- `range`: `24h`, `7d`, `30d`, `90d`, `all`

---

## Machine Learning

### POST /api/ml/train 🔒

Train threat detection model.

### GET /api/ml/status

Model training status.

---

## Location Markers

### GET /api/location-markers

Get all markers.

### POST /api/location-markers/home

Set home location.

### DELETE /api/location-markers/home

Remove home marker.

---

## WiGLE Integration

### GET /api/wigle/network/:bssid

Query WiGLE for network details.

### GET /api/wigle/search

Search WiGLE database.

---

## Utilities

### GET /api/mapbox-token

Get Mapbox token.

### GET /api/manufacturer/:bssid

Lookup manufacturer from MAC OUI.

### GET /api/observations/check-duplicates/:bssid

Check for duplicate observations.

---

## Admin

### POST /api/admin/cleanup-duplicates 🔒

Remove duplicate observations.

### POST /api/admin/refresh-colocation 🔒

Refresh colocation data.

---

## Settings & Export

### GET /api/settings

Get settings.

### POST /api/settings

Update settings.

### GET /api/export/networks

Export networks (CSV/JSON).

### GET /api/export/observations

Export observations.

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

- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `429`: Rate Limited
- `500`: Server Error

---

🔒 = Requires API key
