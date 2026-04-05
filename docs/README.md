# ShadowCheck Documentation

This folder holds the long-form docs. Root `README.md` is the entry point for the repo.
The wiki in `.github/wiki/` is the primary source for diagram-heavy documentation.

## Current Status (Short)

- **Secrets**: AWS Secrets Manager only (no secrets on disk).
- **Runtime**: Node.js 22 + npm 11 (LTS).
- **Data stack**: PostgreSQL 18 + PostGIS, Redis 7.
- **Frontend**: React 19 + Vite 7 (TypeScript).
- **Backend**: Express 4 + TypeScript services/repositories.

## Doc Rules

- Do not add new docs unless they replace an existing page.
- Wiki is the primary source for diagrams; docs are for concise current state.
- If a diagram asset is missing, prefer updating the wiki Mermaid/source doc instead of linking to a dead binary export.
- Repository-wide engineering commandments live in [../AGENTS.md](../AGENTS.md) and [../CONTRIBUTING.md](../CONTRIBUTING.md). Prefer referencing those instead of restating policy in multiple docs.

## Start Here

- [Architecture](ARCHITECTURE.md) - System overview and module organization.
- [Development](DEVELOPMENT.md) - Local dev setup and workflow.
- [Deployment](DEPLOYMENT.md) - Production deployment guidance.
- [Configuration](CONFIG.md) - Environment variables and configuration.
- [API Reference](API_REFERENCE.md) - REST endpoints.
- [TODO](TODO.md) - Shared active backlog and deferred follow-up work.
- [Wiki Home](../.github/wiki/Home.md) - Diagram-heavy documentation hub.
- [Wiki Map](WIKI_MAP.md) - Docs ↔ wiki mapping.

## Development Guides

- [Frontend](CLIENT.md) - React components and client patterns.
- [Testing](TESTING.md) - Test strategy and commands.
- [Scripts](../scripts/README.md) - Utility scripts and maintenance.

## Data & Infrastructure

- [Database](DATABASE_RADIO_ARCHITECTURE.md) - Schema and data design.
- [Configuration](CONFIG.md) - Redis and environment configuration.
- [Secrets](SECRETS.md) - Secrets management.
- [API Reference](API_REFERENCE.md) - Auth endpoints and API contracts.

## Security

- [Security Policy](SECURITY_POLICY.md) - Disclosure and security posture.
- See [SECRETS.md](SECRETS.md) and [../SECURITY.md](../SECURITY.md) for additional material.

## Optional/Internal

- `kiro/` - Job manifest and execution guides for internal quality passes.
- `fixes/` - Targeted fix plans and notes.

## Directory Map

```
docs/
├── README.md
├── API_REFERENCE.md
├── ARCHITECTURE.md
├── CLIENT.md
├── CONFIG.md
├── DATABASE_RADIO_ARCHITECTURE.md
├── DATA_QUALITY_FILTERING.md
├── DEPLOYMENT.md
├── DEVELOPMENT.md
├── FEATURES.md
├── PGADMIN_AWS_FIX.md
├── QUERY_PERFORMANCE.md
├── SECRETS.md
├── SECURITY_POLICY.md
├── SESSION_STATE.md
├── TESTING.md
├── WIKI_MAP.md
├── development/
├── fixes/
└── kiro/
```

### Features & UI

- [FEATURES.md](FEATURES.md) - Feature catalog
- [CLIENT.md](CLIENT.md) - Frontend docs
- `development/` - Additional implementation notes

---

## Troubleshooting

- **[DEVELOPMENT.md](DEVELOPMENT.md#troubleshooting)** - Common development issues
- **[DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting)** - Deployment issues

---

## Archive

Historical notes are kept in dated markdown files and the `fixes/` directory. Prefer the main top-level docs for current behavior.

---

## Contributing

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)** - Community standards
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history

---

**Last Updated:** 2026-04-05
