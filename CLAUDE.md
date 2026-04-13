# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.
Extended guidance: `docs/ai/CLAUDE.md` and `.github/copilot-instructions.md`.

---

## Context Loading Order

Read these before doing anything else on any task:

1. `package.json` — check existing deps before suggesting new ones
2. `AGENTS.md` — prior session notes and handoff state
3. `sql/migrations/README.md` — current migration state
4. Any file explicitly referenced in the prompt via `@filepath`

---

## Project Overview

ShadowCheck is a SIGINT forensics platform for wireless network threat detection.
It analyzes WiFi, Bluetooth, and cellular observations to identify surveillance
devices using PostgreSQL 18 + PostGIS 3.6 for geospatial analysis.

Network types: `W` (WiFi), `E` (BLE), `B` (Bluetooth), `L` (LTE), `N` (5G NR), `G` (GSM)

---

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

# Linting — run before all commits
npm run lint                         # Check ESLint issues
npm run lint:fix                     # Auto-fix issues
npm run lint:boundaries              # Verify no client→server imports

# Database (Docker only)
docker ps | grep shadowcheck_postgres
docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck_db    # Read
docker exec -it shadowcheck_postgres psql -U shadowcheck_admin -d shadowcheck_db   # Write

# ETL pipeline
node etl/run-pipeline.js             # Full import pipeline

# Local stack
docker compose up -d postgres redis api frontend
```

---

## Architecture

**Monorepo**: `server/` (Node.js/Express, CommonJS) + `client/` (React 19/Vite, ES modules).

**CRITICAL**: Backend uses CommonJS (`require`/`module.exports`). Frontend uses ES
modules (`import`/`export`). Never mix them.

**CRITICAL**: PostgreSQL runs in Docker container `shadowcheck_postgres` only. Never
use local system PostgreSQL.

### Backend three-tier pattern

```
Routes (server/src/api/routes/)       → validate input, extract params
  └── Services (server/src/services/) → business logic, threat scoring
        └── Repositories (server/src/repositories/) → SQL execution
```

SQL never appears in route handlers. Services are tested without HTTP context.
Repositories can be mocked in tests.

### Key backend files

- `server/server.ts` — Express entry point; all routes mounted here
- `server/src/config/database.js` — `query()` function (read-only `shadowcheck_user`)
- `server/src/services/adminDbService.js` — Write operations (`shadowcheck_admin`)
- `server/src/errors/AppError.js` — Consistent error responses

### Key frontend files

- `client/src/App.tsx` — React Router setup
- `client/src/stores/filterStore.ts` — Zustand universal filter state (URL-synced, page-scoped)
- `client/src/hooks/useAdaptedFilters.ts` — Use this instead of creating new filter state
- `client/src/constants/network.ts` — `MAP_STYLES`, `NETWORK_TYPE_CONFIG`, column definitions
- `client/src/utils/geospatial/renderNetworkTooltip.ts` — Shared map tooltip (all three map pages)

### Database user separation (enforced at DB role level)

```javascript
// Read (default)
const { query } = require('../config/database');
await query('SELECT * FROM app.networks WHERE bssid = $1', [bssid]);

// Write (admin only)
const adminDb = require('../services/adminDbService');
await adminDb.query('INSERT INTO app.network_tags ...', params);
```

Key tables: `app.networks`, `app.observations`, `app.location_markers`, `app.network_tags`

### Universal filter system

`filterStore.ts` + `useAdaptedFilters()` powers filtering across Dashboard, Geospatial,
Kepler, and WiGLE pages. Filters are URL-synced and page-scoped via `getPageCapabilities()`.
Backend converts filters to SQL via `server/src/services/filterQueryBuilder/`.

### Map pages

- **GeospatialExplorer** — Mapbox GL JS, custom observation layers, network context menus
- **KeplerPage** — deck.gl ScatterplotLayer/HeatmapLayer for 100K+ point datasets; **no default pagination limits**
- **WiglePage** — Mapbox GL JS with WiGLE API v2 search / v3 detail integration

### Threat scoring

Networks scored on: seen at home AND away (+40 pts), distance range >200m (+25 pts),
multiple days (+5–15 pts), observation count (+5–10 pts). Threshold: ≥40 points = threat.

---

## Verification Pattern

For every change, in this exact order:

1. Make the change
2. `npm run lint` or `npx eslint <filepath>`
3. `npx tsc --noEmit`
4. Run relevant tests
5. Report PASS or the exact failure output
6. **Stop for approval before committing**

A failing test or lint error is a hard stop. Do not work around it — report it.

---

## Approval Gates

Stop, show the plan, and wait for explicit "yes" before:

1. Any `git commit`
2. Any `git push`
3. Any DDL against `shadowcheck_db`
4. Any file deletion
5. Any dependency version change
6. Any change to `sql/seed-migrations-tracker.sql`
7. Any file written to `sql/migrations/`

---

## Hard Rules — No Exceptions

### Secrets

- NEVER write secrets to disk
- AWS Secrets Manager is the source of truth
- For local dev: inject as environment variables at runtime only (`export DB_PASSWORD=...`)
- NEVER create `.env` files — only `.env.example`

### EC2 Access

- Instances have no public ingress ports
- Access ONLY via AWS SSM Session Manager (`aws ssm start-session --target i-...`)
- NEVER open port 22 or create 0.0.0.0/0 inbound rules

### File System

- NEVER write to `sql/migrations/` without explicit instruction
- NEVER modify `sql/seed-migrations-tracker.sql` without explicit instruction
- NEVER modify `docker-compose.yml` or any `Dockerfile` without explicit instruction
- NEVER modify `.env` — only `.env.example`
- NEVER auto-commit files in `reports/` — ask first
- All new files go to the path explicitly stated in the prompt

### Git

- NEVER run `git push` without explicit approval in the current prompt
- NEVER run `git commit` without showing the exact diff and message first
- NEVER run `git stash pop` or `git stash drop` without listing contents first
- NEVER use `--force` on any git operation

### Database

- NEVER run DDL against `shadowcheck_db` without explicit approval
- Always use `-v ON_ERROR_STOP=1` on every psql execution
- Always connect as `shadowcheck_admin` — not `postgres` (does not exist in this setup)

### Packages

- All dependencies in `package.json` MUST be pinned to exact versions (no `^` or `~`)
- Dependencies MUST be upgraded one at a time — test and verify each before touching another
- NEVER run `npm audit fix --force`
- NEVER run `npm install <package>` without checking `package.json` first
- NEVER upgrade a package that causes a test failure without stopping and reporting

### Kepler endpoints

- No default pagination limits on `/api/kepler/data`, `/api/kepler/observations`, `/api/kepler/networks`
- Use timeouts (120s) instead of caps

### Tailwind CSS

- Uses `@tailwindcss/postcss` plugin (NOT `tailwindcss`)
- Dark-only theme (slate-950 primary)
- Use Tailwind utilities instead of inline `style={{}}` for colors and spacing

### Import boundaries

- Frontend never imports from `server/`
- Use API calls instead
- Verify with `npm run lint:boundaries`

---

## Scope Discipline

You are NOT:

- Refactoring anything not mentioned in the current prompt
- Improving adjacent code you notice while working
- Adding logging, comments, or documentation beyond what the prompt asks
- Changing code style or formatting outside the affected lines
- Making judgment calls on stashes, untracked files, or open branches without asking

**Audit prompts that say "DO NOT write any code" mean exactly that.** Identifying
a refactor opportunity during an audit does NOT grant permission to execute it.
Report it as a finding only.

**NEVER modify CLAUDE.md itself during a session.** If you believe CLAUDE.md needs
updating, report what change you would make and why. Wait for explicit approval.

---

## Naming & Conventions

- Utility files: `camelCase`; React components: `PascalCase`
- SQL migrations: `YYYYMMDD_description.sql`
- Conventional commits: `feat(...)`, `fix(...)`, `refactor(...)`, `docs(...)`, `test(...)`, `chore(...)`
- Run `npm run lint:fix` before every commit
- Validate all inputs with Joi or Zod; no raw SQL string concatenation

---

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
