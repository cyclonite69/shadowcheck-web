# ShadowCheck Architecture

This document describes the high-level architecture of the ShadowCheck-Static platform.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Threat Detection Algorithm](#threat-detection-algorithm)
- [Security Architecture](#security-architecture)
- [Development Architecture](#development-architecture)
- [Scalability Considerations](#scalability-considerations)
- [Future Architecture Goals](#future-architecture-goals)

## Overview

ShadowCheck-Static is a SIGINT (Signals Intelligence) forensics platform built on a modern modular architecture combining a React/Vite frontend with a Node.js/Express backend, using PostgreSQL + PostGIS for geospatial data processing.

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │Geospatial│  │ Analytics│  │ML Training│   │
│  │   Page   │  │   Intel  │  │   Page   │  │   Page    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Admin   │  │ API Test │  │WiGLE Test│  │Kepler Test│   │
│  │   Page   │  │   Page   │  │   Page   │  │   Page    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  State Management: Zustand + React Hooks                   │
│  Routing: React Router with lazy loading                   │
│  Styling: Tailwind CSS with dark theme                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST API (JSON)
┌───────────────────────────┴─────────────────────────────────┐
│                 Express Server (Node.js)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Layer (Modern Modular Architecture)              │   │
│  │  • All routes organized in server/src/api/ structure      │   │
│  │  • Modern routes in server/src/api/ (v2 API)               │   │
│  │  • /api/dashboard-metrics                            │   │
│  │  • /api/threats/quick (paginated)                    │   │
│  │  • /api/networks/* (CRUD operations)                 │   │
│  │  • /api/analytics/* (temporal, signal, security)     │   │
│  │  • /api/ml/* (training, prediction)                  │   │
│  └──────────────────────────────────────────────────────┘   │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  Business Logic Layer                                 │   │
  │  • server/src/services/ (modular business logic)            │   │
  │  • server/src/repositories/ (data access layer)             │   │
  │  • AdminDbService (privileged database operations)     │   │
  │  • Threat scoring algorithms                         │   │
│  │  • ML training & prediction services                 │   │
│  │  • Filter query builder with 20+ filter types       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware Stack                                     │   │
│  │  • CORS + Rate Limiting (1000 req/15min)            │   │
│  │  • Security Headers (CSP, X-Frame-Options)           │   │
│  │  • HTTPS Redirect (configurable)                     │   │
│  │  • Request Body Size Limiting (10MB)                 │   │
│  │  • Structured Logging with Winston                   │   │
│  │  • Error Handler with client logger integration      │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ Connection Pool (pg)
┌─────────────────────────────────────────────────────────────┐
│            PostgreSQL 18 + PostGIS (Geospatial)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Multi-User Security Model                            │   │
│  │  • shadowcheck_user (Read-Only Prod Data)            │   │
│  │  • shadowcheck_admin (Full Admin Access)             │   │
│  │                                                      │   │
│  │  Schema: app (Production Data)                        │   │
│  │  • networks_legacy (BSSID, SSID, type, encryption)   │   │
│  │  • locations_legacy (observations with lat/lon)      │   │
│  │  • network_tags (user classifications)               │   │
│  │  • location_markers (home/work coordinates)          │   │
│  │  • wigle_networks_enriched (WiGLE API data)          │   │
│  │  • radio_manufacturers (OUI → manufacturer mapping)  │   │
│  │  • ml_model_metadata (ML model versioning)           │   │
│  │  • network_threat_scores (precomputed scores)        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Materialized Views (Performance)                     │   │
│  │  • api_network_explorer_mv (fast network queries)    │   │
│  │  • threat_analysis_mv (precomputed threat metrics)   │   │
│  │  • analytics_summary_mv (dashboard metrics)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## System Architecture

### Current: Modern Modular React + Express Architecture

**Frontend Characteristics:**

- **React 18** with TypeScript support
- **Vite** build system for fast development and optimized builds
- **Component-based architecture** with lazy loading
- **Zustand** for global state management
- **Tailwind CSS** for responsive, dark-themed UI
- **React Router** with code splitting

**Backend Characteristics:**

- **Modern modular API structure**: All routes organized in `server/src/api/` with services and repositories
- **Modular services** in `server/src/services/` for business logic
- **Repository pattern** in `server/src/repositories/` for data access
- **Universal filter system** with 20+ filter types
- **Structured logging** with Winston
- **Connection pooling** with PostgreSQL

**Pros:**

- **Modern development experience** with hot reload and TypeScript
- **Performance optimized** with lazy loading and code splitting
- **Maintainable** with separation of concerns
- **Scalable** frontend architecture
- **SEO ready** with static server and security headers

**Migration Status:**

- ✅ React frontend with modern tooling
- ✅ Component-based UI architecture
- ✅ Universal filter system
- ✅ Modular backend services (partial)
- 🔄 API route migration (in progress)
- ⏳ Full repository pattern adoption

### Frontend Architecture

```
client/src/
├── components/           # React components
│   ├── DashboardPage.tsx        # Main dashboard
│   ├── GeospatialIntelligencePage.tsx  # Map interface
│   ├── AnalyticsPage.tsx        # Charts and analytics
│   ├── MLTrainingPage.tsx       # ML model management
│   ├── AdminPage.tsx            # System administration
│   ├── FilterPanel.tsx          # Universal filter UI
│   ├── Navigation.tsx           # App navigation
│   └── modals/                  # Modal components
├── hooks/                # Custom React hooks
│   ├── useFilteredData.ts       # Data filtering logic
│   ├── useAdaptedFilters.ts     # Filter adaptation
│   └── usePageFilters.ts        # Page-specific filters
├── stores/               # State management
│   └── filterStore.ts           # Zustand filter store
├── utils/                # Utility functions
│   ├── filterCapabilities.ts   # Filter configuration
│   ├── mapboxLoader.ts         # Mapbox integration
│   └── mapOrientationControls.ts  # Map controls
├── logging/              # Client-side logging
│   └── clientLogger.ts          # Error reporting
├── types/                # TypeScript definitions
│   └── filters.ts               # Filter type definitions
├── App.tsx               # Main app component
└── main.tsx              # Application entry point
```

### Backend Architecture

```
server/server.js                 # Main Express server (legacy + new)
server/src/
├── api/                  # Modern API routes (v2)
│   └── routes/           # Route handlers
├── services/             # Business logic layer
│   ├── filterQueryBuilder.js   # Universal filter system
│   ├── threatScoringService.js # Threat detection
│   ├── mlScoringService.js     # ML predictions
│   ├── analyticsService.js     # Analytics queries
│   ├── backgroundJobsService.js # Background processing
│   └── secretsManager.js       # Secrets management
├── repositories/         # Data access layer
│   ├── networkRepository.js    # Network data access
│   └── baseRepository.js       # Base repository class
├── config/               # Configuration
│   └── database.js             # Database configuration
├── validation/           # Input validation
│   ├── schemas.js              # Joi validation schemas
│   └── middleware.js           # Validation middleware
├── errors/               # Error handling
│   ├── AppError.js             # Custom error classes
│   └── errorHandler.js         # Global error handler
└── logging/              # Server-side logging
    ├── logger.js               # Winston logger
    └── middleware.js           # Request logging
```

server/src/
├── api/ # HTTP layer
│ ├── routes/ # Route handlers
│ │ ├── v1/
│ │ │ ├── networks.js
│ │ │ ├── threats.js
│ │ │ ├── analytics.js
│ │ │ └── ml.js
│ ├── middleware/ # Express middleware
│ │ ├── auth.js
│ │ ├── validation.js
│ │ ├── errorHandler.js
│ │ └── requestLogger.js
│ └── schemas/ # Request/response validation
│ ├── network.js
│ └── threat.js
│
├── services/ # Business logic layer
│ ├── threatService.js
│ ├── analyticsService.js
│ ├── networkService.js
│ └── mlService.js
│
├── repositories/ # Data access layer
│ ├── networkRepository.js
│ ├── locationRepository.js
│ ├── networkTagsRepository.js
│ └── unitOfWork.js
│
├── models/ # Domain models
│ ├── Network.js
│ ├── Threat.js
│ └── NetworkTag.js
│
├── config/ # Configuration management
│ ├── index.js
│ ├── database.js
│ └── secrets.js
│
└── utils/ # Utilities
├── logger.js
├── validation.js
└── errorHandler.js

```

## Data Flow

### Threat Detection Request Flow

```

User Request
↓
[Frontend] → GET /api/threats/quick?page=1&limit=100&minSeverity=40
↓
[Middleware] → Rate Limiting → CORS → Authentication
↓
[Route Handler] → Parse & Validate Query Params
↓
[Threat Service] → Calculate Threat Scores
↓
[Repository Layer] → Query Database (CTEs)
↓
[PostgreSQL] → Execute Query with PostGIS Distance Calculations
↓
[Repository Layer] → Map DB Results to Domain Models
↓
[Threat Service] → Apply Pagination & Filtering
↓
[Route Handler] → Format Response
↓
[Frontend] → Render Threat Table

```

### Enrichment Data Flow

```

[WiGLE CSV Import] → Import Script
↓
[PostgreSQL] → app.wigle_networks_enriched
↓
[Enrichment System] → Multi-API Venue Lookup
├─→ [LocationIQ API] → Conflict Resolution
├─→ [OpenCage API] → Voting System
├─→ [Overpass API] → Best Match Selection
└─→ [Nominatim API] → Gap Filling
↓
[PostgreSQL] → app.ap_addresses (venue names, categories)
↓
[Frontend] → Display Enriched Network Data

```

## Database Schema

### Entity Relationship Diagram

```

┌──────────────────────────┐ ┌───────────────────────────┐
│ networks_legacy │ │ locations_legacy │
├──────────────────────────┤ ├───────────────────────────┤
│ bssid (PK) │────┐ │ id (PK) │
│ ssid │ │ │ bssid (FK) │
│ type (W/E/B/L/N/G) │ └───→│ lat │
│ encryption │ │ lon │
│ last_seen │ │ signal_strength │
│ capabilities │ │ time │
└──────────────────────────┘ │ accuracy │
│ └───────────────────────────┘
│
│ 1:1
↓
┌──────────────────────────┐ ┌───────────────────────────┐
│ network_tags │ │ location_markers │
├──────────────────────────┤ ├───────────────────────────┤
│ bssid (PK, FK) │ │ id (PK) │
│ tag_type │ │ name ('home'/'work') │
│ confidence │ │ lat │
│ threat_score │ │ lon │
│ notes │ └───────────────────────────┘
│ created_at │
│ ml_confidence │
└──────────────────────────┘

┌──────────────────────────┐ ┌───────────────────────────┐
│ wigle_networks_enriched │ │ radio_manufacturers │
├──────────────────────────┤ ├───────────────────────────┤
│ bssid (PK, FK) │ │ id (PK) │
│ trilat_lat │ │ mac_prefix │
│ trilat_lon │ │ manufacturer │
│ qos │ │ category │
│ first_seen │ └───────────────────────────┘
└──────────────────────────┘

````

### Key Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_locations_bssid ON app.locations_legacy(bssid);
CREATE INDEX idx_locations_time ON app.locations_legacy(time) WHERE time >= 946684800000;
CREATE INDEX idx_networks_type ON app.networks_legacy(type);
CREATE INDEX idx_networks_last_seen ON app.networks_legacy(last_seen);
CREATE INDEX idx_network_tags_bssid ON app.network_tags(bssid);

-- PostGIS spatial index
CREATE INDEX idx_locations_geom ON app.locations_legacy USING GIST (
  ST_SetSRID(ST_MakePoint(lon, lat), 4326)
);
````

## Threat Detection Algorithm

### Scoring Criteria (Multi-Factor Analysis)

```javascript
const threatScore = (network) => {
  let score = 0;

  // CRITICAL: Seen both at home AND away from home
  if (network.seenAtHome && network.seenAwayFromHome) {
    score += 40; // Strongest indicator of tracking
  }

  // HIGH: Distance range exceeds WiFi range (200m)
  if (network.distanceRange > 0.2) {
    // km
    score += 25;
  }

  // MEDIUM: Temporal persistence (multiple days)
  if (network.uniqueDays >= 7) {
    score += 15;
  } else if (network.uniqueDays >= 3) {
    score += 10;
  } else if (network.uniqueDays >= 2) {
    score += 5;
  }

  // LOW: High observation count
  if (network.observationCount >= 50) {
    score += 10;
  } else if (network.observationCount >= 20) {
    score += 5;
  }

  // ADVANCED: Movement speed analysis
  if (network.maxSpeed > 100) {
    // km/h
    score += 20; // Vehicular tracking device
  } else if (network.maxSpeed > 50) {
    score += 15;
  } else if (network.maxSpeed > 20) {
    score += 10;
  }

  return score;
};
```

### Detection Modes

**1. Quick Detection (Paginated)**

- Location: `server/server.js:344-494`
- Endpoint: `GET /api/threats/quick`
- Features:
  - Fast aggregation queries
  - Pagination support (default: 100 results)
  - User-defined severity threshold
  - Basic distance calculations
- Use Case: Dashboard overview, initial screening

**2. Advanced Detection (Full Analysis)**

- Location: `server/server.js:496-679`
- Endpoint: `GET /api/threats/detect`
- Features:
  - Speed calculations between observations
  - Temporal sequencing (order by time)
  - Detailed movement patterns
  - All observations included
- Use Case: Deep investigation, forensic analysis

### False Positive Filtering

```sql
-- Cellular networks excluded unless exceptional range
WHERE NOT (
  type IN ('G', 'L', 'N')
  AND distance_range_km < 5.0
)

-- Minimum valid timestamp (Jan 1, 2000)
WHERE time >= 946684800000

-- Minimum observations for statistical significance
HAVING COUNT(DISTINCT location_id) >= 2
```

## Security Architecture

### Authentication & Authorization

**Role-Based Access Control (RBAC)**

- **Admin Role**: Required for `/admin` page access and data-modifying operations (tagging, imports).
- **User Role**: Standard access to dashboards and mapping.
- **Middleware**: `requireAdmin` gates privileged backend routes.

**API Key Authentication**

- Environment variable: `API_KEY`
- Header: `x-api-key`
- Protected endpoints:
  - `GET /api/admin/backup`
  - `POST /api/admin/restore`

**Threat Model**

- **Primary Threat**: Unauthorized data access and manipulation
- **Mitigation**:
  - Rate limiting (1000 req/15min per IP)
  - API key for sensitive endpoints
  - CORS origin whitelisting
  - SQL injection prevention (parameterized queries)
  - XSS prevention (HTML escaping in frontend)
  - Request body size limiting (10MB)

### Security Headers

```javascript
// CSP, X-Frame-Options, X-XSS-Protection
res.setHeader(
  'Content-Security-Policy',
  "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "connect-src 'self' https://api.mapbox.com;"
);
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Strict-Transport-Security', 'max-age=31536000');
```

### Secrets Management

**Current:**

- System keyring for credentials (db_password, wigle_api_token, etc.)
- `secretsManager.js` handles loading from keyring, Docker secrets, or env vars.
- No hardcoded tokens in frontend; served via protected backend endpoints.

## Scalability Considerations

### Current Limitations

**Database:**

- Single PostgreSQL instance
- No read replicas
- Connection pool: 20 max connections
- No query caching (except OS-level)

**Application:**

- Single-threaded Node.js
- No horizontal scaling
- No load balancer
- No CDN for static assets

**Storage:**

- ~566K location records
- ~173K unique networks
- Growing linearly with observations

### Scaling Path

**Short-Term (0-100K users)**

```
┌────────────┐
│  Nginx LB  │
└─────┬──────┘
      │
      ├─→ [API Instance 1]
      ├─→ [API Instance 2]
      └─→ [API Instance 3]
           │
           ↓
      [PostgreSQL Primary]
           │
           ├─→ [Read Replica 1]
           └─→ [Read Replica 2]
```

**Medium-Term (100K-1M users)**

- Add Redis for caching (threat scores, analytics)
- Separate read/write databases
- CDN for static frontend (CloudFlare)
- API rate limiting per user (not just per IP)
- Database partitioning by time range

**Long-Term (1M+ users)**

- Microservices architecture:
  - Threat Detection Service
  - Enrichment Service
  - Analytics Service
  - ML Service
- Event-driven architecture (Kafka)
- TimescaleDB for time-series observations
- Elasticsearch for full-text search
- S3 for observation archives

## Future Architecture Goals

### Phase 1: Modularization (Current Sprint)

- [ ] Break `server/server.js` into modules
- [ ] Implement repository pattern
- [ ] Add service layer for business logic
- [ ] Create typed configuration management
- [ ] Add comprehensive unit tests

### Phase 2: Data Layer Optimization

- [ ] Add Redis caching layer
- [ ] Implement database read replicas
- [ ] Add connection pool monitoring
- [ ] Optimize slow queries with materialized views
- [ ] Implement background job queue (Bull)

### Phase 3: Security Hardening

- [ ] Move to system keyring for secrets
- [ ] Implement OAuth2 authentication
- [ ] Add audit logging for all mutations
- [ ] Implement field-level encryption for PII
- [ ] Add API versioning (v1, v2)

### Phase 4: ML Enhancement

- [ ] Real-time threat detection (websockets)
- [ ] Improved ML model (ensemble methods)
- [ ] Anomaly detection (isolation forest)
- [ ] Temporal pattern analysis (LSTM)
- [ ] Automated retraining pipeline

### Phase 5: Observability

- [ ] Structured logging (JSON format)
- [ ] Correlation IDs for request tracing
- [ ] Prometheus metrics export
- [ ] Grafana dashboards
- [ ] OpenTelemetry integration
- [ ] Error tracking (Sentry)

## Technology Stack

**Backend:**

- Node.js 20+ (LTS)
- Express 4.x (HTTP server)
- pg 8.x (PostgreSQL client)
- PostgreSQL 18 + PostGIS (geospatial database)

**Frontend:**

- React 18 (TypeScript)
- Vite (Build Tool)
- Tailwind CSS (utility-first CSS)
- Recharts / Chart.js (visualizations)
- Mapbox GL JS / Deck.gl (mapping)
- Zustand (State Management)

**DevOps:**

- Docker + Docker Compose (containerization)
- GitHub Actions (CI/CD)
- PostgreSQL (database)
- Redis (future: caching)

**Testing:**

- Jest (unit & integration tests)
- Supertest (API testing)

**Code Quality:**

- ESLint (linting)
- Prettier (formatting)
- EditorConfig (editor consistency)

---

For detailed API documentation, see [API.md](API.md).
For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
For development setup, see [DEVELOPMENT.md](DEVELOPMENT.md).
