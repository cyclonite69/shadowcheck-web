# Modularization Plan (Lightweight, Minimal Moves)

## Goals

- Clarify client vs server boundaries.
- Reduce accidental cross-imports.
- Keep existing scripts functional during transition.

## Phase 0: Documentation (Now)

- Keep `docs/naming-conventions.md` updated.
- Add “client/server boundary” note to onboarding docs.

## Phase 1: Soft Boundaries (No Moves)

- Add lint rule (or custom check) to block `client/` imports from `server/src/api`, `server/src/services`, `server/src/repositories`, `server/src/middleware`, `server/src/validation`.
- Use `npm run lint:boundaries` for the boundary check.
- Prefer import aliases (e.g., `@client/*`, `@server/*`) to make boundaries obvious.

## Phase 2: Minimal Folder Split (Implemented)

- `client/`: `index.html`, `client/public/`, `client/src/`, `client/vite.config.js`, `client/postcss.config.js`, `client/tailwind.config.js`
- `server/`: `server/server.js`, `server/static-server.js`, `server/src/api/`, `server/src/services/`, `server/src/repositories/`, `server/src/middleware/`, `server/src/validation/`
- Scripts now use `--config client/vite.config.js` and `server/server.js`.

## Phase 3: Cleanup (Optional)

- Add `server/README.md` and `client/README.md` with entry points.
- Remove duplicate config confusion (single authoritative configs under `client/`).

## Risks / Notes

- Biggest risk is accidental import from server code into client.
- Keep client/server boundaries enforced with `npm run lint:boundaries`.
