# Development Guide

**Wiki versions (diagrams):** [Development](../.github/wiki/Development.md), [Installation](../.github/wiki/Installation.md)

Complete guide for setting up and developing ShadowCheck-Web with modern React + Express architecture.

## Table of Contents

- [Prerequisites](#prerequisites)
- [System Constraints](#system-constraints)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Frontend Development](#frontend-development)
- [Backend Development](#backend-development)
- [Agency Offices Data Quality & Enrichment](#agency-offices-data-quality--enrichment)
- [Database Management](#database-management)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [DevContainer Setup](#devcontainer-setup)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js** 22+ (LTS) - Check with `node --version`
- **npm** 11+ - Check with `npm --version`
- **PostgreSQL** 18+ with PostGIS extension
- **Redis** 7.0+
- **Docker** (for containerized development)
- **Git** for version control
- **VS Code** with DevContainer support

### Tools

- **VS Code Extensions**:
  - ESLint
  - Prettier - Code formatter
  - PostgreSQL (by Chris Kolkman)
  - REST Client
  - Dev Containers
  - Tailwind CSS IntelliSense
  - TypeScript Importer
- **Database Tools**: pgAdmin, DBeaver, or TablePlus
- **API Testing**: Postman, Insomnia, or VS Code REST Client

## System Constraints

The following rules are immutable constraints of the development environment:

1.  **Kepler.gl Endpoints**: No default pagination limits are applied.
2.  **Dataset Scaling**: The dataset size scales linearly with observations.
3.  **Universal Filters**: The filter system applies uniformly across all pages.
4.  **Distance Calculations**: All distance calculations utilize PostGIS `ST_Distance` (spheroid).
5.  **Weather FX Integration**: All weather data is fetched via the `/api/weather` backend proxy.
6.  **Authentication**: Authentication is session-based using Redis.
7.  **API Format**: All API responses use JSON.
8.  **Database**: The system requires PostgreSQL 18+ with PostGIS.
9.  **Frontend Framework**: The frontend is built exclusively with React 19 and Vite 7.
10. **Threat Scoring**: Threat scoring utilizes multi-factor analysis with immutable weights per version.

## Agency Offices Data Quality & Enrichment

The agency offices dataset undergoes a multi-stage enrichment and normalization pipeline to ensure high spatial accuracy and data completeness.

### Enrichment Pipeline

1.  **Smarty ZIP+4 Integration**: All addresses are processed through the Smarty (formerly SmartyStreets) enhanced matching engine. This is the sole provider for ZIP+4 codes. 22 records remain ZIP5-only because Smarty could not identify a safe Plus4 candidate.
2.  **Reverse Geocoding**: Mapbox and Nominatim (OpenStreetMap) are used to validate address components against provided coordinates. Address corrections derived from these sources are stored in metadata and do not overwrite original source values.
3.  **Parent Office Inference**: For resident agencies missing a parent field office in the source data, the system automatically infers the nearest field office using PostGIS `ST_Distance` calculations.
4.  **Website Inheritance**: Resident agencies inherit the FBI.gov subpage URL of their parent field office to ensure 100% website coverage.
5.  **Phone Normalization**: All phone numbers are normalized to a 10-digit format (e.g., 5551234567). The original raw string is preserved in the primary `phone` field.

### Data Preservation Rules

- **Source Integrity**: Original values from the FBI source website are NEVER overwritten in the primary fields.
- **Metadata Logging**: All corrections, inference flags, and enrichment source timestamps are logged in the `metadata` JSONB field.
- **Mapbox Licensing**: Address strings retrieved from Mapbox geocoding are used for validation only and are not stored permanently in the database.

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/cyclonite69/shadowcheck-web.git
cd shadowcheck-web
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies including:

- **Frontend**: React, Vite, Tailwind CSS, TypeScript
- **Backend**: Express, PostgreSQL client, Winston logging
- **Development**: ESLint, Prettier, Jest, Husky

### 3. Environment Configuration

Provision secrets in **AWS Secrets Manager**. For local development, use environment
variables only as explicit overrides (no secrets written to disk).

```bash
# Non-secret config can live in .env if desired
# Secrets policy: do not create local .env files with credentials; inject runtime env vars or load from AWS Secrets Manager

# Local overrides for secrets
export DB_PASSWORD=...
export DB_ADMIN_PASSWORD=...
export MAPBOX_TOKEN=...
```

Non-secret config example:

```env
DB_USER=shadowcheck_user
DB_HOST=localhost  # or shadowcheck_postgres for Docker
DB_NAME=shadowcheck_db
DB_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3001
NODE_ENV=development
FORCE_HTTPS=false
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173
MAPBOX_TOKEN=pk.your_mapbox_token_here
OPENCAGE_API_KEY=your_opencage_key
LOCATIONIQ_API_KEY=your_locationiq_key
ABSTRACT_API_KEY=your_abstract_key
# Endpoint: /api/weather -> https://api.open-meteo.com/v1/forecast
```

**Note**: In production, secrets are stored in AWS Secrets Manager, not `.env`.

## DevContainer Setup

The project includes a complete DevContainer configuration for consistent development environments.

### 1. Prerequisites for DevContainer

- **Docker Desktop** installed and running
- **VS Code** with the **Dev Containers** extension

### 2. Open in DevContainer

```bash
# Option 1: Command Palette
# Ctrl+Shift+P -> "Dev Containers: Reopen in Container"

# Option 2: VS Code will prompt when opening the project
# Click "Reopen in Container" when prompted
```

### 3. DevContainer Features

The DevContainer includes:

- **Node.js 22** with npm 11
- **PostgreSQL 18** with PostGIS
- **Redis 7**
- **All VS Code extensions** pre-installed
- **Database setup** with sample data
- **Port forwarding** for development servers
- **Git configuration** preserved from host

### 4. Development in DevContainer

```bash
# Install dependencies (if not already done)
npm install

# Start development servers
npm run dev          # Backend with nodemon
npm run dev:frontend # Frontend with Vite (separate terminal)

# Run tests
npm test

# Access the application
# Backend: http://localhost:3001
# Frontend: http://localhost:5173 (Vite dev server)
```

## Development Workflow

### Start Development Servers

```bash
# Backend development server (with auto-reload)
npm run dev

# Frontend development server (Vite with HMR)
npm run dev:frontend

# Full-stack development (run both in separate terminals)
# Terminal 1:
npm run dev

# Terminal 2:
npm run dev:frontend
```

### Build and Preview

```bash
# Build frontend for production
npm run build

# Preview production build
npm run preview

# Serve production build with security headers
npm run serve:dist
```

## Frontend Development

### React + Vite Architecture

The frontend uses modern React with TypeScript and Vite for fast development.

#### Key Technologies

- **React 19** with hooks and functional components
- **TypeScript** for type safety
- **Vite** for fast builds and HMR
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router** for navigation

#### Component Structure

```
client/src/components/
├── DashboardPage.tsx           # Main dashboard with metrics
├── GeospatialExplorer.tsx / geospatial/ # Interactive map interface
├── AnalyticsPage.tsx           # Charts and data visualization
├── KeplerPage.tsx              # Kepler workflow
├── AdminPage.tsx               # System administration
├── FilterPanel.tsx             # Universal filter interface
├── ActiveFiltersSummary.tsx    # Filter status display
├── Navigation.tsx              # App navigation bar
└── modals/                     # Modal dialogs
    └── NetworkContextMenu.jsx  # Right-click context menu
```

#### State Management

```typescript
// Global filter state with Zustand
import { useFilterStore } from '../stores/filterStore';

const MyComponent = () => {
  const { filters, setFilter, clearFilters } = useFilterStore();

  const handleFilterChange = (key: string, value: any) => {
    setFilter(key, value);
  };

  return (
    <FilterPanel
      filters={filters}
      onFilterChange={handleFilterChange}
    />
  );
};
```

#### Custom Hooks

```typescript
// Data fetching with filters
import { useFilteredData } from '../hooks/useFilteredData';

const NetworksList = () => {
  const { data, loading, error } = useFilteredData('/api/networks');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return <NetworkTable data={data} />;
};
```

#### Styling with Tailwind

```tsx
// Dark theme with responsive design
const DashboardCard = ({ title, value, icon }) => (
  <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:bg-slate-750 transition-colors">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className="text-blue-400">{icon}</div>
    </div>
  </div>
);
```

### Adding New Components

1. **Create Component File**

```tsx
// client/src/components/MyNewPage.tsx
import React, { useState, useEffect } from 'react';
import { logError } from '../logging/clientLogger';

interface MyNewPageProps {
  // Define props
}

const MyNewPage: React.FC<MyNewPageProps> = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/my-endpoint');
      const result = await response.json();
      setData(result);
    } catch (error) {
      logError('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">My New Page</h1>
      {/* Your component content */}
    </div>
  );
};

export default MyNewPage;
```

2. **Add Route to App.tsx**

```tsx
// client/src/App.tsx
import { lazy } from 'react';

const MyNewPage = lazy(() => import('./components/MyNewPage'));

// In the Routes component:
<Route path="/my-new-page" element={<MyNewPage />} />;
```

3. **Add Navigation Link**

```tsx
// client/src/components/Navigation.tsx
const navItems = [
  // ... existing items
  { path: '/my-new-page', label: 'My New Page', icon: MyIcon },
];
```

### Making Changes

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Edit `server/server.ts` or utility files
   - Add tests in `tests/` directory
   - Update documentation if needed

3. **Test Changes**

   ```bash
   # Run linter
   npm run lint

   # Fix linting errors
   npm run lint:fix

   # Format code
   npm run format

   # Run tests
   npm test

   # Run specific test
   npm test -- tests/unit/your-test.test.js
   ```

4. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `test:` Test additions/changes
   - `refactor:` Code refactoring
   - `chore:` Maintenance tasks

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Database Management

### Common Database Operations

#### Connect to Database

```bash
# Via Docker
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db

# Direct connection
psql -U shadowcheck_user -d shadowcheck_db
```

#### Run Migration

```bash
# Via Docker
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db < sql/migrations/your_migration.sql

# Direct
psql -U shadowcheck_user -d shadowcheck_db -f sql/migrations/your_migration.sql
```

#### Backup Database

```bash
# Full backup
pg_dump -U shadowcheck_user -d shadowcheck_db -F c -f backup_$(date +%Y%m%d).dump

# Schema only
pg_dump -U shadowcheck_user -d shadowcheck_db -s > schema_backup.sql
```

#### Restore Database

```bash
# From custom format
pg_restore -U shadowcheck_user -d shadowcheck_db backup.dump

# From SQL
psql -U shadowcheck_user -d shadowcheck_db < backup.sql
```

### Useful Queries

```sql
-- Count networks by type
SELECT type, COUNT(*) FROM app.networks GROUP BY type;

-- Recent observations
SELECT * FROM app.observations
WHERE time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000
LIMIT 10;

-- Tagged networks
SELECT bssid, threat_tag, threat_confidence, notes
FROM app.network_tags
ORDER BY created_at DESC;

-- Threat statistics
SELECT
  COUNT(*) FILTER (WHERE threat_score >= 80) AS critical,
  COUNT(*) FILTER (WHERE threat_score >= 70) AS high,
  COUNT(*) FILTER (WHERE threat_score >= 50) AS medium,
  COUNT(*) FILTER (WHERE threat_score >= 30) AS low
FROM (/* threat detection query */);
```

## Testing

### Test Suites

ShadowCheck includes comprehensive testing for security and data integrity:

#### Integration Tests

- **SQL Injection Fixes** (44 tests) - Security vulnerability prevention
- **Networks API Data Integrity** - Regression tests for core filters

#### Unit Tests

- Component testing with Jest and React Testing Library
- API endpoint testing with Supertest
- Database query validation

### Run All Tests

```bash
npm test
```

### Run Specific Test Suites

```bash
# Run integration tests
npm run test:integration

# Run specific test files
npm test -- tests/integration/sql-injection-fixes.test.ts

# Run unit tests
npm test -- tests/unit/your-test.test.ts
```

### Run Tests with Coverage

```bash
npm run test:cov
```

Coverage report will be generated in `coverage/` directory.

### Recent Test Additions

#### Data Integrity Tests

Added regression tests for recently fixed issues:

```bash
# Test networks API data integrity
npm test -- tests/integration/networks-data-integrity.test.js
```

These tests verify:

- ✅ GeoSpatial data accuracy (no 0 values for signal/frequency/channel)
- ✅ Analytics endpoints return valid data
- ✅ Distance calculations use PostGIS functions
- ✅ Manufacturer fields populated correctly

### Writing Tests

Create test files in `tests/` directory:

```javascript
// tests/api/dashboard-metrics.test.js
const request = require('supertest');
const app = require('../../server');

describe('GET /api/dashboard-metrics', () => {
  it('should return dashboard metrics', async () => {
    const response = await request(app)
      .get('/api/dashboard-metrics')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toHaveProperty('totalNetworks');
    expect(response.body).toHaveProperty('threatsCount');
  });
});
```

### Test Documentation

See [Integration Tests README](../tests/integration/README.md) for detailed test coverage and security validation.

### Integration Tests

```bash
# Run integration tests
NODE_ENV=test npm run test:integration
```

## Code Quality

### Linting

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

ESLint configuration: `.eslintrc.json`

### Formatting

```bash
# Check formatting
npm run format:check

# Auto-format
npm run format
```

Prettier configuration: `.prettierrc.json`

### Pre-commit Hooks

Install pre-commit hooks (optional):

```bash
npm install --save-dev husky lint-staged

# Setup husky
npx husky install
npx husky add .husky/pre-commit "npm run lint-staged"
```

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.js": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml}": ["prettier --write"]
  }
}
```

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/server/server.ts",
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Debug Logging

Enable debug logging:

```bash
# Set environment variable
DEBUG=shadowcheck:* npm start

# Or in .env
NODE_ENV=development
LOG_LEVEL=debug
```

### Database Query Logging

```javascript
// In server/server.ts
const pool = new Pool({
  // ... config
  log: (msg) => console.log('DB:', msg), // Enable query logging
});
```

## Common Tasks

### Quick Start (Local)

```bash
docker compose up -d
npm install
npm run dev
```

### Common Scripts

- `scripts/docker-manage.sh` — start/stop/status/logs for Docker services
- `scripts/db-connect.sh` — open psql connection
- `scripts/refresh-threat-scores.sh` — recompute threat scores
- `scripts/test-endpoints.sh` — API smoke tests

### Logging & Errors

- Logging uses Winston; runtime logs live under `server/data/logs/` and `logs/` and are gitignored.
- API errors use `AppError` classes with centralized middleware for consistent responses.

### Input Validation

- Validation helpers and middleware live in `server/src/validation/`.
- Prefer middleware (pagination, bssid, coordinates) to keep routes clean and safe.

### Add New API Endpoint

1. Add route handler in `server/server.ts`:

```javascript
app.get('/api/your-endpoint', async (req, res) => {
  try {
    const result = await query('SELECT * FROM ...');
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    errorHandler(err, res);
  }
});
```

2. Add tests in `tests/api/your-endpoint.test.js`
3. Update `API.md` documentation
4. Test endpoint manually

### Add Database Migration

1. Create SQL file in `sql/migrations/`:

```sql
-- sql/migrations/add_your_feature.sql
CREATE TABLE IF NOT EXISTS app.your_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);
```

2. Run migration:

```bash
psql -U shadowcheck_user -d shadowcheck_db -f sql/migrations/add_your_feature.sql
```

3. Update schema documentation

### Add Enrichment Script

1. Create script in `scripts/enrichment/`:

```javascript
// scripts/enrichment/your-enrichment.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

async function enrichData() {
  // Your enrichment logic
}

enrichData()
  .catch(console.error)
  .finally(() => pool.end());
```

2. Make executable:

```bash
chmod +x scripts/enrichment/your-enrichment.js
```

3. Run script:

```bash
node scripts/enrichment/your-enrichment.js
```

## Troubleshooting

### Database Connection Errors

**Error:** `ECONNREFUSED`

**Solution:**

```bash
# Check PostgreSQL is running
docker ps | grep postgres
# Or
sudo systemctl status postgresql

# Check connection settings in .env
# Verify DB_HOST, DB_PORT match your setup
```

**Error:** `password authentication failed`

**Solution:**

```bash
# Reset password in PostgreSQL
sudo -u postgres psql
postgres=# ALTER USER shadowcheck_user WITH PASSWORD 'new_password';

# Update .env file with new password
```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**

```bash
# Find process using port
lsof -i :3001
# Or
netstat -nlp | grep :3001

# Kill process
kill -9 <PID>

# Or change PORT in .env
```

### Migration Errors

**Error:** `relation already exists`

**Solution:**

```bash
# Drop and recreate (development only!)
psql -U shadowcheck_user -d shadowcheck_db << EOF
DROP SCHEMA app CASCADE;
CREATE SCHEMA app;
EOF

# Then re-run migrations
```

### Memory Issues

**Error:** `JavaScript heap out of memory`

**Solution:**

```bash
# Increase Node.js memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm start
```

### Slow Queries

Check query performance:

```sql
EXPLAIN ANALYZE SELECT ...;
```

Add indexes if needed:

```sql
CREATE INDEX idx_locations_bssid ON app.locations_legacy(bssid);
```

## Best Practices

### Code Style

- Use 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Descriptive variable names
- Comment complex logic
- Extract repeated code into functions

### Security

- Never commit `.env` file
- Use parameterized queries (SQL injection prevention)
- Validate all user input
- Sanitize output (XSS prevention)
- Use HTTPS in production
- Rotate API keys regularly

### Performance

- Use connection pooling
- Add database indexes for frequent queries
- Cache expensive computations
- Paginate large result sets
- Use `LIMIT` in queries

### Git Workflow

- Create feature branches
- Write descriptive commit messages
- Keep commits atomic (one feature/fix per commit)
- Rebase before merging
- Review your own code before requesting review

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

---

For API documentation, see [API.md](API.md).
For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).
