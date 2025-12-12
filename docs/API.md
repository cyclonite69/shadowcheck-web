# ShadowCheck API Documentation

Comprehensive API reference for ShadowCheck-Static REST API.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Dashboard](#dashboard)
  - [Threats](#threats)
  - [Networks](#networks)
  - [Analytics](#analytics)
  - [Machine Learning](#machine-learning)
  - [Utility](#utility)

## Base URL

```
http://localhost:3001/api
```

Production: `https://your-domain.com/api`

## Authentication

Most endpoints are public. Sensitive endpoints require API key authentication.

**Protected Endpoints:**

- `POST /api/tag-network`
- `DELETE /api/tag-network/:bssid`
- `POST /api/ml/train`

**Header:**

```http
x-api-key: your-api-key-here
```

**Example:**

```bash
curl -H "x-api-key: your-key" -X POST http://localhost:3001/api/ml/train
```

## Rate Limiting

- **Limit:** 1000 requests per 15 minutes per IP address
- **Response:** 429 Too Many Requests when exceeded
- **Headers:**
  - `RateLimit-Limit`: Maximum requests allowed
  - `RateLimit-Remaining`: Requests remaining
  - `RateLimit-Reset`: Time when limit resets (Unix timestamp)

## Response Format

### Success Response

Most endpoints return JSON with this structure:

```json
{
  "ok": true,
  "data": {
    /* response data */
  }
}
```

**Exceptions:**

- `/api/dashboard-metrics`: Returns raw object
- `/api/networks`: Returns array with pagination metadata

### Error Response

```json
{
  "error": "Error message",
  "details": "Additional context (optional)"
}
```

HTTP Status Codes:

- `200 OK`: Successful request
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Error Handling

All errors include:

- `error`: Human-readable error message
- `details`: (Optional) Additional error context
- Appropriate HTTP status code

**Example Error:**

```json
{
  "error": "Invalid limit parameter. Must be between 1 and 5000.",
  "details": "Received: 10000"
}
```

## Endpoints

### Dashboard

#### Get Dashboard Metrics

Returns overall platform statistics.

```http
GET /api/dashboard-metrics
```

**Response:**

```json
{
  "totalNetworks": 173326,
  "threatsCount": 1842,
  "surveillanceCount": 256,
  "enrichedCount": 45123
}
```

**Fields:**

- `totalNetworks`: Total unique networks in database
- `threatsCount`: Networks with threat score ≥ 40
- `surveillanceCount`: Networks tagged as INVESTIGATE or THREAT
- `enrichedCount`: Networks with WiGLE enrichment data

---

### Threats

#### Quick Threat Detection (Paginated)

Fast threat detection with pagination support.

```http
GET /api/threats/quick?page=1&limit=100&minSeverity=40
```

**Query Parameters:**

- `page` (integer, default: 1): Page number
- `limit` (integer, default: 100, max: 5000): Results per page
- `minSeverity` (integer, default: 40, range: 0-100): Minimum threat score

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
      "last_seen": "2025-12-02T08:30:00Z",
      "user_tag": "INVESTIGATE",
      "user_threat_score": 0.7,
      "user_confidence": 0.85,
      "manufacturer": "Apple Inc.",
      "encryption": "WPA2-PSK"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 1842,
    "totalPages": 19
  }
}
```

**Threat Score Breakdown:**

- **40+ points:** Seen at home AND away (strongest indicator)
- **25 points:** Distance range > 200m
- **5-15 points:** Multiple unique days (2-7+)
- **5-10 points:** High observation count (20-50+)
- **10-20 points:** High movement speed (20-100+ km/h)

---

#### Advanced Threat Detection

Full threat analysis with speed calculations.

```http
GET /api/threats/detect
```

**Query Parameters:**

- `minSeverity` (integer, default: 40): Minimum threat score

**Response:**

```json
{
  "ok": true,
  "data": {
    "threats": [
      {
        "bssid": "AA:BB:CC:DD:EE:FF",
        "ssid": "Mobile Hotspot",
        "type": "W",
        "threat_score": 85,
        "distance_range_km": 5.2,
        "observation_count": 128,
        "unique_days": 15,
        "max_speed_kmh": 95,
        "avg_speed_kmh": 42,
        "first_seen": "2025-11-01T06:00:00Z",
        "last_seen": "2025-12-02T08:30:00Z",
        "observations": [
          {
            "lat": 40.7128,
            "lon": -74.006,
            "time": "2025-12-02T08:00:00Z",
            "signal_strength": -65,
            "speed_to_next_kmh": 45
          }
        ]
      }
    ],
    "summary": {
      "total_threats": 1842,
      "critical": 45,
      "high": 256,
      "medium": 842,
      "low": 699
    }
  }
}
```

---

### Networks

#### List Networks

Get paginated list of all networks.

```http
GET /api/networks?page=1&limit=100&sort=lastSeen&order=DESC
```

**Query Parameters:**

- `page` (integer, default: 1): Page number
- `limit` (integer, default: 100, max: 5000): Results per page
- `sort` (string, default: lastSeen): Sort field
  - Options: `lastSeen`, `ssid`, `type`, `bssid`
- `order` (string, default: DESC): Sort order
  - Options: `ASC`, `DESC`

**Response:**

```json
{
  "networks": [
    {
      "bssid": "AA:BB:CC:DD:EE:FF",
      "ssid": "Home WiFi",
      "type": "W",
      "encryption": "WPA3-PSK",
      "capabilities": "[WPA3-SAE-CCMP][RSN-SAE-CCMP]",
      "channel": 36,
      "frequency": 5180,
      "last_seen": "2025-12-02T08:30:00Z",
      "first_seen": "2025-10-15T12:00:00Z",
      "observation_count": 456
    }
  ],
  "total": 173326,
  "page": 1,
  "limit": 100,
  "totalPages": 1734
}
```

---

#### Get Network Observations

Get all observation records for a specific network.

```http
GET /api/networks/observations/:bssid
```

**Path Parameters:**

- `bssid` (string, required): MAC address or cellular tower ID

**Example:**

```bash
curl http://localhost:3001/api/networks/observations/AA:BB:CC:DD:EE:FF
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "bssid": "AA:BB:CC:DD:EE:FF",
    "ssid": "Mobile Hotspot",
    "type": "W",
    "observations": [
      {
        "id": 12345,
        "lat": 40.7128,
        "lon": -74.006,
        "signal_strength": -65,
        "time": "2025-12-02T08:00:00Z",
        "accuracy": 10
      }
    ],
    "count": 128
  }
}
```

---

#### Search Networks by SSID

Search for networks matching SSID pattern.

```http
GET /api/networks/search/:ssid
```

**Path Parameters:**

- `ssid` (string, required): SSID to search (supports wildcards with %)

**Example:**

```bash
curl http://localhost:3001/api/networks/search/Starbucks
```

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "bssid": "AA:BB:CC:DD:EE:FF",
      "ssid": "Starbucks WiFi",
      "type": "W",
      "last_seen": "2025-12-02T08:30:00Z"
    }
  ]
}
```

---

#### Tag Network

Classify a network with user tag.

```http
POST /api/tag-network
```

**Headers:**

```http
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**

```json
{
  "bssid": "AA:BB:CC:DD:EE:FF",
  "tag_type": "LEGIT",
  "confidence": 95,
  "notes": "Home router confirmed"
}
```

**Fields:**

- `bssid` (string, required): Network MAC address or tower ID
- `tag_type` (string, required): One of:
  - `LEGIT`: Confirmed safe network (threat score: 0.0)
  - `FALSE_POSITIVE`: Incorrectly flagged (threat score: 0.05)
  - `INVESTIGATE`: Requires investigation (threat score: 0.7)
  - `THREAT`: Confirmed threat (threat score: 1.0)
- `confidence` (integer, required, 0-100): User confidence level
- `notes` (string, optional): Additional context

**Response:**

```json
{
  "ok": true,
  "data": {
    "message": "Network tagged successfully",
    "bssid": "AA:BB:CC:DD:EE:FF",
    "tag_type": "LEGIT"
  }
}
```

---

#### Delete Network Tag

Remove classification tag from network.

```http
DELETE /api/tag-network/:bssid
```

**Headers:**

```http
x-api-key: your-api-key
```

**Path Parameters:**

- `bssid` (string, required): Network MAC address

**Response:**

```json
{
  "ok": true,
  "data": {
    "message": "Tag removed successfully"
  }
}
```

---

### Analytics

#### Network Types Distribution

Get count of networks by type.

```http
GET /api/analytics/network-types
```

**Response:**

```json
{
  "ok": true,
  "data": [
    { "type": "W", "type_name": "WiFi", "count": 145230 },
    { "type": "E", "type_name": "BLE", "count": 18456 },
    { "type": "B", "type_name": "Bluetooth", "count": 5234 },
    { "type": "L", "type_name": "LTE", "count": 3215 },
    { "type": "N", "type_name": "5G NR", "count": 891 },
    { "type": "G", "type_name": "GSM", "count": 300 }
  ]
}
```

---

#### Signal Strength Distribution

Get histogram of signal strengths.

```http
GET /api/analytics/signal-strength
```

**Response:**

```json
{
  "ok": true,
  "data": [
    { "range": "-100 to -90", "count": 1234 },
    { "range": "-90 to -80", "count": 5678 },
    { "range": "-80 to -70", "count": 12456 },
    { "range": "-70 to -60", "count": 45678 },
    { "range": "-60 to -50", "count": 23456 }
  ]
}
```

---

#### Temporal Activity Patterns

Get hourly observation distribution (24-hour).

```http
GET /api/analytics/temporal-activity
```

**Response:**

```json
{
  "ok": true,
  "data": [
    { "hour": 0, "observation_count": 1234 },
    { "hour": 1, "observation_count": 890 },
    { "hour": 6, "observation_count": 3456 },
    { "hour": 12, "observation_count": 8901 },
    { "hour": 18, "observation_count": 6789 }
  ]
}
```

---

#### Security/Encryption Distribution

Get count of networks by security type (WiFi only).

```http
GET /api/analytics/security
```

**Response:**

```json
{
  "ok": true,
  "data": [
    { "security_type": "WPA3-E", "count": 1234 },
    { "security_type": "WPA3-P", "count": 5678 },
    { "security_type": "WPA2-E", "count": 34567 },
    { "security_type": "WPA2-P", "count": 89012 },
    { "security_type": "WPA", "count": 12345 },
    { "security_type": "WEP", "count": 456 },
    { "security_type": "WPS", "count": 234 },
    { "security_type": "OPEN", "count": 2345 }
  ]
}
```

**Security Type Classification:**

- `WPA3-E`: WPA3 Enterprise (802.1X)
- `WPA3-P`: WPA3 Personal (SAE/PSK)
- `WPA2-E`: WPA2 Enterprise
- `WPA2-P`: WPA2 Personal (PSK)
- `WPA`: Original WPA (not WPA2/3)
- `WEP`: Legacy WEP encryption
- `WPS`: WiFi Protected Setup only
- `OPEN`: No encryption

---

#### Radio Type Over Time

Get network type distribution over last 30 days.

```http
GET /api/analytics/radio-type-over-time
```

**Response:**

```json
{
  "ok": true,
  "data": [
    {
      "date": "2025-11-03",
      "type_W": 1234,
      "type_E": 234,
      "type_B": 56,
      "type_L": 12,
      "type_N": 3,
      "type_G": 1
    }
  ]
}
```

---

### Machine Learning

#### Train ML Model

Train threat detection model on tagged networks.

```http
POST /api/ml/train
```

**Headers:**

```http
x-api-key: your-api-key
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "message": "Model trained successfully",
    "training_samples": 156,
    "accuracy": 0.89,
    "coefficients": {
      "distance_range": 2.45,
      "observation_count": 0.12,
      "unique_days": 0.34,
      "seen_at_home": 1.89,
      "seen_away_from_home": 2.12
    }
  }
}
```

**Requirements:**

- Minimum 10 tagged networks
- At least 2 different tag types (LEGIT vs THREAT/INVESTIGATE)

---

#### Get ML Model Status

Get training status and statistics.

```http
GET /api/ml/status
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "model_trained": true,
    "last_training": "2025-12-02T06:00:00Z",
    "training_samples": 156,
    "tagged_networks": {
      "LEGIT": 89,
      "FALSE_POSITIVE": 12,
      "INVESTIGATE": 34,
      "THREAT": 21
    },
    "can_train": true,
    "message": "Model ready for prediction"
  }
}
```

---

#### Predict Threat

Get ML prediction for specific network.

```http
GET /api/ml/predict/:bssid
```

**Path Parameters:**

- `bssid` (string, required): Network MAC address

**Response:**

```json
{
  "ok": true,
  "data": {
    "bssid": "AA:BB:CC:DD:EE:FF",
    "ml_prediction": 0.87,
    "classification": "THREAT",
    "confidence": "HIGH",
    "features": {
      "distance_range": 2.5,
      "observation_count": 45,
      "unique_days": 8,
      "seen_at_home": true,
      "seen_away_from_home": true
    }
  }
}
```

---

### Utility

#### Get Manufacturer

Lookup manufacturer from MAC address OUI.

```http
GET /api/manufacturer/:bssid
```

**Path Parameters:**

- `bssid` (string, required): MAC address

**Example:**

```bash
curl http://localhost:3001/api/manufacturer/AA:BB:CC:DD:EE:FF
```

**Response:**

```json
{
  "ok": true,
  "data": {
    "manufacturer": "Apple Inc.",
    "category": "consumer_electronics"
  }
}
```

---

## Network Type Codes

- `W`: WiFi (802.11)
- `E`: BLE (Bluetooth Low Energy)
- `B`: Bluetooth Classic (mapped to BLE if frequency < 5000 or capabilities contain 'BLE')
- `L`: LTE (4G cellular)
- `N`: 5G NR (New Radio)
- `G`: GSM/Cellular (mapped to LTE if capabilities contain 'LTE')

## Timestamp Format

All timestamps are ISO 8601 UTC:

```
2025-12-02T08:30:00Z
```

## Constants

- `MIN_VALID_TIMESTAMP`: 946684800000 (Jan 1, 2000 in milliseconds)
- `THREAT_THRESHOLD`: 40 points (configurable via `minSeverity`)
- `MIN_OBSERVATIONS`: 2 (minimum for threat detection)
- `MAX_PAGE_SIZE`: 5000 (maximum results per page)

## Examples

### Complete Threat Detection Workflow

```bash
# 1. Get dashboard metrics
curl http://localhost:3001/api/dashboard-metrics

# 2. Get threats with high severity
curl "http://localhost:3001/api/threats/quick?page=1&limit=10&minSeverity=70"

# 3. Investigate specific network
curl http://localhost:3001/api/networks/observations/AA:BB:CC:DD:EE:FF

# 4. Tag as threat
curl -X POST http://localhost:3001/api/tag-network \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-key" \
  -d '{
    "bssid": "AA:BB:CC:DD:EE:FF",
    "tag_type": "THREAT",
    "confidence": 90,
    "notes": "Confirmed tracking device"
  }'

# 5. Train ML model
curl -X POST http://localhost:3001/api/ml/train \
  -H "x-api-key: your-key"

# 6. Get ML prediction
curl http://localhost:3001/api/ml/predict/AA:BB:CC:DD:EE:FF
```

---

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).
For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
