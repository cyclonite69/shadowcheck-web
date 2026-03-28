# Session State (Docs + Secrets Cleanup)

## Summary

- Docs cleaned and reduced to current-state set under `docs/`.
- Wiki-first policy established; wiki pages link back to docs.
- All keyring references removed; AWS Secrets Manager is the only secrets source.
- Legacy keyring scripts removed.

## Current Docs Set (kept)

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/DEPLOYMENT.md`
- `docs/CONFIG.md`
- `docs/SECRETS.md`
- `docs/FEATURES.md`
- `docs/API_REFERENCE.md`
- `docs/TESTING.md`
- `docs/CLIENT.md`
- `docs/README.md`
- `docs/WIKI_MAP.md`
- `docs/kiro/`

## Wiki-First Linking

Wiki pages updated to point back to docs:

- `.github/wiki/Home.md`
- `.github/wiki/Architecture.md`
- `.github/wiki/API-Reference.md`
- `.github/wiki/Deployment-Guide.md`
- `.github/wiki/Features.md`
- `.github/wiki/Database.md`
- `.github/wiki/Database-Schema.md`
- `.github/wiki/Development.md`
- `.github/wiki/Installation.md`
- `.github/wiki/Security.md`
- `.github/wiki/Data-Flow.md`
- `.github/wiki/Machine-Learning.md`
- `.github/wiki/Quick-Reference.md`
- `.github/wiki/Troubleshooting.md`

## Secrets Cleanup

- Keyring docs, scripts, and references removed.
- `.env.example` updated to AWS Secrets Manager only.
- `tests/unit/secretsManager.test.ts` rewritten to mock AWS Secrets Manager.
- `openapi.yaml` health schema updated (`secretsManager` field).
- `server/src/services/keyringService.ts` removed.

## Removed (Cleanup)

- Large doc subfolders: `docs/architecture`, `docs/guides`, `docs/security`, etc.
- Legacy keyring scripts and helpers.

## Pending Decision

- `dist/` still contains old compiled keyring code. Decide whether to delete `dist/` now or rebuild later.
