# ShadowCheck - SIGINT Forensics Platform

[![GitHub stars](https://img.shields.io/github/stars/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/network)
[![GitHub issues](https://img.shields.io/github/issues/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/issues)
[![GitHub license](https://img.shields.io/github/license/cyclonite69/shadowcheck-static?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D18-blue?style=flat-square)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%3E%3D4.0.0-red?style=flat-square)](https://redis.io/)
[![GitHub last commit](https://img.shields.io/github/last-commit/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/commits)
[![GitHub repo size](https://img.shields.io/github/repo-size/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static)

🛡️ **Production-grade SIGINT forensics and wireless network analysis platform.** Real-time threat detection, geospatial correlation via PostGIS, and interactive analysis dashboards.

## Current System Status

- **React/Vite frontend** with TypeScript support is fully integrated (`client/src/` routes like `/geospatial-intel`, `/analytics`, `/ml-training`, `/endpoint-test`)
- **Modern modular backend architecture** with organized services in `server/src/api/`, `server/src/services/`, and `server/src/repositories/`
- **Integrated Asset Serving**: The main Express server natively serves compiled frontend assets from `dist/` with optimized security headers.
- **Universal filter system** with 20+ filter types supporting complex queries across all pages
- **DevContainer support** for consistent development environments with VS Code integration
- **Static server** with security headers for production deployment and Lighthouse audits
- **PostGIS materialized views** for fast explorer pages with precomputed threat intelligence
- **ETL pipeline** lives in `etl/` with modular load/transform/promote steps feeding the explorer views; staging tables remain UNLOGGED for ingestion speed
- **Machine learning** with multiple algorithms (Logistic Regression, Random Forest, Gradient Boosting) and hyperparameter optimization
- **Redis Integration** handles caching, session management, and rate limiting.

## Features

- **Dashboard:** Real-time network environment overview with threat indicators and interactive metrics cards.
- **Geospatial Analysis:** Interactive Mapbox visualization with spatial correlation, clustering, heatmaps, routes, and **Unified Network Tooltips**.
- **Weather FX System:** Real-time atmospheric visualization with rain/snow particle effects, dynamic fog, and historical weather lookup for observation points.
- **Agency Offices Dataset:** [NEW] 56 Field Offices (100% ZIP+4 coverage) and 334 Resident Agencies (93.4% ZIP+4 coverage) with PostGIS coordinate points for geospatial correlation.
- **Geospatial Explorer:** Map-based network exploration with overlays and timeline views.
- **Network Analysis:** Deep dive into individual network characteristics and behavior patterns with universal filtering.
- **Threat Detection:** ML-powered identification of surveillance devices and anomalies with multiple algorithms.
- **Analytics:** Advanced charts and graphs for network pattern analysis with Chart.js visualizations.
- **Address Enrichment:** Multi-API venue and business identification (4 sources: OpenCage, LocationIQ, Abstract, Overpass).
- **Device Classification:** Automatic identification of device types and behavioral profiling.
- **Network Tagging:** Manual classification and tag retrieval for networks.
- **Trilateration:** AP location calculation from multiple observations with accuracy estimation.
- **Machine Learning:** Multi-algorithm threat detection with hyperparameter optimization and model versioning.
- **Universal Filters:** 20+ filter types supporting complex temporal, spatial, and behavioral queries.
- **WiGLE Integration:** Local WiGLE database search with live API lookups.
- **Kepler Integration:** Kepler.gl-ready GeoJSON endpoints with filter support.
- **Home Location & Markers:** Saved locations and distance-from-home filters.
- **Data Export & Backup:** CSV/JSON/GeoJSON exports plus admin-protected backups.
- **Authentication & Roles:** Session-based login with admin-gated operations.
- **Admin Settings:** Keyring-backed Mapbox/WiGLE/Google Maps configuration.
- **DevContainer Support:** Consistent development environment with VS Code integration.
- **Security Headers:** Production-ready deployment with CSP, HTTPS enforcement, and Lighthouse optimization.
- **Admin Features:** System administration interface with configuration management, user settings, and role-based gating.
- **Admin Database Security**: Multi-user model with read-only `shadowcheck_user` and privileged `shadowcheck_admin`.

See `docs/FEATURES.md` for the full feature catalog.

## Kepler.gl Data Policy

- **No default limits** on Kepler endpoints unless explicitly requested via query params.
- Filters are used instead of caps; Kepler.gl is designed for large datasets.

## Recent Improvements (February 2026)

✅ **Agency Offices Dataset Completion**

- **Field Offices**: 56 total, 56 ZIP+4 (100%), 0 ZIP5-only.
- **Resident Agencies**: 334 total, 312 ZIP+4 (93.4%), 22 ZIP5-only.
- **Data Completeness**: 0 missing cities, states, postal codes, phones, websites, or coordinates across all 390 primary records.
- **Normalization**: Full address and phone normalization (10 digits) with original value preservation.

✅ **Weather FX & Atmospheric Visualization**

- **Real-time Weather Overlay**: Dynamic fog, rain, and snow effects based on live Open-Meteo data at the map center.
- **Particle System**: High-performance canvas-based particle engine for realistic rain (vertical streaks) and snow (sinusoidal drift).
- **Historical Weather Context**: Ability to view weather conditions (temp, pressure, visibility) for any past observation point via the backend proxy.
- **Backend Proxy**: New `/api/weather` endpoints to securely fetch external weather data without exposing keys or triggering CSP issues.

✅ **TypeScript Migration & Build Pipeline**

- **Complete TypeScript migration**: Converted 60+ files including server utilities, middleware, ETL scripts, and build tools
- **Production build pipeline**: Compiled TypeScript server for Docker deployment eliminates runtime ts-node overhead
- **Type safety**: Added comprehensive interfaces and types for database operations, API responses, and service layers
- **Build optimization**: Frontend and server compile separately with proper path resolution for containerized deployment

✅ **Redis Implementation**

- **Threat Score Caching**: Redis caches threat scores at 5-minute intervals.
- **Analytics Caching**: Redis caches analytics aggregations.
- **Session Management**: Redis handles session storage.
- **Rate Limiting**: Redis backend enforces 1000 req/15min per IP.

✅ **Data Integrity Fixes**

- Fixed GeoSpatial table showing incorrect default values (signal: 0 dBm, channel: 0, frequency: 0 MHz)
- Resolved analytics widgets failures (Temporal Activity, Radio Types Over Time, Threat Score Trends)
- Fixed max distance calculation to use real PostGIS geographic distances instead of ~238m signal approximation
- Resolved threat score column sorting issues (rule_score, ml_score, ml_weight, ml_boost now sortable)

✅ **API & Backend Improvements**

- Networks API now uses latest observation data for accurate real-time information
- Added manufacturer field population via radio_manufacturers table with OUI prefix matching
- Fixed WiGLE observation points rendering with correct schema namespace (app vs public)
- Enhanced analytics endpoints with proper null value handling and appropriate data sources

✅ **Frontend Enhancements**

- Fixed data transformer field name mismatches (network_type → type, avg_score → avgScore)
- Added missing API calls for temporal, radio-time, and threat-trends analytics
- Improved geographic distance display and invalid value handling

✅ **Testing & Quality**

- Added comprehensive regression tests for networks API data integrity
- Enhanced error handling and validation across all endpoints

## Architecture

**Backend:** Node.js/Express REST API with PostgreSQL + PostGIS + Redis (Modular architecture with Repositories and Services)
**Frontend:** React + Vite with TypeScript (explorers and dashboards)
**Database:** PostgreSQL 18 with PostGIS extension (566,400+ location records, 173,326+ unique networks)
**Cache:** Redis v4+ for sessions, rate limiting, and analytics
**Development:** DevContainer support with VS Code integration
**Deployment:** Production builds are served via the integrated asset handler in `server/server.ts`.

## Prerequisites

- Node.js 20+
- PostgreSQL 18+ with PostGIS
- Redis 4.0+
- TypeScript 5.0+ (included in devDependencies)

## Quick Start

### Local Development

```bash
git clone https://github.com/cyclonite69/shadowcheck-static.git
cd shadowcheck-static
npm install
docker-compose up -d
```

### Home Lab Deployment

```bash
git clone https://github.com/cyclonite69/shadowcheck-static.git
cd shadowcheck-static
./deploy/homelab/scripts/setup.sh
```

See [deploy/homelab/README.md](deploy/homelab/README.md) for hardware requirements and detailed setup.

### AWS Production

**🚀 Quick Start:** See [deploy/aws/QUICKSTART.md](deploy/aws/QUICKSTART.md)

```bash
# 1. Launch instance (from local machine)
./deploy/aws/scripts/launch-shadowcheck-spot.sh

# 2. Connect via SSM
aws ssm start-session --target INSTANCE_ID --region us-east-1

# 3. Run automated setup
bash
curl -fsSL https://raw.githubusercontent.com/cyclonite69/shadowcheck-static/master/deploy/aws/scripts/setup-instance.sh | sudo bash
cd /home/ssm-user
git clone https://github.com/cyclonite69/shadowcheck-static.git shadowcheck
cd shadowcheck
./deploy/aws/scripts/deploy-complete.sh

# 4. Update deployments
git pull origin master
./deploy/aws/scripts/scs_rebuild.sh
```

**Documentation:**

- [QUICKSTART.md](deploy/aws/QUICKSTART.md) - Complete deployment guide
- [WORKFLOW.md](deploy/aws/WORKFLOW.md) - Development workflow
- [README.md](deploy/aws/README.md) - AWS infrastructure details
- [DEPLOYMENT_CHECKLIST.md](deploy/aws/DEPLOYMENT_CHECKLIST.md) - Verification checklist

---

## Detailed Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-username/shadowcheck-static.git
cd shadowcheck-static
npm install
```

### 2. Database & Redis Setup

Create PostgreSQL database with PostGIS and secure users. Ensure Redis is running.

```sql
-- Standard application user (Read-only on production tables)
CREATE ROLE shadowcheck_user WITH LOGIN PASSWORD 'your_password';
-- Administrative user (Full access for imports/tagging)
CREATE ROLE shadowcheck_admin WITH LOGIN PASSWORD 'admin_password';

CREATE DATABASE shadowcheck_db OWNER shadowcheck_admin;
\c shadowcheck_db
CREATE EXTENSION postgis;
```

Apply security migration: `psql -U shadowcheck_admin -d shadowcheck_db -f sql/migrations/20260129_implement_db_security.sql`

### 3. Environment Configuration

Create `.env` in project root (or load secrets via keyring):

```
DB_USER=shadowcheck_user
DB_HOST=shadowcheck_postgres
DB_NAME=shadowcheck_db
DB_PASSWORD=your_password
DB_PORT=5432
REDIS_HOST=shadowcheck_static_redis
REDIS_PORT=6379
PORT=3001
```

See `.env.example` for all options.

> **Bare-metal only**: Replace `DB_HOST` and `REDIS_HOST` with `localhost` if running without Docker.

### 4. Run Migrations

```bash
psql -U shadowcheck_user -d shadowcheck_db -f sql/functions/create_scoring_function.sql
psql -U shadowcheck_user -d shadowcheck_db -f sql/functions/fix_kismet_functions.sql
psql -U shadowcheck_user -d shadowcheck_db -f sql/migrations/migrate_network_tags_v2.sql
# Follow the order in sql/migrations/README.md for remaining migrations
```

### 5. Start Server

```bash
npm start
```

Server runs on `http://localhost:3001`

## Pages

- Dashboard (React): `/` and `/dashboard`
- Geospatial Intelligence (React): `/geospatial` or `/geospatial-intel`
- Geospatial Explorer (React): `/geospatial-explorer`
- Analytics (React): `/analytics`
- API Test (React): `/endpoint-test`
- ML Training (React): `/ml-training`
- Admin: `/admin`
- WiGLE (React): `/wigle`
- Kepler (React): `/kepler`

## API Endpoints

### Networks & Observations

- `GET /api/networks` - Paginated network list with universal filtering
- `GET /api/v2/networks` - Version 2 paginated networks API
- `GET /api/networks/observations/:bssid` - All observation records for a specific network
- `GET /api/networks/search/:ssid` - Search networks by SSID
- `GET /api/networks/tagged` - List user-tagged networks
- `GET /api/location-markers` - Retrieve saved map markers
- `GET /api/home-location` - Get current home/base coordinates

### Threat Analysis & ML

- `GET /api/threats/quick` - High-performance threat detection overview
- `GET /api/threats/detect` - Detailed movement-based forensic analysis
- `GET /api/ml/status` - Check ML model training status and stats
- `POST /api/ml/train` - Trigger ML model retraining on tagged data

### Analytics & Intelligence

- `GET /api/analytics/dashboard-metrics` - Key metrics for dashboard cards
- `GET /api/analytics/*` - Various statistical distribution endpoints (temporal, signal, etc.)
- `GET /api/weather` - Current weather proxy for map overlays (Open-Meteo)
- `GET /api/wigle/api-status` - Check WiGLE API connectivity
- `GET /api/mapbox-token` - Securely retrieve Mapbox API token

### Data Management & Admin

- `POST /api/network-tags/:bssid` - Manually classify a network (admin)
- `POST /api/admin/import-sqlite` - Turbo SQLite database import (admin)
- `POST /api/admin/cleanup-duplicates` - Remove redundant observation data (admin)
- `GET /api/export/networks` - Export filtered networks to CSV/JSON
- `POST /api/admin/aws/instances/:id/start` - Start EC2 instance (admin)
- `POST /api/admin/aws/instances/:id/stop` - Stop EC2 instance (admin)

### Authentication

- `POST /api/auth/login` - Session-based authentication
- `POST /api/auth/logout` - Invalidate current session
- `GET /api/auth/status` - Check current authentication state

See `server/server.ts` and `server/src/utils/routeMounts.ts` for implementation details.

## Machine Learning

ShadowCheck includes multi-algorithm threat detection with model training and hyperparameter optimization.

### Training Endpoint

**POST** `/api/ml/train`

Trains logistic regression model on all tagged networks in database.

**Request:**

```bash
curl -X POST http://localhost:3001/api/ml/train
```

**Response:**

```json
{
  "ok": true,
  "model": {
    "type": "logistic_regression",
    "accuracy": 0.92,
    "precision": 0.88,
    "recall": 0.95,
    "f1": 0.91,
    "rocAuc": 0.94
  },
  "trainingData": {
    "totalNetworks": 45,
    "threats": 18,
    "falsePositives": 27
  },
  "message": "Model trained successfully"
}
```

**Errors:**

- `400`: Fewer than 10 tagged networks (minimum required)
- `503`: ML model module unavailable

### Status Endpoint

**GET** `/api/ml/status`

Check model training status and tag statistics.

### Advanced ML Iteration

Test multiple algorithms with grid search and cross-validation:

```bash
pip install -r scripts/ml/requirements.txt
python3 scripts/ml/ml-iterate.py
```

Tests Logistic Regression, Random Forest, and Gradient Boosting with hyperparameter tuning.

### Features Used for Training

- Observation count (network detections)
- Unique days seen
- Geographic distribution (location clustering)
- Signal strength (RSSI max)
- Distance range from home location
- Behavioral flags (seen at home vs. away)

## Project Structure

```
shadowcheck-static/
├── client/
│   ├── src/
│   │   ├── components/    # ⚛️ React components (TypeScript)
│   │   ├── App.tsx        # ⚛️ Main React app
│   │   └── main.tsx       # ⚛️ Frontend entry point
│   └── vite.config.ts     # ⚛️ Frontend build config (TypeScript)
├── server/
│   ├── src/
│   │   ├── api/           # 🔧 REST API routes (TypeScript)
│   │   ├── services/      # 🔧 Business logic (TypeScript)
│   │   ├── middleware/    # 🔧 Express middleware (TypeScript)
│   │   └── utils/         # 🔧 Server utilities (TypeScript)
│   ├── server.ts          # 🔧 Main server entry point
│   └── static-server.ts   # 🛠️ Benchmark static server
├── deploy/                # 🚀 Deployment configs (AWS, etc.)
│   └── aws/               # AWS-specific deployment
├── etl/                   # 📊 ETL pipeline (TypeScript)
├── scripts/               # 🛠️ Utility scripts (TypeScript)
├── tests/                 # 🧪 Jest tests (TypeScript)
├── sql/                   # 🗄️ Database migrations & functions
├── docs/                  # 📚 Documentation
├── tsconfig.json          # ⚙️ TypeScript config (client)
├── tsconfig.server.json   # ⚙️ TypeScript config (server)
└── docker-compose.yml     # 🐳 Docker configuration
```

**📖 See [docs/architecture/PROJECT_STRUCTURE.md](docs/architecture/PROJECT_STRUCTURE.md) for detailed frontend/backend organization.**

Also see [docs/DIRECTORY_STRUCTURE.md](docs/DIRECTORY_STRUCTURE.md) for complete details.

## Development

**Run dev server:**

```bash
npm run dev
```

**Run tests:**

```bash
npm test
```

## Configuration

Key environment variables (see `.env.example`):

- `DB_*` - PostgreSQL connection
- `REDIS_*` - Redis connection
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - development or production

## Security

- Use strong database credentials in production.
- Rotate passwords every 60-90 days (see `deploy/aws/docs/PASSWORD_ROTATION.md`).
- Enable HTTPS/TLS at reverse proxy layer.
- Restrict API access via rate limiting (enabled via Redis).
- See `SECURITY.md` for detailed security guidelines.

### Security Headers & Lighthouse Audits

For accurate Lighthouse Best Practices audits, use the benchmark static server:

```bash
npm run build
npm run serve:dist
# Then run Lighthouse against http://localhost:4000
```

The integrated server (`server/server.ts`) also applies high-security headers by default.

### Third-Party Cookies Notice

**Expected Lighthouse warning:** "Uses third-party cookies" from `api.mapbox.com`.

This is an expected behavior when using Mapbox GL JS. Mapbox sets cookies for:

- Session management and rate limiting
- Telemetry (can be disabled via `mapboxgl.config.COLLECT_TELEMETRY = false`)
- Tile caching

These cookies are required for Mapbox functionality and cannot be eliminated without self-hosting all map tiles.

### SEO Indexing

By default, `robots.txt` disallows all crawling (dev/staging). For production:

```bash
npm run build:public  # Sets ROBOTS_ALLOW_INDEXING=true
```

## Documentation

Additional documentation is available in the `docs` directory. See [docs/README.md](docs/README.md) for navigation.

## Contributing

See `CONTRIBUTING.md` for code standards and workflow.

## Code of Conduct

See `CODE_OF_CONDUCT.md`.

## License

MIT. See `LICENSE` for details.
