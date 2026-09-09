# ShadowCheck — SIGINT Forensics Platform

[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen?style=flat-square)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-18%2BPostGIS-blue?style=flat-square)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/redis-%3E%3D7.0.0-red?style=flat-square)](https://redis.io/)

**Production-grade SIGINT forensics and wireless network analysis platform.** Real-time threat detection, geospatial correlation via PostGIS, and interactive analysis dashboards.

---

## Purpose & Ethical Use

ShadowCheck is a **defensive, evidentiary network intelligence platform**. It is not an offensive tool and is not designed or intended for unauthorized surveillance or offensive exploitation.

- **Data Model**: Designed for operators to analyze their own legally collected signals intelligence, wardriving observations (Wi-Fi, Bluetooth/BLE, Cellular), and media evidence. You bring your own data.
- **Intended Use**:
  - Personal RF environment awareness and threat posture evaluation
  - Evidentiary documentation of observed RF activity and physical surveillance equipment
  - Defensive wireless security research using operator-collected scans
  - Academic, civic, and hobbyist wardriving analysis
- **Prohibited Use**:
  - Unauthorized network access, tracking individuals without consent, or unlawful surveillance
  - Any activity violating local, state, or federal laws

---

## Current System Status

- **Frontend**: React 19 + Vite 8 + TypeScript with Zustand state management, Mapbox GL JS + Deck.gl spatial rendering, and Kepler.gl GeoJSON visualizer.
- **Backend**: Express + Node.js 22 (CommonJS, TypeScript) organized in a three-tier pattern (Routes validate → Services execute logic → Repositories hold SQL).
- **Database Layer**: PostgreSQL 18 + PostGIS 3.6 utilizing materialized views (`app.api_network_explorer_mv`, `app.mv_sibling_groups`) and PostGIS geography types for spatial indexing and radius queries.
- **Cache & Session Infrastructure**: Redis 7 for user session stores, rate limiting, and analytics caching.
- **Security & Secrets**: AWS Secrets Manager runtime injection for production credentials; Bcrypt password hashing (12 rounds) with forced first-login password rotation.
- **Filter Engine**: 64 universal filter parameters (defined in `FILTER_KEYS`) supporting pipe-OR (`|`), comma-AND (`,`), BSSID wildcards, temporal windows, and spatial bounding boxes.

---

## Implemented Core Subsystems

- **Geospatial Explorer (`/geospatial-explorer`)**: Interactive Mapbox GL JS + Deck.gl map synchronized with a rich network data table. Features include pin-drop radius filtering, sibling topology overlays, nearest agency and federal courthouse overlays, and DeFlock/ShotSpotter reference layers. See [docs/features/geospatial.md](docs/features/geospatial.md).
- **VISINT Evidence Pipeline (`/admin` → VisINT Uploader)**: Spatial-temporal correlation engine linking field photography with wireless observations using EXIF coordinates and capture timestamps (`radiusMeters: 50`, `windowHours: 2`). Built with a strict **preview-by-default contract** (`commit=false` unless explicitly confirmed). See [docs/features/visint-evidence-pipeline.md](docs/features/visint-evidence-pipeline.md).
- **WiGLE Ingestion & Search (`/wigle` & `/admin` tabs)**: V2 search coordinator, V3 deep forensic network inspection, ledger-backed paginated import loops, adaptive backoff delay with quota tracking, and automatic pause on HTTP 429 rate limits. See [docs/features/wigle-import-player.md](docs/features/wigle-import-player.md).
- **Sibling Detection & Inference**: Undirected sibling pair graphs (`bssid1`/`bssid2`), MAC octet arithmetic heuristics (`MAX_OCTET_DELTA: 6`, `MAX_DISTANCE_M: 1500`), fleet SSID exclusion filters (148 curated SSIDs), and analyst override controls. See [docs/SIBLING_RULESET_ANALYSIS.md](docs/SIBLING_RULESET_ANALYSIS.md).
- **Surveillance Detection & SIGINT Library (`/admin` → SIGINT Library)**: Automated signature scoring for Automated License Plate Readers (ALPR, Flock Safety BLE UUID and SSID patterns), acoustic gunshot detection (ShotSpotter / SoundThinking), and Body-Worn Camera (BWC) signatures. See [docs/features/surveillance-detection.md](docs/features/surveillance-detection.md).
- **Universal Filtering Engine**: Unified filter compilation across REST endpoints supporting 64 filter keys (SSID/BSSID patterns, RSSI, radio types `W`, `E`, `B`, `L`, `N`, `G`, temporal lifetime, threat levels, and geofences). See [docs/FILTERS.md](docs/FILTERS.md).
- **Automated Geocoding Cache (`/admin` → Geocoding)**: Background daemon performing reverse geocoding via Mapbox and OpenCage APIs with persistent SQLite/PostgreSQL caching.
- **Machine Learning Scoring (`/admin` → ML Training)**: Admin-gated logistic regression model training, dataset splitting, and offline hyperparameter iteration via Python scripts.

---

## Application Navigation & Pages

The application exposes the following top-level routes (see `client/src/App.tsx` and `client/src/components/Navigation.tsx`):

| Route                  | Label          | Description                                                                                            | Access       |
| ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------ | ------------ |
| `/` or `/dashboard`    | **Dashboard**  | Overview metrics, threat posture, radio distribution, and recent high-threat detections.               | User / Admin |
| `/start`               | **Start**      | System introductory overview and splash screen (active when demo mode is enabled).                     | Public       |
| `/geospatial-explorer` | **Geospatial** | Dual map/table view for spatial clustering, pin-drop radius search, and sibling topology.              | User / Admin |
| `/analytics`           | **Analytics**  | Temporal heatmaps, signal attenuation curves, threat score distributions, and network lifetime trends. | User / Admin |
| `/monitoring`          | **Monitoring** | System health, background job states, and ingestion pipeline performance metrics.                      | User / Admin |
| `/wigle`               | **WiGLE**      | WiGLE import player, V2 search, enrichment backlog inspection, and Kepler export.                      | User / Admin |
| `/kepler`              | **Kepler**     | Large-scale GeoJSON spatial visualization powered by Kepler.gl with lazy-loaded tooltips.              | User / Admin |
| `/admin`               | **Admin**      | Comprehensive administrative management console (18 distinct tabs).                                    | Admin Only   |

---

## Administrative Console (`/admin`)

The Administrative page provides 18 dedicated management tabs (see `client/src/components/AdminPage.tsx`):

1. **Configuration (`config`)**: Runtime feature flags, API rate limits, environment diagnostics.
2. **Automation (`jobs`)**: Background job schedules (MV refresh, surveillance scoring, ML scoring).
3. **DB Stats (`db-stats`)**: Database table sizes, index utilization, materialized view health, sibling pair counts.
4. **WiGLE Stats (`wigle-stats`)**: Daily WiGLE API quota usage, ledger request logs, query cache statistics.
5. **API Testing (`api`)**: Interactive client-side endpoint testing against registered REST endpoints.
6. **ML Training (`ml`)**: _(Feature-gated)_ Train, evaluate, and deploy logistic regression threat models.
7. **WiGLE Search (v2) (`wigle`)**: WiGLE V2 search coordinator with coverage metrics and import run history.
8. **WiGLE Detail (v3) (`wigle-detail`)**: Deep forensic network lookup, trilaterated centroids, and batch v3 enrichment.
9. **Data Import (`imports`)**: Import pipelines for KML, CSV, JSON, and WiGLE archive files.
10. **VisINT Uploader (`visint`)**: Media evidence upload, EXIF extraction, and spatio-temporal observation correlation.
11. **Backups (`backups`)**: PostgreSQL database backup creation, S3 archiving, and restoration tooling.
12. **Data Export (`exports`)**: Filter-aware data export to GeoJSON, KML, CSV, and SQLite formats.
13. **Geocoding (`geocoding`)**: Geocoding daemon controls, cache hit statistics, and backlog processing.
14. **AWS (`aws`)**: AWS Secrets Manager, Bedrock AI integration, and S3 connectivity verification.
15. **PgAdmin (`pgadmin`)**: _(Feature-gated)_ Embedded Dockerized pgAdmin management iframe.
16. **Users (`users`)**: User account management, role assignment (`admin`/`user`), active session revocation.
17. **SIGINT Library (`sigint-library`)**: Surveillance device signature catalog, OUI database, and equipment guides.
18. **Badge Studio (`badge-studio`)**: _(Feature-gated)_ Custom styling and rule configuration for Explorer table badges (see [docs/features/badge-studio.md](docs/features/badge-studio.md)).

---

## Architecture Overview

```
client/ (React 19 + Vite 8 + ES Modules)
  ├── components/          # Page components & modular tab cards
  ├── stores/              # Zustand state stores
  ├── hooks/               # React hooks (auth, config, queries)
  └── config/              # Feature flags & endpoint registries
           │
           │ HTTP / JSON API (Session Cookie or Bearer Token)
           ▼
server/ (Node.js 22 + Express + TypeScript / CommonJS)
  ├── api/routes/          # REST route handlers & input validation
  ├── services/            # Business logic & correlation algorithms
  ├── repositories/        # SQL queries and database access layer
  └── logging/             # Structured Winston logging
           │
           │ Parameterized SQL Queries & Spatial Functions
           ▼
PostgreSQL 18 + PostGIS 3.6 & Redis 7
  ├── app.api_network_explorer_mv  # Core pre-computed materialized view
  ├── app.network_sibling_pairs    # Sibling pair graph with confidence scoring
  ├── app.observations             # Raw GPS/RF observation data
  └── Redis 7                      # User sessions, token blacklists, rate limits
```

---

## Environment Configuration

Configuration is structured across five primary categories (see `.env.example` — **never commit `.env`**):

### 1. Required Core Settings

- `PORT`: API server port (default: `3001`).
- `NODE_ENV`: Application environment (`development` or `production`).
- `API_GATE_ENABLED`: Set to `true` to require session/bearer authentication on protected routes.
- `CORS_ORIGINS`: Comma-separated allowed origins (e.g., `http://localhost:3001,http://127.0.0.1:3001`).

### 2. Database Connection & Role Boundaries

- `DB_HOST`, `DB_PORT`, `DB_NAME`: Database host, port, and name (`shadowcheck_db`).
- `DB_USER` / `DB_PASSWORD`: Read-limited runtime user (`shadowcheck_user`).
- `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD`: Administrative DDL owner (`shadowcheck_admin`).
- `DB_SSL`, `DB_SSL_CA`: TLS configuration for PostgreSQL connections in production/RDS.

### 3. Redis & Caching

- `REDIS_HOST`, `REDIS_PORT`: Redis server connection for session state, API rate limiting, and analytics cache.

### 4. External Intelligence & Geospatial Keys

- `MAPBOX_TOKEN` / `VITE_MAPBOX_TOKEN`: Mapbox API token for map vector rendering and reverse geocoding.
- `GOOGLE_MAPS_API_KEY`: Server-side proxy key for satellite base map tiles.
- `WIGLE_API_NAME`, `WIGLE_API_TOKEN`: WiGLE API credentials for network search and v3 enrichment.
- `WIGLE_SOFT_LIMIT_SEARCH`, `WIGLE_SOFT_LIMIT_DETAIL`: 24-hour rolling window API quota safeguards.
- `OPENCAGE_API_KEY`, `LOCATIONIQ_API_KEY`: Optional fallback geocoding provider API keys.
- `SHADOWCHECK_API_KEY`: API key for direct mobile observation ingest (`/api/v1/ingest`).

### 5. Production Secrets Injection

- In production on AWS EC2, credentials are not stored in `.env` files. Secrets are dynamically loaded into memory at startup from **AWS Secrets Manager** (`shadowcheck/config`). See [docs/SECRETS.md](docs/SECRETS.md).

---

## Local Development & Operational Safeguards

### Development Setup

```bash
git clone https://github.com/cyclonite69/shadowcheck-web.git
cd shadowcheck-web
npm install
docker compose up -d
```

`docker compose up -d` boots a self-contained local environment running PostgreSQL, Redis, Express API (`:3001`), and the Vite dev server (`:5173`).

### Host-Based Development

```bash
npm run dev          # Backend dev server (Nodemon on port 3001)
npm run dev:frontend # Frontend dev server (Vite on port 5173)
```

### Database Boundaries & Safety Protocol

> **CRITICAL OPERATIONAL SAFEGUARD**: The primary production database is `shadowcheck_db`.

- **No Secrets on Disk**: Secrets are loaded dynamically via AWS Secrets Manager in production (`shadowcheck/config`). `.env` files are never committed.
- **Test Database Isolation**: Automated test suites and local test runners must never target `shadowcheck_db`. When running integration tests, verify `DB_NAME` targets `shadowcheck_test` (or an ephemeral container). The frontend displays a persistent yellow warning banner whenever `VITE_TEST_DB_BANNER` is active.
- **DB Write Protocol**: Every direct database mutation (INSERT, UPDATE, DELETE, DDL) in production requires:
  1. SQL preview and impact analysis (rows affected, tables touched, reversibility).
  2. Rollback plan.
  3. Explicit operator confirmation before execution.
- **Database Role Separation**: `shadowcheck_admin` (DDL owner for migrations) and `shadowcheck_user` (read-limited runtime role). No `postgres` superuser exists in this container setup.
- **Rate Limiting**: Express middleware enforces IP rate limits (50,000 requests per 15 minutes by default; login and password change endpoints enforce tighter limits of 10 req/15m and 5 req/1h).
- **EC2 Rebuilds**: Always use `scs_rebuild.sh` on EC2 (`deploy/aws/scripts/scs_rebuild.sh`) to protect SSL certs, EBS mounts, and container permissions. Never run raw `docker build` or `docker compose up` on production instances. See [docs/SSM_ACCESS.md](docs/SSM_ACCESS.md).

---

## Verification & Quality Gates

Before committing any changes, run the mandatory verification sequence:

```bash
npx tsc --noEmit           # 1. Type Check (zero errors required)
npm run lint               # 2. Lint Check (ESLint zero errors)
npm run policy:modularity  # 3. Modularity Policy Check
npm test                   # 4. Full Jest Test Suite (531 test suites)
npm run test:cov           # 5. Coverage Check (60% coverage threshold enforced in jest.config.js)
```

---

## Testing Strategy

- **Unit Tests (`tests/unit/`)**: Isolated module and pure function tests with mocked dependencies (e.g., `tests/unit/wigleDetailUtils.test.ts`).
- **Integration Tests (`tests/integration/`)**: Supertest-backed API endpoint tests against mocked or ephemeral database instances.
- **E2E Tests (`tests/e2e/`)**: Full-flow browser tests covering login, geospatial navigation, and admin controls.
- **Test Standards**: See [docs/TESTING.md](docs/TESTING.md) and [docs/workflow/TESTING_STANDARDS.md](docs/workflow/TESTING_STANDARDS.md) for testing guidelines.

---

## Documentation Index

| Documentation Guide                                                                      | Description                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md)                                           | Curated REST API endpoint documentation                                |
| [docs/api/route-inventory.md](docs/api/route-inventory.md)                               | Exhaustive mapping of all backend route mounts                         |
| [docs/api/manual-only-endpoints.md](docs/api/manual-only-endpoints.md)                   | Dangerous/destructive operations and test automation rules             |
| [docs/FILTERS.md](docs/FILTERS.md)                                                       | Universal filter query parameter syntax and usage                      |
| [docs/features/geospatial.md](docs/features/geospatial.md)                               | Mapbox/Deck.gl architecture and PostGIS materialized views             |
| [docs/features/visint-evidence-pipeline.md](docs/features/visint-evidence-pipeline.md)   | Media evidence upload, EXIF extraction, and correlation contract       |
| [docs/features/wigle-import-player.md](docs/features/wigle-import-player.md)             | WiGLE import pipeline, ledger recovery, and rate limiters              |
| [docs/features/surveillance-detection.md](docs/features/surveillance-detection.md)       | Surveillance signatures, DeFlock, ShotSpotter, and BWC classifications |
| [docs/features/badge-studio.md](docs/features/badge-studio.md)                           | Badge rendering configuration and styling rules                        |
| [docs/SIBLING_RULESET_ANALYSIS.md](docs/SIBLING_RULESET_ANALYSIS.md)                     | Sibling pair heuristics, fleet SSID rules, and override policies       |
| [docs/DATABASE_CONNECTION.md](docs/DATABASE_CONNECTION.md)                               | Database roles, PostGIS extensions, and connection patterns            |
| [docs/SSM_ACCESS.md](docs/SSM_ACCESS.md)                                                 | AWS SSM access protocols and EC2 deployment rules                      |
| [docs/TESTING.md](docs/TESTING.md)                                                       | Frontend and backend test execution instructions                       |
| [docs/workflow/TESTING_STANDARDS.md](docs/workflow/TESTING_STANDARDS.md)                 | Coverage and regression standards                                      |
| [docs/workflow/EXISTING_WORK_AUDIT.md](docs/workflow/EXISTING_WORK_AUDIT.md)             | Mandatory audit-first protocol before code modifications               |
| [docs/schema/network-tables.md](docs/schema/network-tables.md)                           | Core wireless database structure and tables                            |
| [docs/schema/observations-sources.md](docs/schema/observations-sources.md)               | Observation sources, WiGLE accounting, and KML scans                   |
| [docs/maintenance/maintenance-cadence.md](docs/maintenance/maintenance-cadence.md)       | Four maintenance lanes and audit check templates                       |
| [docs/maintenance/documentation-workflow.md](docs/maintenance/documentation-workflow.md) | Docs/wiki synchronization process                                      |
| [docs/ai/sessions/ACTIVE.md](docs/ai/sessions/ACTIVE.md)                                 | Active session state and hard safety constraints                       |
| [.github/wiki/Home.md](.github/wiki/Home.md)                                             | Diagram-heavy wiki entry point                                         |
| [.github/wiki/Architecture.md](.github/wiki/Architecture.md)                             | High-level system architecture diagrams                                |
| [.github/wiki/Data-Flow.md](.github/wiki/Data-Flow.md)                                   | Signal processing and data flow diagrams                               |

---

## License

MIT. See [LICENSE](LICENSE) for details.
