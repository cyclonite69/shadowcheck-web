# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShadowCheck is a wireless network threat detection platform that analyzes WiFi, Bluetooth, and cellular observations to detect potential surveillance devices. The system uses **Dockerized PostgreSQL 18 + PostGIS 3.6** for geospatial analysis and features a modular Node.js/Express backend with React + Vite frontend.

**Tech Stack**: Node.js 18+, Express, **Dockerized PostgreSQL 18 + PostGIS 3.6**, React 18, Vite, Mapbox GL JS, Recharts

**IMPORTANT**: PostgreSQL runs in Docker container `shadowcheck_postgres` on the `shadowcheck_net` network. **DO NOT use local system PostgreSQL** - always connect via Docker network or through the exposed port 5432.

## Quick Start

```bash
# Database Setup (REQUIRED FIRST STEP)
# PostgreSQL 18 + PostGIS must be running in shared Docker network
docker ps | grep shadowcheck_postgres  # Verify shared postgres is running
docker-compose up -d                    # Starts Redis and API containers

# Development (Recommended: Run API in Docker)
docker-compose up -d --build api   # Build and run API in Docker container
npm run build                       # Build React frontend
# Access at http://localhost:3001

# Alternative: Local development (Docker PostgreSQL must be running)
npm run dev              # Start backend API with auto-reload (port 3001)
npm run dev:frontend     # Start Vite dev server (port 5173)

# Testing
npm test                 # All tests
npm run test:watch       # Watch mode
npm run test:cov         # With coverage
npm run test:integration # Integration tests only

# Linting & Formatting
npm run lint             # Check for linting issues
npm run lint:fix         # Fix linting issues automatically
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without changes

# Docker Management
npm run docker:build     # Build Docker image
npm run docker:up        # Start all services
npm run docker:down      # Stop all services
npm run docker:logs      # Follow API logs

# Production
npm run build            # Build React frontend for production
docker-compose up -d     # Start all services in Docker
```

**IMPORTANT**:

- PostgreSQL MUST run in Docker (`shadowcheck_postgres` container) on external network `shadowcheck_net`
- Redis is managed by this project's docker-compose.yml (`shadowcheck_static_redis`)
- If running API locally (not in Docker), ensure local PostgreSQL service is STOPPED
- Backend API: port 3001, Frontend dev server: port 5173
- Node.js version: 20+ (specified in package.json engines)

## Architecture

The codebase uses a **modular, layered architecture**:

```
src/
├── api/routes/v1/      # HTTP endpoints (networks, threats, analytics, ml, etc.)
├── services/           # Business logic (dashboardService, analyticsService)
├── repositories/       # Data access layer (networkRepository)
├── config/             # Database pool, DI container
├── validation/         # Request schemas & middleware
├── errors/             # Custom error classes & handlers
├── logging/            # Winston structured logging
└── utils/              # Secrets validation, SQL escaping
```

**Design Patterns**:

- **Dependency Injection**: Services registered in `src/config/container.js`
- **Repository Pattern**: Database access abstracted in `src/repositories/`
- **Service Layer**: Business logic in `src/services/`
- **Global Error Handling**: Custom `AppError` class with middleware

**Infrastructure**:

- **Shared PostgreSQL**: External container `shadowcheck_postgres` on network `shadowcheck_net`
- **Project Redis**: Container `shadowcheck_static_redis` for caching (512MB, LRU eviction)
- **Secrets**: Docker secrets (`/run/secrets/`) → System keyring → Environment variables (priority order)
- **Static Assets**: Built frontend served from `dist/`, legacy pages from `public/`

See [docs/architecture/](docs/architecture/) for detailed system design.

## Database Schema

PostgreSQL 18 with PostGIS extension. Primary tables in `app` schema:

- `networks` - Network metadata (BSSID, SSID, type, encryption, threat_score)
- `observations` - Observation records (lat/lon, signal, timestamp) - partitioned by year
- `network_tags` - User tags (LEGIT, FALSE_POSITIVE, INVESTIGATE, THREAT)
- `location_markers` - Home/work locations for threat analysis
- `wigle_networks_enriched` - WiGLE API enrichment data

**Network Types**: W (WiFi), E (BLE), B (Bluetooth), L (LTE), N (5G NR), G (GSM)

**Note**: Legacy tables (`networks_legacy`, `locations_legacy`) exist but are deprecated. All new code uses `app.networks` and `app.observations`.

See [docs/DATABASE_SCHEMA_ENTITIES.md](docs/DATABASE_SCHEMA_ENTITIES.md) and related schema docs in `docs/` for full schema details.

## Development Patterns

### Database Queries

```javascript
const { query } = require('../config/database');

// Always use parameterized queries
const result = await query('SELECT * FROM app.networks WHERE bssid = $1', [bssid.toUpperCase()]);
```

### Error Handling

```javascript
const AppError = require('../errors/AppError');

// Throw custom errors with status codes
if (!network) {
  throw new AppError('Network not found', 404);
}
// Global error handler catches these automatically
```

### Secrets Management

```javascript
const secretsManager = require('../services/secretsManager');

// Get optional secret (returns null if missing)
const apiKey = secretsManager.get('api_key');

// Get required secret (throws if missing)
const dbPassword = secretsManager.getOrThrow('db_password');
```

**Secrets Priority**: Docker secrets → System keyring → Environment variables

### Logging

```javascript
const logger = require('../logging/logger');

logger.info('Processing threat detection', {
  correlationId: req.correlationId,
  networkCount: networks.length,
});
```

## Common Tasks

### Adding a New API Endpoint

1. Create route handler in `src/api/routes/v1/`
2. Add business logic to service in `src/services/`
3. Add data access to repository in `src/repositories/`
4. Register services in `src/config/container.js` (if needed)
5. Import and mount route in `server.js`

### Running Tests

```bash
npm test                 # All tests
npm run test:watch       # Watch mode
npm run test:cov         # With coverage (70% threshold)
npm run test:integration # Integration tests only

# Run a single test file
npx jest tests/unit/secretsManager.test.js

# Run tests matching a pattern
npx jest --testNamePattern="threat detection"
```

### Database Access

```bash
# Access PostgreSQL directly (via Docker)
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db

# Run a SQL file
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db < sql/migrations/your_migration.sql

# Or via local psql (if Docker port 5432 is exposed)
psql -h localhost -U shadowcheck_user -d shadowcheck_db -f sql/migrations/your_migration.sql

# Via npm script
npm run db:migrate  # Runs sql/migrations/00_init_schema.sql
```

### Secrets Management

```bash
# Set a secret (JavaScript)
node scripts/set-secret.js db_password "your-password"

# List all secrets (Python)
python3 scripts/keyring/list-keyring-items.py

# Get a specific secret (Python)
python3 scripts/keyring/get-keyring-password.py db_password

# Generate secure password
node scripts/generate-password.js

# Rotate database password
node scripts/rotate-db-password.js
```

### ML Model Training

```bash
# Train model via API
curl -X POST http://localhost:3001/api/ml/train

# Check model status
curl http://localhost:3001/api/ml/status

# Advanced ML iteration (requires Python dependencies)
pip install -r scripts/ml/requirements.txt
python3 scripts/ml/ml-iterate.py  # Tests multiple algorithms with hyperparameter tuning
```

## Code Style

**Backend (Node.js):**

- **CommonJS modules** (not ES modules)
- **Pure JavaScript** - No TypeScript in backend
- **Async/await** preferred over callbacks
- **Parameterized SQL** - Never string interpolation
- **Structured logging** - Use logger with metadata

**Frontend (React):**

- **ES modules** (import/export)
- **TypeScript/JSX** - .tsx files for components
- **Functional components** with hooks
- **Tailwind CSS** for styling

**Both:**

- **ESLint + Prettier** - Run `npm run lint:fix` before committing

## Key Configuration

**Environment Variables** (`.env`):

- `DB_*` - Database connection
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - development | production
- `CORS_ORIGINS` - Allowed CORS origins
- `THREAT_THRESHOLD` - Threat detection threshold (default: 40)

**Required Secrets**:

- `db_password` - Database password
- `mapbox_token` - Mapbox GL JS token

**Optional Secrets**:

- `api_key` - API authentication
- `wigle_api_key` / `wigle_api_token` - WiGLE integration
- `locationiq_api_key` / `opencage_api_key` - Geocoding

## Important Constants

- `MIN_VALID_TIMESTAMP`: 946684800000 (Jan 1, 2000) - Filters invalid timestamps
- `THREAT_THRESHOLD`: 40 points (configurable)
- `MAX_PAGE_SIZE`: 5000 results
- `RATE_LIMIT`: 1000 requests/15min per IP

## Threat Detection Algorithm

Networks are scored based on:

1. **Seen at home AND away** (+40 pts) - Strongest indicator
2. **Distance range > 200m** (+25 pts) - Beyond WiFi range
3. **Multiple unique days** (+5 to +15 pts)
4. **High observation count** (+5 to +10 pts)
5. **Movement speed** (+10 to +20 pts, advanced mode only)

**Threshold**: Networks scoring ≥40 flagged as threats

**Endpoints**:

- `/api/threats/quick` - Fast paginated detection
- `/api/threats/detect` - Advanced with speed calculations

## Troubleshooting

**Database Connection Errors / Timeouts**:

- **CRITICAL**: Verify Docker PostgreSQL is running: `docker ps | grep shadowcheck_postgres`
- **CRITICAL**: If running API locally, STOP local PostgreSQL service: `sudo systemctl stop postgresql`
  - Node.js cannot connect if both local and Docker PostgreSQL run on port 5432
  - The local system PostgreSQL will intercept connections intended for Docker
- Test Docker connection: `docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db`
- Verify port mapping: `docker port shadowcheck_postgres` should show `5432/tcp -> 0.0.0.0:5432`
- Check secrets: `python3 scripts/keyring/list-keyring-items.py`
- **Recommended**: Run API in Docker to avoid conflicts: `docker-compose up -d --build api`

**Server Won't Start**:

- Check required secrets are set (db_password, mapbox_token)
- Verify Docker PostgreSQL is running: `docker ps | grep shadowcheck_postgres`
- Check logs: `docker-compose logs -f api`
- If running locally, ensure port 3001 is available and local PostgreSQL is STOPPED

**Empty Threat Results / Dashboard Shows Zeros**:

- Verify data exists: `docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c "SELECT COUNT(*) FROM app.networks;"`
- Check ml_threat_score values: `docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db -c "SELECT COUNT(*) FILTER (WHERE ml_threat_score > 0) FROM app.networks;"`
- Run ML threat assessment if scores are zero
- Verify home location set in `location_markers` table
- Networks need ≥2 observations to appear

## Documentation

- **[docs/README.md](docs/README.md)** or **[docs/INDEX.md](docs/INDEX.md)** - Documentation index
- **[docs/architecture/](docs/architecture/)** - System architecture guides
- **[docs/security/](docs/security/)** - Security policies & secrets management
- **[docs/DATABASE\_\*.md](docs/)** - Database schema documentation
- **[docs/API.md](docs/API.md)** & **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)** - API documentation
- **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Development guide
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Deployment instructions

## Frontend Structure

The project is migrating from legacy HTML/JS (in `public/`) to a modern React + Vite frontend:

**React Pages** (`src/` components):

- `/` or `/dashboard` - Main dashboard (React)
- `/geospatial` or `/geospatial-intel` - Geospatial analysis (React)
- `/analytics` - Analytics charts (React)
- `/api-test` - API testing interface (React)
- `/ml-training` - ML model training UI (React)

**Legacy Pages** (served until feature parity):

- `public/geospatial.html` - Legacy geospatial view
- `public/networks.html` - Legacy network list
- `public/analytics.html` - Legacy analytics
- `public/surveillance.html` - Legacy threat detection

**Frontend Tech Stack**:

- React 18 with TypeScript (.tsx files)
- Vite for build and dev server
- Tailwind CSS for styling
- Mapbox GL JS for maps
- Recharts for charts
- React Router for routing

## Utility Scripts

**Import & Data Processing**:

- `scripts/import/turbo-import.js` - Fast parallel data import
- `scripts/import/import-wigle-parallel.js` - WiGLE data import

**Geocoding & Enrichment**:

- `scripts/geocoding/geocode-batch.js` - Batch geocoding
- `scripts/enrichment/enrich-addresses-fast.js` - Address enrichment
- `scripts/enrichment/enrich-multi-source.js` - Multi-source enrichment (4 APIs)

**ML & Analytics**:

- `scripts/ml/ml-trainer.js` - Train ML models (JavaScript)
- `scripts/ml/ml-iterate.py` - Advanced ML iteration (Python)

**Database & Maintenance**:

- `scripts/set-home.js` - Set home location for threat detection
- `scripts/rebuild-networks-precision.js` - Rebuild network precision data

## Project Structure

```
/
├── src/                     # Source code
│   ├── api/routes/v1/      # Backend API endpoints (CommonJS)
│   ├── services/           # Backend business logic (CommonJS)
│   ├── repositories/       # Backend data access (CommonJS)
│   ├── config/             # Backend configuration (DI container, DB pool)
│   ├── validation/         # Request validation schemas
│   ├── errors/             # Custom error classes
│   ├── logging/            # Winston structured logging
│   ├── utils/              # Utility functions (SQL escaping, secrets)
│   ├── components/         # React components (TSX, ES modules)
│   ├── App.tsx             # React app router
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles (Tailwind)
├── public/                  # Static assets & legacy HTML pages
├── scripts/                 # Utility scripts (import, geocoding, ML)
├── sql/                     # Database migrations & functions
├── tests/                   # Jest tests (unit, integration, API)
├── docs/                    # Documentation
├── server.js                # Express backend entry point
├── vite.config.js           # Vite configuration
├── docker-compose.yml       # Docker services (API + Redis)
└── tsconfig.json            # TypeScript configuration
```

## Root Directory Organization

**Best Practices for Keeping Root Clean**:

The root directory should only contain essential configuration files. All code, data, and generated files belong in subdirectories.

**Files That Belong in Root**:

- ✅ Configuration: `package.json`, `.env.example`, `tsconfig.json`, `vite.config.js`, `jest.config.js`
- ✅ Docker: `docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfile`
- ✅ Documentation: `README.md`, `CLAUDE.md`, `CHANGELOG.md`, `LICENSE`, `CONTRIBUTING.md`
- ✅ Entry points: `server.js`, `index.html`
- ✅ Dotfiles: `.gitignore`, `.eslintrc.json`, `.prettierrc.json`, `.nvmrc`

**Files That Should NOT Be in Root**:

- ❌ Data files: `*.csv`, `*.sqlite`, `*.db` → Move to `backups/` or `data/`
- ❌ SQL scripts: `*.sql`, `*.psql` → Move to `sql/` or `sql/temp/`
- ❌ Test files: `test-*.js`, `*_test.sh` → Move to `tests/`
- ❌ Logs: `*.log` → Auto-cleaned by `.gitignore`, stored in `logs/`
- ❌ Analysis reports: `*_analysis.md`, `*_report.md` → Move to `docs/archive/`
- ❌ Debug files: `*.tar.gz`, `*.dump` → Move to `backups/` or delete

**Directory Structure**:

```
/
├── backups/             # Database dumps, CSV exports (gitignored)
│   ├── csv/            # CSV data backups
│   ├── sqlite/         # SQLite database backups
│   └── analysis-reports/ # Analysis and debug reports
├── data/               # Runtime data (gitignored, needs permissions fix)
├── docker/
│   └── infrastructure/ # Shared infrastructure compose files
├── sql/
│   ├── functions/      # SQL functions
│   ├── migrations/     # Schema migrations
│   └── temp/           # Temporary SQL scripts
├── src/                # Application source code
├── tests/              # Test files
├── docs/               # Documentation
├── scripts/            # Utility scripts
└── public/             # Static assets
```

**Maintenance Commands**:

```bash
# Check for files that shouldn't be in root
ls -la | grep -E '\.(csv|sqlite|log|sql)$'

# Clean up common clutter
rm -f *.log *.csv *.sqlite test-*.js

# Check what's being tracked by git in root
git ls-files --directory ./ --exclude-standard | grep -v '/'
```

---

**Last Updated**: 2025-12-19
**See**: [CHANGELOG.md](CHANGELOG.md) for version history
