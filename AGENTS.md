# Repository Guidelines

## Project Structure & Modules
- `server.js` + `src/api/` hold Express routes (v1 legacy + v2 explorer) and DB access; keep shared logic in `src/services/` and `src/repositories/`.
- Frontend lives in `src/` (React/Vite entry `src/main.tsx`, routing in `src/App.tsx`); legacy HTML stays in `public/` until parity—do not delete.
- Data pipelines sit in `etl/` (modular load/transform/promote SQL) and `sql/migrations/` (canonical order documented in `sql/migrations/README.md`); keep staging tables UNLOGGED.
- Docs live under `docs/`; prefer updating Markdown there instead of scattering new files in root.

## Build, Test, and Development Commands
- Install: `npm install` (Node 20+ required).
- Backend dev: `npm run dev` (nodemon on port 3001, reads `.env`).
- Frontend dev: `npm run dev:frontend` (Vite dev server), build: `npm run build`, preview: `npm run preview`.
- Tests: `npm test` (Jest), coverage: `npm run test:cov`; lint/format: `npm run lint`, `npm run format:check`.
- Docker helpers: `npm run docker:up` / `npm run docker:down`; migrations: run the ordered files from `sql/migrations/README.md` with `psql`.

## Coding Style & Naming Conventions
- TypeScript/React: components in PascalCase (`ComponentName.tsx`); hooks/utilities camelCase; avoid default exports for shared utilities.
- Indentation 2 spaces; prefer const/let, async/await, and early returns over deeply nested logic.
- Keep UI tokens consistent with the dark dashboard theme (`bg-slate-*`, gradients) and preserve draggable/resizable card patterns.
- Use `.env`/keyring for secrets; never hardcode credentials, tokens, or connection strings.

## Testing Guidelines
- Add Jest tests for new routes/services; place API/integration tests in `tests/` with descriptive filenames (`*.integration.test.ts`).
- For SQL changes, include a reversible migration and, when possible, a lightweight verification query in PR notes (row counts, index presence).
- Manual steps (e.g., Vite page smoke test, API 200/500 handling) should be noted in PR description until automated.

## Commit & Pull Request Guidelines
- Small, topic-focused commits with imperative subjects (`Add geospatial timeline`, `Fix explorer v2 paging`); reference issue IDs when applicable.
- Ensure pre-commit passes (secret scan + eslint + prettier via husky). No TODO/debug logs in committed code.
- PRs should describe schema changes, migration order, and any legacy HTML impact; include screenshots for UI work and timing/row-count notes for ETL changes.

## Security & Secrets
- `.env` is gitignored; keep DB/API keys there or in keytar. Validate that new files respect `.gitignore` before committing.
- Review `secrets/` and `config/` additions carefully; never commit generated keys or CSV exports. If in doubt, sanitize or move to `backups/` (also gitignored).

## Database & ETL Notes
- Apply migrations in the documented sequence (`sql/migrations/README.md`) to avoid conflicting schemas; do not mix deprecated legacy migrations back in.
- Keep staging tables disposable; build indexes after bulk inserts; prefer idempotent transform scripts in `etl/03_transform/` and materialized-view refresh steps in `etl/05_indexes/`.
