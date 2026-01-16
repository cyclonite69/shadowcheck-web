# Development Guide

Complete guide for setting up and developing ShadowCheck-Static.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Workflow](#development-workflow)
- [Database Management](#database-management)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 18+ with PostGIS extension
- **Docker** (optional, for containerized development)
- **Git** for version control

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - PostgreSQL (by Chris Kolkman)
  - REST Client
- **Postman** or **Insomnia** for API testing
- **pgAdmin** or **DBeaver** for database management

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/ShadowCheckStatic.git
cd ShadowCheckStatic
```

### 2. Install Dependencies

```bash
npm install
```

This installs all dependencies from `package.json`:

- express, pg, dotenv (core dependencies)
- jest, eslint, prettier (development dependencies)

### 3. Configure Environment

Create `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DB_USER=shadowcheck_user
DB_HOST=shadowcheck_postgres
DB_NAME=shadowcheck_db
DB_PASSWORD=your_secure_password
DB_PORT=5432

# Server Configuration
PORT=3001
NODE_ENV=development
FORCE_HTTPS=false

# CORS Configuration (comma-separated origins)
CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001

# API Authentication (optional for development)
API_KEY=dev-key-123

# Frontend Configuration
MAPBOX_TOKEN=pk.your_mapbox_token_here

# Enrichment APIs (optional)
OPENCAGE_API_KEY=your_opencage_key
LOCATIONIQ_API_KEY=your_locationiq_key
ABSTRACT_API_KEY=your_abstract_key
```

If you're running PostgreSQL locally (not the shared Docker container), set `DB_HOST=localhost` and use the database name you created.

### 4. Setup Database

#### Option A: Docker (Recommended)

This repo expects a shared Postgres container (`shadowcheck_postgres`) on the `shadowcheck_net` network. Start it via your shared database stack before continuing.

```bash
# Ensure shared PostgreSQL container is running
docker ps | grep shadowcheck_postgres

# Wait for database to be ready (shared Postgres container)
docker exec shadowcheck_postgres pg_isready -U shadowcheck_user

# Run migrations
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db < sql/migrations/00_init_schema.sql
```

#### Option B: Manual Installation

```bash
# Install PostgreSQL 18 and PostGIS
sudo apt-get install postgresql-18 postgresql-18-postgis-3

# Create database and user
sudo -u postgres psql << EOF
CREATE USER shadowcheck_user WITH PASSWORD 'your_password';
CREATE DATABASE shadowcheck_db OWNER shadowcheck_user;
\c shadowcheck_db
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS app;
GRANT ALL ON SCHEMA app TO shadowcheck_user;
EOF

# Run migrations
psql -U shadowcheck_user -d shadowcheck_db -f sql/migrations/00_init_schema.sql
```

### 5. Verify Installation

```bash
# Test database connection
node tests/test-db.js

# Start development server
npm run dev

# Test API endpoint
curl http://localhost:3001/api/dashboard-metrics
```

Expected output:

```json
{
  "totalNetworks": 0,
  "threatsCount": 0,
  "surveillanceCount": 0,
  "enrichedCount": 0
}
```

## Development Workflow

### Start Development Server

```bash
# Standard mode
npm start

# Development mode with auto-reload (requires nodemon)
npm run dev

# Frontend dev server (Vite)
npm run dev:frontend

# Debug mode
npm run debug
```

### Project Structure

```
ShadowCheckStatic/
├── server.js              # Express server entrypoint
├── server/                # Express API modules
├── src/                   # React/Vite frontend + shared server modules
│   ├── api/               # Backend API routes
│   ├── services/          # Backend business logic
│   └── repositories/      # Backend data access
├── utils/                 # Utility modules
│   └── errorHandler.js
├── public/                # Static frontend files
│   ├── index.html
│   ├── geospatial.html
│   ├── networks.html
│   ├── analytics.html
│   └── surveillance.html
├── scripts/               # Utility scripts
│   ├── enrichment/        # Address enrichment
│   ├── geocoding/         # Reverse geocoding
│   ├── ml/                # Machine learning
│   └── import/            # Data import
├── sql/                   # SQL files
│   ├── migrations/        # Schema migrations
│   └── functions/         # SQL functions
├── tests/                 # Test files
│   ├── setup.js
│   ├── api/
│   ├── integration/
│   └── unit/
├── docs/                  # Documentation
└── data/                  # Data files (not in git)
    ├── csv/
    └── logs/
```

### Making Changes

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Edit `server.js` or utility files
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
SELECT type, COUNT(*) FROM app.networks_legacy GROUP BY type;

-- Recent observations
SELECT * FROM app.locations_legacy
WHERE time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000
LIMIT 10;

-- Tagged networks
SELECT bssid, tag_type, confidence, notes
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

### Run All Tests

```bash
npm test
```

### Run Specific Test

```bash
npm test -- tests/unit/your-test.test.js
```

### Run Tests with Coverage

```bash
npm run test:cov
```

Coverage report will be generated in `coverage/` directory.

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
      "program": "${workspaceFolder}/server.js",
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
// In server.js
const pool = new Pool({
  // ... config
  log: (msg) => console.log('DB:', msg), // Enable query logging
});
```

## Common Tasks

### Add New API Endpoint

1. Add route handler in `server.js`:

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
