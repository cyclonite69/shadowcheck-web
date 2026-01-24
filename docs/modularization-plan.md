# Modularization Plan (Lightweight, No Code Moves)

## Goals

- Clarify client vs server boundaries.
- Reduce accidental cross-imports.
- Keep existing scripts functional during transition.

## Phase 0: Documentation (Now)

- Keep `docs/naming-conventions.md` updated.
- Add “client/server boundary” note to onboarding docs.

## Phase 1: Soft Boundaries (No Moves)

- Add lint rule (or custom check) to block `src/` client imports from `src/api`, `src/services`, `src/repositories`, `src/middleware`, `src/validation`.
- Use `npm run lint:boundaries` for the boundary check.
- Prefer import aliases (e.g., `@client/*`, `@server/*`) to make boundaries obvious.

## Phase 2: Minimal Folder Split (Optional)

- Create `client/` and `server/` folders.
- Move without changing runtime behavior:
  - `client/`: `index.html`, `public/`, `src/`, `vite.config.js`, `postcss.config.js`, `tailwind.config.js`
  - `server/`: `server.js`, `server/` (static server), `src/api/`, `src/services/`, `src/repositories/`, `src/middleware/`, `src/validation/`
- Update scripts:
  - `dev:frontend`: `vite --root client`
  - `build`: `vite build --root client`
  - `preview`: `vite preview --root client`
  - `dev`: `nodemon server/server.js` (or `nodemon server.js` if you keep it at root)

## Phase 3: Cleanup (Optional)

- Add `server/README.md` and `client/README.md` with entry points.
- Remove duplicate config confusion (single authoritative configs under `client/`).

## Risks / Notes

- Biggest risk is accidental import from server code into client.
- Avoid moving runtime files unless you plan to update scripts in the same PR.
