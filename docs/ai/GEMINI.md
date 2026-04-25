# GEMINI.md — Session Primer

Gemini CLI does not auto-read context files. Paste this entire file at the start of each session.

---

## Project

**ShadowCheck** — SIGINT forensics platform.
**Stack**: Node.js 22, Express (CJS), React 19, Vite (ESM), PostgreSQL 18/PostGIS, Redis.

---

## Context Loading (Read in this order)

1. Root `GEMINI.md` — foundational project rules & mandates.
2. `package.json` — check existing deps before suggesting new ones.
3. `docs/ai/sessions/ACTIVE.md` — active workstreams; do not touch in-progress areas.
4. `sql/migrations/README.md` — current migration state.
5. `docs/schema/observations-sources.md` — before querying spatial data.
6. `docs/ai/decisions/` — scan ADRs before any architectural decision.
7. Any file explicitly referenced in the user's prompt.

---

## Hard Rules — No Exceptions

- **Secrets**: Never write to disk. Use AWS Secrets Manager.
- **EC2 access**: SSM only. Never SSH.
- **Module systems**: Backend = CommonJS. Frontend = ES modules. Never mix.
- **SQL**: Only in `server/src/repositories/`. Never in routes/services. Parameterized queries only.
- **Migrations**: Never edit `sql/migrations/` without explicit approval. Use `-v ON_ERROR_STOP=1`.

---

## Verification Pattern

1. Make the change.
2. `npm run lint` or `npx eslint <filepath>`.
3. `npx tsc --noEmit`.
4. Run relevant tests: `npx jest tests/unit/<file>.test.ts --runInBand`.
5. Report PASS or the exact failure.
6. Stop for approval before committing.

---

## Standards

### Every new endpoint requires:

1. Entry in `client/src/config/apiTestEndpoints.ts`
2. JSDoc comment on the route handler
3. If it touches DB schema: a note in the relevant `docs/schema/` file

### Every new DB query requires:

- JSDoc on the query builder function
- If schema changes: update `docs/schema/` before the PR

These are non-negotiable. Do not commit a new route without all three.
