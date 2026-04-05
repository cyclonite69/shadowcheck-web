# ShadowCheck — Gemini CLI Project Config

---

## Project Overview

**ShadowCheckWeb** is a production-grade SIGINT (Signals Intelligence) forensics
and wireless network analysis platform. It provides real-time threat detection,
geospatial correlation via PostGIS, and interactive analysis dashboards.

**Primary Technologies:**

- React 19, Vite 7, TypeScript
- Node.js 22+, Express
- PostgreSQL 18 + PostGIS
- Redis 7.0 (session management, rate limiting, caching)
- Docker / Podman (primary container runtime — not optional)
- Mapbox GL JS, Deck.gl (spatial visualization)
- Zustand (frontend state management)

---

## Architecture

**Frontend:** Component-based UI — Zustand state, Mapbox GL JS + Deck.gl for
spatial visualization.

**Backend:** Express REST API using a Service-Query pattern. All business logic
lives in the service layer with parameterized queries only.

**Data Layer:** PostgreSQL + PostGIS for spatial data. Redis for sessions,
rate limiting, caching.

**ETL:** Modular pipeline for ingestion, transformation, and enrichment of
WiGLE, KML, and mobile scan data.

---

## Directory Structure

- `client/` — React/Vite frontend source
- `server/` — Express backend source
  - `src/api/` — REST API route definitions
  - `src/services/` — Business logic, direct SQL query integration
- `etl/` — ETL pipeline scripts and logic
- `scripts/` — DB management, geocoding, maintenance utilities
- `sql/` — Schema, migrations, PostGIS functions
  - `sql/migrations/` — Live runner path — DO NOT touch without explicit instruction
  - `sql/baseline_drafts/` — Phase 2 planning drafts — reference only
  - `sql/baseline_phase3/` — Phase 3 baseline assembly — validation complete
- `docs/` — Architecture and development documentation
- `tests/` — Integration and unit tests (Jest)
- `deploy/` — AWS, Docker, Homelab deployment configs
- `reports/` — Audit artifacts — untracked, do not auto-commit

---

## Key Files

- `server/server.ts` — Express entry point
- `client/src/App.tsx` — React entry point
- `package.json` — Dependencies and scripts
- `docs/ARCHITECTURE.md` — System architecture detail
- `docs/DEVELOPMENT.md` — Development guide
- `.env.example` — Environment variable template (NEVER touch `.env`)
- `sql/migrations/README.md` — Current migration state
- `sql/seed-migrations-tracker.sql` — Migration tracker seeding (approval required)
- `AGENTS.md` — Prior session notes — read before starting any task

---

## Building and Running

### Prerequisites

- Node.js 22+
- PostgreSQL 18+ with PostGIS
- Redis 7.0+
- Docker or Podman (required)

### Development Commands

```bash
npm install                  # Install dependencies
npm run dev                  # Full-stack dev (nodemon + Vite)
npm run dev:frontend         # Vite frontend only
npm run build                # Production build (client + server)
npm start                    # Run production server from dist/
docker-compose up -d         # Start PostgreSQL, Redis infrastructure
```

### Testing and Linting

```bash
npm test                     # All tests (Jest)
npm run test:integration     # Integration tests (requires live DB)
npm run lint                 # ESLint
npm run format               # Prettier
```

---

## Database Roles — Critical

| Role                | Purpose                                 |
| ------------------- | --------------------------------------- |
| `shadowcheck_admin` | DDL owner — use for all psql operations |
| `shadowcheck_user`  | App runtime role — limited privileges   |
| `postgres`          | Does NOT exist in this container setup  |

Always connect as `shadowcheck_admin`. Never assume a `postgres` superuser.

Live database: `shadowcheck_db` — DDL against this requires explicit approval.

---

## Development Conventions

### Modularity Philosophy

Responsibility-based modularity. One primary responsibility per module.
Coherence and logical grouping over arbitrary line limits.

### TypeScript

Mandatory for all new frontend and backend code.
Use explicit typing. Avoid `any`. No exceptions without justification.

### API Versioning

All routes use `/api/v1/` or `/api/v2/` prefixes.

### Spatial Calculations

Use PostGIS `ST_Distance` (spheroid) for all distance-based SQL logic.

### Security

- Validate all inputs with Joi or Zod
- No raw SQL string concatenation
- No secrets in code — environment variables only via `.env.example`

### Git Workflow

- Conventional Commits: `feat:` `fix:` `docs:` `test:` `chore:`
- Direct pushes to `master` are permitted for this repo — no PR requirement
- `npm test` and `npm run lint` must pass before any commit
- Never use `--force` on any git operation

---

## Hard Rules — No Exceptions

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
- Always connect as `shadowcheck_admin` — not `postgres`

### Packages

- NEVER run `npm audit fix --force`
- NEVER run `npm install <package>` without checking `package.json` first
- NEVER upgrade a package that causes a test failure without stopping and reporting

### Testing

- Run the relevant tests after every change
- A failing test is a hard stop — report it, do not work around it

---

## Approval Gates

Stop, show the plan, wait for explicit "yes" before:

1. Any `git commit`
2. Any `git push`
3. Any DDL against `shadowcheck_db`
4. Any file deletion
5. Any dependency version change
6. Any change to `sql/seed-migrations-tracker.sql`
7. Any file written to `sql/migrations/`

---

## Context Loading Order

When starting any task, read these before doing anything else:

1. `package.json` — check existing deps before suggesting new ones
2. `AGENTS.md` — prior session notes and handoff state
3. `sql/migrations/README.md` — current migration state
4. Any file explicitly referenced in the prompt via `@filepath`

---

## Verification Pattern

For every change, in this order:

1. Make the change
2. Run relevant lint: `npm run lint` or `npx eslint <filepath>`
3. Run type check: `npx tsc --noEmit`
4. Run relevant tests
5. Report PASS or the exact failure
6. Stop for approval before committing

---

## Scope Discipline

You are NOT:

- Refactoring anything not mentioned in the current prompt
- Improving adjacent code you notice while working
- Adding logging, comments, or documentation beyond what the prompt asks
- Changing code style or formatting outside the affected lines
- Making judgment calls on stashes, untracked files, or open branches
  without asking first

## Scope Discipline — Additional Rules (added after violation 2026-04-05)

- Audit prompts that say "DO NOT write any code" mean exactly that.
  Identifying a refactor opportunity in an audit does NOT grant permission
  to execute it. Report it as a finding only.
- NEVER modify GEMINI.md itself during a session. If you believe GEMINI.md
  needs updating, report what change you would make and why. Wait for
  explicit approval before touching it.
