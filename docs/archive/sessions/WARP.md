# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

ShadowCheck-Static is a SIGINT forensics platform with a Node.js/Express backend and static HTML/JavaScript frontend. It analyzes wireless network observations (WiFi, BLE, cellular) to detect potential tracking devices through threat detection algorithms and ML-based classification.

## Essential Development Commands

```bash
# Server (Port 3001)
npm start              # Production mode
npm run dev            # Development with auto-reload (nodemon)
npm run debug          # Node debugger enabled

# Testing & Quality
npm test               # Run Jest tests
npm run lint           # Check ESLint
npm run lint:fix       # Auto-fix linting issues
npm run format         # Auto-format with Prettier

# Database (Docker required)
docker-compose up -d postgres          # Start PostgreSQL 18 + PostGIS
docker-compose exec postgres psql -U shadowcheck_user -d shadowcheck  # Connect to DB

# Database Migrations
docker exec -i shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck < sql/migrations/00_init_schema.sql
```

**Key Ports:** 3001 (API), 5432 (PostgreSQL)

## Database Configuration

**Connection String Details:**
```
Host: localhost (or docker container name)
Port: 5432
User: shadowcheck_user
Database: shadowcheck
Schema: app
```

**Environment Variables (.env required):**
```env
DB_USER=shadowcheck_user
DB_PASSWORD=<your_password>
DB_HOST=127.0.0.1
DB_NAME=shadowcheck
DB_PORT=5432
PORT=3001
NODE_ENV=development
```

**Key Tables (Schema: app):**
- `networks_legacy` - Network metadata (BSSID, SSID, type, encryption, last_seen)
- `locations_legacy` - Observation records (BSSID, lat/lon, signal_strength, timestamp)
- `network_tags` - User classifications (LEGIT, FALSE_POSITIVE, INVESTIGATE, THREAT)
- `location_markers` - Home/work coordinates for threat analysis
- `wigle_networks_enriched` - WiGLE API enrichment data
- `radio_manufacturers` - MAC OUI to manufacturer mapping

**Important Constant:**
- `MIN_VALID_TIMESTAMP = 946684800000` (Jan 1, 2000 in milliseconds) - filters corrupted timestamps from all queries

## Architecture: Monolithic Single-File Backend

**Current State:**
- All API endpoints in `server.js` (~1700 lines)
- Business logic mixed with database queries
- No separation of concerns, CommonJS modules
- Single connection pool (pg library)

**Key Middleware Stack:**
- CORS enabled for cross-origin requests
- Rate limiting: 1000 requests/15min per IP (express-rate-limit)
- Security headers (CSP, X-Frame-Options, X-XSS-Protection)
- Request body size limit: 10MB
- Automatic transient error retry on database failures (lines 25-42)

**Dependencies (Minimal):**
- express@4.18.2 - HTTP routing
- pg@8.16.3 - PostgreSQL client with connection pooling
- dotenv@16.3.1 - Environment variables
- cors@2.8.5, express-rate-limit@8.2.1 - Security
- ml-logistic-regression@2.0.0 - Threat detection ML

## Frontend Architecture

**Static HTML Pages (No Build Step Required):**
- `public/index.html` - Main dashboard
- `public/geospatial.html` - Interactive Mapbox map
- `public/analytics.html` - Charts and temporal analysis
- `public/networks.html` - Network browser with filtering
- `public/surveillance.html` - Threat-focused view
- `public/admin.html` - Administration interface

**Frontend Stack:**
- Vanilla JavaScript (no framework)
- Tailwind CSS via CDN
- Chart.js for visualizations
- Mapbox GL JS for geospatial rendering
- Dynamic API base URL construction (supports deployment flexibility)

**Shared Frontend Code:**
- `public/js/common.js` - Utility functions (shared across pages)

## Threat Detection Algorithm

**Scoring Criteria (Cumulative):**
1. **Seen at home AND away:** +40 points (strongest indicator)
2. **Distance range > 200m:** +25 points (exceeds WiFi typical range)
3. **Multiple unique days:** +5 to +15 points (7+ days: 15, 3-6: 10, 2: 5)
4. **High observation count:** +5 to +10 points (50+: 10, 20-49: 5)
5. **Movement speed (advanced only):** +10 to +20 points (>100 km/h: 20, >50: 15, >20: 10)

**Threshold:** Score ≥ 30 = potential threat (configurable via `minSeverity` query param)

**Two Detection Modes:**
- `/api/threats/quick` (lines 344-494): Fast paginated detection, basic distance calculations
- `/api/threats/detect` (lines 496-679): Advanced detection with speed calculations between observations

**Cellular Networks:** Type G, L, N excluded from threats unless distance_range_km > 5

## API Endpoints (Common)

**Dashboard & Metrics:**
- `GET /api/dashboard-metrics` → `{ totalNetworks, threatsCount, surveillanceCount, enrichedCount }`

**Threat Detection:**
- `GET /api/threats/quick?page=1&limit=100&minSeverity=40` → Paginated threats with pagination info
- `GET /api/threats/detect` → Advanced threats with speed calculations

**Networks:**
- `GET /api/networks?page=1&limit=100&sort=lastSeen&order=ASC` → Network list with pagination
- `GET /api/networks/observations/:bssid` → All observations for specific network
- `POST /api/tag-network` → Tag network (requires `{bssid, tag_type, confidence, notes}`)

**Analytics:**
- `GET /api/analytics/network-types` → Distribution by type (W, E, B, L, N, G)
- `GET /api/analytics/signal-strength` → Signal strength histogram (dBm ranges)
- `GET /api/analytics/temporal-activity` → 24-hour activity patterns
- `GET /api/analytics/security` → Encryption distribution (WPA3-E/P, WPA2-E/P, WPA, WEP, WPS, OPEN)
- `GET /api/analytics/radio-type-over-time` → Network type distribution (last 30 days)

**ML Endpoints:**
- `POST /api/ml/train` (auth required) → Train logistic regression model
- `GET /api/ml/predict/:bssid` → ML prediction for specific network

**Authentication:**
- Optional API key via `x-api-key` header (env var: API_KEY)
- Protected endpoints: `/api/tag-network`, `/api/ml/train`

**Response Format:** Most endpoints return `{ ok: boolean, data: any }`. Exceptions: `/api/dashboard-metrics` returns raw object, `/api/networks` returns array directly.

## Network Type Codes

- `W` = WiFi
- `E` = BLE (Bluetooth Low Energy)
- `B` = Bluetooth Classic (mapped to BLE)
- `L` = LTE / 4G
- `N` = 5G NR (New Radio)
- `G` = GSM/Cellular (mapped to LTE if capabilities contain 'LTE')

## Security/Encryption Classification (WiFi)

The `/api/analytics/security` endpoint parses `capabilities` field to classify:
- `WPA3-E` = WPA3 Enterprise
- `WPA3-P` = WPA3 Personal (SAE/PSK)
- `WPA2-E` = WPA2 Enterprise
- `WPA2-P` = WPA2 Personal (PSK)
- `WPA` = Original WPA
- `WEP` = WEP encryption
- `WPS` = WiFi Protected Setup only
- `OPEN` = No encryption

## Database Query Patterns

**Transient Error Handling:**
The `query()` wrapper (lines 25-42) automatically retries once on connection errors (57P01, 53300, 08006, ETIMEDOUT, etc.) with 1-second delay.

**PostGIS Distance Calculations:**
```sql
ST_Distance(
  ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
  home_point
) / 1000.0  -- Convert meters to kilometers
```

**Query Pattern:** Most complex queries use CTEs (Common Table Expressions) for readability:
1. `home_location` CTE: Get home coordinates
2. Network aggregation CTEs: Statistics per network
3. Threat analysis CTE: Final threat scoring

## Testing

**Test Files:**
- `tests/api/dashboard.test.js` - Dashboard metrics tests
- `tests/setup.js` - Jest configuration

**Run Tests:**
```bash
npm test                          # All tests
npm test -- tests/api.test.js     # Specific file
npm run test:cov                  # Coverage report
npm run test:integration          # Integration tests only
```

**Configuration:**
- Jest config: `jest.config.js`
- Coverage thresholds: 70% (branches, functions, lines, statements)

## Code Quality Tools

**ESLint:** `.eslintrc.json`
- CommonJS, Node.js environment
- Rules: no-var, prefer-const, eqeqeq, no-eval
- Run: `npm run lint` / `npm run lint:fix`

**Prettier:** `.prettierrc.json`
- Single quotes, semicolons, 100 char line width, 2-space indentation
- Run: `npm run format` / `npm run format:check`

**EditorConfig:** `.editorconfig` - Universal editor settings

## Docker Deployment

**Images/Services (docker-compose.yml):**
- `postgres:18-alpine` + PostGIS extension (Port 5432)
- `node:18-alpine` multi-stage build (Port 3001, non-root user)
- Redis 7 (optional, for future caching)
- pgAdmin (optional, profile: tools)

**Quick Start:**
```bash
docker-compose up -d                 # Start all services
docker-compose logs -f api           # View API logs
docker-compose down                  # Stop services
docker-compose down -v               # Clean shutdown (delete volumes)
```

**Production Build:**
- Multi-stage Dockerfile for minimal image size
- Non-root nodejs user (UID 1001)
- Health check enabled
- Proper signal handling (dumb-init)

## CI/CD Pipelines (GitHub Actions)

**ci.yml Workflow:**
- Lint (ESLint + Prettier)
- Test (Jest + PostgreSQL service)
- Security (npm audit + TruffleHog secret scanning)
- Build (Docker image build + container test)

**codeql.yml Workflow:**
- Weekly CodeQL security scanning

**Triggers:** Push/PR to master/main/develop branches

## File Structure

```
server.js              # Main application
utils/
  errorHandler.js      # Error utilities
public/                # Frontend (static HTML/CSS/JS)
  *.html              # Dashboard, analytics, networks, surveillance pages
  js/common.js        # Shared frontend utilities
sql/
  migrations/         # Database schema migrations
  functions/          # SQL functions
scripts/
  enrichment/         # Multi-API venue enrichment
  geocoding/          # Reverse geocoding
  ml/                 # ML training scripts
tests/                # Jest test files
docs/                 # Comprehensive documentation
  ARCHITECTURE.md     # System design
  DEVELOPMENT.md      # Dev setup guide
  API.md              # API reference
  DATABASE_*.md       # Schema docs
```

## Common Development Tasks

**Add New API Endpoint:**
1. Add route handler in `server.js` with parameterized queries
2. Add tests in `tests/api.test.js`
3. Update `docs/API.md`
4. Test with `curl` before committing

**Add Database Migration:**
1. Create SQL file in `sql/migrations/`
2. Run: `psql -U shadowcheck_user -d shadowcheck -f sql/migrations/your_file.sql`
3. Update `docs/DATABASE_*.md`

**Add Enrichment Script:**
1. Create in `scripts/enrichment/` (or appropriate subdirectory)
2. Use Pool connection pattern (see existing scripts)
3. Include error handling and progress logging
4. Make executable: `chmod +x scripts/enrichment/your-script.js`

## Known Issues & Fixes (2025-11-23)

**Critical Fixes Applied:**
1. Dashboard metrics crash risk - Added defensive checks before accessing result rows
2. Hardcoded Mapbox token - Documented as security risk (TODO: move to API endpoint)
3. Missing BSSID validation - Added validation for cellular tower identifiers
4. Threat severity filtering bug - Removed duplicate hardcoded threshold, respects user `minSeverity`
5. Debug logging in production - Removed console.log from `/api/networks`
6. Max pagination limit - Enforces 5000 max (prevents DoS)
7. Frontend error handling - Added `.catch()` handlers for unhandled promise rejections

**Security Improvements:**
- XSS prevention: HTML escaping in frontend (added `escapeHtml()` utility)
- API keys: Only via `x-api-key` header (removed query parameter support)
- CORS: Origin whitelist configured
- Request body: 10MB size limit
- Connection pool: Proper limits configured (max 20, idle timeout 30s)

## Threat Model & Security

**Primary Threats:** Unauthorized data access/manipulation, DoS, SQL injection, XSS

**Mitigations:**
- Rate limiting (1000 req/15min per IP)
- API key auth for sensitive endpoints
- Parameterized SQL queries (prevents injection)
- HTML escaping in frontend
- Request body size limit (10MB)
- Security headers (CSP, X-Frame-Options, HSTS)

**Secrets Management:**
- `.env` file (gitignored, never commit)
- Mapbox token hardcoded in `geospatial.html` (security risk - move to API endpoint)
- API keys via environment variables only

## Enrichment System

**Location:** `scripts/enrichment/enrichment-system.js`

**Features:**
- Multi-API venue identification (LocationIQ, OpenCage, Overpass OSM, Nominatim)
- Conflict resolution via voting + confidence scoring
- Rate limit management with daily reset

**Usage:**
```bash
node scripts/enrichment/enrichment-system.js 1000    # Enrich 1000 networks
node scripts/enrichment/enrichment-system.js test    # Test enrichment
```

**Required API Keys (.env):**
- OPENCAGE_API_KEY
- LOCATIONIQ_API_KEY
- ABSTRACT_API_KEY

## Performance Considerations

**Database Query Optimization:**
- Recommended indexes on: locations_legacy(bssid), locations_legacy(time), networks_legacy(type), network_tags(bssid)
- PostGIS spatial indexes for distance calculations
- Queries use CTEs for readability but may need optimization for large datasets (566K+ location records)

**Slow Query Detection:**
```sql
EXPLAIN ANALYZE SELECT ...;  -- Check query plans
```

**Caching:** No Redis caching currently (recommended for scaling)

**Memory Issues:** If "JavaScript heap out of memory", increase Node limit:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm start
```

## Troubleshooting

**Database Connection Errors:**
- Verify PostgreSQL running: `docker ps | grep postgres`
- Check .env matches docker-compose configuration
- Test connection: `docker exec -it shadowcheck_postgres psql -U shadowcheck_user -d shadowcheck`

**Port Already in Use (3001):**
```bash
lsof -i :3001        # Find process
kill -9 <PID>        # Kill it
# Or change PORT in .env
```

**Empty API Results:**
- Verify home location set in `location_markers` table (required for threat detection)
- Check queries filter by `MIN_VALID_TIMESTAMP` (946684800000)
- Ensure observations have valid lat/lon
- Threat threshold is 40 by default (networks below won't appear)

**ML Model Training Fails:**
- Need 10+ tagged networks minimum
- Model stored in database (see `/api/ml/status`)
- Check logs for training errors

## Modernization Roadmap

**Phase 1 (Planned): Modularization**
- Extract routes into `src/api/routes/v1/`
- Extract business logic into `src/services/`
- Extract database queries into `src/repositories/`

**Phase 2: Data Layer Optimization**
- Add Redis caching layer
- Implement database read replicas
- Use Bull for background jobs

**Phase 3: Security Hardening**
- Move to system keyring for secrets
- Implement OAuth2 authentication
- Add audit logging

**Phase 4: ML Enhancement**
- Real-time detection (websockets)
- Ensemble ML models
- Anomaly detection algorithms

**Phase 5: Observability**
- Structured logging (Winston JSON)
- Correlation IDs for tracing
- Prometheus metrics export
- Grafana dashboards

## Quick Command Reference

```bash
# Most Common
npm run dev              # Start with auto-reload
npm test                 # Run tests
npm run lint:fix         # Fix linting
docker-compose up -d     # Start all services

# Database
docker-compose exec postgres psql -U shadowcheck_user -d shadowcheck
npm run db:migrate       # Run migrations

# API Testing
curl http://localhost:3001/api/dashboard-metrics
curl "http://localhost:3001/api/threats/quick?page=1&limit=10"

# Enrichment
node scripts/enrichment/enrichment-system.js 1000

# Production
npm start
docker-compose -f docker-compose.yml up -d
```

## Important Constants

- **Port:** 3001 (configurable in .env)
- **MIN_VALID_TIMESTAMP:** 946684800000 (Jan 1, 2000)
- **THREAT_THRESHOLD:** 40 points (default, configurable)
- **MAX_PAGE_SIZE:** 5000 results
- **RATE_LIMIT:** 1000 requests/15 minutes per IP
- **DB_CONNECTION_POOL:** max 20, idle timeout 30s, connection timeout 2s
- **REQUEST_BODY_LIMIT:** 10MB

## Related Documentation

- **Detailed Architecture:** See `docs/ARCHITECTURE.md`
- **API Reference:** See `docs/API_REFERENCE.md` and `docs/API.md`
- **Development Setup:** See `docs/DEVELOPMENT.md`
- **Database Schema:** See `docs/DATABASE_DESIGN_V2.md` and `docs/DATABASE_SCHEMA_ENTITIES.md`
- **Deployment:** See `docs/DEPLOYMENT.md`
- **Security Policies:** See `SECURITY.md`

---

**Last Updated:** 2025-12-05  
**Node Version:** 18+  
**Database:** PostgreSQL 18 + PostGIS  
**Key Files:** server.js (main), public/*.html (frontend), sql/migrations/ (schema)
