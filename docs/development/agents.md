# Repository Guidelines

## Project Structure & Module Organization

- Monorepo with Express backend (`server/`) and React/Vite frontend (`client/`).
- Backend: `server/src/api/routes/v1/` (Express routes), `server/src/services/` (business logic), `server/src/repositories/` (Postgres access), `server/src/middleware/`, `server/src/config/`.
- Frontend: `client/src/components/`, `client/src/App.tsx`, `client/src/main.tsx`, styles in `client/src/index.css` and `client/src/unified.css`.
- Data and ops: SQL migrations in `sql/`, utility scripts in `scripts/`, docs in `docs/`, Jest tests in `tests/`, Docker entrypoints in `docker-compose*.yml` and `Dockerfile`.

## Build, Test, and Development Commands

- `npm install` – install dependencies (Node 20+).
- `npm run dev` – start Express API on port 3001.
- `npm run dev:frontend` – start Vite dev server on port 5173; proxies `/api` to backend.
- `npm run build` – build React app to `dist/`; served by Express in production.
- `npm start` – serve built frontend + API.
- `npm run test` / `npm run test:watch` – run Jest suite; `npm run test:integration` targets integration patterns.
- `npm run test:cov` – enable coverage (thresholds 70%+ defined in `jest.config.js`).
- `npm run lint` / `npm run lint:fix` – ESLint checks and autofix for JS; `npm run format:check` / `npm run format` for Prettier.
- Docker helpers: `npm run docker:build`, `npm run docker:up`, `npm run docker:down`; database bootstrap via `npm run db:migrate` (psql).

## Coding Style & Naming Conventions

- ESLint enforced for JS (see `.eslintrc.json`): 2-space indent, single quotes, semicolons, Unix line endings, brace-required blocks, `eqeqeq`, `prefer-const`, no trailing spaces.
- Prettier (`.prettierrc.json`) formats JS/JSON/MD/YAML; `printWidth` 100, trailing commas (ES5), arrow parens always.
- Tests and configs may be CommonJS; TS/TSX frontend is formatted via Prettier (ESLint ignores it).
- Name tests `*.test.js`; keep module filenames descriptive (`networkRepository.js`, `ThreatChart.tsx`).

## Testing Guidelines

- Framework: Jest (Node environment), auto-mocking enabled, timeouts 10s.
- Test locations: `tests/**/*.test.js`, `__tests__`, or `*.spec.js`; keep fixtures outside coverage paths.
- Target coverage 70%+ when running `npm run test:cov`; reviewers expect coverage reports for new subsystems.
- Use Supertest for API routes and seed DB via `sql/migrations` snippets or lightweight fakes; prefer deterministic data over live services.

## Commit & Pull Request Guidelines

- Commit messages follow short, present-tense, imperative lines (e.g., `Add threat tagging API`, `Fix ML trainer counts`).
- Reference issues in body when applicable; group related changes per commit.
- Before PR: run `npm run lint`, `npm run test`, and include coverage or manual test notes; add screenshots/GIFs for UI changes.
- PR description should state scope, risks, rollout steps (DB migrations, env vars), and any follow-ups; link docs or specs (e.g., `GEOSPATIAL_EXPLORER_SPEC.md`) when relevant.

## Security & Configuration Tips

- Copy `.env.example` to `.env`; never commit secrets. Key vars: `DB_*`, `PORT`.
- PostgreSQL + PostGIS required; local dev assumes user `shadowcheck` (see README setup).
- Use `docker-compose.dev.yml` for isolated stacks; `docker-compose logs -f api` aids backend debugging.
- Husky/lint-staged run ESLint/Prettier on staged files—keep them enabled to prevent regressions.
