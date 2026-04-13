# AGENTS.md — Repository Guidelines

Prior session notes and handoff state. Claude Code reads this at the start of every task.

---

## Project Structure

- `client/` — React 19/Vite frontend (ES modules, TypeScript)
- `server/` — Express API backend (CommonJS, TypeScript)
  - `src/api/` — Route definitions
  - `src/services/` — Business logic and SQL integration
  - `src/repositories/` — Data access layer
- `etl/` — Ingestion, transformation, enrichment pipeline
- `sql/` — Schema and migrations
  - `sql/migrations/` — **Live runner path — DO NOT touch without explicit instruction**
  - `sql/baseline_drafts/` — Phase 2 planning — reference only
  - `sql/baseline_phase3/` — Phase 3 baseline — validation complete
- `tests/` — Jest unit and integration tests
- `client/src/utils/__tests__/` — Client utility tests
- `deploy/` — AWS, Docker, Homelab configs
- `reports/` — Audit artifacts — untracked, do not auto-commit
- `docs/` — Architecture and development documentation

---

## Build & Dev Commands

```bash
npm run build                        # Frontend + server → dist/
npm run dev                          # Nodemon backend (port 3001)
npm run dev:frontend                 # Vite dev server (port 5173)
npm test                             # Jest suite
npm run test:integration             # Requires RUN_INTEGRATION_TESTS=true + live DB
npm run lint                         # ESLint
npm run lint:fix                     # Auto-fix
npm run lint:boundaries              # Verify no client→server imports
docker compose up -d postgres redis api frontend
```

---

## Coding Conventions

- TypeScript mandatory for all new frontend and backend code
- Explicit typing; avoid `any` without justification
- `camelCase` for utilities, `PascalCase` for React components
- SQL migrations: `YYYYMMDD_description.sql`
- Conventional commits: `feat:` `fix:` `docs:` `test:` `chore:` `refactor:`
- All dependencies pinned to exact versions (no `^` or `~`)
- `npm test` and `npm run lint` must pass before any commit
- NEVER use `--force` on any git operation

---

## Database Roles

| Role                | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `shadowcheck_admin` | DDL owner — use for all psql operations      |
| `shadowcheck_user`  | App runtime role — read-only, limited access |
| `postgres`          | Does NOT exist in this container setup       |

Use `-v ON_ERROR_STOP=1` on every psql execution.
Live DB DDL requires explicit approval — stop and ask first.

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

---

## Session Notes

_(Append handoff notes here at the end of each session before closing.)_
