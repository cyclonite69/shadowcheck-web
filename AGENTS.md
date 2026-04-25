# AGENTS.md — Codex Guidelines

This file is read automatically by Codex at session start.

---

## Context Loading Order

Read these before doing anything else on any task:

1. `package.json` — check existing deps before suggesting new ones
2. `docs/ai/sessions/ACTIVE.md` — check active workstreams; do not touch in-progress areas
3. `sql/migrations/README.md` — current migration state
4. `docs/schema/observations-sources.md` — before any query touching observation/wigle data
5. `docs/ai/decisions/` — scan ADRs before any architectural decision

---

## Project Overview

ShadowCheck is a SIGINT forensics platform for wireless network threat detection.
It analyzes WiFi, Bluetooth, and cellular observations to identify surveillance devices.

**Stack**: Node.js 22 + Express (CommonJS), React 19 + Vite (ES modules), PostgreSQL 18 + PostGIS 3.6, Redis, Docker, AWS EC2/SSM, TypeScript throughout.

**Network types**: `W` (WiFi), `E` (BLE), `B` (Bluetooth), `L` (LTE), `N` (5G NR), `G` (GSM)

---

## Project Structure

- `client/` — React 19/Vite frontend (ES modules, TypeScript)
- `server/` — Express API backend (CommonJS, TypeScript)
  - `src/api/routes/v1/` — Route definitions; sub-routers under `admin/`, `wigle/`, etc.
  - `src/services/` — Business logic
  - `src/repositories/` — Data access layer (SQL here only)
- `etl/` — Import, transform, enrichment pipeline
- `sql/migrations/` — **Live runner path — DO NOT touch without explicit instruction**
- `tests/` — Jest unit and integration tests
- `docs/ai/decisions/` — Architecture Decision Records
- `docs/schema/` — Table/column reference docs (read before writing queries)

---

## Build & Dev Commands

```bash
npm run build                 # Frontend + server → dist/
npm run dev                   # Nodemon backend (port 3001)
npm run dev:frontend          # Vite dev server (port 5173)
npm test                      # Jest suite
npm run test:cov              # With coverage (70% threshold)
npm run lint                  # ESLint
npm run lint:fix              # Auto-fix
npm run lint:boundaries       # Verify no client→server imports
```

---

## Architecture

**Backend three-tier**: Routes validate → Services hold logic → Repositories hold SQL. SQL never appears in route handlers.

**CRITICAL — module systems**:

- Backend: CommonJS (`require`/`module.exports`)
- Frontend: ES modules (`import`/`export`)
- Never mix them

**Database user separation**:

```javascript
// Read (default)
const { query } = require('../config/database');
// Write (admin only)
const adminDb = require('../services/adminDbService');
```

**Admin route prefix**: All import sub-routes live under `/admin/` prefix (e.g., `/api/admin/import-history`). The adminRoutes router is mounted at `app.use('/api', adminRoutes)` — sub-route paths must include `/admin/`.

---

## Codex-Specific Constraints

**No `sed` on EC2**: Use proper file editors, not sed/awk/echo pipelines. Patches to running files on EC2 have caused data loss.

**No dist patches**: Never edit files in `dist/` directly. Always rebuild from source via `scs_rebuild.sh`.

**EC2 access**: SSM only — instance `i-06380d0c9c99f6124`, profile `shadowcheck`. Secrets from `shadowcheck/config` in Secrets Manager. Never open port 22.

**Approved shell patterns**:

```bash
# DB access via SSM — never write password to disk
DB_PASS=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config \
  --region us-east-1 --query SecretString --output text | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['db_admin_password'])")
docker exec -e PGPASSWORD=$DB_PASS shadowcheck_postgres psql \
  -U shadowcheck_admin -d shadowcheck_db -c "<SQL>"

# Rebuild EC2 backend
cd /home/ssm-user/shadowcheck && ./scs_rebuild.sh
```

---

## Database Roles

| Role                | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `shadowcheck_admin` | DDL owner — use for all psql operations via SSM |
| `shadowcheck_user`  | App runtime — read-only, limited access         |
| `postgres`          | Does NOT exist in this container setup          |

Always use `-v ON_ERROR_STOP=1` on every psql execution.

---

## Security

- NEVER write secrets to disk
- NEVER commit `.env` contents — only `.env.example`
- No raw SQL string concatenation — parameterized queries only
- Validate all inputs with Joi or Zod

---

## Git Gates

NEVER without explicit approval in the current prompt:

- `git commit` — show exact diff and message first
- `git push` — requires explicit "yes"
- `git stash pop` / `git stash drop` — list contents first
- `--force` on any git operation — never

---

## Verification Pattern

For every change, in this exact order:

1. Make the change
2. `npm run lint` or `npx eslint <filepath>`
3. `npx tsc --noEmit`
4. Run relevant tests
5. Report PASS or the exact failure output
6. Stop for approval before committing

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
