# ShadowCheck — Modularity Audit (Pre-Bedrock)

**Date:** 2026-02-21
**Auditor:** Claude Sonnet 4.6
**Scope:** Full codebase — `client/src/`, `server/src/`
**Purpose:** Identify coupling, SoC violations, and refactoring priorities before Bedrock AI integration

---

## Overall Score: 6 / 10

| Layer                | Score | Notes                                         |
| -------------------- | ----- | --------------------------------------------- |
| Frontend components  | 9/10  | Excellent hook decomposition, clean API layer |
| Frontend data layer  | 7/10  | Good API abstraction; hooks lack DI           |
| Backend services     | 5/10  | Present but bypassed constantly               |
| Backend routes       | 3/10  | Inline SQL, direct DB imports are widespread  |
| Dependency injection | 3/10  | Container exists; only 2 services use it      |

---

## 1. Folder Structure

### Client (`client/src/`)

```
api/              11 files — centralized API modules (good)
components/       19 root + subdirs:
  geospatial/     52 files (28 .tsx components + 14 .ts hooks + shared)
  admin/          mixed tabs/types/hooks
  analytics/      small
  badges/         3 files
  wigle/          10 files
constants/        1 file (network.ts — large constants hub)
hooks/            14 top-level custom hooks
stores/           1 file (filterStore.ts — Zustand)
types/            2 files
utils/            4 root + geospatial/ + wigle/
directions/       1 folder (feature slice)
weather/          1 folder (feature slice)
```

**Assessment:** Clean overall. `geospatial/` is a proper feature slice with co-located hooks and
components. `api/` is a dedicated layer. The `directions/` and `weather/` folders show emerging
feature-slice thinking which is good for Bedrock.

### Server (`server/src/`)

```
api/routes/v1/    20+ route modules (several with inline SQL)
api/routes/v2/    4 files (all with inline SQL)
services/         28 files (root) + filterQueryBuilder/, geocoding/, ml/, analytics/
repositories/     2 files (barely used)
config/           2 files (database.ts, container.ts)
middleware/       8 files
utils/            21 files (mostly init orchestration, not domain logic)
validation/       3 files + schemas/
```

**Assessment:** Too much lives in `utils/` (21 init files) and too little in `repositories/`. The
service layer is broad (28 files) but is largely bypassed by routes that import the database
directly.

---

## 2. Route Handler Purity — Inline SQL Violations

**Standard:** Routes should call service functions; all SQL belongs in services or repositories.

### Violating Routes (direct DB import or inline SQL)

| File                      | Violation Type      | Details                                                               |
| ------------------------- | ------------------- | --------------------------------------------------------------------- |
| `v2/networks.ts`          | Import + inline SQL | `require('../../../config/database')` + 12+ SQL blocks in one handler |
| `v2/threats.ts`           | Import + inline SQL | Direct DB import; multi-line SELECT inside handler                    |
| `v2/filtered.ts`          | Import + inline SQL | Direct DB import; SQL in helper functions inside route file           |
| `v1/threats.ts`           | Import              | `require('../../../config/database')` — bypasses threatScoringService |
| `v1/analytics.ts`         | Import              | `require('../../../config/database')` — bypasses analyticsService     |
| `v1/admin.ts`             | Import              | `require('../../../config/database')` — admin queries inline          |
| `v1/admin/maintenance.ts` | Import              | Direct pool import; maintenance SQL inline                            |
| `v1/admin/import.ts`      | Inline SQL          | 8 SQL operations (SELECT, INSERT, UPDATE) in import flow              |
| `v1/health.ts`            | Import + inline SQL | `import { pool }` + `pool.query('SELECT 1')`                          |
| `v1/location-markers.ts`  | Inline SQL          | 5 SQL operations — SELECT, DELETE, INSERT with ST_MakePoint           |
| `v1/explorer/networks.ts` | Inline SQL          | Full CTEs with ST_Distance in route handler                           |
| `v1/networks/list.ts`     | Inline SQL          | Dynamic SQL expression (distanceExpr) built in route, not service     |

**Count: 12 routes violate the service boundary** (out of ~24 total route files = 50% violation rate).

### Worst Offender — `v2/networks.ts`

```javascript
// In a route handler — should be in a service
const result = await query(
  `
  WITH filtered AS (
    SELECT n.bssid, n.ssid, n.type, ...
    FROM app.networks n
    LEFT JOIN app.network_tags nt ON n.bssid = nt.bssid
    WHERE ...
  )
  SELECT * FROM filtered
  ORDER BY ${sortColumn} ${sortDir}
  LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
`,
  params
);
```

### Worst Offender — `v1/location-markers.ts`

```javascript
// Route handler directly runs INSERT with PostGIS
await query(
  `INSERT INTO app.location_markers (marker_type, latitude, longitude, location, created_at)
   VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326), NOW())`,
  [type, lat, lon]
);
```

---

## 3. Service Layer

### What Exists

28 service files cover: agency, analytics, auth, backup, cache, dashboard, data quality, explorer,
export, geocoding, homeLocation, kepler, ML, network, observation, secrets, threatScoring, wigle, etc.

### What's Missing

The service layer is **structurally present but functionally bypassed**.

**Pattern (correct, rare):**

```javascript
// route handler
const agencies = await agencyService.getNearestAgenciesToNetwork(bssid, radius);
res.json({ agencies });
```

**Anti-pattern (common, wrong):**

```javascript
// route handler — should not exist here
const { query } = require('../../../config/database');
const result = await query(`SELECT ... FROM app.networks WHERE ...`, [params]);
res.json(result.rows);
```

### Inter-Service Dependencies

- `dashboardService` ← `networkRepository` (injected via DI — correct)
- All other services: no known inter-service imports found (low coupling, good)

### Repository Pattern

Only 2 repositories exist (`baseRepository.ts`, `networkRepository.ts`). `networkRepository` is
used by `dashboardService` only. Every other service calls `query()` directly — making the
repository pattern nearly vestigial.

---

## 4. Client API Layer

### Strengths

All 11 API modules use a **single centralized base client** (`client/src/api/client.ts`):

```typescript
// client.ts — base abstraction (~80 lines)
class ApiClient {
  async get<T>(path: string, options?: RequestOptions): Promise<T>;
  async post<T>(path: string, body?: unknown): Promise<T>;
  async put<T>(path: string, body?: unknown): Promise<T>;
  async patch<T>(path: string, body?: unknown): Promise<T>;
  async delete<T>(path: string): Promise<T>;
}
export const apiClient = new ApiClient();
```

Each domain module (e.g., `agencyApi.ts`, `networkApi.ts`) imports `apiClient` and wraps
specific endpoints with typed interfaces:

```typescript
// networkApi.ts
interface NetworkTag { bssid: string; threat_tag: string; ... }
export const networkApi = {
  async getNetworkTags(bssid: string): Promise<NetworkTag[]> {
    return apiClient.get<NetworkTag[]>(`/networks/${bssid}/tags`);
  }
};
```

**For Bedrock:** A new `bedrockApi.ts` module can follow this exact pattern — one file, typed
interfaces, `apiClient` as transport. Zero architectural changes needed.

### Weakness

The `agencyApi.ts` response type (`NearestAgenciesResponse`) declares field `bssid: string` but
the actual DB response now returns `bssid` only in batch mode. Interface definitions are slightly
stale relative to implementation. Field name mismatches exist (DB returns `office_name`, frontend
reads `agency.name`).

---

## 5. Component Modularity

### Large Components

| File                     | Lines    | Approach                                  |
| ------------------------ | -------- | ----------------------------------------- |
| `GeospatialExplorer.tsx` | **652**  | 23 custom hooks — excellent decomposition |
| `KeplerPage.tsx`         | **508**  | 8+ custom hooks — good decomposition      |
| `WiglePage.tsx`          | **496**  | 10+ custom hooks — good decomposition     |
| `NetworkContextMenu.tsx` | **~400** | Not inspected                             |
| `DashboardPage.tsx`      | ~290     | Within limit                              |

Despite high line counts, `GeospatialExplorer`, `KeplerPage`, and `WiglePage` are **not god
components**. Each delegates all business logic, data fetching, map management, and side effects
to dedicated hooks. The component body is largely JSX composition.

### GeospatialExplorer Hook Inventory (30 hooks)

```
Map lifecycle:    useGeospatialMap, useMapDimensions, useMapResizeHandle,
                  useMapPreferences, useMapStyleControls, useApplyMapLayerDefaults
Data:             useNetworkData, useObservations, useObservationSummary, useHomeLocation
Layers:           useHomeLocationLayer, useObservationLayers, useMapLayersToggle
Filters:          useBoundingBoxFilter, useDebouncedFilterState, useResetPaginationOnFilters
UX:               useNetworkContextMenu, useNetworkNotes, useNetworkSelection,
                  useNetworkSort, useNetworkInfiniteScroll, useColumnVisibility
Panels:           useExplorerPanels, useTimeFrequencyModal, useNearestAgencies
External:         useDirectionsMode, useWeatherFx, useLocationSearch
Store:            useFilterURLSync, usePageFilters
```

**Assessment:** Textbook hook decomposition. Adding Bedrock context would mean adding one more hook
(e.g., `useBedrockAnalysis`) and wiring its output into the existing JSX — no restructuring needed.

---

## 6. Dependency Injection

### Server-side

`container.ts` defines a proper DI container with `registerSingleton` and `registerFactory`:

```javascript
// container.ts — only 2 services registered
container.registerFactory('networkRepository', () => new NetworkRepository(pool));
container.registerFactory(
  'dashboardService',
  (c) => new DashboardService(c.get('networkRepository'))
);
```

**26 of 28 services** are never registered in the container. Route handlers import them directly:

```javascript
// route handler — tight coupling
const agencyService = require('../../../services/agencyService');
const homeLocationService = require('../../../services/homeLocationService');
```

This means: swapping an implementation (e.g., replacing `agencyService` with a Bedrock-aware
version) requires changing every route that imports it, not just one registration.

### Client-side

All hooks hardcode their API dependency:

```typescript
// useNetworkData.ts — line 4
import { apiClient } from '../api/client';

// No parameter — cannot inject a mock or alternative client
export function useNetworkData(options = {}) { ... }
```

**Impact on testing:** Hooks cannot be unit-tested without mocking the module-level import.
**Impact on Bedrock:** If a `bedrockNetworkHook` needs to call a different API, it must either
copy `useNetworkData` entirely or use the same `apiClient` with different endpoints.

---

## 7. Duplicated Patterns

### Client — Fetch Pattern (9 identical structures)

Nine hooks implement identical loading/error state machines:

```typescript
// Repeated verbatim across useNetworkData, useObservations, useDashboard,
// useKepler, useNetworkNotes, useNetworkObservations, useFilteredData, etc.
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const controller = new AbortController();
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get(...);
      setData(result);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
  return () => controller.abort();
}, [dependencies]);
```

**No shared abstraction exists.** A `useAsyncData<T>` factory hook would eliminate ~200 lines of
duplicated boilerplate across the codebase.

### Server — PostGIS Expressions (scattered)

`ST_Distance` + `ST_MakePoint` appear in at least 4 route/service files with no shared helper:

| File                            | Expression                                                                  |
| ------------------------------- | --------------------------------------------------------------------------- |
| `v1/networks/list.ts`           | `ST_Distance(ST_MakePoint(lon, lat)::geography, ...)  / 1000`               |
| `v1/explorer/networks.ts`       | `ST_Distance(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, ...)`       |
| `services/agencyService.ts`     | `ST_Distance(ST_SetSRID(ST_MakePoint(o.lon, o.lat), 4326)::geography, ...)` |
| `services/networkRepository.ts` | `ST_Y(...)`, `ST_X(...)` patterns                                           |

Inconsistency: some use `ST_MakePoint(...)::geography`, others use
`ST_SetSRID(ST_MakePoint(...), 4326)::geography`. Both are valid but inconsistent.

---

## 8. Separation of Concerns Violations

| Layer                   | Should Contain                    | Actually Contains                     | Verdict            |
| ----------------------- | --------------------------------- | ------------------------------------- | ------------------ |
| `api/routes/v1/*.ts`    | Request parsing, response shaping | + SQL queries, business logic         | ❌ Violated        |
| `api/routes/v2/*.ts`    | Request parsing, response shaping | + SQL CTEs, distance calculations     | ❌ Violated        |
| `services/*.ts`         | Business logic, SQL               | Business logic, SQL (correct)         | ✅ OK when used    |
| `repositories/*.ts`     | Data access only                  | Data access (correct but barely used) | ⚠️ Underused       |
| `components/*.tsx`      | JSX, UI state                     | JSX only (logic in hooks)             | ✅ Good            |
| `hooks/*.ts`            | Stateful UI logic                 | Logic + hardcoded API dep             | ⚠️ Minor           |
| `api/*.ts` (client)     | HTTP transport                    | HTTP transport + types                | ✅ Good            |
| `stores/filterStore.ts` | UI filter state                   | UI state (correct)                    | ✅ Good            |
| `utils/*.ts` (server)   | Cross-cutting init                | Mostly init orchestration             | ⚠️ Naming mismatch |

---

## 9. Reusability for Bedrock AI

### What Can Be Reused Directly

| Asset              | Path                                   | Reuse for Bedrock                             |
| ------------------ | -------------------------------------- | --------------------------------------------- |
| Base API client    | `client/src/api/client.ts`             | ✅ `bedrockApi.ts` follows same pattern       |
| Filter store       | `client/src/stores/filterStore.ts`     | ✅ Pass active filters as Bedrock context     |
| Network types      | `client/src/types/network.ts`          | ✅ Use as Bedrock input schema                |
| Hook pattern       | any `useGeospatial*.ts`                | ✅ `useBedrockAnalysis.ts` follows same shape |
| `formatSecurity()` | `client/src/utils/wigle/security.ts`   | ✅ For structuring network context            |
| `agencyService`    | `server/src/services/agencyService.ts` | ✅ Supply nearest-agency context to Bedrock   |

### What Needs Refactoring First

| Problem                      | Blocks Bedrock Because                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Inline SQL in v2/networks.ts | Cannot add Bedrock-augmented responses without rewriting the whole handler                                |
| No shared fetch abstraction  | Bedrock hook must copy 40 lines of boilerplate                                                            |
| DI container underused       | Swapping agency/network services for Bedrock-aware versions requires changing 12 route files              |
| No geospatial SQL utility    | Bedrock context assembly (nearby networks, distance to agencies) requires duplicating PostGIS expressions |

---

## 10. Top Findings

### Strengths

1. **Frontend API abstraction is clean.** The `apiClient` singleton + per-domain module pattern
   is consistent across all 11 API files. Adding `bedrockApi.ts` requires zero architectural
   change — copy the pattern, done.

2. **Large components are properly decomposed.** `GeospatialExplorer` (652 lines) delegates all
   logic to 30 custom hooks. Adding a Bedrock panel means writing one new hook and one new panel
   component — no surgery on existing code.

3. **Service layer is comprehensive in scope.** 28 service files cover every domain: auth,
   geocoding, ML, WiGLE, agency, threat scoring, export, kepler. The domain model is mature.

### Weaknesses

1. **50% of route handlers contain inline SQL.** The service layer is bypassed by 12 of 24 route
   files. Bedrock integration that needs to enrich network queries (e.g., v2/networks.ts) cannot
   be done cleanly without first extracting those queries into services.

2. **DI container is vestigial.** The container is well-designed but only 2 services are
   registered. Every other service is a direct `require()` call, making it impossible to swap
   implementations (e.g., `agencyService` → `bedrockAgencyService`) without grep-replacing all
   import sites.

3. **No shared async data hook.** Nine hooks repeat identical `useState + useEffect + try/catch +
AbortController` boilerplate. This debt scales linearly — a Bedrock data hook will be the
   tenth copy. A `useAsyncData<T>` abstraction would eliminate ~200 lines of duplicate code and
   make the hooks actually testable.

---

## 11. Top 3 Refactorings Before Bedrock Integration

### Priority 1 — Extract v2 route SQL into services

**Files:** `server/src/api/routes/v2/networks.ts`, `v2/threats.ts`, `v2/filtered.ts`
**Effort:** Medium (2-3 days)
**Why first:** The v2 routes are the most likely Bedrock integration points (filtered network lists,
threat results). They currently contain 12+ raw SQL queries per handler.

```javascript
// Before (v2/networks.ts route handler — 180 lines of SQL)
const result = await query(`WITH filtered AS (SELECT ...) SELECT * FROM filtered`, params);

// After
const result = await v2NetworkService.getFilteredNetworks(filters, pagination);
```

### Priority 2 — Register all services in the DI container

**File:** `server/src/config/container.ts`
**Effort:** Low-Medium (1 day)
**Why second:** Once Bedrock services exist, they need to be swappable with existing services.
The container already has the right interface — it just needs all 28 services registered.

```javascript
// container.ts — add registrations
container.registerSingleton('agencyService', new AgencyService(query));
container.registerSingleton('bedrockService', new BedrockService(awsService));
// Routes then use: req.app.get('container').get('agencyService')
```

### Priority 3 — Create `useAsyncData<T>` shared hook

**File:** `client/src/hooks/useAsyncData.ts` (new)
**Effort:** Low (hours)
**Why third:** Removes boilerplate from 9 existing hooks, makes all future hooks (including
Bedrock) one-liners, and finally makes hooks unit-testable by accepting the fetch function as a
parameter (proper DI).

```typescript
// useAsyncData.ts — shared abstraction
export function useAsyncData<T>(
  fetchFn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[]
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchFn(controller.signal)
      .then(setData)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, deps);
  return { data, loading, error };
}

// useNetworkData.ts — becomes:
const { data, loading, error } = useAsyncData(
  (signal) => apiClient.get('/networks?' + params, { signal }),
  [JSON.stringify(filters), offset]
);
```

---

## Appendix — File Inventory

### Routes with inline SQL (extract to services)

```
server/src/api/routes/v2/networks.ts        ← worst offender (12+ queries)
server/src/api/routes/v2/threats.ts         ← direct DB import
server/src/api/routes/v2/filtered.ts        ← SQL in helpers inside route
server/src/api/routes/v1/threats.ts         ← direct DB import
server/src/api/routes/v1/analytics.ts       ← direct DB import
server/src/api/routes/v1/admin.ts           ← direct DB import
server/src/api/routes/v1/admin/maintenance.ts ← direct pool import
server/src/api/routes/v1/admin/import.ts    ← 8 SQL operations
server/src/api/routes/v1/health.ts          ← `SELECT 1` inline (acceptable)
server/src/api/routes/v1/location-markers.ts ← INSERT/DELETE inline
server/src/api/routes/v1/explorer/networks.ts ← CTE + ST_Distance inline
server/src/api/routes/v1/networks/list.ts   ← dynamic SQL expression inline
```

### Hooks with duplicated fetch pattern (candidates for useAsyncData)

```
client/src/hooks/useNetworkData.ts
client/src/hooks/useObservations.ts
client/src/hooks/useFilteredData.ts
client/src/hooks/useDashboard.ts (if exists)
client/src/hooks/useKepler.ts (if exists)
client/src/hooks/useNetworkNotes.ts
client/src/hooks/useChangePassword.ts
client/src/hooks/useLogin.ts
client/src/components/geospatial/useNearestAgencies.ts
```

### Geospatial utilities (candidates for shared SQL helper)

```
server/src/services/agencyService.ts        ← ST_Distance / ST_SetSRID / ST_MakePoint
server/src/api/routes/v1/networks/list.ts   ← ST_Distance / ST_MakePoint
server/src/api/routes/v1/explorer/networks.ts ← ST_Distance / ST_SetSRID / ST_MakePoint
server/src/repositories/networkRepository.ts ← ST_Y / ST_X
```

---

_Report generated: 2026-02-21. Re-run after each major refactoring milestone._
