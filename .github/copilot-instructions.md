# Copilot Instructions for ShadowCheck Static

This document provides actionable guidance for AI coding agents (Claude, Copilot, etc.) when working with the ShadowCheck-Static codebase.

## Quick Reference

**Tech Stack**: Node.js 20+, Express.js, PostgreSQL 18 + PostGIS, React 18, Vite, Tailwind CSS v4, TypeScript

**Critical Constraint**: PostgreSQL runs in Docker. Never use local system PostgreSQL. If running API locally, stop it: `sudo systemctl stop postgresql`

## Project Architecture

### Monorepo Structure

```
├── server/                       # Node.js/Express backend (CommonJS)
│   ├── server.js                 # Entry point, orchestration
│   └── src/
│       ├── api/routes/v1/        # HTTP endpoints (20+ route modules)
│       ├── api/routes/v2/        # Newer endpoints (filtered data)
│       ├── services/             # Business logic layer
│       ├── repositories/         # Data access layer (base + network)
│       ├── config/               # Container.js (DI), database pool
│       ├── middleware/           # Auth, rate-limit, error handlers
│       ├── validation/           # Request schema validation
│       ├── errors/               # AppError class
│       ├── logging/              # Structured logging
│       ├── websocket/            # WebSocket handlers
│       └── utils/                # SQL escaping, secrets, database init
├── client/                       # React/TypeScript frontend (ES modules)
│   ├── src/
│   │   ├── App.tsx               # React Router setup
│   │   ├── components/           # Page & UI components (.tsx)
│   │   ├── hooks/                # Custom hooks
│   │   ├── stores/               # Zustand state management
│   │   ├── types/                # TypeScript interfaces
│   │   ├── constants/            # Magic constants
│   │   └── utils/                # Helper functions
│   └── vite.config.ts            # Vite build config
├── docs/                         # Comprehensive documentation
├── etl/                          # Data pipeline for ingestion
├── sql/                          # Database migrations & schemas
├── tests/                        # Jest test suites
│   ├── unit/                     # Isolated function tests
│   ├── integration/              # API endpoint tests
│   └── setup.ts                  # Jest configuration & globals
└── CLAUDE.md                     # General development guidance
```

## Key Patterns & Conventions

### Backend (Server)

**Module System**: CommonJS (`require`, `module.exports`)

**Dependency Injection**: All services registered in `server/src/config/container.js`. Inject via constructor:

```javascript
// In route handler
const { networkService } = require('../../services');
const result = await networkService.getNetworks();
```

**Database Access**:

- **Read queries**: Use default `query()` function (connects as `shadowcheck_user` - read-only)

  ```javascript
  const { query } = require('../../config/database');
  const result = await query('SELECT * FROM public.networks WHERE bssid = $1', [bssid]);
  ```

- **Write operations**: Use `adminDbService` (connects as `shadowcheck_admin`)
  ```javascript
  const adminDb = require('../../services/adminDbService');
  await adminDb.query('INSERT INTO app.network_tags ...', params);
  ```

**Error Handling**: Use `AppError` class

```javascript
const AppError = require('../../errors/AppError');
if (!network) throw new AppError('Network not found', 404);
```

**Secrets Management**: Priority order: Encrypted keyring → Local files → Environment variables

```javascript
const secretsManager = require('../../services/secretsManager');
const apiKey = secretsManager.get('api_key'); // Optional (returns null)
const dbPassword = secretsManager.getOrThrow('db_password'); // Required (throws)
```

**Route Registration**: Mount routes in `server/server.js` main file

```javascript
app.use('/api/networks', require('./src/api/routes/v1/networks'));
```

### Frontend (Client)

**Module System**: ES modules (`import`, `export`)

**Components**: Functional TSX components with hooks

```typescript
// client/src/components/MyComponent.tsx
import React from 'react';

export const MyComponent: React.FC<Props> = ({ data }) => {
  return <div className="p-4">Hello</div>;
};
```

**State Management**: Zustand store in `client/src/stores/`

```typescript
// client/src/stores/filterStore.ts
import { create } from 'zustand';

export const useFilterStore = create((set) => ({
  filters: [],
  setFilters: (filters) => set({ filters }),
}));
```

**Custom Hooks**: Keep in `client/src/hooks/`

- `useNetworkData()` - Fetch network lists with caching
- `useObservations()` - Fetch observation records
- `useAdaptedFilters()` - Universal filter system with URL sync

**Styling**: Tailwind CSS v4 (using `@tailwindcss/postcss` plugin, NOT `tailwindcss`)

- Use semantic tokens: `z-modal` (1000), `z-dropdown` (100)
- Color palette: `slate-950` (primary dark), `slate-900`, `slate-800`, `slate-700`
- Reference `client/tailwind.config.js` for all colors and safelist
- Extract complex gradients to `client/src/index.css` under `@layer components`
- Bad: `<div style={{ backgroundColor: '#0f172a' }}>` → Good: `<div className="bg-slate-950">`

**Type Definitions**: Store in `client/src/types/`

```typescript
// client/src/types/network.ts
export interface Network {
  bssid: string;
  ssid: string;
  type: 'W' | 'E' | 'B' | 'L' | 'N' | 'G';
  frequency: number;
  bestlevel: number;
  bestlat: number;
  bestlon: number;
}
```

## Universal Filter System

The filter system powers filtering across all pages (Dashboard, Geospatial, Kepler, WiGLE).

**Implementation Details**:

- State: `client/src/stores/filterStore.ts` (Zustand)
- Hook: `client/src/hooks/useAdaptedFilters()` - Manages URL sync and page-scoped capabilities
- Query Building: `server/src/services/filterQueryBuilder/` - Converts UI filters to SQL `WHERE` clauses
- 20+ filter types: BSSID, SSID, Signal Strength, Frequency, Threat Score, etc.

**Adding a New Filter**:

1. Add filter type constant to `client/src/constants/filters.ts`
2. Update filter schema in `server/src/validation/schemas/complexValidators.ts`
3. Add query builder logic in `server/src/services/filterQueryBuilder/`
4. Use `useAdaptedFilters()` hook in component - it handles everything else

## Database Schema

**PostgreSQL 18 with PostGIS 3.6**

**Network Types**: `W` (WiFi), `E` (BLE), `B` (Bluetooth), `L` (LTE), `N` (5G NR), `G` (GSM)

**Key Tables**:

- `public.networks` - Network metadata (bssid, ssid, type, frequency, bestlevel, bestlat/bestlon, lasttime_ms)
- `public.observations` - Observation records with location data (linked to networks)
- `app.location_markers` - Home/work locations for threat analysis
- `app.network_tags` - Manual network classifications (threat, false_positive, known_safe)
- `app.materialized_views` - Aggregated data for performance

**Security Model**:

- `shadowcheck_user` - Read-only access (default for queries)
- `shadowcheck_admin` - Write access for imports, tagging, backups
- Separation enforced at database role level, NOT application layer

**Connection**: Via Docker container `shadowcheck_postgres` on network `shadowcheck_net`

## Common Development Tasks

### Adding a New API Endpoint

1. **Create route handler** in `server/src/api/routes/v1/myroute.ts`

   ```typescript
   const router = require('express').Router();
   router.get('/:id', async (req, res) => {
     // Handler logic
   });
   module.exports = router;
   ```

2. **Add business logic** in `server/src/services/myService.ts`

   ```javascript
   const getMyData = async (id) => {
     const { query } = require('../config/database');
     return await query('SELECT * FROM ... WHERE id = $1', [id]);
   };
   module.exports = { getMyData };
   ```

3. **Add data access** in `server/src/repositories/` (optional, for complex queries)

4. **Add validation schema** in `server/src/validation/schemas/`

   ```javascript
   const mySchema = yup.object().shape({
     id: yup.number().required(),
   });
   ```

5. **Register and mount** in `server/server.js`
   ```javascript
   app.use('/api/myroute', require('./src/api/routes/v1/myroute'));
   ```

### Running Commands

**Development**:

```bash
docker-compose up -d --build api    # Run API in Docker (recommended)
npm run build                        # Build frontend + server TypeScript
npm run dev                          # Local backend with auto-reload (port 3001)
npm run dev:frontend                 # Vite dev server (port 5173)
```

**Testing**:

```bash
npm test                             # All tests
npm run test:watch                   # Watch mode
npm run test:cov                     # With coverage (70% threshold)
npx jest tests/unit/file.test.js    # Single test file
```

**Linting**:

```bash
npm run lint                         # Check issues
npm run lint:fix                     # Auto-fix issues
npm run lint:boundaries              # Check client/server import boundaries
```

**Database**:

```bash
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db
```

### Testing Patterns

**Unit Test Structure** (`tests/unit/`):

```typescript
// tests/unit/myfunction.test.ts
describe('myFunction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return expected value', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });

  it('should throw on invalid input', () => {
    expect(() => myFunction(invalid)).toThrow();
  });
});
```

**Integration Test Structure** (`tests/integration/`):

```typescript
// Mock database and services
const mockQuery = jest.fn();
jest.mock('../../server/src/config/database', () => ({
  query: mockQuery,
}));

// Test endpoint
it('GET /api/endpoint should return 200', async () => {
  mockQuery.mockResolvedValue([{ id: 1, name: 'Test' }]);
  const response = await request(app).get('/api/endpoint');
  expect(response.status).toBe(200);
});
```

**Jest Configuration**: `jest.config.js`

- Test environment: Node.js
- Test match: `tests/**/*.test.{js,ts}`, `**/*.spec.{js,ts}`
- Coverage threshold: 70% (branches, functions, lines, statements)
- Setup: `tests/setup.ts` - Mocks and environment variables

**Coverage Command**: `npm run test:cov` (70% threshold enforced)

## Critical Rules

### Kepler.gl Endpoints

- **No default pagination limits** on Kepler endpoints unless explicitly requested
- Let database and Kepler.gl handle large datasets
- Applies to: `/api/kepler/data`, `/api/kepler/observations`, `/api/kepler/networks`
- Use timeouts (120s) for large queries, prefer filtering over caps

### Threat Detection Scoring

Networks scored on:

- Seen at home AND away: +40 pts (primary indicator)
- Distance range > 200m: +25 pts
- Multiple days: +5-15 pts
- High observation count: +5-10 pts
- **Threshold**: ≥40 points = threat

Endpoints:

- `/api/threats/quick` - Fast paginated detection
- `/api/threats/detect` - Advanced with speed calculations

### Import Boundaries

**DO NOT violate**: Frontend cannot import from backend

- Bad: `import { networkService } from '../../server/src/services'`
- Good: Frontend imports only from `client/src/`, makes API calls instead
- Verify with: `npm run lint:boundaries`

### Environment Variables

**Required** (validation throws if missing):

- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`
- `MAPBOX_TOKEN`

**Optional**:

- `WIGLE_API_KEY`, `WIGLE_API_NAME`, `WIGLE_API_TOKEN`
- `LOCATIONIQ_API_KEY`, `OPENCAGE_API_KEY`, `GOOGLE_MAPS_API_KEY`
- `NODE_ENV` (default: development)
- `PORT` (default: 3001)

### Tailwind CSS Rules

- CRITICAL: Uses `@tailwindcss/postcss` (NOT `tailwindcss`)
- Dark-only theme (slate-950 primary)
- Do NOT use inline `style={{}}` for colors/spacing
- Reference `client/tailwind.config.js` for color palette

### Code Style

- Backend: **CommonJS** (no ES modules in server/)
- Frontend: **ES modules** (no CommonJS in client/)
- TypeScript: Strict mode enabled
- Linting: ESLint + Prettier (run before commits)

## File Organization

**When Adding New Code**:

- Route handlers → `server/src/api/routes/v1/`
- Business logic → `server/src/services/`
- Data queries → `server/src/repositories/`
- React components → `client/src/components/`
- Custom hooks → `client/src/hooks/`
- State management → `client/src/stores/`
- Type definitions → `client/src/types/`
- Constants → `client/src/constants/`
- Utility functions → `client/src/utils/` or `server/src/utils/`

## Debugging

**Enable Debug Logging**:

```bash
DEBUG=shadowcheck:* npm run dev
```

**Node Inspector**:

```bash
node --inspect server/server.js
# Then visit: chrome://inspect
```

**Database Queries**:

```bash
docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db
# Check logs: \dt (list tables), \d table_name (describe)
```

**Frontend Issues**:

- Check browser console (F12)
- Vite HMR logs (port 5173)
- React DevTools extension
- Network tab for API calls

## Mapping Pages Architecture

**GeospatialExplorer** (`client/src/components/GeospatialExplorer.tsx`)

- Mapbox GL JS with custom observation layers
- Network context menus
- Real-time data filtering

**KeplerPage** (`client/src/components/KeplerPage.tsx`)

- deck.gl ScatterplotLayer/HeatmapLayer/HexagonLayer
- For large datasets (100K+ points)
- High performance geospatial visualization

**WiglePage** (`client/src/components/WiglePage.tsx`)

- Mapbox GL JS with WiGLE API integration
- v2 search, v3 detail endpoints
- Network enumeration from WiGLE database

**All use**: `client/src/utils/geospatial/renderNetworkTooltip.ts` for consistent tooltip rendering

## Performance Considerations

**Frontend**:

- Use React.memo for expensive components
- Lazy load map components: `LazyMapComponent.tsx`
- Vite optimizes production builds
- PWA enabled (offline support, caching)

**Backend**:

- Connection pooling via `server/src/config/database.js`
- Query timeouts (120s default)
- Rate limiting middleware
- Redis caching for frequently accessed data

**Database**:

- Materialized views for aggregated data
- Indexes on frequently queried columns
- UNLOGGED staging tables for ETL ingestion
- PostGIS spatial indexes for geospatial queries

## Secrets Management

**Keyring Location**: `~/.local/share/shadowcheck/keyring.enc` (encrypted)

**Setting Secrets**:

```bash
npx tsx scripts/set-secret.ts db_password "password"
npx tsx scripts/set-secret.ts db_admin_password "admin_pass"
npx tsx scripts/set-secret.ts mapbox_token "pk.xxx"
```

**In Docker**: Set `KEYRING_MACHINE_ID` env var to allow container to decrypt host keyring:

```bash
KEYRING_MACHINE_ID=$(hostname)$(whoami) docker-compose up
```

## ETL Pipeline

**Run Pipeline**: `node etl/run-pipeline.js`

**Individual Stages**:

- JSON import: `node etl/load/json-import.js`
- SQLite import: `node etl/load/sqlite-import.js`
- Deduplication: `node etl/transform/deduplicate.js`
- Normalization: `node etl/transform/normalize-observations.js`
- Refresh views: `node etl/promote/refresh-mviews.js`
- Score threats: `node etl/promote/run-scoring.js`

**Optimization**: Staging tables are UNLOGGED for ingestion speed

## AI Agent Best Practices

### Before Writing Code

1. **Verify Docker status**: `docker ps | grep shadowcheck_postgres`
2. **Read relevant documentation**: CLAUDE.md + docs/ folder
3. **Check existing patterns**: Look at similar route/component before implementing
4. **Validate database schema**: Check `sql/` for table definitions
5. **Review test coverage**: Understand expected behavior from tests

### When Writing Code

1. **Follow module structure** - Don't mix concerns
2. **Use provided utilities** - Don't reinvent escaping, secrets, validation
3. **Write tests alongside code** - Unit tests for logic, integration tests for endpoints
4. **Mock external dependencies** - Database, APIs, file system in tests
5. **Run linting before commits** - `npm run lint:fix`

### Common Mistakes to Avoid

- ❌ Using local PostgreSQL instead of Docker
- ❌ Inline `style={{}}` instead of Tailwind classes
- ❌ Direct SQL in routes (use repositories/services)
- ❌ Frontend importing from backend (use API calls)
- ❌ CommonJS in frontend, ES modules in backend
- ❌ Ignoring database security roles (admin vs. user)
- ❌ Hard-coding secrets (use secretsManager)
- ❌ Applying pagination limits to Kepler endpoints
- ❌ Forgetting to run tests before pushing

## Resources

- **CLAUDE.md** - General development guidance
- **docs/DEVELOPMENT.md** - Detailed setup & workflow
- **docs/TESTING.md** - Testing strategy & patterns
- **docs/ARCHITECTURE.md** - System design deep-dive
- **docs/API_REFERENCE.md** - API endpoint documentation
- **README.md** - Project overview & quick start
- **jest.config.js** - Test configuration details
- **server/src/config/container.js** - Service dependency mapping

## Summary

This is a **production-grade SIGINT forensics platform** with:

- Modular architecture (backend services, frontend components)
- Security-first design (DB role separation, encrypted secrets)
- Performance-optimized (spatial indexes, materialized views, connection pooling)
- Comprehensive testing (70% coverage threshold)
- Universal filtering system (20+ filter types, URL-synced)

**Golden Rules**:

1. Docker PostgreSQL ONLY - never local system DB
2. Backend = CommonJS + services/repositories pattern
3. Frontend = ES modules + React hooks + Zustand
4. Test everything - especially business logic
5. Use Tailwind - no inline styles
6. Follow existing patterns - consistency matters
7. Read CLAUDE.md before asking questions
