# ShadowCheck Project Structure

This document provides a comprehensive overview of the ShadowCheck project organization and file structure best practices.

## Root Directory Principles

**The root directory should only contain essential configuration and entry point files.**

All source code, data, tests, and generated files belong in their respective subdirectories.

## Directory Layout

```
shadowcheck-static/
├── 📦 Core Application
│   ├── server.js              # Express backend entry point
│   ├── index.html             # Vite HTML template
│   ├── package.json           # Node.js dependencies & scripts
│   └── package-lock.json      # Locked dependency versions
│
├── 📁 src/                    # Application Source Code
│   ├── api/                   # Backend API (CommonJS)
│   │   └── routes/v1/         # API endpoints (networks, threats, analytics, ml)
│   ├── services/              # Business logic layer
│   ├── repositories/          # Data access layer
│   ├── config/                # Configuration (DB pool, DI container)
│   ├── validation/            # Request validation schemas
│   ├── errors/                # Custom error classes
│   ├── logging/               # Winston structured logging
│   ├── utils/                 # Utility functions
│   ├── components/            # React components (TSX, ES modules)
│   ├── App.tsx                # React app router
│   ├── main.tsx               # React entry point
│   └── index.css              # Global Tailwind styles
│
├── 📁 public/                 # Static Assets & Legacy Pages
│   ├── geospatial.html        # Legacy geospatial view (to be replaced)
│   ├── networks.html          # Legacy network list
│   ├── analytics.html         # Legacy analytics
│   └── surveillance.html      # Legacy threat detection
│
├── 📁 tests/                  # Test Suite
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── api/                   # API endpoint tests
│   └── setup.js               # Jest setup
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
│   ├── INDEX.md               # Navigation guide
│   ├── architecture/          # System architecture guides
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
│   ├── vite.config.js         # Vite build configuration
│   ├── tsconfig.json          # TypeScript configuration
│   ├── jest.config.js         # Jest test configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── postcss.config.js      # PostCSS configuration
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
    ├── SECURITY.md            # Security policy
    └── PROJECT_STRUCTURE.md   # This file
```

## File Organization Rules

### ✅ DO

- Keep root directory minimal (config + docs only)
- Use descriptive directory names
- Group related files in subdirectories
- Use `.gitkeep` to preserve empty directories in git
- Document non-obvious directory purposes in README files
- Use consistent naming conventions:
  - **Backend (src/api, services, repositories)**: `camelCase.js` (CommonJS)
  - **Frontend (src/components)**: `PascalCase.tsx` (TypeScript/React)
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
- Root files: PostgreSQL dumps (`*.sql`, `*.dump`)

**Usage**:

```bash
# Create a backup
docker exec shadowcheck_postgres pg_dump -U shadowcheck_user shadowcheck_db > backups/backup-$(date +%Y%m%d).sql

# Store CSV exports
mv *.csv backups/csv/
```

### `data/` - Runtime Data Directory

**Purpose**: Application runtime data (imports, exports, temporary processing).

**Important**: Directory exists but has permission issues (owned by root from Docker volume). Needs manual fix:

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

**Location**: `src/api/`, `src/services/`, `src/repositories/`

**Pattern**: Modular, layered architecture

- **Routes** (`src/api/routes/v1/`): HTTP endpoint handlers
- **Services** (`src/services/`): Business logic
- **Repositories** (`src/repositories/`): Data access layer
- **Config** (`src/config/`): Database pool, DI container

**Example**:

```javascript
// src/api/routes/v1/networks.js
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

**Location**: `src/components/`, `src/App.tsx`, `src/main.tsx`

**Pattern**: Functional components with hooks

- **Components**: Reusable UI components (TSX)
- **App.tsx**: React Router configuration
- **main.tsx**: React entry point
- **index.css**: Global Tailwind styles

**Example**:

```typescript
// src/components/Dashboard.tsx
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

## Migration Status: Legacy → React

The project is migrating from legacy HTML/JS pages to modern React components.

**Current State**:

- ✅ React pages: Dashboard, Geospatial, Analytics, ML Training, API Test
- 🔄 Legacy pages: Still served from `public/` until feature parity
- 📦 Build: Vite bundles React app to `dist/`, served by Express

**Do NOT delete legacy pages** (`public/*.html`) until React migration is complete.

## Git Workflow

### What Gets Committed

- ✅ Source code (`src/`)
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

# Should only see config files, package.json, server.js, index.html, and docs
```

### Fix Permissions

```bash
# Fix data/ directory permissions (if using Docker volumes)
sudo chown -R $USER:$USER data/
mkdir -p data/{csv,imports,exports,analysis}
```

## Questions?

See:

- [CLAUDE.md](CLAUDE.md) - Development guidance
- [README.md](README.md) - Project overview
- [docs/INDEX.md](docs/INDEX.md) - Documentation navigation
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

---

**Last Updated**: 2025-12-19
