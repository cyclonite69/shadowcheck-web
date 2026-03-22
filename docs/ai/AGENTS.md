# Repository Guidelines

## Project Structure & Module Organization

- `client/src/` is the React 18 + TypeScript frontend. Routing lives in `client/src/App.tsx`; page and feature UI is mainly under `client/src/components/`, with heavier map work in `client/src/components/geospatial/`, `client/src/components/kepler/`, and `client/src/components/wigle/`.
- `client/src/api/`, `client/src/hooks/`, `client/src/stores/`, `client/src/constants/`, and `client/src/utils/` contain the frontend data, state, and shared behavior layers. There are also feature folders such as `client/src/directions/` and `client/src/weather/`.
- `server/src/` is the Express API. Routes live under `server/src/api/routes/`, business logic under `server/src/services/`, data access under `server/src/repositories/`, validation under `server/src/validation/`, and shared infra under `server/src/config/`, `server/src/middleware/`, and `server/src/logging/`.
- `server/src/services/filterQueryBuilder/` contains the v2 filtered explorer query stack. `server/src/services/admin/`, `analytics/`, `geocoding/`, `ml/`, and `reports/` are active service areas.
- `etl/` contains import, transform, and promote pipeline code.
- `sql/` contains migrations, functions, and schema-related assets. Archived migrations may also exist under `sql/migrations/_archived/`.
- `docs/`, `deploy/`, `docker/`, and `config/` hold operational and deployment material. `dist/` is the production build output.
- Tests live in `tests/` and in colocated `__tests__` directories under `client/src/`.

## Build, Test, and Development Commands

```bash
# Core development
npm run dev             # Build server TS and run compiled backend with nodemon
npm run dev:frontend    # Vite dev server using client/vite.config.ts
npm run build           # Build frontend and server
npm run build:frontend  # Build client into dist/
npm run build:server    # Compile server TypeScript
npm start               # Run compiled server from dist/server/server/server.js
```

```bash
# Docker / runtime
docker-compose up -d --build api
docker ps | grep shadowcheck_postgres
npm run docker:build
npm run docker:up
npm run docker:down
npm run docker:logs
```

```bash
# Tests
npm test
npm run test:watch
npm run test:cov
npm run test:integration
npm run test:certification
```

```bash
# Lint / policy
npm run lint
npm run lint:fix
npm run lint:boundaries
npm run policy:secrets
npm run format:check
```

## Runtime and Infrastructure Notes

- PostgreSQL is expected to run in Docker as `shadowcheck_postgres`. Do not target a local system PostgreSQL instance when working on this repo.
- The app uses Dockerized PostgreSQL/PostGIS and expects the container/networked database to be the source of truth during normal development and debugging.
- Frontend builds are served from `dist/`. If browser behavior does not match recent code, verify the actual deployed bundle rather than assuming the browser is current.
- Secrets are primarily loaded from AWS Secrets Manager (`shadowcheck/config`), with local file / environment fallbacks in the app. When debugging live credentials, align with the repo’s AWS SM workflow rather than assuming `.env` is authoritative.

## Coding Style & Naming Conventions

- TypeScript is the default across client, server, and ETL. Use `*.ts` / `*.tsx` consistently.
- Run `npm run lint` on changed areas before finishing. Use `npm run format` sparingly because it can reformat unrelated files; prefer focused edits.
- Follow existing naming patterns: React components use `PascalCase`; functions, hooks, and variables use `camelCase`; constants use `UPPER_SNAKE_CASE` when the file already follows that style.
- Preserve the current architectural split: route handlers stay thin, services hold behavior, repositories or DB helpers hold query logic, and frontend state/query helpers stay out of presentation components when the repo already has a separate layer.

## Testing Guidelines

- Jest is the test runner. Add tests in `tests/` or next to the feature in `client/src/**/__tests__/`.
- Keep coverage in mind when changing core logic; `npm run test:cov` enforces the repo threshold.
- For filtered explorer, map/geospatial, or auth work, prefer verifying the targeted build command as a minimum even if a full test suite is not practical.

## Database and SQL Guidance

- Treat `sql/` as part of the product surface, not a dumping ground. If a table/function/view is no longer part of the intended system, remove it from the consolidated migration path instead of preserving dead creation logic for fresh installs.
- Keep live/manual cleanup and migration-path cleanup conceptually separate: the repo should represent the desired end state, not temporary cruft.
- Follow `sql/migrations/README.md` and the existing migration ordering conventions before adding or folding SQL changes.

## Commit & Pull Request Guidelines

- Use Conventional Commits such as `feat(...)`, `fix(...)`, `refactor(...)`, and `docs(...)`.
- Keep commits scoped to a coherent change. Avoid mixing frontend, backend, SQL, and docs churn unless they are part of one tightly-coupled fix.
- PRs should include behavior summary, validation performed, and docs updates when the workflow or operational assumptions changed.

## Security & Configuration Tips

- Use `.env.example` as a local reference, but do not assume it is the only source of config in active environments.
- Required secrets commonly include DB credentials and `mapbox_token`; AWS Secrets Manager is the normal source in deployed environments.
- Use admin DB access only for write paths or operational tasks; regular query paths should stay on the lower-privilege app user.
- See `SECURITY.md`, `CONTRIBUTING.md`, and deployment material under `deploy/` / `docker/` for environment-specific practices.
