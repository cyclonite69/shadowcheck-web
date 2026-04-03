# Repository Guidelines

## Project Structure & Module Organization

`client/` contains the React/Vite frontend, with geospatial UI under `client/src/components/geospatial/` and shared utilities under `client/src/utils/`. `server/` contains the Express API and backend services. `etl/` holds import and transformation scripts. Database assets live in `sql/`, especially `sql/migrations/`. Tests are in `tests/` and selected client utility tests also live under `client/src/utils/__tests__/`.

## Build, Test, and Development Commands

- `npm run build`: builds frontend and server output into `dist/`.
- `npm run dev`: builds the server and starts it with `nodemon`.
- `npm run dev:frontend`: runs the Vite frontend dev server.
- `npm test`: runs the Jest suite.
- `npm run test:integration`: runs integration tests when `RUN_INTEGRATION_TESTS=true`.
- `npm run lint`: runs ESLint across the repo.
- `docker compose up -d postgres redis api frontend`: starts the local stack.

## Coding Style & Naming Conventions

Use TypeScript where already established and keep code ASCII unless the file already uses Unicode. Follow the existing ESLint config in [eslint.config.js](/home/dbcooper/repos/shadowcheck-web/eslint.config.js). Prefer functional React components and keep geospatial logic in focused utilities/hooks. Use descriptive filenames with `camelCase` for utilities, `PascalCase` for React components, and timestamped snake-case SQL migration names such as `20260402_add_kml_staging_tables.sql`.

## Testing Guidelines

Jest is the primary test framework. Name tests `*.test.ts`, `*.test.tsx`, or place them in `tests/unit/` or `tests/integration/`. Add targeted tests for parsing, transformations, and query builders when changing ETL, map rendering, or explorer table behavior. Run `npm test` before pushing; use `npx jest path/to/test` for focused validation.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects, often `Fix ...` or conventional-style prefixes like `feat(ui): ...`. Keep commits scoped to one concern. PRs should state user-visible impact, list schema or migration changes, note verification steps, and include screenshots for frontend changes when relevant.

## Security & Configuration Tips

Do not commit secrets or `.env` contents. Secrets are loaded via AWS Secrets Manager or local environment configuration. Treat staging imports such as KML or Kismet as non-canonical until reconciled with core observation data.
