# Cross-Repository Database Integration

## Overview

ShadowCheck ecosystem consists of multiple repositories sharing a unified PostgreSQL database with PostGIS for geospatial analysis.

## Repository Architecture

### 1. ShadowCheckStatic (Node.js/Express)

**Role:** Web dashboard, analytics, visualization

- **Frontend:** HTML5, Tailwind CSS, Chart.js, Mapbox GL JS
- **Backend:** Express REST API
- **Database:** PostgreSQL 18 + PostGIS (primary)
- **Maps:** Mapbox, Google Maps, Google Earth, Kepler.gl

### 2. ShadowCheckPentest (Python/SQLAlchemy)

**Role:** Active scanning, penetration testing

- **Framework:** Clean Architecture (Domain/Infrastructure/Application)
- **ORM:** SQLAlchemy with Pydantic domain models
- **Database:** PostgreSQL 18 (shared with Static)
- **Scans:** WiFi, ARP, port scanning, baseline audits

### 3. ShadowCheckMobile (Kotlin/Room)

**Role:** Mobile wardriving, passive collection

- **Framework:** Android with Jetpack Compose
- **Database:** Room (SQLite local) + sync to PostgreSQL
- **Entities:** WiFi, Bluetooth, BLE, Cellular, Sensors
- **Features:** Geofencing, notes, tags, API tokens

## Shared Database Schema

### Core Principle: Single Source of Truth

All repos write to and read from the same PostgreSQL database at `shadowcheck_postgres:5432`

```
┌─────────────────────┐
│  ShadowCheckStatic  │──┐
│   (Web Dashboard)   │  │
└─────────────────────┘  │
                         │
┌─────────────────────┐  │    ┌──────────────────────┐
│ ShadowCheckPentest  │──┼───▶│  PostgreSQL 18 +     │
│  (Active Scanning)  │  │    │  PostGIS 3.4         │
└─────────────────────┘  │    │  (shadowcheck_db)    │
                         │    └──────────────────────┘
┌─────────────────────┐  │
│ ShadowCheckMobile   │──┘
│ (Mobile Wardriving) │
└─────────────────────┘
```

## Unified Entity Mapping

### WiFi Networks

| ShadowCheckMobile (Room) | PostgreSQL (app.networks) | ShadowCheckPentest (ORM) |
| ------------------------ | ------------------------- | ------------------------ |
| bssid                    | bssid (MACADDR)           | bssid                    |
| ssid                     | ssid                      | ssid                     |
| frequency                | frequency_mhz             | frequency                |
| signalLevel              | max_signal_dbm            | signal_strength          |
| capabilities             | encryption[]              | security                 |
| channel                  | channel                   | channel                  |
| latitude/longitude       | location (GEOGRAPHY)      | -                        |
| timestamp                | last_seen_at              | last_seen                |
| vendorName               | manufacturer              | -                        |

### Observations (Location Sightings)

All repos insert into `app.observations` (partitioned by month):

- **Mobile:** Continuous passive collection
- **Pentest:** Active scan sessions
- **Static:** Import from WiGLE API/CSV

### Devices (Clients)

| Mobile Entity   | PostgreSQL  | Pentest Entity           |
| --------------- | ----------- | ------------------------ |
| BluetoothDevice | app.devices | DeviceORM                |
| BleDevice       | app.devices | DeviceORM                |
| -               | app.devices | DeviceORM (WiFi clients) |

## API Key Management (Keyring)

### No Hardcoded Secrets Policy

All API keys stored in system keyring, never in code or .env files committed to git.

### Keyring Structure

```python
# Service: 'shadowcheck'
# Accounts:
- postgres_password          # Database password
- pgadmin_password           # pgAdmin password
- mapbox_token              # Mapbox GL JS
- google_maps_api_key       # Google Maps/Earth
- wigle_api_key             # WiGLE API v2/v3
- opencage_api_key          # OpenCage geocoding
- locationiq_api_key        # LocationIQ geocoding
- abstract_api_key          # Abstract API
- kepler_gl_token           # Kepler.gl (if needed)
```

### Access Pattern (Python - ShadowCheckPentest)

```python
import keyring

# Get password
password = keyring.get_password('shadowcheck', 'postgres_password')

# Set password
keyring.set_password('shadowcheck', 'postgres_password', 'new_password')
```

### Access Pattern (Node.js - ShadowCheckStatic)

```javascript
// Use child_process to call Python keyring
const { execSync } = require('child_process');

function getKeyringPassword(account) {
  const cmd = `python3 -c "import keyring; print(keyring.get_password('shadowcheck', '${account}'))"`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

const dbPassword = getKeyringPassword('postgres_password');
```

### Access Pattern (Kotlin - ShadowCheckMobile)

```kotlin
// Store in Android Keystore
val keyStore = KeyStore.getInstance("AndroidKeyStore")
// Or use EncryptedSharedPreferences
```

## Map Integration

### Mapbox GL JS (Primary)

```javascript
mapboxgl.accessToken = getKeyringPassword('mapbox_token');
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [lng, lat],
  zoom: 12,
});

// Add PostGIS data as GeoJSON
map.addSource('networks', {
  type: 'geojson',
  data: '/api/networks/geojson',
});
```

### Google Maps

```html
<script src="https://maps.googleapis.com/maps/api/js?key=FROM_KEYRING"></script>
```

### Kepler.gl

```javascript
import KeplerGl from 'kepler.gl';

// Load data from PostgreSQL
const data = {
    fields: [...],
    rows: [...] // From app.observations
};
```

### Google Earth (KML Export)

```sql
-- Export as KML from PostGIS
SELECT ST_AsKML(location) FROM app.networks;
```

## Data Flow Patterns

### 1. Mobile → PostgreSQL Sync

```kotlin
// ShadowCheckMobile
suspend fun syncToPostgres() {
    val networks = wifiNetworkDao.getAllFlow().first()

    // HTTP POST to ShadowCheckStatic API
    api.importNetworks(networks.map { it.toPostgresFormat() })
}
```

### 2. Pentest → PostgreSQL Direct

```python
# ShadowCheckPentest
from shadowcheck.infrastructure.repositories import NetworkRepository

repo = NetworkRepository(db_session)
network = Network(ssid="test", bssid="00:11:22:33:44:55", ...)
repo.create(network)  # Direct SQLAlchemy insert
```

### 3. Static → PostgreSQL (Import)

```javascript
// ShadowCheckStatic
app.post('/api/import/wigle', async (req, res) => {
  const { csv_data } = req.body;

  // Call PostgreSQL function
  await pool.query('SELECT * FROM app.import_wigle_csv($1, $2)', [import_id, csv_data]);
});
```

## Cross-Repo API Endpoints

### ShadowCheckStatic REST API

```
GET  /api/networks              # All networks
GET  /api/networks/:bssid       # Single network
GET  /api/networks/geojson      # GeoJSON for maps
GET  /api/observations/:bssid   # Location history
POST /api/import/wigle          # Import WiGLE data
POST /api/import/mobile         # Import from mobile
POST /api/import/pentest        # Import from pentest
GET  /api/analytics/dashboard   # Dashboard stats (from MVs)
GET  /api/threats/quick         # Quick threat detection
```

### ShadowCheckPentest API (FastAPI)

```
POST /api/scans/wifi            # Start WiFi scan
GET  /api/scans/:id             # Scan status
POST /api/baselines             # Create baseline
POST /api/baselines/:id/audit   # Audit against baseline
GET  /api/networks              # Query networks
```

### ShadowCheckMobile Sync API

```
POST /api/mobile/sync/networks  # Bulk upload networks
POST /api/mobile/sync/bluetooth # Bulk upload BT devices
POST /api/mobile/sync/cellular  # Bulk upload cell towers
GET  /api/mobile/pull/updates   # Get updates since timestamp
```

## Database Connection Configuration

### Environment Variables (Not Committed)

```bash
# .env (gitignored)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=shadowcheck_db
DB_USER=shadowcheck_user
# DB_PASSWORD retrieved from keyring at runtime
```

### Connection String Assembly

```python
# Python (ShadowCheckPentest)
import keyring
from shadowcheck.core.config import get_settings

settings = get_settings()
password = keyring.get_password('shadowcheck', 'postgres_password')
db_url = f"postgresql://{settings.database.user}:{password}@{settings.database.host}:{settings.database.port}/{settings.database.name}"
```

```javascript
// Node.js (ShadowCheckStatic)
const password = getKeyringPassword('postgres_password');
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: password,
  port: process.env.DB_PORT,
});
```

## Shared Schema Benefits

### 1. Real-time Collaboration

- Mobile collects → Static visualizes → Pentest validates
- No data silos, immediate availability

### 2. Unified Analytics

- Materialized views aggregate from all sources
- Single dashboard shows all data

### 3. Cross-validation

- Mobile passive + Pentest active = higher confidence
- Trilateration from multiple sources

### 4. Simplified Backup

- One database to backup
- Consistent data model

## Migration Strategy

### Phase 1: Shared Core Tables

- app.networks
- app.observations
- app.devices

### Phase 2: Repo-Specific Extensions

- app.scans (Pentest)
- app.baselines (Pentest)
- app.geofences (Mobile)
- app.enrichments (Static)

### Phase 3: Sync Mechanisms

- Mobile: Periodic HTTP sync
- Pentest: Direct SQLAlchemy
- Static: Import APIs + direct queries

## Security Considerations

1. **Keyring Access:** Only authorized users can read keys
2. **Database Auth:** Strong passwords from keyring
3. **API Auth:** JWT tokens for mobile/pentest APIs
4. **Network:** VPN/SSH tunnel for remote access
5. **Encryption:** TLS for all database connections

## Next Steps

1. ✅ Document cross-repo architecture
2. ⏳ Implement keyring integration in all repos
3. ⏳ Create unified API endpoints
4. ⏳ Setup mobile sync mechanism
5. ⏳ Configure map integrations
6. ⏳ Test cross-repo data flow
