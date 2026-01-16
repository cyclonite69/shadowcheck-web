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

- React/Vite front-end is being introduced (`src/` routes like `/geospatial-intel`, `/analytics`, `/ml-training`, `/api-test`), backed by new PostGIS materialized views for fast explorer pages.
- Legacy HTML/JS under `public/` stays in place (and is still served) until the React refactor reaches full feature parity—do not remove legacy assets yet.
- Backend serves both: Express APIs at `/api/*` plus React build assets (`dist/`) once built; legacy pages remain accessible under their existing paths.
- ETL pipeline lives in `etl/` with modular load/transform/promote steps feeding the explorer views; staging tables remain UNLOGGED for ingestion speed.

## Features

- **Dashboard:** Real-time network environment overview with threat indicators
- **Geospatial Analysis:** Interactive Mapbox visualization with spatial correlation
- **Network Analysis:** Deep dive into individual network characteristics and behavior patterns
- **Threat Detection:** ML-powered identification of surveillance devices and anomalies
- **Analytics:** Advanced charts and graphs for network pattern analysis
- **Address Enrichment:** Multi-API venue and business identification (4 sources)
- **Device Classification:** Automatic identification of device types and behavioral profiling
- **Trilateration:** AP location calculation from multiple observations

## Architecture

**Backend:** Node.js/Express REST API with PostgreSQL + PostGIS  
**Frontend:** React + Vite (new explorers and dashboards) and legacy HTML/JS (Mapbox/Chart.js) until parity is reached  
**Database:** PostgreSQL 18 with PostGIS extension (566,400+ location records, 173,326+ unique networks)

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

## Pages (legacy + new React)

- Dashboard (React): `/` and `/dashboard`
- Geospatial Intelligence (React): `/geospatial` or `/geospatial-intel`
- Analytics (React): `/analytics`
- API Test (React): `/api-test`
- ML Training (React): `/ml-training`
- Legacy HTML (kept until parity): `/geospatial.html`, `/networks.html`, `/analytics.html`, `/surveillance.html`, `/kepler-test.html`

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
├── public/                # Static assets
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

**📖 See [docs/architecture/project-structure.md](docs/architecture/project-structure.md) for detailed frontend/backend organization.**

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

## Documentation

Additional documentation is available in the `docs` directory. See [docs/INDEX.md](docs/INDEX.md) for navigation.

## Contributing

See `CONTRIBUTING.md` for code standards and workflow.

## Code of Conduct

See `CODE_OF_CONDUCT.md`.

## License

MIT. See `LICENSE` for details.
