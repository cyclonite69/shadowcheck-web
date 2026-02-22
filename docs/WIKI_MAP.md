# Docs ↔ Wiki Map

The wiki lives in `.github/wiki/` and is the primary source for diagram-heavy pages.
Use this map to avoid duplicating content and to decide when docs should link to the wiki.

## Canonical Wiki Pages
- `Home.md` → `.github/wiki/Home.md`
- `Architecture.md` → `.github/wiki/Architecture.md`
- `Data-Flow.md` → `.github/wiki/Data-Flow.md`
- `Deployment-Guide.md` → `.github/wiki/Deployment-Guide.md`
- `API-Reference.md` → `.github/wiki/API-Reference.md`
- `Features.md` → `.github/wiki/Features.md`
- `Database.md` → `.github/wiki/Database.md`
- `Database-Schema.md` → `.github/wiki/Database-Schema.md`
- `Development.md` → `.github/wiki/Development.md`
- `Installation.md` → `.github/wiki/Installation.md`
- `Machine-Learning.md` → `.github/wiki/Machine-Learning.md`
- `Security.md` → `.github/wiki/Security.md`
- `Troubleshooting.md` → `.github/wiki/Troubleshooting.md`

## Docs That Should Link To Wiki
- `docs/ARCHITECTURE.md` → link to `.github/wiki/Architecture.md`
- `docs/API_REFERENCE.md` → link to `.github/wiki/API-Reference.md`
- `docs/DEPLOYMENT.md` → link to `.github/wiki/Deployment-Guide.md`
- `docs/FEATURES.md` → link to `.github/wiki/Features.md`
- `docs/DATABASE_RADIO_ARCHITECTURE.md` → link to `.github/wiki/Database.md` and `Database-Schema.md`
- `docs/DEVELOPMENT.md` → link to `.github/wiki/Development.md` and `Installation.md`
- `docs/SECURITY_POLICY.md` → link to `.github/wiki/Security.md`
- `docs/SECRETS.md` → cite `.github/wiki/Security.md` for diagrams/troubleshooting while calling out AWS Secrets Manager as the single source of truth

## When To Sync Docs → Wiki
Only sync when a page is explicitly designated as a source and does not conflict with diagram-heavy wiki content.
If in doubt, update the wiki page directly and add cross-links from `docs/`.

## Secrets Policy Reminder
- **AWS Secrets Manager** is the canonical source for credentials; do not describe keyring workflows in docs or the wiki anymore.
- Always state `docs/SECRETS.md` whenever the wiki covers secrets so readers can jump to the canonical guide.
