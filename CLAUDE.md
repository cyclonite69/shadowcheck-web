# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShadowCheck is a wireless network threat detection platform that analyzes WiFi, Bluetooth, and cellular observations to detect potential surveillance devices. The system uses **Dockerized PostgreSQL 18 + PostGIS 3.6** for geospatial analysis and features a modular Node.js/Express backend with React + Vite frontend.

**Tech Stack**: Node.js 18+, Express, **Dockerized PostgreSQL 18 + PostGIS 3.6**, React 18, Vite, Mapbox GL JS, Recharts

**IMPORTANT**: PostgreSQL runs in Docker container `shadowcheck_postgres` on the `shadowcheck_net` network. **DO NOT use local system PostgreSQL** - always connect via Docker network or through the exposed port 5432.

## Quick Start

```bash
# Development
npm run dev              # Start backend API with auto-reload (port 3001)
npm run dev:frontend     # Start Vite dev server (port 5173)
npm test                 # Run tests
npm run lint:fix         # Fix linting issues

# Build
npm run build            # Build React frontend for production

# Database (REQUIRED - runs in Docker)
docker-compose up -d     # Starts PostgreSQL 18 + PostGIS container
docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db  # Access DB

# Development (Recommended: Run API in Docker)
docker-compose up -d --build api   # Build and run API in Docker container
npm run build                       # Build React frontend
# Access at http://localhost:3001

# Alternative: Local development (requires Docker PostgreSQL running)
npm run dev              # Start backend API with auto-reload (port 3001)
npm run dev:frontend     # Start Vite dev server (port 5173)

# Testing & Linting
npm test                 # Run tests
npm run lint:fix         # Fix linting issues

# Production
npm run build            # Build React frontend for production
docker-compose up -d     # Start all services in Docker
```

**IMPORTANT**:

- PostgreSQL MUST run in Docker (`shadowcheck_postgres` container)
- If running API locally (not in Docker), ensure local PostgreSQL service is STOPPED
- Backend API: port 3001, Frontend dev server: port 5173

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

See [docs/reference/DATABASE_SCHEMA.md](docs/reference/DATABASE_SCHEMA.md) for full schema.

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
npm run test:cov         # With coverage
npm run test:integration # Integration only
```

### Database Migrations

```bash
# Apply migration
psql -U shadowcheck_user -d shadowcheck -f sql/migrations/your_migration.sql

# Or via npm
npm run db:migrate
```

### Checking Secrets

```bash
# Set a secret (JavaScript)
node scripts/set-secret.js db_password "your-password"

# List secrets (Python)
python3 scripts/keyring/list-keyring-items.py

# Get a secret (Python)
python3 scripts/keyring/get-keyring-password.py db_password
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

- **[docs/README.md](docs/README.md)** - Documentation index
- **[docs/architecture/](docs/architecture/)** - System architecture
- **[docs/development/](docs/development/)** - Development guides
- **[docs/reference/](docs/reference/)** - API & database reference
- **[docs/security/](docs/security/)** - Security policies & guides

## Project Structure

```
/
├── src/                     # Source code
│   ├── api/routes/v1/      # Backend API endpoints
│   ├── services/           # Backend business logic
│   ├── repositories/       # Backend data access
│   ├── config/             # Backend configuration
│   ├── components/         # React components (Dashboard, Maps, etc.)
│   ├── App.tsx             # React app router
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles
├── public/                  # Static assets
├── scripts/                 # Utility scripts
├── sql/                     # Database migrations
├── tests/                   # Jest tests
├── docs/                    # Documentation
├── server.js                # Express backend entry point
├── vite.config.js           # Vite configuration
└── tsconfig.json            # TypeScript configuration
```

---

**Last Updated**: 2025-12-10
**See**: [docs/CHANGELOG.md](CHANGELOG.md) for version history
