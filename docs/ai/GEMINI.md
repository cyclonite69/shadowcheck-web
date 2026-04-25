# GEMINI.md — Session Primer

Gemini CLI does not auto-read context files. Paste this entire file at the start of each session.

---

## Project

**ShadowCheck** — SIGINT forensics platform for wireless network threat detection. Analyzes WiFi, Bluetooth, and cellular observations to identify surveillance devices.

**Stack**: Node.js 22 + Express (CommonJS backend), React 19 + Vite (ES module frontend), PostgreSQL 18 + PostGIS 3.6, Redis, Docker, AWS EC2/SSM, TypeScript throughout.

**Network types**: `W` (WiFi), `E` (BLE), `B` (Bluetooth), `L` (LTE), `N` (5G NR), `G` (GSM)

---

## Context to Load First

Before doing anything, read:

1. `package.json` — check existing deps before suggesting new ones
2. `docs/ai/sessions/ACTIVE.md` — active workstreams; do not touch in-progress areas
3. `sql/migrations/README.md` — current migration state
4. `docs/schema/observations-sources.md` — before any query touching observation/wigle data
5. `docs/ai/decisions/` — scan ADRs before any architectural decision
6. Any file explicitly referenced in the user's prompt

---

## Repo Layout

```
server/
  server.ts                     # Express entry point
  src/api/routes/v1/            # HTTP endpoints
  src/services/                 # Business logic
  src/repositories/             # SQL (only here)
  src/config/database.js        # query() — read-only pool
  src/services/adminDbService.js # Write pool (admin only)

client/
  src/App.tsx                   # React Router
  src/components/               # Page components
  src/stores/filterStore.ts     # Zustand universal filter state
  src/hooks/useAdaptedFilters.ts
  src/utils/wigle.ts
  src/api/wigleApi.ts

sql/migrations/                 # Live — DO NOT edit without explicit approval
docs/schema/                    # Table reference docs (read before querying)
docs/ai/decisions/              # ADRs
docs/ai/sessions/ACTIVE.md      # Active workstreams
```

---

## Hard Rules — No Exceptions

**Secrets**: Never write to disk. AWS Secrets Manager (`shadowcheck/config`) is the source of truth.

**EC2 access**: SSM only. Instance `i-06380d0c9c99f6124`, profile `shadowcheck`. Never SSH, never port 22.

**DB access via SSM**:

```bash
DB_PASS=$(aws secretsmanager get-secret-value --secret-id shadowcheck/config \
  --region us-east-1 --query SecretString --output text | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['db_admin_password'])")
docker exec -e PGPASSWORD=$DB_PASS shadowcheck_postgres psql \
  -U shadowcheck_admin -d shadowcheck_db -c "<SQL HERE>"
```

**DB roles**:

- `shadowcheck_admin` — DDL and writes
- `shadowcheck_user` — app read-only
- `postgres` — does NOT exist in this setup

**Module systems**: Backend = CommonJS. Frontend = ES modules. Never mix.

**SQL**: Only in repositories. Never in routes or services. Parameterized queries only — no string concatenation.

**Migrations**: Never edit `sql/migrations/` without explicit approval from user. Always use `-v ON_ERROR_STOP=1`.

**Dependencies**: Pinned to exact versions. Check `package.json` before suggesting any new dep.

**Git**:

- Never commit without showing diff + message first
- Never push without explicit approval
- Never `--force` any git operation

---

## Verification Pattern (every change)

1. Make the change
2. `npm run lint` or `npx eslint <filepath>`
3. `npx tsc --noEmit`
4. Run relevant tests: `npx jest tests/unit/<file>.test.ts --runInBand`
5. Report PASS or the exact failure
6. Stop for approval before committing

---

## Key Architecture Decisions (read ADRs for full context)

- `docs/ai/decisions/20260425_server_side_observation_aggregation.md` — WiGLE map uses server-side ST_SnapToGrid aggregation across 4 source tables; client receives a single GeoJSON FeatureCollection (cluster:false). Do not re-litigate this.
- `docs/ai/decisions/20260413_v3-tooltip-skipped.md` — v3 tooltip skipped in current phase.
- `docs/ai/decisions/20260413_vite8-cjs-esm-fix.md` — Vite 8 CJS/ESM boundary fix.

---

## Active Work

See `docs/ai/sessions/ACTIVE.md` for current workstreams and files in-flight. Do not touch anything listed as IN PROGRESS.

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
