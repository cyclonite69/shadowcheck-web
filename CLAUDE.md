# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShadowCheck is a SIGINT forensics platform for wireless network threat detection. It analyzes WiFi, Bluetooth, and cellular observations to detect potential surveillance devices using **Dockerized PostgreSQL 18 + PostGIS 3.6** for geospatial analysis.

**Tech Stack**: Node.js 20+, Express, PostgreSQL 18 + PostGIS, React 18, Vite, Tailwind CSS v4, Mapbox GL JS, Recharts

**CRITICAL**: PostgreSQL runs in Docker container `shadowcheck_postgres` on the `shadowcheck_net` network. **DO NOT use local system PostgreSQL** - if running API locally, STOP local PostgreSQL: `sudo systemctl stop postgresql`

## Commands

```bash
# Verify Docker PostgreSQL is running (REQUIRED)
docker ps | grep shadowcheck_postgres

# Development
docker-compose up -d --build api   # Run API in Docker (recommended)
npm run build                       # Build React frontend + TypeScript server
npm run dev                         # Local backend with auto-reload (port 3001)
npm run dev:frontend                # Vite dev server (port 5173)

# Testing
npm test                            # All tests (uses tests/setup.ts)
npm run test:watch                  # Watch mode
npm run test:cov                    # With coverage (70% threshold)
npm run test:integration            # Integration tests (RUN_INTEGRATION_TESTS=true)
npx jest tests/unit/file.test.js   # Single test file
npx jest --testNamePattern="pattern" # Tests matching pattern

# Linting (run before commits)
npm run lint                        # Check issues
npm run lint:fix                    # Auto-fix issues
npm run lint:boundaries             # Check client/server import boundaries
# Note: Avoid `npm run format` unless explicitly needed - it reformats unrelated files

# Database access
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db
docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db  # Admin access
```

## Architecture

**Monorepo Structure** - Backend in `server/`, Frontend in `client/`:

```
server/
├── server.ts              # Express entry point (orchestration)
└── src/
    ├── api/routes/v1/     # HTTP endpoints (20+ route modules)
    ├── api/routes/v2/     # Newer endpoints (filtered networks/threats)
    ├── services/          # Business logic
    ├── repositories/      # Data access layer
    ├── config/            # Database pool, DI container
    ├── middleware/        # Auth, rate limiting, error handling
    ├── errors/            # AppError class
    ├── logging/           # Structured logging
    ├── validation/        # Request schemas
    ├── websocket/         # WebSocket handlers
    └── utils/             # SQL escaping, secrets

client/
├── src/
│   ├── App.tsx            # React router
│   ├── components/        # Page components (.tsx)
│   ├── constants/         # MAP_STYLES, NETWORK_TYPE_CONFIG, column defs
│   ├── hooks/             # Custom hooks (useNetworkData, useObservations)
│   ├── stores/            # Zustand state (filterStore)
│   ├── types/             # TypeScript types
│   ├── utils/             # Helper functions (mapHelpers, renderNetworkTooltip)
│   └── index.css          # Tailwind + custom CSS
├── vite.config.ts
└── tailwind.config.js
```

**Design Patterns**:

- **Backend**: CommonJS, Dependency Injection (`server/src/config/container.ts`), Repository pattern. Note: only a small number of services are registered in the container; most are imported directly in route handlers.
- **Frontend**: ES modules, TypeScript, Functional components, Zustand for state
- **Universal Filter System**: `filterStore.ts` + `useAdaptedFilters` hook powers filtering across all pages (Dashboard, Geospatial, Kepler, WiGLE). Filters are URL-synced and page-scoped via `getPageCapabilities()`.

**Map Pages Architecture**:

- `GeospatialExplorer` - Mapbox GL JS with custom observation layers, network context menus
- `KeplerPage` - deck.gl ScatterplotLayer/HeatmapLayer/HexagonLayer for large datasets
- `WiglePage` - Mapbox GL JS with WiGLE API integration (v2 search, v3 detail)
- All use `renderNetworkTooltip.ts` for consistent tooltip rendering

## Database Schema

PostgreSQL 18 with PostGIS. Network types: `W` (WiFi), `E` (BLE), `B` (Bluetooth), `L` (LTE), `N` (5G NR), `G` (GSM)

**Key Tables**:

- `app.networks` - Network metadata (bssid, ssid, type, frequency, bestlevel, bestlat/bestlon, lasttime_ms)
- `app.observations` - Observation records with location data
- `app.network_entries` - View mapping networks columns to API-expected names
- `app.location_markers` - Home/work locations for threat analysis
- `app.network_tags` - Manual network classifications (threat, false_positive, known_safe)

**Database Users** (security separation):

- `shadowcheck_user` - Read-only access for queries (used by default `query()`)
- `shadowcheck_admin` - Write access for imports, tagging, backups (use `adminDbService`)

```javascript
// Read operations (default)
const { query } = require('../config/database');
const result = await query('SELECT * FROM app.networks WHERE bssid = $1', [bssid.toUpperCase()]);

// Write operations (admin only)
const adminDb = require('../services/adminDbService');
await adminDb.query('INSERT INTO app.network_tags ...', params);
```

## Code Patterns

**Backend Error Handling**:

```javascript
const AppError = require('../errors/AppError');
if (!network) throw new AppError('Network not found', 404);
```

**Secrets Management** (priority: AWS Secrets Manager → Local files → Environment variables):

```javascript
const secretsManager = require('../services/secretsManager');
const apiKey = secretsManager.get('api_key'); // Optional (returns null if missing)
const dbPassword = secretsManager.getOrThrow('db_password'); // Required (throws if missing)
```

## Kepler.gl Data Rules (Do Not Violate)

- **No artificial limits** on Kepler endpoints unless explicitly requested via query params.
- Default behavior is **no limit**; let the DB and Kepler.gl handle large datasets.
- Applies to: `/api/kepler/data`, `/api/kepler/observations`, `/api/kepler/networks`.
- Use timeouts (e.g., 120s) for large queries and prefer filtering over caps.

## Tailwind CSS (v4)

**CRITICAL**: Uses `@tailwindcss/postcss` plugin (NOT `tailwindcss`). Dark-only theme (slate-950 primary).

- Use Tailwind utilities instead of inline `style={{}}` for colors, spacing, shadows
- Extract complex gradients to `client/src/index.css` under `@layer components`
- Use semantic z-index tokens: `z-modal` (1000), `z-dropdown` (100)
- Reference `client/tailwind.config.js` for color palette and safelist
- See `.cursor/rules/tailwind-css-refactoring.md` for detailed refactoring guidelines

```tsx
// Good: Tailwind utilities
<div className="bg-slate-900/95 border border-slate-700/20 shadow-lg rounded-lg p-4">

// Bad: Inline styles for colors
<div style={{ backgroundColor: '#0f172a', border: '1px solid rgba(71, 85, 105, 0.6)' }}>
```

**Color Mapping**: `#0f172a` → `bg-slate-950`, `#1e293b` → `bg-slate-800`, `rgba(X, 0.9)` → `/90` opacity

## Threat Detection

Networks scored on: seen at home AND away (+40 pts), distance range >200m (+25 pts), multiple days (+5-15 pts), observation count (+5-10 pts). Threshold: ≥40 points.

- `/api/threats/quick` - Fast paginated detection
- `/api/threats/detect` - Advanced with speed calculations

## Key Configuration

**Required Secrets**: `db_password`, `db_admin_password`, `mapbox_token`
**Optional**: `wigle_api_key`, `wigle_api_name`, `wigle_api_token`, `locationiq_api_key`, `opencage_api_key`, `google_maps_api_key`

**Constants**: `THREAT_THRESHOLD`: 40, `MAX_PAGE_SIZE`: 5000, `RATE_LIMIT`: 1000 req/15min

## Adding a New API Endpoint

1. Create route handler in `server/src/api/routes/v1/`
2. Add business logic to service in `server/src/services/`
3. Add data access to repository in `server/src/repositories/`
4. Register services in `server/src/config/container.ts` (if needed)
5. Import and mount route in `server/server.js`

**Existing route modules (v1)**: `admin`, `admin-threat-scoring`, `analytics`, `analytics-public`, `agencyOffices`, `auth`, `backup`, `dashboard`, `explorer`, `export`, `geospatial`, `health`, `home-location`, `kepler`, `location-markers`, `misc`, `ml`, `networks`, `network-agencies`, `network-tags`, `settings`, `threats`, `weather`, `wigle`

## ETL Pipeline

Data ingestion via `etl/` directory with modular stages:

```bash
node etl/run-pipeline.js              # Run full ETL pipeline

# Individual stages
node etl/load/json-import.js          # Import WiGLE JSON
node etl/load/sqlite-import.js        # Import from Kismet SQLite
node etl/transform/deduplicate.js     # Deduplicate observations
node etl/transform/normalize-observations.js  # Normalize data
node etl/promote/refresh-mviews.js    # Refresh materialized views
node etl/promote/run-scoring.js       # Run threat scoring
```

Staging tables are UNLOGGED for ingestion speed.

## ML Model Training

```bash
curl -X POST http://localhost:3001/api/ml/train   # Train model
curl http://localhost:3001/api/ml/status          # Check status

# Advanced iteration with multiple algorithms
pip install -r scripts/ml/requirements.txt
python3 scripts/ml/ml-iterate.py
```

## Secrets Management

Secrets are stored in AWS Secrets Manager (`shadowcheck/config`). The app reads them at startup via `secretsManager.load()`. Secrets can also be set via the Config UI or admin API, which writes through to AWS SM.

Resolution order: AWS Secrets Manager → local files (`./secrets/`) → environment variables.

## Troubleshooting

**Database Connection Errors**:

- Verify Docker PostgreSQL: `docker ps | grep shadowcheck_postgres`
- If local API, STOP local PostgreSQL: `sudo systemctl stop postgresql`
- Test connection: `docker exec shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db`

**Dashboard Shows Zeros**:

- Check data exists: `SELECT COUNT(*) FROM app.networks;`
- Verify home location set in `app.location_markers`
- Check if filters are active (displayed in UI)

**Admin Operations Failing (500 errors on tags/imports)**:

- Ensure `db_admin_password` secret is in keyring: `npx tsx scripts/set-secret.ts db_admin_password`
- Verify migration applied: `sql/migrations/20260129_implement_db_security.sql`

## Key Frontend Utilities

- `client/src/utils/geospatial/renderNetworkTooltip.ts` - Unified tooltip for all map pages
- `client/src/utils/mapHelpers.ts` - Signal range calculations, coordinate formatting
- `client/src/hooks/useNetworkData.ts` - Network list fetching with `formatSecurity()` helper
- `client/src/stores/filterStore.ts` - Zustand store for universal filters
- `client/src/constants/network.ts` - `MAP_STYLES`, `NETWORK_TYPE_CONFIG`, column definitions
