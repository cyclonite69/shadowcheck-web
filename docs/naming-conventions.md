# Naming Conventions

## Frontend (React)

- Components: PascalCase files and symbols (e.g., `NetworkExplorerSection.tsx`).
- Hooks/utilities: camelCase (e.g., `useNetworkSort`, `formatDate`).
- Files: match export name where possible; avoid default exports for shared utilities.

## Backend (Express)

- Routes/URLs: kebab-case (e.g., `/api/network-tags`, `/api/network-notes`).
  - Rationale: matches existing URL strings in the UI and is consistent for REST paths.
- Handlers/services/repositories: camelCase in code (e.g., `getNetworkTags`, `networkRepository`).

## Imports & Boundaries

- Client code must not import from server/runtime files.
- Server code must not import from client bundles.
- Shared types/utilities live under `src/types`, `src/utils`, or `src/services` and should be import-safe.

## Files & Paths

- React entry: `src/main.tsx`; app routing in `src/App.tsx`.
- API routes live in `src/api/`; keep new routes there.
