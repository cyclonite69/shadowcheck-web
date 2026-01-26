# ShadowCheck Project Structure

This document provides a comprehensive overview of the ShadowCheck project organization and file structure best practices.

## Root Directory Principles

**The root directory should only contain essential configuration and entry point files.**

All source code, data, tests, and generated files belong in their respective subdirectories.

## Directory Layout

```
shadowcheck-static/
├── 📦 Core Application
│   ├── package.json           # Node.js dependencies & scripts
│   └── package-lock.json      # Locked dependency versions
│
├── 📁 client/                 # React/Vite frontend
│   ├── index.html             # Vite HTML template
│   ├── public/                # Static frontend assets
│   ├── src/                   # React source (TS/TSX)
│   ├── vite.config.js         # Vite build configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── postcss.config.js      # PostCSS configuration
│   └── tsconfig*.json         # TypeScript configs
│
├── 📁 server/                 # Express backend
│   ├── server.js              # Main Express server entry point
│   ├── static-server.js       # Production static server
│   └── src/                   # Backend source (API/services/etc)
│       ├── api/               # API routes (v1 + v2)
│       ├── services/          # Business logic layer
│       ├── repositories/      # Data access layer
│       ├── config/            # Configuration (DB pool, DI container)
│       ├── validation/        # Request validation schemas
│       ├── errors/            # Custom error classes
│       ├── logging/           # Winston structured logging
│       └── utils/             # Utility functions
│
├── 📁 tests/                  # Test Suite
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── api/                   # API endpoint tests
│   └── setup.js               # Jest setup
│
├── 📁 etl/                    # ETL pipelines (load/transform/promote)
│   ├── 01_load/
│   ├── 03_transform/
│   └── 05_indexes/
│
├── 📁 scripts/                # Utility Scripts
│   ├── import/                # Data import utilities
│   ├── geocoding/             # Geocoding & reverse geocoding
│   ├── enrichment/            # Address enrichment (4 API sources)
│   ├── ml/                    # ML training & iteration
│   ├── keyring/               # Secrets management (Python)
│   └── *.js                   # Misc utilities (set-home, rotate-password, etc.)
│
├── 📁 sql/                    # Database
│   ├── functions/             # SQL functions (scoring, Kismet import, etc.)
│   ├── migrations/            # Schema migrations (numbered)
│   └── temp/                  # Temporary SQL scripts (gitignored)
│
├── 📁 docs/                   # Documentation
│   ├── README.md              # Documentation index
│   ├── architecture/          # System architecture guides
│   ├── architecture/PROJECT_STRUCTURE.md # This file
│   ├── security/              # Security policies
│   ├── archive/               # Historical documentation
│   └── DATABASE_*.md          # Database schema docs
│
├── 📁 backups/                # Backups & Temporary Data (gitignored)
│   ├── csv/                   # CSV data exports/imports
│   ├── sqlite/                # SQLite database backups
│   ├── analysis-reports/      # Analysis and debug reports
│   ├── *.sql                  # PostgreSQL dumps
│   └── *.dump                 # pg_dump backups
│
├── 📁 data/                   # Runtime Data (gitignored, permission issues)
│   ├── csv/                   # Runtime CSV data
│   ├── imports/               # Import staging
│   ├── exports/               # Export output
│   └── analysis/              # Analysis output
│
├── 📁 docker/                 # Docker Configuration
│   └── infrastructure/        # Shared PostgreSQL infrastructure
│       └── docker-compose.postgres.yml
│
├── 🐳 Docker Files (Root)
│   ├── Dockerfile             # Multi-stage Docker build
│   ├── docker-compose.yml     # Main: API + Redis
│   └── docker-compose.dev.yml # Development overrides (hot-reload)
│
├── ⚙️ Configuration Files
│   ├── .env.example           # Environment variable template
│   ├── jest.config.js         # Jest test configuration
│   ├── .eslintrc.json         # ESLint rules
│   ├── .prettierrc.json       # Prettier formatting
│   ├── .gitignore             # Git ignore patterns
│   └── .nvmrc                 # Node version (20+)
│
└── 📄 Documentation (Root)
    ├── README.md              # Project overview
    ├── CLAUDE.md              # Claude Code guidance
    ├── CHANGELOG.md           # Version history
    ├── LICENSE                # MIT License
    ├── CONTRIBUTING.md        # Contribution guidelines
    ├── CODE_OF_CONDUCT.md     # Community guidelines
    └── SECURITY.md            # Security policy
```

## Technology Stack

### Backend (Node.js 20+)

- **Language**: JavaScript (CommonJS modules)
- **Framework**: Express.js
- **Database**: PostgreSQL 18 + PostGIS
- **Architecture**: Layered (Routes → Services → Repositories)

### Frontend (React 18)

- **Language**: TypeScript (ES modules)
- **Framework**: React 18
- **Build Tool**: Vite
- **Router**: React Router v6
- **Styling**: Tailwind CSS
- **Maps**: Mapbox GL JS
- **Charts**: Recharts

## File Type Patterns

| File Extension   | Purpose                       | Location                                                              |
| ---------------- | ----------------------------- | --------------------------------------------------------------------- |
| `*.js` (backend) | Backend JavaScript (CommonJS) | `server/src/api/`, `server/src/services/`, `server/src/repositories/` |
| `*.tsx`, `*.jsx` | Frontend React components     | `client/src/components/`, `client/src/App.tsx`, `client/src/main.tsx` |
| `*.ts` (scripts) | TypeScript scripts/utilities  | `scripts/`, `scripts/enrichment/`                                     |
| `*.css`          | Frontend styles               | `client/src/`                                                         |
| `*.sql`          | Database migrations           | `sql/migrations/`                                                     |
| `*.test.js`      | Backend tests                 | `tests/`                                                              |

## File Organization Rules

### ✅ DO

- Keep root directory minimal (config + docs only)
- Use descriptive directory names
- Group related files in subdirectories
- Use `.gitkeep` to preserve empty directories in git
- Document non-obvious directory purposes in README files
- Use consistent naming conventions:
  - **Backend (server/src/api, services, repositories)**: `camelCase.js` (CommonJS)
  - **Frontend (client/src/components)**: `PascalCase.tsx` (TypeScript/React)
  - **Tests**: `*.test.js` or `*.spec.js`
  - **Config**: `kebab-case.config.js`

### ❌ DON'T

- Commit data files (`*.csv`, `*.sqlite`) to git
- Leave test files (`test-*.js`) in root directory
- Store logs or temporary files in root
- Mix backend (CommonJS) and frontend (ES modules) patterns
- Commit secrets or credentials
- Create deeply nested directory structures (max 3-4 levels)

## Special Directories

### `backups/` - Local Backups Only

**Purpose**: Store database dumps, CSV exports, and analysis reports locally.

**Important**: This entire directory is gitignored. Do NOT commit backups to git.

**Subdirectories**:

- `csv/` - CSV data files (exports, imports, device source files)
- `sqlite/` - SQLite database backups
- `analysis-reports/` - Database analysis and debug reports
- `db/` - Admin-triggered pg_dump files
- Root files: PostgreSQL dumps (`*.sql`, `*.dump`)

**Usage**:

```bash
# Create a backup
docker exec shadowcheck_postgres pg_dump -U shadowcheck_user shadowcheck_db > backups/backup-$(date +%Y%m%d).sql

# Admin UI backup (docker-compose must mount ./backups:/app/backups)
# Run "Run Full Backup" in /admin to write into backups/db/

# Store CSV exports
mv *.csv backups/csv/
```

### `data/` - Runtime Data Directory

**Purpose**: Application runtime data (imports, exports, temporary processing).

**Important**: Directory is gitignored but kept in repo via `data/.gitkeep`. If owned by root from Docker volume, fix permissions:

```bash
sudo chown -R $USER:$USER data/
```

**Status**: Currently using `backups/` instead. Fix permissions before using.

### `sql/temp/` - Temporary SQL Scripts

**Purpose**: Store temporary SQL scripts during development/debugging.

**Important**: Entire directory is gitignored. Use for throwaway queries and test scripts.

**Usage**:

```bash
# Temporary analysis
echo "SELECT COUNT(*) FROM app.networks;" > sql/temp/count.sql
psql -U shadowcheck_user -d shadowcheck_db -f sql/temp/count.sql
```

### `docker/infrastructure/` - Shared Infrastructure

**Purpose**: Docker Compose files for shared PostgreSQL infrastructure (used across multiple ShadowCheck projects).

**Usage**:

```bash
# Start shared PostgreSQL (run once)
docker-compose -f docker/infrastructure/docker-compose.postgres.yml up -d

# Then start this application
docker-compose up -d
```

## Code Organization Patterns

### Backend (CommonJS)

**Location**: `server/src/api/`, `server/src/services/`, `server/src/repositories/`

**Pattern**: Modular, layered architecture

- **Routes** (`server/src/api/routes/v1/`): HTTP endpoint handlers
- **Services** (`server/src/services/`): Business logic
- **Repositories** (`server/src/repositories/`): Data access layer
- **Config** (`server/src/config/`): Database pool, DI container

**Example**:

```javascript
// server/src/api/routes/v1/networks.js
const express = require('express');
const container = require('../../../config/container');
const router = express.Router();

router.get('/', async (req, res, next) => {
  const service = container.get('networkService');
  const networks = await service.getAllNetworks();
  res.json(networks);
});
```

### Frontend (React + TypeScript)

**Location**: `client/src/components/`, `client/src/App.tsx`, `client/src/main.tsx`

**Pattern**: Functional components with hooks

- **Components**: Reusable UI components (TSX)
- **App.tsx**: React Router configuration
- **main.tsx**: React entry point
- **index.css**: Global Tailwind styles

**Example**:

```typescript
// client/src/components/Dashboard.tsx
import React from 'react';

export const Dashboard: React.FC = () => {
  return <div className="p-4">Dashboard</div>;
};
```

### Tests

**Location**: `tests/`

**Pattern**: Jest test suites

- `tests/unit/` - Unit tests for individual functions/modules
- `tests/integration/` - Integration tests for API endpoints
- `tests/api/` - API contract tests

**Naming**: `*.test.js` or `*.spec.js`

## Migration Status

The React/Vite frontend has replaced the legacy HTML pages. The server now serves the React app only.

## Git Workflow

### What Gets Committed

- ✅ Source code (`client/`, `server/`)
- ✅ Tests (`tests/`)
- ✅ Configuration files (root `*.config.js`, `.env.example`)
- ✅ Documentation (`docs/`, root `*.md`)
- ✅ SQL migrations (`sql/migrations/`)
- ✅ SQL functions (`sql/functions/`)
- ✅ Scripts (`scripts/`)
- ✅ Directory structure (`.gitkeep` files)

### What Gets Ignored

- ❌ `node_modules/`
- ❌ `dist/`, `build/`
- ❌ `.env` (secrets)
- ❌ `logs/`, `*.log`
- ❌ `backups/` (entire directory)
- ❌ `data/` (entire directory)
- ❌ `coverage/`
- ❌ `.vscode/`, `.idea/`
- ❌ `*.csv`, `*.sqlite`, `*.db`
- ❌ Test files in root (`/test-*.js`)

See `.gitignore` for complete list.

## Maintenance

### Regular Cleanup

```bash
# Check for files in root that shouldn't be there
ls -la | grep -E '\.(csv|sqlite|log|sql)$'

# Remove common clutter
rm -f *.log *.csv *.sqlite test-*.js *.tar.gz

# Move misplaced files
mv *.sql sql/temp/
mv *.csv backups/csv/
mv *analysis*.md backups/analysis-reports/
```

### Verify Directory Structure

```bash
# Check what git is tracking in root
git ls-files --directory ./ --exclude-standard | grep -v '/'

# Should only see config files, package.json, client/, server/, and docs/
```

### Fix Permissions

```bash
# Fix data/ directory permissions (if using Docker volumes)
sudo chown -R $USER:$USER data/
mkdir -p data/{csv,imports,exports,analysis}
```

## Questions?

See:

- [CLAUDE.md](../../CLAUDE.md) - Development guidance
- [README.md](../../README.md) - Project overview
- [docs/README.md](../README.md) - Documentation navigation
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Contribution guidelines

---

**Last Updated**: 2025-12-19
