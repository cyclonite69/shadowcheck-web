# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShadowCheck is a SIGINT forensics platform for wireless network threat detection. It analyzes WiFi, Bluetooth, and cellular observations to identify potential surveillance devices using PostgreSQL 18 + PostGIS 3.6 for geospatial analysis.

**Extended guidance**: `docs/ai/CLAUDE.md` and `.github/copilot-instructions.md` contain deeper architectural details, patterns, and examples.

## Commands

```bash
# Development
npm run dev                          # Local backend with auto-reload (port 3001)
npm run dev:frontend                 # Vite dev server (port 5173, hot reload)
npm run build                        # Full build: frontend + server TypeScript → dist/

# Testing
npm test                             # All tests
npm run test:cov                     # With coverage (70% threshold enforced)
npm run test:integration             # Integration tests (requires Docker DB)
npx jest tests/unit/file.test.ts    # Single test file
npx jest -t "test name pattern"     # Tests matching pattern

# Linting (run before all commits)
npm run lint                         # Check ESLint issues
npm run lint:fix                     # Auto-fix issues
npm run lint:boundaries              # Verify no client→server imports

# Database (Docker only)
docker ps | grep shadowcheck_postgres                                          # Verify DB is running
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db    # Read access
docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db   # Write access

# ETL pipeline
node etl/run-pipeline.js             # Full import pipeline
```

## Architecture

**Monorepo**: `server/` (Node.js/Express, CommonJS) + `client/` (React 19/Vite, ES modules).

**CRITICAL**: Backend uses CommonJS (`require`/`module.exports`). Frontend uses ES modules (`import`/`export`). Never mix them.

**CRITICAL**: PostgreSQL runs in Docker container `shadowcheck_postgres` only. Never use local system PostgreSQL (`sudo systemctl stop postgresql` if running locally).

### Backend three-tier pattern

```
Routes (server/src/api/routes/)       → validate input, extract params
  └── Services (server/src/services/) → business logic, threat scoring
        └── Repositories (server/src/repositories/) → SQL execution
```

SQL never appears in route handlers. Services are tested without HTTP context. Repositories can be mocked in tests.

### Key backend files

- `server/server.ts` — Express entry point; all routes mounted here
- `server/src/config/container.ts` — DI registration (most services imported directly in routes, not via container)
- `server/src/config/database.js` — `query()` function (read-only `shadowcheck_user`)
- `server/src/services/adminDbService.js` — Write operations (`shadowcheck_admin`)
- `server/src/errors/AppError.js` — Consistent error responses

### Key frontend files

- `client/src/App.tsx` — React Router setup
- `client/src/stores/filterStore.ts` — Zustand universal filter state (URL-synced, page-scoped)
- `client/src/hooks/useAdaptedFilters.ts` — Filter hook; use this instead of creating new filter state
- `client/src/constants/network.ts` — `MAP_STYLES`, `NETWORK_TYPE_CONFIG`, column definitions
- `client/src/utils/geospatial/renderNetworkTooltip.ts` — Shared map tooltip (used by all three map pages)

### Universal filter system

`filterStore.ts` + `useAdaptedFilters()` powers filtering across Dashboard, Geospatial, Kepler, and WiGLE pages. Filters are URL-synced and page-scoped via `getPageCapabilities()`. The backend converts filters to SQL via `server/src/services/filterQueryBuilder/`.

### Map pages

- **GeospatialExplorer** — Mapbox GL JS, custom observation layers, network context menus
- **KeplerPage** — deck.gl ScatterplotLayer/HeatmapLayer for 100K+ point datasets; **no default pagination limits**
- **WiglePage** — Mapbox GL JS with WiGLE API v2 search / v3 detail integration

## Database

Network types: `W` (WiFi), `E` (BLE), `B` (Bluetooth), `L` (LTE), `N` (5G NR), `G` (GSM)

Key tables: `app.networks`, `app.observations`, `app.location_markers`, `app.network_tags`

**Database user separation** (enforced at DB role level):

```javascript
// Read (default)
const { query } = require('../config/database');
await query('SELECT * FROM app.networks WHERE bssid = $1', [bssid]);

// Write (admin only)
const adminDb = require('../services/adminDbService');
await adminDb.query('INSERT INTO app.network_tags ...', params);
```

## Critical Rules

**Secrets**: NEVER write secrets to disk. AWS Secrets Manager is the source of truth. For local dev, inject as environment variables at runtime only (`export DB_PASSWORD=...`). Never create `.env` files.

**EC2 access**: Instances have no public ingress ports. Access ONLY via AWS SSM Session Manager (`aws ssm start-session --target i-...`). Never open port 22 or create 0.0.0.0/0 inbound rules.

**Kepler endpoints**: No default pagination limits on `/api/kepler/data`, `/api/kepler/observations`, `/api/kepler/networks`. Use timeouts (120s) instead of caps.

**Tailwind CSS**: Uses `@tailwindcss/postcss` plugin (NOT `tailwindcss`). Dark-only theme (slate-950 primary). Use Tailwind utilities instead of inline `style={{}}` for colors and spacing.

**Import boundaries**: Frontend never imports from `server/`. Use API calls instead. Verify with `npm run lint:boundaries`.

## Threat Detection

Networks scored on: seen at home AND away (+40 pts), distance range >200m (+25 pts), multiple days (+5–15 pts), observation count (+5–10 pts). Threshold: ≥40 points = threat.

## Naming & Conventions

- Utility files: `camelCase`; React components: `PascalCase`; SQL migrations: `YYYYMMDD_description.sql`
- Conventional commits: `feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`
- Run `npm run lint:fix` before every commit

## Ten Commandments

1. Secrets shall never be written to disk.
2. AWS Secrets Manager shall remain the source of truth for secrets.
3. Core tables shall remain canonical.
4. Enrichment data shall live in separate source-owned tables.
5. Cross-source merging shall happen in views or materialized views, not core tables.
6. Source precision shall be preserved end-to-end.
7. Rounding, truncation, and shortening shall remain presentation concerns only.
8. Refactors shall not leave cruft, duplicate paths, or half-migrated code behind.
9. Behavior changes require regression tests; new features require test coverage.
10. Bootstrap, restore, import, and upgrade are separate contracts and must be validated separately.
