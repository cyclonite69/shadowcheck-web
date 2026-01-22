# ShadowCheck - SIGINT Forensics Platform

[![GitHub stars](https://img.shields.io/github/stars/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/network)
[![GitHub issues](https://img.shields.io/github/issues/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/issues)
[![GitHub license](https://img.shields.io/github/license/cyclonite69/shadowcheck-static?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?style=flat-square)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D18-blue?style=flat-square)](https://www.postgresql.org/)
[![GitHub last commit](https://img.shields.io/github/last-commit/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static/commits)
[![GitHub repo size](https://img.shields.io/github/repo-size/cyclonite69/shadowcheck-static?style=flat-square)](https://github.com/cyclonite69/shadowcheck-static)

🛡️ **Production-grade SIGINT forensics and wireless network analysis platform.** Real-time threat detection, geospatial correlation via PostGIS, and interactive analysis dashboards.

## Current Development Direction

- **React/Vite frontend** with TypeScript support is fully integrated (`src/` routes like `/geospatial-intel`, `/analytics`, `/ml-training`, `/api-test`)
- **Hybrid backend architecture** with legacy routes in `server.js` and modern modular services in `src/api/`, `src/services/`, and `src/repositories/`
- **Universal filter system** with 20+ filter types supporting complex queries across all pages
- **DevContainer support** for consistent development environments with VS Code integration
- **Static server** with security headers for production deployment and Lighthouse audits
- **PostGIS materialized views** for fast explorer pages with precomputed threat intelligence
- **ETL pipeline** lives in `etl/` with modular load/transform/promote steps feeding the explorer views; staging tables remain UNLOGGED for ingestion speed
- **Machine learning** with multiple algorithms (Logistic Regression, Random Forest, Gradient Boosting) and hyperparameter optimization

## Features

- **Dashboard:** Real-time network environment overview with threat indicators and interactive metrics cards
- **Geospatial Analysis:** Interactive Mapbox visualization with spatial correlation, clustering, and map orientation controls
- **Network Analysis:** Deep dive into individual network characteristics and behavior patterns with universal filtering
- **Threat Detection:** ML-powered identification of surveillance devices and anomalies with multiple algorithms
- **Analytics:** Advanced charts and graphs for network pattern analysis with Chart.js visualizations
- **Address Enrichment:** Multi-API venue and business identification (4 sources: OpenCage, LocationIQ, Abstract, Overpass)
- **Device Classification:** Automatic identification of device types and behavioral profiling
- **Trilateration:** AP location calculation from multiple observations with accuracy estimation
- **Machine Learning:** Multi-algorithm threat detection with hyperparameter optimization and model versioning
- **Universal Filters:** 20+ filter types supporting complex temporal, spatial, and behavioral queries
- **DevContainer Support:** Consistent development environment with VS Code integration
- **Security Headers:** Production-ready deployment with CSP, HTTPS enforcement, and Lighthouse optimization
- **Admin Features:** System administration interface with configuration management, user settings, and system monitoring

## Architecture

**Backend:** Node.js/Express REST API with PostgreSQL + PostGIS  
**Frontend:** React + Vite with TypeScript (explorers and dashboards)  
**Database:** PostgreSQL 18 with PostGIS extension (566,400+ location records, 173,326+ unique networks)  
**Development:** DevContainer support with VS Code integration  
**Deployment:** Static server with security headers for production

## Prerequisites

- Node.js 20+
- PostgreSQL 18+ with PostGIS

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-username/shadowcheck-static.git
cd shadowcheck-static
npm install
```

### 2. Database Setup

Create PostgreSQL database with PostGIS:

```sql
CREATE ROLE shadowcheck_user WITH LOGIN PASSWORD 'your_password';
CREATE DATABASE shadowcheck_db OWNER shadowcheck_user;
\c shadowcheck_db
CREATE EXTENSION postgis;
```

### 3. Environment Configuration

Create `.env` in project root (or load secrets via keyring):

```
DB_USER=shadowcheck_user
DB_HOST=shadowcheck_postgres
DB_NAME=shadowcheck_db
DB_PASSWORD=your_password
DB_PORT=5432
PORT=3001
```

See `.env.example` for all options.
If you're running PostgreSQL locally, set `DB_HOST=localhost` and use your local database name.

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
- Analytics (React): `/analytics`
- API Test (React): `/endpoint-test`
- ML Training (React): `/ml-training`
- Admin: `/admin`
- WiGLE Test (React): `/wigle-test`
- Kepler Test (React): `/kepler-test`

## API Endpoints

- `GET /api/networks` - All networks
- `GET /api/threats/quick` - Quick threat detection
- `GET /api/analytics/*` - Analytics data
- `GET /api/networks/observations/:bssid` - Network observations

See `server.js` for full endpoint documentation.

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
├── src/
│   ├── api/               # 🔧 Backend API routes
│   ├── services/          # 🔧 Backend business logic
│   ├── repositories/      # 🔧 Backend data access
│   ├── components/        # ⚛️ Frontend React components
│   ├── App.tsx            # ⚛️ Frontend React app
│   └── main.tsx           # ⚛️ Frontend entry point
├── server.js              # 🔧 Backend Express server
├── index.html             # ⚛️ Frontend HTML template
├── vite.config.js         # ⚛️ Frontend build config
├── scripts/               # Utility scripts
│   ├── import/            # Data import utilities
│   ├── enrichment/        # Address enrichment
│   └── ml/                # ML utilities
├── sql/                   # Database
│   ├── migrations/        # Schema migrations
│   └── functions/         # SQL functions
├── tests/                 # Jest tests
├── docs/                  # Documentation
└── docker-compose.yml     # Docker configuration
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
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - development or production

## Security

- Use strong database credentials in production
- Enable HTTPS/TLS at reverse proxy layer
- Restrict API access via rate limiting (already enabled)
- See `SECURITY.md` for detailed security guidelines

### Security Headers & Lighthouse Audits

For accurate Lighthouse Best Practices audits, use the static server with security headers:

```bash
npm run build
npm run serve:dist
# Then run Lighthouse against http://localhost:4000
```

The static server (`server/static-server.js`) applies these headers:

- `Content-Security-Policy` (allows Mapbox CDN)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`

### Third-Party Cookies Notice

**Expected Lighthouse warning:** "Uses third-party cookies" from `api.mapbox.com`.

This is an expected behavior when using Mapbox GL JS. Mapbox sets cookies for:

- Session management and rate limiting
- Telemetry (can be disabled via `mapboxgl.config.COLLECT_TELEMETRY = false`)
- Tile caching

These cookies are required for Mapbox functionality and cannot be eliminated without self-hosting all map tiles (impractical for most use cases).

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
