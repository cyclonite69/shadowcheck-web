# ShadowCheck Modular Architecture Audit — Final Report

**Audit Date**: 2025-04-05  
**Scope**: 4 comprehensive tracks analyzing 226+ frontend components, 104+ hooks, 40+ routes, 50+ services, 117+ SQL migrations, Docker/K8s config, CI/CD pipelines  
**Total Analyzed**: ~21,000+ lines of application code, ~2,300 lines of audit findings

---

## Executive Summary

### Overall Modular Architecture Score: **7.3/10 - GOOD with Critical Improvements Needed**

**Breakdown by Layer**:

- **Frontend Components**: 7/10 (Monolithic components in visualization)
- **Hooks & Logic**: 7/10 (God service in admin API, scattered forms)
- **Backend API**: 7.5/10 (Route monoliths in Kepler/geospatial)
- **Infrastructure**: 8/10 (Strong config, missing observability)
- **Overall**: 7.3/10 (Healthy foundations, targeted refactoring needed)

### Current State

ShadowCheck has achieved **Level 3 Modular Architecture** (early modules with some clear boundaries) and is approaching **Level 4 (Orchestrator-driven)** with focused refactoring. The codebase demonstrates:

✅ **Strong Fundamentals**:

- Clean separation between client and server
- Hook-based data fetching abstraction
- Centralized filter state management (Zustand)
- Proper database security model (role-based access)
- Comprehensive Docker health checks
- No hardcoded secrets
- Excellent dev/prod configuration separation

⚠️ **Architectural Gaps**:

- 12 monolithic components (>350 lines) in frontend
- 3 monolithic routes (>200 lines) in backend
- "God service" (adminApi.ts, 600 lines handling 20+ domains)
- Scattered form state management (duplicated in 15+ components)
- Missing observability infrastructure (Prometheus)
- Form/modal state not abstracted (scattered across components)

### Top 3 Architectural Strengths

1. **Clean Architecture Separation**: No backend imports in frontend; all API calls routed through dedicated API layer. Type safety maintained across boundary.

2. **Custom Hook Architecture for Data Fetching**: Well-designed hooks (useNetworkData, useObservations, useAdaptedFilters) with proper memoization and caching. 95% hook adoption rate demonstrates strong functional patterns.

3. **Database Security Model**: Role-based access control (shadowcheck_user read-only, shadowcheck_admin write), parameterized queries throughout, AWS Secrets Manager integration. Zero hardcoded credentials, migrations enforce privileges via GRANT/REVOKE.

### Top 3 Critical Gaps

1. **Monolithic Components & Routes** (6-8 files, 600-700 total lines):
   - Frontend: WiglePage (649), ConfigurationTab (523), AnalyticsCharts (542), NetworkNoteModal (489)
   - Backend: keplerHelpers (250+), admin/dbStats (150+), geospatial distance queries (100+)
   - **Impact**: Difficult to test, reuse, reason about
   - **Estimated Refactor Effort**: 10-14 hours

2. **API Layer God Service** (adminApi.ts, 600 lines):
   - Conflates 20+ domains (users, backups, tagging, WiGLE, geocoding, AWS, ML, imports)
   - **Impact**: Hard to navigate, import dependencies everywhere
   - **Estimated Refactor Effort**: 4-6 hours to split into 10+ modules

3. **Scattered Form & Modal State** (15+ components):
   - Form validation, submission, loading states duplicated across NetworkNoteModal, ConfigurationTab, admin forms
   - Modal state management ad-hoc (no central manager)
   - **Impact**: Scaling pain as features grow
   - **Estimated Refactor Effort**: 6-8 hours (create useForm + useModalManager hooks)

---

## Orchestrator Gap Analysis

### Layer 1: Frontend Components

**Current Orchestrator Patterns**: ✅ **PRESENT (35% of components)**

**What IS the orchestrator doing**:

- **App.tsx** (138 lines): Root routing, auth wrapper, lazy loading boundaries
- **DashboardPage** (313 lines): Layout composition, MetricCards coordination
- **Navigation** (273 lines): Menu orchestration, dropdown state
- **GeospatialLayout** (150 lines): Layout composition (MapSection, FiltersSidebar)
- **MapToolbar** (289 lines): Toolbar composition with sub-components
- **AdminPage** (403 lines): Tab system orchestration (but embedded icon definitions, minor issue)

These follow proper patterns: **validate input → delegate to children → return**

**What's PREVENTING clean orchestration** (45% mixed, 5% monolithic):

1. **Monolithic Components with Conflated Concerns**:
   - **WiglePage** (649 lines): Manages map initialization, layer state, filter coordination, data fetching, cluster colors, auto-refetching, KML data, agency visibility—all in one component
   - **ConfigurationTab** (523 lines): Tab orchestration + 13 config panels with form handling + validation + API integration
   - **AnalyticsCharts** (542 lines): Chart data transformation + color mapping + legend generation + interactive state

2. **Prop Drilling Chains** (3-5 levels deep):
   - GeospatialExplorer → GeospatialLayout → GeospatialContent → GeospatialTableContent → NetworkTableRow (pass-throughs at levels 2-3)
   - WiglePage → WigleControlPanel → FilterPanelContainer → FilterPanel (filter state threading)
   - AdminPage → TabView → ConfigurationTab → FormFields → SavedValueInput

3. **Missing Abstractions**:
   - No form state hook (useForm); logic repeated in 15+ components
   - No modal manager; modal state scattered (NetworkNoteModal, WigleLookupDialog, etc. each manage own)
   - No table/grid abstraction; column/sort/filter logic duplicated

**Refactoring Targets** (highest impact):

- **WiglePage**: Extract useWigleMapState, useWigleLayerState, useWigleClusterColors hooks → Orchestrator becomes 80 lines
- **ConfigurationTab**: Extract useConfigurationForm hook, split 13 panels into separate components → Orchestrator becomes 100 lines
- **AnalyticsCharts**: Extract chart rendering to utils/analytics/chartRenderer → Component becomes 200 lines
- **Geospatial Pass-Through**: Flatten 5-level chain to 3 levels using context (GeospatialContext.Provider)

---

### Layer 2: Hooks, Services, and State Management

**Current Orchestrator Patterns**: ✅ **PRESENT (strongly)**

**What IS the orchestrator doing**:

- **useAdaptedFilters** (primary orchestrator): Manages universal filter state with page scoping, URL synchronization, validation
- **useNetworkData** (data orchestrator): Coordinates paginated fetching with filter application and state management
- **filterStore** (Zustand): Central state dispatcher for all filter operations across pages
- **useAuth** (context orchestrator): Centralized authentication state and token management
- **Custom hooks (useObservations, useDashboard, useKepler)**: Domain-specific data orchestrators

**What's PREVENTING clean orchestration**:

1. **God Service: adminApi.ts (600 lines)**:
   - Single module handling 20+ distinct domains:
     ```
     userApi operations + backupApi + taggingApi + settingsApi +
     wigleAdminApi + geocodingAdminApi + awsAdminApi + jobsApi +
     importApi + mlApi
     ```
   - **Problem**: Hard to navigate, import spread throughout codebase
   - **Example**: A component needing to tag a network imports adminApi, which pulls in all 20 domains

2. **Scattered Form State** (NO abstraction):
   - **NetworkNoteModal** (489 lines): Form state (title, content, tags), validation, submission, loading, error
   - **ConfigurationTab** (523 lines): 13 different forms with independent state
   - **Multiple admin forms**: Repeated pattern: useState(values) → useState(errors) → onChange → handleSubmit
   - **Missing**: `useForm(initialValues, onSubmit, validate) → { values, errors, touched, handleChange, handleSubmit }`

3. **Modal State Scattered** (NO orchestrator):
   - **NetworkNoteModal**: Own state (isOpen, isLoading, error)
   - **WigleLookupDialog**: Own state
   - **NetworkTimeFrequencyModal**: Own state
   - Missing: Modal manager context or hook

4. **Validation Logic Duplicated**:
   - **filterStore.validateFilters()**: Zustand method
   - **Component-level validation**: FilterPanel validates RSSI, threat score
   - **API-side validation**: server/src/validation/ redefines rules
   - **Problem**: Client/server validation diverges; risk of silent failures

5. **Observation Fetching Duplicated**:
   - **useObservations** (hooks/useObservations.ts)
   - **useNetworkObservations** (hooks/useNetworkObservations.ts)
   - Both fetch observations for BSSID sets; confusing which to use

**Refactoring Targets** (highest impact):

- **Split adminApi.ts** → 10 domain-specific modules (userApi, backupApi, taggingApi, settingsApi, wigleAdminApi, geocodingAdminApi, awsAdminApi, jobsApi, importApi, mlApi). Impact: Every component importing adminApi becomes more focused
- **Extract useForm hook**: Consolidate form state, validation, submission pattern. Impact: 15+ components benefit, unified UX
- **Create useModalManager**: Context-based modal orchestration (isOpen, data, handlers). Impact: Scaling new modals becomes trivial
- **Consolidate useObservations**: Keep one implementation; migrate useNetworkObservations callers
- **Share validation schema**: Export Yup schemas from server; reuse in client validation hooks

---

### Layer 3: Backend API and Routes

**Current Orchestrator Patterns**: ✅ **PRESENT (65% of routes)**

**What IS the orchestrator doing**:

- **Proper Thin Orchestrators** (35-40 routes):
  - `/api/networks/:bssid` → Validates input, delegates to networkService, returns response
  - `/api/health` → Simple DB check
  - `/api/kepler/data` → Delegates to service
  - Tagging routes: POST /admin/tags/:bssid → Service delegation
- **Service Layer** (35-40 services with single responsibility):
  - explorerQueries.ts: Network observation queries
  - wigleImportRunService.ts: WiGLE import coordination
  - threatDetectionService.ts: Threat scoring
  - Each service focuses on one domain

**What's PREVENTING clean orchestration** (20% monolithic routes):

1. **3 Critical Monolithic Routes** (250-300+ lines total):
   - **keplerHelpers.ts** (250+ lines): Contains GET /kepler/networks
     ```typescript
     router.get('/networks', async (req, res) => {
       // 50 lines: Filter building from query params
       // 60 lines: SQL aggregation query construction
       // 80 lines: Data transformation (grouping, aggregations)
       // 40 lines: GeoJSON formatting
       // 30 lines: Response serialization
     });
     ```
     **Should be**: Route delegates to service
   - **admin/dbStats.ts** (150+ lines): Table enumeration, stats calculation, formatting all inline
   - **geospatial.ts** - distance queries (100+ lines): ST_Distance calculations, filter application, response transformation all inline

2. **N+1 Query Risks** (2 identified):
   - **geospatial.ts**: Fetching observations by BSSID set without batch limits
   - **explorerQueries.ts**: Implicit loop fetching sibling networks per base network
   - **Risk Level**: MEDIUM-HIGH; mitigated by design review but not enforced

3. **Query Location Anti-Patterns**:
   - Routes sometimes execute queries directly (should delegate to services/repositories)
   - Example: admin/dbStats.ts queries database directly instead of via service

**Refactoring Targets** (highest impact):

- **Extract keplerHelpers → keplerDataService**: Move transformation logic to service; route becomes 30 lines
- **Extract dbStats → adminDbStatsService**: Stats calculation as service; route becomes 20 lines
- **Extract geospatial distance queries → geospatialQueryService**: Service encapsulates ST_Distance logic
- **Audit batch sizes**: Review observation fetching BSSID limits; document expected query counts
- **Enforce repository layer**: All database access through repositories, not direct queries

---

### Layer 4: Infrastructure and Configuration

**Current Orchestrator Patterns**: ✅ **PRESENT (strong)**

**What IS the orchestrator doing**:

- **docker-compose.yml**: Service topology orchestration (postgres → redis → api → frontend)
- **Health checks**: Comprehensive checks coordinating service startup (pg_isready → redis-cli PING → curl /health)
- **docker/entrypoint.sh**: Startup orchestration (dumb-init → configuration → app startup)
- **Dockerfile**: Multi-stage build orchestration (builder stage → runtime stage)
- **.env integration**: Externalized configuration per environment

**What's PREVENTING clean orchestration**:

1. **Missing Observability Infrastructure**:
   - Grafana exists but queries PostgreSQL directly (not time-series optimized)
   - **NO Prometheus service** in docker-compose
   - **NO prom-client instrumentation** in Express app
   - **NO operational dashboards**: Only overview.json and home-fleet-detection.json
   - **Impact**: Cannot track response time, error rate, throughput trends
   - Problem: Observability as an afterthought; should be orchestrated at startup

2. **CI/CD Incomplete**:
   - Lint, test, security jobs ✅
   - **Missing**: Docker image build in CI
   - **Missing**: Registry push (ECR, Docker Hub)
   - **Missing**: Deployment automation
   - **Problem**: Cannot validate Docker image build in CI; manual deployment risk

3. **Health Check Orchestration** (minor):
   - Service startup order good (depends_on)
   - Start periods generous (180s for api)
   - Interval/timeout/retry well-tuned ✅

**Refactoring Targets** (medium impact):

- **Add Prometheus service**: docker-compose addition (1 hour)
- **Instrument Express**: prom-client middleware exporting metrics (2 hours)
- **Create Prometheus config**: Job definitions, scrape targets (1 hour)
- **Build operational dashboard**: Grafana dashboard for response time, errors, throughput (3 hours)
- **Enhance CI/CD**: Add Docker build job, registry push (2 hours)

---

## Dependency and Coupling Map

### Module Coupling Analysis

#### **Tightly Coupled Pairs** (Should be Decoupled)

| From                  | To                                                              | Coupling Type                  | Impact                                           | Decoupling Strategy                         |
| --------------------- | --------------------------------------------------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------------- |
| **WiglePage**         | useWigleLayers, useWigleData, useWigleKmlData, useAgencyOffices | Strong (10+ hooks)             | 649-line monolith; hard to test, reuse           | Extract to orchestrator wrapper hooks       |
| **adminApi**          | All admin components                                            | Strong (600 lines, 20 domains) | Circular imports; scattered dependencies         | Split into 10 domain-specific modules       |
| **NetworkNoteModal**  | useNetworkNotes, networkApi                                     | Strong (form logic inline)     | 489 lines; reusable logic trapped                | Extract useNetworkNoteForm hook             |
| **ConfigurationTab**  | 13 config panels + validation                                   | Very Strong (523 lines)        | Ad-hoc form pattern; duplicated in 15 components | Extract useConfigurationForm + split panels |
| **filterStore**       | Zustand (monolithic)                                            | Moderate (500+ lines)          | Single store handling all filters + presets      | Split: filterStore + presetStore            |
| **kepler routes**     | Complex data transformation                                     | Strong (250+ lines)            | Route does service-level work                    | Extract keplerDataService                   |
| **geospatial routes** | ST_Distance queries                                             | Strong (100+ lines inline)     | Route does repository-level work                 | Extract geospatialQueryService              |

#### **Cross-Layer Bleeding** (Concerns Leaking Across Boundaries)

1. **Frontend → Backend Boundary** (CLEAN ✅):
   - No server/ imports detected in client/
   - API calls exclusively through client/src/api/
   - Type interfaces defined locally in client/src/types/
   - **Status**: NO VIOLATIONS

2. **Component → Hook Boundary** (MOSTLY CLEAN ⚠️):
   - Components call hooks ✓
   - Hooks call services ✓
   - Problem: WiglePage, ConfigurationTab, NetworkNoteModal have business logic that should be hooks
   - Solution: Extract logic to hooks; components become presentation-only

3. **Hook → Service Boundary** (MOSTLY CLEAN ⚠️):
   - Hooks coordinate services ✓
   - Services handle business logic ✓
   - Problem: adminApi spans multiple service domains; should be separated
   - Solution: Split adminApi into focused service modules

4. **Database → Repository Boundary** (MOSTLY CLEAN ⚠️):
   - Most queries in services ✓
   - Some queries in routes (keplerHelpers, dbStats, geospatial) ✗
   - Solution: Move route queries to repository layer

5. **Validation → Component Boundary** (BLEEDING ⚠️):
   - Form validation duplicated across 15+ components
   - No shared validation hook
   - Client validation diverges from server validation
   - Solution: Create useForm + share validation schema

#### **Highest-Priority Decoupling Targets** (By Impact × Effort × Risk)

| Priority     | Issue                        | Current Coupling          | Target Coupling            | Effort | Risk   |
| ------------ | ---------------------------- | ------------------------- | -------------------------- | ------ | ------ |
| **CRITICAL** | adminApi (600 lines)         | 20 domains in 1 module    | 10 focused modules         | 4-6h   | LOW    |
| **CRITICAL** | WiglePage (649 lines)        | 10+ hooks + inline state  | 3-4 specialized hooks      | 4-6h   | LOW    |
| **CRITICAL** | Form state duplication       | 15 components             | 1 useForm hook             | 2-3h   | LOW    |
| **HIGH**     | ConfigurationTab (523 lines) | 13 panels inline          | 1 orchestrator + 13 panels | 4-5h   | LOW    |
| **HIGH**     | keplerHelpers (250 lines)    | Query building inline     | Route → service delegation | 2-3h   | MEDIUM |
| **HIGH**     | Modal state scattered        | 5 modals manage own state | 1 useModalManager hook     | 2-3h   | MEDIUM |
| **MEDIUM**   | filterStore (500+ lines)     | Filters + presets mixed   | filterStore + presetStore  | 1-2h   | LOW    |
| **MEDIUM**   | Validation logic mismatch    | Client/server diverge     | Share Yup schemas          | 2-3h   | MEDIUM |

---

## Modularization Readiness: Refactoring Roadmap

### Ordered Priority List (By Impact × Effort × Risk)

| Priority | Category | Item                              | Current Problem                                                                                                   | Modular Pattern                                                                                                                                 | Scope                                                               | Effort | Risk   |
| -------- | -------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ | ------ |
| **P1**   | CRITICAL | Split adminApi.ts                 | 600 lines, 20 domains, everywhere                                                                                 | Domain-specific modules (userApi, backupApi, taggingApi, settingsApi, wigleAdminApi, geocodingAdminApi, awsAdminApi, jobsApi, importApi, mlApi) | client/src/api/{domain}Api.ts                                       | 4-6h   | LOW    |
| **P2**   | CRITICAL | Refactor WiglePage                | 649 lines, 10+ hooks, 500+ JSX, map+data+layer state conflated                                                    | Extract 3 hooks (useWigleMapState, useWigleLayerState, useWigleClusterColors) → Orchestrator                                                    | client/src/components/WiglePage + hooks/wigle/                      | 4-6h   | LOW    |
| **P3**   | CRITICAL | Extract useForm hook              | Form validation, submission, loading states repeated 15+ places (NetworkNoteModal, ConfigurationTab, admin forms) | Reusable useForm(initialValues, onSubmit, validate) hook                                                                                        | client/src/hooks/useForm.ts + client/src/hooks/useFormValidation.ts | 2-3h   | LOW    |
| **P4**   | CRITICAL | Refactor ConfigurationTab         | 523 lines, 13 config panels with form handling                                                                    | Extract useConfigurationForm hook; split into 13 focused panel components                                                                       | client/src/components/admin/tabs/config/ (subdomain)                | 4-5h   | LOW    |
| **P5**   | HIGH     | Extract keplerDataService         | 250+ lines in route; filter building, SQL construction, transformation, formatting all inline                     | Move to server/src/services/keplerDataService.ts; route delegates                                                                               | server/src/services/                                                | 2-3h   | MEDIUM |
| **P6**   | HIGH     | Extract adminDbStatsService       | 150+ lines inline table stats calculation, query building, formatting                                             | Move to server/src/services/adminDbStatsService.ts                                                                                              | server/src/services/admin/                                          | 1-2h   | MEDIUM |
| **P7**   | HIGH     | Extract geospatialQueryService    | 100+ lines distance calculations (ST_Distance), filter application inline                                         | Move to server/src/services/geospatialQueryService.ts                                                                                           | server/src/services/                                                | 2-3h   | MEDIUM |
| **P8**   | HIGH     | Create useModalManager hook       | Modal state scattered (NetworkNoteModal, WigleLookupDialog, NetworkTimeFrequencyModal)                            | Context-based useModalManager(modalType) → { isOpen, open, close, data }                                                                        | client/src/hooks/useModalManager.ts                                 | 2-3h   | MEDIUM |
| **P9**   | HIGH     | Extract AnalyticsCharts rendering | 542 lines; chart data transform, color mapping, legend generation, interactive state                              | Move chart rendering to utils/analytics/chartRenderer.ts                                                                                        | client/src/utils/analytics/                                         | 2-3h   | LOW    |
| **P10**  | HIGH     | Extract NetworkNoteModal logic    | 489 lines; form state, validation, CRUD, loading, error handling                                                  | Extract useNetworkNoteForm(bssid) → { formState, save, delete, etc. }                                                                           | client/src/hooks/network/                                           | 2-3h   | LOW    |
| **P11**  | MEDIUM   | Flatten geospatial prop chains    | 5-level pass-through (GeospatialExplorer → GeospatialLayout → GeospatialContent → Table → Row)                    | GeospatialContext.Provider wrapping table scope                                                                                                 | client/src/components/geospatial/                                   | 2-3h   | MEDIUM |
| **P12**  | MEDIUM   | Consolidate useObservations hooks | useObservations + useNetworkObservations duplicate logic                                                          | Keep useObservations; migrate useNetworkObservations callers; deprecate                                                                         | client/src/hooks/                                                   | 1-2h   | LOW    |
| **P13**  | MEDIUM   | Add Prometheus observability      | Grafana without Prometheus; no metrics collection                                                                 | Add prometheus service to docker-compose; prom-client instrumentation; operational dashboards                                                   | server/, docker-compose, deploy/                                    | 7h     | MEDIUM |
| **P14**  | MEDIUM   | Share validation schema           | Client/server validation diverges (Yup schemas in server not exported)                                            | Export validation from server; reuse in client hooks                                                                                            | server/src/validation/ → shared                                     | 2-3h   | MEDIUM |
| **P15**  | MEDIUM   | Fix CI/CD Docker build            | CI pipeline lacks Docker image build/push; deployment manual                                                      | Add docker build job; add registry push (ECR); update Node version 22                                                                           | .github/workflows/ci.yml                                            | 2-3h   | MEDIUM |
| **P16**  | LOW      | Geospatial subdomain split        | 44 components in one directory (catch-all)                                                                        | Split into: core/ (MapViewport, Toolbar), table/ (rows, headers), modals/, overlays/                                                            | client/src/components/geospatial/                                   | 2-3h   | LOW    |
| **P17**  | LOW      | Admin tab reorganization          | 40+ components in admin/tabs/ (scattered organization)                                                            | Create subdirectories per feature: backup/, wigle/, geocoding/, ml/, import/                                                                    | client/src/components/admin/tabs/                                   | 2-3h   | LOW    |
| **P18**  | LOW      | Split filterStore                 | 500+ lines; filters + presets conflated                                                                           | Separate filterStore + presetStore                                                                                                              | client/src/stores/                                                  | 1-2h   | LOW    |
| **P19**  | LOW      | Audit N+1 queries                 | MEDIUM-HIGH risk in observation fetching, sibling lookups                                                         | Document batch sizes; add explicit batch limits; add query result caching                                                                       | server/src/services/                                                | 2-3h   | MEDIUM |
| **P20**  | LOW      | Add path aliases                  | Import paths up to 6 levels deep (`../../../../../../api`)                                                        | Configure tsconfig paths; use @/components, @/hooks, @/utils                                                                                    | client/tsconfig.json                                                | 1-2h   | LOW    |

### Implementation Notes

#### Phase 1 (Sprint 1): Critical Path - 12-16 hours

1. **Split adminApi.ts** (4-6h): Immediate impact, unblocks other work, LOW risk
2. **Extract useForm hook** (2-3h): Enables ConfigurationTab and NetworkNoteModal refactoring
3. **Refactor WiglePage** (4-6h): Reduces monolithic components from 12 to 10, clarifies component boundaries

**Total**: 10-15 hours (1 sprint)

#### Phase 2 (Sprint 2): High-Impact Backend - 8-12 hours

4. **Extract keplerDataService, adminDbStatsService, geospatialQueryService** (4-6h): Converts monolithic routes to thin orchestrators
5. **Create useModalManager hook** (2-3h): Prepares for new modal features
6. **Extract NetworkNoteModal logic** (2-3h): Reusable form pattern

**Total**: 8-12 hours (1 sprint)

#### Phase 3 (Sprint 3): Infrastructure & Scaling - 10-15 hours

7. **Add Prometheus & metrics** (7h): Operational visibility
8. **Flatten geospatial prop chains** (2-3h): Cleaner component hierarchy
9. **Fix CI/CD Docker build** (2-3h): Deployment automation

**Total**: 10-15 hours (1-2 sprints)

#### Phase 4 (Sprint 4+): Polish & Documentation - 5-10 hours

10. **Consolidate duplicate hooks, add path aliases, audit N+1, split filterStore** (5-10h total)

**Blockers & Dependencies**:

- P1 (split adminApi) enables P4, P8-11 (removes circular imports)
- P2 (WiglePage) independent; P3 (useForm) enables P4, P9-10
- P5-7 (backend services) independent; P9-10 require P3 first
- P13 (Prometheus) independent; enhances monitoring for all other work

---

## Ideal Modular Architecture: File Map

### Proposed Directory Structure

#### **Frontend (client/src/)**

```
client/
├── src/
│   ├── orchestrators/              # Pure orchestrators (new layer)
│   │   ├── pages/
│   │   │   ├── DashboardPageOrch.tsx       # Orchestrator composition only
│   │   │   ├── AnalyticsPageOrch.tsx
│   │   │   ├── AdminPageOrch.tsx           # Tab orchestrator
│   │   │   ├── WiglePageOrch.tsx           # Map + data + filter orchestration
│   │   │   ├── KeplerPageOrch.tsx
│   │   │   └── ...
│   │   └── layouts/
│   │       ├── GeospatialLayoutOrch.tsx    # Map + table + filter layout
│   │       └── AdminLayoutOrch.tsx
│   │
│   ├── components/                 # Dumb UI components (<80 lines, no logic)
│   │   ├── common/                 # Shared components
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── ...
│   │   ├── geospatial/             # Domain-specific components (refactored)
│   │   │   ├── core/               # Map viewport, toolbar
│   │   │   ├── table/              # Table rows, headers, renderers
│   │   │   ├── modals/             # NetworkNoteModal, dialogs
│   │   │   └── overlays/           # Markers, legend, status
│   │   ├── admin/                  # Domain-specific
│   │   │   ├── tabs/               # Organized per feature
│   │   │   │   ├── backup/
│   │   │   │   ├── wigle/
│   │   │   │   ├── geocoding/
│   │   │   │   ├── config/
│   │   │   │   └── ...
│   │   │   └── panels/             # Reusable config panels
│   │   ├── analytics/
│   │   └── ...
│   │
│   ├── modules/                    # Single-responsibility feature modules (new organization)
│   │   ├── authentication/
│   │   │   ├── hooks.ts            # useAuth
│   │   │   ├── types.ts
│   │   │   └── utils.ts
│   │   ├── networks/
│   │   │   ├── hooks.ts            # useNetworkData, etc.
│   │   │   ├── types.ts
│   │   │   ├── services.ts
│   │   │   └── utils.ts
│   │   ├── threats/
│   │   ├── maps/
│   │   ├── wigle/
│   │   ├── admin/
│   │   └── ...
│   │
│   ├── hooks/                      # Reusable logic hooks (unchanged pattern)
│   │   ├── data/                   # Data fetching
│   │   │   ├── useNetworkData.ts
│   │   │   ├── useObservations.ts
│   │   │   └── ...
│   │   ├── forms/                  # Form abstraction (NEW)
│   │   │   ├── useForm.ts
│   │   │   ├── useFormValidation.ts
│   │   │   ├── useNetworkNoteForm.ts
│   │   │   ├── useConfigurationForm.ts
│   │   │   └── ...
│   │   ├── state/                  # State coordination
│   │   │   ├── useAdaptedFilters.ts
│   │   │   ├── useModalManager.ts    # NEW
│   │   │   └── ...
│   │   ├── ui/                     # UI state
│   │   │   ├── useGeospatialExplorerState.ts
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── stores/                     # Global state (Zustand)
│   │   ├── filterStore.ts          # Filters (unchanged)
│   │   └── presetStore.ts          # Presets (NEW: split from filterStore)
│   │
│   ├── types/                      # TypeScript definitions
│   │   ├── network.ts
│   │   ├── threat.ts
│   │   ├── ...
│   │   └── index.ts
│   │
│   ├── api/                        # API layer (refactored)
│   │   ├── client.ts               # Base HTTP client
│   │   ├── auth.ts
│   │   ├── networks.ts
│   │   ├── admin/                  # Domain-specific (NEW organization)
│   │   │   ├── users.ts            # Split from adminApi
│   │   │   ├── backups.ts
│   │   │   ├── tagging.ts
│   │   │   ├── settings.ts
│   │   │   ├── wigle.ts
│   │   │   ├── geocoding.ts
│   │   │   ├── aws.ts
│   │   │   ├── jobs.ts
│   │   │   ├── imports.ts
│   │   │   └── ml.ts
│   │   ├── wigle.ts
│   │   ├── threats.ts
│   │   ├── kepler.ts
│   │   └── ...
│   │
│   ├── utils/                      # Domain utilities
│   │   ├── geospatial/
│   │   ├── formatting.ts
│   │   ├── filterUrlState.ts
│   │   ├── wigle/
│   │   ├── analytics/              # NEW: chartRenderer extracted here
│   │   │   ├── chartRenderer.ts
│   │   │   └── chartConfig.ts
│   │   └── ...
│   │
│   ├── constants/                  # Magic values
│   │   ├── filters.ts
│   │   ├── colors.ts
│   │   ├── threats.ts
│   │   └── ...
│   │
│   ├── App.tsx                     # Root (unchanged)
│   ├── index.css
│   └── main.tsx
│
└── ... (vite.config, tsconfig, package.json, etc.)
```

#### **Backend (server/src/)**

```
server/
├── src/
│   ├── api/                        # Route handlers (thin orchestrators)
│   │   ├── routes/
│   │   │   ├── v1/
│   │   │   │   ├── networks.ts         # Thin: Validate → Service → Response
│   │   │   │   ├── admin/
│   │   │   │   │   ├── users.ts
│   │   │   │   │   ├── backups.ts
│   │   │   │   │   ├── tagging.ts
│   │   │   │   │   ├── settings.ts
│   │   │   │   │   ├── wigle.ts
│   │   │   │   │   ├── geocoding.ts
│   │   │   │   │   ├── aws.ts
│   │   │   │   │   ├── jobs.ts
│   │   │   │   │   ├── imports.ts
│   │   │   │   │   ├── ml.ts
│   │   │   │   │   ├── db.ts         # Stats route → adminDbStatsService
│   │   │   │   │   └── index.ts
│   │   │   │   ├── geospatial.ts     # Routes → geospatialQueryService
│   │   │   │   ├── kepler.ts         # Routes → keplerDataService
│   │   │   │   └── ...
│   │   │   └── v2/
│   │   │       ├── networks.ts
│   │   │       └── threats.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       ├── errorHandler.ts
│   │       └── ...
│   │
│   ├── services/                   # Business logic
│   │   ├── modules/                # By domain (OPTIONAL: grouping for clarity)
│   │   │   ├── networks/
│   │   │   │   ├── networkService.ts
│   │   │   │   ├── networkTagService.ts
│   │   │   │   └── threatDetectionService.ts
│   │   │   ├── geospatial/
│   │   │   │   ├── geospatialQueryService.ts   # Extracted from route
│   │   │   │   └── geospatialService.ts
│   │   │   ├── admin/
│   │   │   │   ├── adminDbStatsService.ts      # Extracted from route
│   │   │   │   ├── userManagementService.ts
│   │   │   │   ├── backupService.ts
│   │   │   │   ├── wigleAdminService.ts
│   │   │   │   ├── geocodingAdminService.ts
│   │   │   │   ├── awsAdminService.ts
│   │   │   │   ├── jobSchedulingService.ts
│   │   │   │   ├── importService.ts
│   │   │   │   └── mlService.ts
│   │   │   ├── kepler/
│   │   │   │   └── keplerDataService.ts        # Extracted from route
│   │   │   ├── wigle/
│   │   │   │   └── wigleImportRunService.ts
│   │   │   └── ...
│   │   │
│   │   ├── explorerQueries.ts      # Moved to modules/networks/ (optional refactor)
│   │   ├── authService.ts
│   │   ├── dashboardService.ts
│   │   ├── analyticsService.ts
│   │   ├── secretsManager.ts
│   │   ├── adminDbService.ts
│   │   └── ...
│   │
│   ├── repositories/               # Data access layer
│   │   ├── base/
│   │   │   └── BaseRepository.ts    # Query builder pattern
│   │   ├── NetworkRepository.ts
│   │   ├── ObservationRepository.ts
│   │   ├── LocationRepository.ts
│   │   └── ...
│   │
│   ├── validation/                 # Request schema validation (UNCHANGED)
│   │   ├── schemas/
│   │   │   ├── filters.ts
│   │   │   ├── networks.ts
│   │   │   └── ...
│   │   └── index.ts
│   │
│   ├── errors/                     # Error classes
│   │   └── AppError.ts
│   │
│   ├── logging/                    # Structured logging
│   │   └── logger.ts
│   │
│   ├── middleware/                 # Cross-cutting concerns
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimit.ts
│   │   └── ...
│   │
│   ├── config/                     # Configuration
│   │   ├── database.ts
│   │   ├── container.ts            # Dependency injection
│   │   └── ...
│   │
│   ├── utils/                      # Utilities
│   │   ├── sqlEscaper.ts
│   │   ├── secrets.ts
│   │   ├── geospatial.ts
│   │   └── ...
│   │
│   ├── websocket/                  # WebSocket handlers
│   │   └── handlers.ts
│   │
│   └── server.ts                   # Entry point
│
├── docker/
│   ├── initdb/                     # Database initialization
│   ├── entrypoint.sh
│   └── Dockerfile
│
└── ... (package.json, tsconfig, etc.)
```

#### **Database (sql/)**

```
sql/
├── migrations/                     # Live migrations (by domain, consolidated)
│   ├── 20260216_consolidated_001_extensions.sql
│   ├── 20260216_consolidated_002_core_tables.sql
│   ├── 20260216_consolidated_003_auth.sql
│   ├── 20260216_consolidated_004_network_analysis.sql
│   ├── 20260216_consolidated_005_ml_scoring.sql
│   ├── 20260216_consolidated_006_wigle_integration.sql
│   ├── 20260216_consolidated_007_agency_offices.sql
│   ├── 20260216_consolidated_008_views.sql
│   ├── 20260216_consolidated_009_functions.sql
│   ├── 20260216_consolidated_010_indexes.sql
│   ├── 20260331_consolidated_012_mv_fields.sql
│   ├── 20260401_observations_upper_bssid_index.sql
│   ├── 20260402_add_kml_staging_tables.sql
│   └── ...
│
├── schema/                         # Reference schemas (documentation)
│   ├── networks.sql
│   ├── observations.sql
│   ├── analysis.sql
│   └── ...
│
└── seed/                           # Optional seed data
    └── ...
```

#### **Infrastructure (docker/deploy/)**

```
docker/
├── Dockerfile                      # Main (unchanged)
├── Dockerfile.frontend.local
├── entrypoint.sh
└── initdb/

deploy/
├── docker-compose.yml              # Development (UNCHANGED)
├── docker-compose.dev.yml
├── docker-compose.monitoring.yml   # ENHANCED: Add Prometheus
├── monitoring/
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/
│   │   │   │   ├── postgres.yml
│   │   │   │   └── prometheus.yml  # NEW
│   │   │   └── dashboards/
│   │   └── dashboards/
│   │       ├── shadowcheck-overview.json
│   │       ├── shadowcheck-home-fleet-detection.json
│   │       └── operational-dashboard.json  # NEW
│   └── prometheus/                 # NEW
│       └── prometheus.yml
│
├── cloudformation/                 # AWS infrastructure
└── ...
```

### Current → Ideal Mapping

| Current Location                                        | Ideal Location                                                                                     | Reason                                  |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `client/src/components/WiglePage.tsx`                   | `client/src/orchestrators/pages/WiglePageOrch.tsx` + `client/src/hooks/wigle/`                     | Separate orchestration from logic       |
| `client/src/components/admin/tabs/ConfigurationTab.tsx` | `client/src/orchestrators/pages/AdminPageOrch.tsx` + `client/src/components/admin/tabs/config/`    | Distribute 13 panels; extract form hook |
| `client/src/components/geospatial/NetworkNoteModal.tsx` | Keep in place; extract logic to `client/src/hooks/network/useNetworkNoteForm.ts`                   | Modal stays as UI; logic extracted      |
| `client/src/api/adminApi.ts`                            | `client/src/api/admin/{users,backups,tagging,settings,wigle,geocoding,aws,jobs,imports,ml}.ts`     | Split god service by domain             |
| `server/src/api/routes/v1/kepler.ts`                    | `server/src/api/routes/v1/kepler.ts` (thin) + `server/src/services/kepler/keplerDataService.ts`    | Extract query building to service       |
| `server/src/api/routes/v1/admin/dbStats.ts`             | `server/src/api/routes/v1/admin/db.ts` (thin) + `server/src/services/admin/adminDbStatsService.ts` | Extract stats calculation               |
| `server/src/api/routes/v1/geospatial.ts`                | Keep route; extract distance queries to `server/src/services/geospatial/geospatialQueryService.ts` | Query service encapsulates logic        |
| `server/src/services/explorerQueries.ts`                | Move to `server/src/services/modules/networks/explorerQueries.ts` (optional)                       | Domain-based grouping                   |
| `docker-compose.monitoring.yml`                         | Enhanced: add Prometheus service + config                                                          | Observability orchestration             |
| `.github/workflows/ci.yml`                              | Enhanced: add Docker build job                                                                     | CI/CD completeness                      |

---

## Modular Architecture Maturity Assessment

### Current Maturity Level: **Level 3 → Approaching Level 4**

**Maturity Scale**:

- **Level 1**: Monolithic (everything everywhere) — ❌ NOT this
- **Level 2**: Early modules (some separation, mostly mixed) — ❌ NOT this
- **Level 3**: Modular (clear boundaries, some orchestrators) — ✅ **CURRENT STATE**
- **Level 4**: Orchestrator-driven (thin orchestrators, well-bounded modules) — ✅ **TARGET (6-12 months)**
- **Level 5**: Fully modular (seamless integration, zero coupling, plug-and-play) — 🎯 **LONG-TERM**

### Evidence for Level 3 Classification

**What's Working**:

- ✅ Services have single responsibility (35+ services, each focused)
- ✅ Routes delegate to services (65% of routes are proper orchestrators)
- ✅ Custom hooks abstract data fetching (95% hook adoption)
- ✅ Zustand centralizes filter state
- ✅ Clear frontend/backend boundary (no server imports)
- ✅ Database queries parameterized throughout

**What's Blocking Level 4**:

- ⚠️ 12 monolithic components (5% of frontend) with conflated concerns
- ⚠️ 3 monolithic routes (8-10% of backend) with inline logic
- ⚠️ Form state scattered across 15+ components (no abstraction)
- ⚠️ Modal state ad-hoc (no manager)
- ⚠️ adminApi (600 lines, 20 domains) in single module

### Pathway to Level 4 (6-12 months)

**Phase 1 (Weeks 1-2)**: Extract Critical Monoliths

1. Split adminApi into 10 focused modules (4-6h) ← **IMMEDIATE IMPACT**: Removes circular imports, clarifies dependencies
2. Extract useForm hook for form state (2-3h)
3. Refactor WiglePage to orchestrator + 3 hooks (4-6h)

**Phase 2 (Weeks 3-4)**: Backend Route Cleanup 4. Extract keplerDataService, adminDbStatsService, geospatialQueryService (4-6h) 5. Create useModalManager for modal coordination (2-3h) 6. Extract AnalyticsCharts rendering logic (2-3h)

**Phase 3 (Weeks 5-8)**: Component Hierarchy & State 7. Flatten geospatial prop chains to 3 levels using context (2-3h) 8. Refactor ConfigurationTab (4-5h) 9. Consolidate duplicate hooks (1-2h)

**Phase 4 (Weeks 9-12)**: Infrastructure & Observability 10. Add Prometheus + operational metrics (7h) 11. Fix CI/CD Docker build (2-3h) 12. Audit N+1 queries and add batch limits (2-3h) 13. Path aliases for import clarity (1-2h)

**Completion Criteria for Level 4**:

- [ ] Zero monolithic components (>350 lines)
- [ ] > 90% of routes are thin orchestrators
- [ ] Form state abstracted to reusable hook
- [ ] Modal state managed centrally
- [ ] No "god services" (all services <200 lines per responsibility)
- [ ] All N+1 risks documented and mitigated
- [ ] Observability complete (Prometheus + dashboards)
- [ ] Every component has a single primary responsibility

### Transition Risks & Mitigation

| Risk                                      | Probability | Mitigation                                                                     |
| ----------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| Breaking changes in hook refactoring      | MEDIUM      | Comprehensive test coverage before refactoring; gradual migration of consumers |
| Route changes causing API contract break  | LOW         | API versioning (v1/v2 paths); backward compatibility during refactor           |
| Form state hook incompatibility           | MEDIUM      | Create hook incrementally; support both old + new patterns during transition   |
| Performance regression in split services  | MEDIUM      | Profile before/after; monitor query counts                                     |
| Deployment complexity from adminApi split | LOW         | Feature flags for gradual rollout; parallel imports                            |

---

## Risks and Considerations

### High-Risk Refactoring Areas

#### 1. **adminApi Split** (HIGH RISK)

- **Concern**: Scattered imports throughout codebase; refactoring could miss dependencies
- **Mitigation**:
  - Use grep to find all adminApi imports: `grep -r "adminApi" client/src/`
  - Create all 10 modules with barrel exports (index.ts) matching old API
  - Test each API call before migrating callers
  - Run full test suite after split

#### 2. **Form State Hook Extraction** (MEDIUM RISK)

- **Concern**: Form patterns vary (NetworkNoteModal, ConfigurationTab, admin forms); hook must be flexible
- **Mitigation**:
  - Build hook with support for custom validation, onSubmit
  - Test with 3 different form types before rollout
  - Keep old patterns working; migrate incrementally

#### 3. **WiglePage Refactoring** (MEDIUM RISK)

- **Concern**: Complex state (map refs, layer visibility, cluster colors, data fetching, agency data)
- **Mitigation**:
  - Extract hooks incrementally: useWigleMapState → useWigleLayerState → useWigleClusterColors
  - Test map rendering after each hook extraction
  - Preserve component behavior (no functional changes, only reorganization)

#### 4. **Backend Route Changes** (MEDIUM RISK)

- **Concern**: Extracting business logic from routes could affect request/response flow
- **Mitigation**:
  - Use temporary wrapper functions to validate service output matches route expectations
  - Run integration tests after each route change
  - Monitor error logs in staging environment

### Dependencies Between Refactors

```
adminApi Split (P1)
  └─→ Removes circular imports
       └─→ Enables: Admin component refactoring (P4)

useForm Hook (P3)
  └─→ Enables: ConfigurationTab refactoring (P4)
  └─→ Enables: NetworkNoteModal extraction (P10)

WiglePage Refactor (P2)
  └─→ Independent; can happen in parallel with P1, P3

Backend Service Extraction (P5-7)
  └─→ Independent; can happen in parallel

Modal Manager Hook (P8)
  └─→ Enables: New modal features without state duplication
  └─→ Can happen after useForm (share patterns)

Prometheus Setup (P13)
  └─→ Independent; runs in parallel; enhances monitoring
```

### Testing and Validation Strategy

#### **Before Refactoring**

- [ ] Run `npm test` and verify all tests pass
- [ ] Run `npm run test:cov` and note baseline coverage
- [ ] Run `npm run lint` and fix any issues
- [ ] Document current behavior (screenshots, user flows)

#### **During Refactoring**

- [ ] For each component/hook change:
  1. Extract logic to new module
  2. Create tests for new module (same coverage as original)
  3. Update consumer imports
  4. Run tests specific to that area: `npm test path/to/test`
  5. Verify visual behavior in dev environment

#### **After Refactoring**

- [ ] Full test suite: `npm test` (should pass)
- [ ] Coverage check: `npm run test:cov` (≥70%, no regression)
- [ ] Linting: `npm run lint` (clean)
- [ ] Frontend smoke tests: Start dev environment, verify all pages load
- [ ] Performance check: Lighthouse score, no regression
- [ ] Type safety: `npx tsc --noEmit` (no TS errors)

#### **Integration Testing**

- [ ] After adminApi split: Test all admin operations in staging
- [ ] After form hook extraction: Test form submission, validation, error handling
- [ ] After backend service extraction: Run integration tests with real DB

---

## Conclusion

### Current State Summary

ShadowCheck has built a **solid foundation** (Level 3 Modular) with:

- ✅ Clean separation of concerns at layer boundaries
- ✅ Strong custom hook architecture
- ✅ Security best practices (parameterized queries, secret management)
- ✅ Comprehensive Docker configuration
- ✅ Well-organized database schema with role-based access

But faces **architectural challenges** from monolithic components and services that are **preventing seamless scaling**:

- ❌ 12 frontend components >350 lines (conflated logic)
- ❌ 3 backend routes with inline business logic
- ❌ "God service" spanning 20 domains
- ❌ Scattered form/modal state management
- ❌ Observability infrastructure incomplete

### Vision for 12 Months

**Target State**: **Level 4 Orchestrator-Driven Architecture**

In 12 months, ShadowCheck should exhibit:

1. **Thin Orchestrators at Every Layer**
   - Frontend: Pages as pure composition (validate filters → render children)
   - Backend: Routes as request/response adapters (validate → delegate → respond)
   - Hooks: Data/state orchestrators with focused responsibility

2. **Domain-Driven Module Organization**
   - Frontend modules: authentication/, networks/, threats/, maps/, wigle/, admin/
   - Backend modules: networks/, threats/, geospatial/, kepler/, wigle/, admin/
   - Clear boundaries; easy to find code and understand flow

3. **Form & Modal Abstraction Layer**
   - useForm hook handles validation, submission, loading, errors
   - useModalManager centralizes modal coordination
   - All new forms/modals use abstraction; zero code duplication

4. **Fully Parameterized Backend**
   - No routes with inline queries or transformations
   - All business logic in services; services <200 lines each
   - Routes: 20-40 lines (validate → service → respond)

5. **Complete Observability**
   - Prometheus metrics for response time, error rate, throughput
   - Grafana dashboards with alerts
   - N+1 query risks audited and documented
   - Performance benchmarks tracked

6. **Automated Deployment**
   - Docker image builds in CI
   - Registry push (ECR) on success
   - Deployment automation (CloudFormation, Terraform)
   - Staged rollout with health checks

### Recommended Action Plan

**Immediate (Next Sprint)**:

1. **P1**: Split adminApi (4-6h) — HIGHEST ROI, unblocks other work
2. **P3**: Extract useForm hook (2-3h) — Enables component refactoring
3. **P2**: Refactor WiglePage (4-6h) — Reduces monolithic count

**Next 2 Sprints**: 4. **P5-7**: Extract backend services (4-6h) — Thin routes 5. **P4**: Refactor ConfigurationTab (4-5h) — Config panel split 6. **P8**: Create useModalManager (2-3h) — Modal coordination

**2-3 Months Out**: 7. **P13**: Add Prometheus observability (7h) — Operational visibility 8. **P15**: Fix CI/CD Docker automation (2-3h) — Deployment readiness 9. **P11-12**: Clean up components & hooks (5-10h) — Final polish

**Total Effort**: ~50-60 hours (3-4 engineer-months) distributed over 12 weeks = 1.5 sprints/month

### Expected Outcomes

After completing this roadmap:

- ✅ Zero monolithic components (every component <200 lines, single responsibility)
- ✅ 90%+ of routes are thin orchestrators (20-40 lines)
- ✅ Form/modal state fully abstracted (no duplication across codebase)
- ✅ Observability complete (metrics, dashboards, alerts)
- ✅ Deployment automated (Docker build, push, deploy in CI)
- ✅ Team velocity increases (clearer code → faster feature delivery)
- ✅ Bug surface area reduced (isolated logic → easier testing)

---

## Appendices

### A. All Four Track Findings (Summary Table)

| Track               | Component                   | Finding                                                              | Severity | Effort | Impact    |
| ------------------- | --------------------------- | -------------------------------------------------------------------- | -------- | ------ | --------- |
| **T1: Frontend**    | WiglePage                   | 649 lines, 10+ hooks, conflated state                                | CRITICAL | 4-6h   | HIGH      |
| **T1: Frontend**    | ConfigurationTab            | 523 lines, 13 panels, duplicated form logic                          | CRITICAL | 4-5h   | HIGH      |
| **T1: Frontend**    | AnalyticsCharts             | 542 lines, chart rendering inline                                    | HIGH     | 2-3h   | MEDIUM    |
| **T1: Frontend**    | NetworkNoteModal            | 489 lines, form logic trapped                                        | HIGH     | 2-3h   | MEDIUM    |
| **T1: Frontend**    | Geospatial pass-throughs    | 5-level prop drilling                                                | MEDIUM   | 2-3h   | MEDIUM    |
| **T1: Frontend**    | Component organization      | 44 files in geospatial/ (catch-all), 40+ in admin/tabs/              | MEDIUM   | 2-3h   | MEDIUM    |
| **T2: Hooks/Logic** | adminApi.ts                 | 600 lines, 20 domains, god service                                   | CRITICAL | 4-6h   | VERY HIGH |
| **T2: Hooks/Logic** | Form state                  | Duplicated in 15+ components, no abstraction                         | CRITICAL | 2-3h   | HIGH      |
| **T2: Hooks/Logic** | Modal state                 | Scattered across 5+ modals, ad-hoc                                   | HIGH     | 2-3h   | MEDIUM    |
| **T2: Hooks/Logic** | Validation logic            | Client/server diverge, no shared schema                              | MEDIUM   | 2-3h   | MEDIUM    |
| **T2: Hooks/Logic** | useObservations             | Duplicated with useNetworkObservations                               | LOW      | 1-2h   | LOW       |
| **T3: Backend**     | keplerHelpers.ts            | 250+ lines, query building inline in route                           | CRITICAL | 2-3h   | HIGH      |
| **T3: Backend**     | admin/dbStats.ts            | 150+ lines, stats calculation inline                                 | HIGH     | 1-2h   | MEDIUM    |
| **T3: Backend**     | geospatial distance queries | 100+ lines, ST_Distance logic inline                                 | HIGH     | 2-3h   | MEDIUM    |
| **T3: Backend**     | N+1 query risks             | Observation fetching, sibling lookups, batch limits unclear          | MEDIUM   | 2-3h   | MEDIUM    |
| **T3: Backend**     | Repository layer            | Only 10-15 files, could be formalized                                | LOW      | 2-3h   | LOW       |
| **T4: Infra**       | Observability gap           | Grafana without Prometheus, no metrics                               | HIGH     | 7h     | MEDIUM    |
| **T4: Infra**       | CI/CD incomplete            | No Docker build/push, Node version mismatch                          | HIGH     | 3h     | MEDIUM    |
| **T4: Infra**       | Service topology            | Excellent health checks, port management, secret externaliation      | —        | —      | —         |
| **T4: Infra**       | Security                    | Non-root user, Alpine base, multi-stage builds, no hardcoded secrets | —        | —      | —         |

### B. Non-Critical Observations

| Area         | Finding                                  | Recommendation                                                           | Priority |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------ | -------- |
| **Frontend** | geospatial/ deep nesting (44 components) | Reorganize into subdirectories (core/, table/, modals/, overlays/)       | LOW      |
| **Frontend** | admin/tabs/ scattered (40+ components)   | Create subdirectories per feature (backup/, wigle/, geocoding/, config/) | LOW      |
| **Frontend** | Import paths up to 6 levels deep         | Add path aliases (@/components, @/hooks)                                 | LOW      |
| **Frontend** | StartPage (382 lines)                    | Acceptable size but content-dense; monitor                               | LOW      |
| **Backend**  | WigleSearchTab (437 lines)               | Split search form from result grid                                       | MEDIUM   |
| **Backend**  | DbStatsTab (391 lines)                   | Extract stats calculation service                                        | MEDIUM   |
| **Backend**  | filterStore (500+ lines)                 | Split filters + presets into separate stores                             | LOW      |
| **Infra**    | Grafana version pinning                  | Change from `latest` to specific version (e.g., `11.2.0`)                | LOW      |
| **Infra**    | Grafana admin password                   | Default (`grafanaadmin`) should require env var                          | MEDIUM   |
| **Testing**  | Admin hooks isolation                    | Admin hooks isolated to components (acceptable), but parallel patterns   | MEDIUM   |
| **Testing**  | Integration test gaps                    | Missing tests for adminApi operations (20+ endpoints)                    | MEDIUM   |
| **Testing**  | Hook test coverage                       | useAsyncData, usePageFilters, useFilterURLSync lack tests                | MEDIUM   |

### C. References

- **AUDIT_track1_frontend.md**: 388 lines (226 components analyzed, 21,088 LOC)
- **AUDIT_track2_logic.md**: 557 lines (104 hooks, 11 API files analyzed)
- **AUDIT_track3_backend.md**: 688 lines (40+ routes, 50+ services, 117 migrations analyzed)
- **AUDIT_track4_infra.md**: 663 lines (Docker, Kubernetes, CI/CD, observability analyzed)
- **GEMINI.md**: Project configuration guidelines
- **CLAUDE.md**: General development guidance
- **docs/ARCHITECTURE.md**: System design deep-dive
- **README.md**: Project overview

---

## Final Metrics

### Code Quality Summary

| Metric                  | Target     | Current        | Status          | Trend           |
| ----------------------- | ---------- | -------------- | --------------- | --------------- |
| Avg Component Size      | <150 lines | ~95 lines      | ✅ GOOD         | Stable          |
| Monolithic %ile         | <5%        | 5%             | ⚠️ AT THRESHOLD | Needs attention |
| Routes as Orchestrators | >80%       | 65%            | ⚠️ BELOW TARGET | Improvable      |
| Deep Prop Chains        | <3 levels  | 5 levels (max) | ⚠️ NEEDS WORK   | Fixable         |
| Hook Adoption           | >70%       | 95%            | ✅ EXCELLENT    | Strong          |
| Test Coverage           | >70%       | Unknown        | ❓ NEEDS AUDIT  | —               |
| Secret Externaliation   | 100%       | 100%           | ✅ EXCELLENT    | Secure          |
| Service Separation      | >85%       | 85%            | ✅ GOOD         | Solid           |

### Timeline & Effort Estimate

| Phase                                 | Duration   | Effort | Outcome                                                     |
| ------------------------------------- | ---------- | ------ | ----------------------------------------------------------- |
| **Phase 1** (Critical Path)           | Weeks 1-2  | 10-15h | Split adminApi; extract useForm; refactor WiglePage         |
| **Phase 2** (Backend Cleanup)         | Weeks 3-4  | 8-12h  | Extract services; modal manager; analytics rendering        |
| **Phase 3** (Component Hierarchy)     | Weeks 5-8  | 8-12h  | Flatten props; refactor ConfigurationTab; consolidate hooks |
| **Phase 4** (Infrastructure)          | Weeks 9-12 | 10-15h | Prometheus setup; CI/CD fixes; N+1 audit; path aliases      |
| **Phase 5+** (Documentation & Polish) | Ongoing    | 5-10h  | Update architecture docs; create runbooks                   |
| **TOTAL**                             | 12 weeks   | 50-60h | **LEVEL 4 ACHIEVED**                                        |

---

**Report Compiled**: 2025-04-05  
**Next Review**: 2025-07-05 (after Phase 2 completion)  
**Prepared by**: Architectural Audit Process  
**Status**: ✅ FINAL
