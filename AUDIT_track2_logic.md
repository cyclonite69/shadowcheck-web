# TRACK 2 AUDIT: Hooks, Services, and State Management

**Audit Date**: 2025-04-05
**Scope**: client/src/hooks/, client/src/api/, client/src/stores/, client/src/constants/, utilities, services
**Total Files Analyzed**: 104 hook files + 11 API files + utilities + constants

---

## Custom Hooks Inventory

### Data Fetching & Network Hooks

| Hook              | File                     | Purpose                               | State/Effects                                             | Dependencies                               | Lines |
| ----------------- | ------------------------ | ------------------------------------- | --------------------------------------------------------- | ------------------------------------------ | ----- |
| `useAuth`         | hooks/useAuth.tsx        | Authentication state and login/logout | user, token, isAuthenticated, loading, mustChangePassword | localStorage, authApi, JWT                 | ~150  |
| `useNetworkData`  | hooks/useNetworkData.ts  | Paginated network list with filtering | networks[], total, loading, pagination state              | useAdaptedFilters, networkApi, filterStore | ~180  |
| `useObservations` | hooks/useObservations.ts | Observation fetching by BSSID set     | observationsByBssid[], loading, total                     | networkApi, selectedNetworks               | ~160  |
| `useNetworkNotes` | hooks/useNetworkNotes.ts | Fetch/manage network notes            | notes[], loading, error, cacheKey                         | networkApi, bssid, cache                   | ~120  |
| `useFilteredData` | hooks/useFilteredData.ts | Centralized filtered data fetching    | filteredNetworks[], metrics                               | useAdaptedFilters, v2Api                   | ~140  |
| `useDashboard`    | hooks/useDashboard.ts    | Dashboard metrics and summaries       | metrics, threats, lastUpdate                              | dashboardApi, caching                      | ~100  |
| `useKepler`       | hooks/useKepler.ts       | Kepler.gl data and viewport state     | keplerState, config, bounds                               | keplerApi, mapState                        | ~130  |
| `useKeplerDeck`   | hooks/useKeplerDeck.ts   | Deck.gl layer management for Kepler   | deckInstance, layers, viewport                            | mapbox-gl, deck.gl                         | ~180  |

### Filter & URL Synchronization

| Hook                | File                       | Purpose                                         | State/Effects                  | Key Features                                 |
| ------------------- | -------------------------- | ----------------------------------------------- | ------------------------------ | -------------------------------------------- |
| `useAdaptedFilters` | hooks/useAdaptedFilters.ts | Universal filter system with capability scoping | filters, enabled, applyFilters | Page-scoped, URL-synced, validation          |
| `useFilterURLSync`  | hooks/useFilterURLSync.ts  | Bidirectional URL ↔ filter state sync           | N/A (side effect)              | useEffect watches filterStore, updates URL   |
| `usePageFilters`    | hooks/usePageFilters.ts    | Page-scoped filter registration                 | currentPage state              | Integrates with filterStore.setCurrentPage() |

### Form & Input Management

| Hook                | File                       | Purpose                         | State/Effects                            | Notes                       |
| ------------------- | -------------------------- | ------------------------------- | ---------------------------------------- | --------------------------- |
| `useLogin`          | hooks/useLogin.ts          | Login form state and submission | username, password, error, loading       | Form-specific validation    |
| `useChangePassword` | hooks/useChangePassword.ts | Password change form            | oldPassword, newPassword, confirm, error | Validation, API integration |
| `useAsyncData`      | hooks/useAsyncData.ts      | Generic async data fetching     | data, loading, error, refetch            | Reusable wrapper            |

### Admin & Specialized Features

| Hook                       | File                            | Purpose                                | State/Effects                    | Scope                                     |
| -------------------------- | ------------------------------- | -------------------------------------- | -------------------------------- | ----------------------------------------- |
| `useAwsInstanceAction`     | hooks/useAwsInstanceAction.ts   | AWS EC2 instance control               | action state, error, result      | Component-scoped                          |
| **useWigleFileUpload**     | hooks/useWigleFileUpload.ts     | File upload handling for WiGLE imports | uploadProgress, fileState, error | **OLD**: Migration candidate              |
| **useNetworkObservations** | hooks/useNetworkObservations.ts | Alternative observation fetching       | observationData[]                | **DUPLICATE**: Similar to useObservations |

### Component-Local Hooks (Admin Sub-Directory)

Hooks in `client/src/components/admin/hooks/` (9 files):

- `useAwsOverview` - AWS region/instance enumeration
- `useBackups` - Backup history and restore operations
- `useConfiguration` - Configuration panel state
- `useMLTraining` - ML model training coordination
- `useWigleSearch` - WiGLE database search
- `useWigleDetail` - WiGLE network detail fetching
- `useGeocodingCache` - Geocoding provider management
- `usePgAdmin` - PgAdmin container operations
- `useDataImport` - Data import workflow coordination

**Pattern**: Admin hooks are **isolated to admin components** - acceptable for feature scope but creates parallel state management patterns.

### Geospatial Hooks (Component-Local)

Hooks in `client/src/components/geospatial/`:

- `useGeospatialExplorerState` - Explorer mode, selections
- `useNetworkContextMenu` - Context menu state and operations
- `useNetworkSelection` - Selected networks state
- `useNearestAgencies` - Proximity calculations
- `useSiblingLinks` - Sibling network relationships
- `useTimeFrequencyModal` - Modal visibility state
- `useWigleLayers` - WiGLE layer visibility persistence
- `useWigleData` - WiGLE v2/v3 point fetching
- `useWigleKmlData` - KML data source integration
- `useWigleMapInit` - Mapbox GL initialization

**Assessment**: Geospatial hooks are **domain-appropriate** but create localized state silos. No cross-feature coordination.

### Analytics Hooks

Hooks in `client/src/components/analytics/hooks/`:

- `useAnalyticsData` - Chart data fetching and processing
- `useAnalyticsFilters` - Filter subset for analytics
- `useCardLayout` - Responsive card arrangement

**Assessment**: Well-scoped; minimal duplication.

---

## Service Files Inventory (API Layer)

### API Modules in client/src/api/

| File              | Endpoints             | Purpose                                       | Features                                       | ~Lines         |
| ----------------- | --------------------- | --------------------------------------------- | ---------------------------------------------- | -------------- |
| `client.ts`       | Base HTTP client      | Request/response intercepting, error handling | Axios config, auth header injection            | ~80            |
| `authApi.ts`      | /auth/\*              | User authentication and session               | login, logout, changePassword, refreshToken    | ~90            |
| `networkApi.ts`   | /api/networks/\*      | Network data retrieval                        | getNetworks, getNetworkDetail, getObservations | ~120           |
| `dashboardApi.ts` | /api/dashboard/\*     | Dashboard metrics                             | getDashboardMetrics, getThreatSummary          | ~60            |
| `analyticsApi.ts` | /api/analytics/\*     | Analytics charts and statistics               | getChartData, getMetrics, getTimeSeries        | ~70            |
| `keplerApi.ts`    | /api/kepler/\*        | Kepler.gl data export                         | getKeplerData, getObservations, getNetworks    | ~80            |
| `wigleApi.ts`     | /api/wigle/\*         | WiGLE search and detail                       | search, detail, observations                   | ~100           |
| `locationApi.ts`  | /api/home-location/\* | Home location management                      | getLocation, setLocation, deleteLocation       | ~50            |
| `agencyApi.ts`    | /api/agencies/\*      | Agency office/courthouse data                 | getOffices, getCourthhouses                    | ~40            |
| `mapboxApi.ts`    | (external)            | Mapbox style proxy                            | proxyStyle, proxyData                          | ~60            |
| `adminApi.ts`     | /api/admin/\*         | Administrative operations                     | Very broad scope                               | **~600 lines** |

### adminApi.ts - CRITICAL ANALYSIS

**File Size**: 600+ lines
**Scope**: Handles 20+ distinct operational domains:

- User management (createUser, updateUser, deleteUser, resetPassword)
- Backup operations (getBackups, startBackup, restoreBackup)
- Network tagging (tagNetwork, untagNetwork, getTags)
- Settings (getSetting, setSetting)
- WiGLE operations (searchWigle, getWigleDetail, updateStats)
- Geocoding (runGeocoding, getGeocodingStatus, clearCache)
- AWS operations (describeInstances, startInstance, stopInstance)
- Database stats (getDbStats, getTableStats)
- ML training (startTraining, getTrainingStatus)
- Orphan networks (getOrphanNetworks, reconcile)
- Data import (importData, getImportHistory)
- Job scheduling (createJob, updateJob, getJobStatus)

**Issue**: **GOD SERVICE** - violates single responsibility
**Solution**: Split into domain-specific modules:

```
adminApi.ts → {
  userApi.ts (user management)
  backupApi.ts (backup operations)
  taggingApi.ts (network tagging)
  settingsApi.ts (configuration)
  wigleAdminApi.ts (WiGLE operations)
  geocodingAdminApi.ts (geocoding)
  awsAdminApi.ts (AWS operations)
  jobsApi.ts (job scheduling)
  importApi.ts (data import)
  mlApi.ts (ML operations)
}
```

---

## State Management Pattern Analysis

### Zustand (Single Store)

**File**: `client/src/stores/filterStore.ts`
**Lines**: ~568
**State Scope**: Universal filter state with page-scoped subsets

**Structure**:

```typescript
HardenedFilterStore {
  // Global state
  currentPage: string
  pageStates: Record<string, PageFilterState>
  presets: Record<string, FilterState>

  // Page-specific actions
  setCurrentPage(page)
  getCurrentFilters()
  setFilter(key, value)

  // Persistence via zustand/middleware
  persist({ name: 'shadowcheck-filters-v2' })
}
```

**Assessment**:

- ✅ Centralized filter state
- ✅ Page-scoped isolation
- ✅ URL synchronization support
- ✅ Preset management
- ⚠️ Could split: presets → separate store
- ⚠️ Monolithic: 500+ lines; consider splitting into domain stores

---

## Logic Distribution Across Layers

### WHERE Logic Lives (Audit)

```
Architecture Layers:
├── Components (client/src/components/)
│   ├── Presentation logic (rendering, styling) ✅
│   ├── State management (useState overuse) ⚠️
│   ├── Form validation (scattered) ⚠️
│   └── Business logic (conflated in monoliths) ⚠️
│
├── Hooks (client/src/hooks/)
│   ├── Data fetching (custom hooks) ✅
│   ├── Form management (minimal) ⚠️
│   ├── Validation (via Yup/Zod, minimal) ⚠️
│   └── State coordination ✅
│
├── API Layer (client/src/api/)
│   ├── HTTP transport ✅
│   ├── Request/response transformation ✅
│   ├── Error handling (basic) ⚠️
│   └── Domain separation (poor in adminApi) ⚠️
│
├── Stores (client/src/stores/)
│   └── Global state (filters only) ⚠️
│
├── Utils (client/src/utils/)
│   ├── Formatting (good scope) ✅
│   ├── Calculations (geospatial, good) ✅
│   ├── Constants (well-organized) ✅
│   └── URL parsing (good) ✅
│
└── Constants (client/src/constants/)
    └── Magic values ✅
```

---

## Duplicated Logic Analysis

### Identified Duplications

#### 1. **Observation Fetching** (2 implementations)

- `useObservations` (hooks/useObservations.ts)
- `useNetworkObservations` (hooks/useNetworkObservations.ts)

**Duplication**: Both fetch observations for selected BSSIDs
**Solution**: Keep useObservations; deprecate useNetworkObservations; migrate callers

**Impact**: MEDIUM - Creates confusion about which hook to use

#### 2. **Filter Validation** (scattered)

- `filterStore.validateFilters()` - Zustand store method
- Component-level validation in FilterPanel
- API-side validation in server routes

**Duplication**: RSSI bounds, threat score range, GPS accuracy checks
**Solution**: Extract to shared validation schema (filterValidation.ts)

**Impact**: MEDIUM - Validation logic out of sync between frontend/backend

#### 3. **Network Detail Display** (duplicated)

- GeospatialExplorer (table cell rendering)
- Admin NetworkExplorer (separate implementation)
- WiglePage (network markers)

**Duplication**: BSSID formatting, signal strength badges, type badges
**Solution**: Centralize in networkDisplay.ts utility

**Impact**: LOW - UI duplication, not business logic

#### 4. **Date/Time Formatting** (scattered)

- utils/formatting.ts (partial)
- components/geospatial/cellRenderers.tsx (inline)
- admin components (inline)

**Duplication**: Timestamp → human-readable formatting
**Solution**: Audit utils/formatting.ts; standardize

**Impact**: LOW - Presentation only

#### 5. **API Error Handling** (inconsistent)

- adminApi.ts catches and logs
- networkApi.ts throws
- Some components implement try/catch

**Inconsistency**: No unified error handling strategy
**Solution**: Middleware in client.ts axios interceptor

**Impact**: MEDIUM - Inconsistent user experience

---

## God-Utils Files Analysis

### client/src/utils/ Directory Structure

| File              | Functions | Responsibility                             | Lines | Assessment            |
| ----------------- | --------- | ------------------------------------------ | ----- | --------------------- |
| formatting.ts     | ~20       | Format timestamps, numbers, BSSID, SSID    | ~200  | ✅ Focused            |
| filterUrlState.ts | ~10       | Serialize/deserialize filters to/from URL  | ~180  | ✅ Focused            |
| geospatial/       | (subdir)  | Distance, bearing, coordinate calculations | ~400  | ✅ Domain-appropriate |
| wigle/            | (subdir)  | WiGLE-specific utilities, GeoJSON mapping  | ~300  | ✅ Focused            |
| mapUtils.ts       | ~8        | Mapbox GL utility functions                | ~120  | ✅ Focused            |
| constants.ts      | ~50+      | Magic values, limits, defaults             | ~300  | ⚠️ Growing            |

### client/src/constants/ Directory

| File         | Constants              | Purpose                     | Assessment     |
| ------------ | ---------------------- | --------------------------- | -------------- |
| filters.ts   | Filter types, defaults | Filter system configuration | ✅ Appropriate |
| colors.ts    | Color palette          | Tailwind color references   | ✅ Appropriate |
| mapStyles.ts | Mapbox style URLs      | Map configuration           | ✅ Appropriate |
| threats.ts   | Threat levels, scoring | Threat classification       | ✅ Appropriate |
| limits.ts    | Pagination, timeouts   | System limits               | ✅ Appropriate |

**Assessment**: Utilities are **well-organized by domain**. No god-utils detected.

---

## Missing Abstractions

### Critical Missing Abstractions

#### 1. **Form State Management Hook**

**Evidence**: Form logic repeated in:

- NetworkNoteModal (form state, validation, submission)
- ConfigurationTab (13 different forms)
- Multiple admin forms

**Missing Hook**:

```typescript
useForm(initialValues, onSubmit, validate) → {
  values, errors, touched, isSubmitting, handleChange, handleSubmit, reset
}
```

**Impact**: HIGH - Duplicated form logic across 15+ components

#### 2. **Validation Schema Export**

**Evidence**:

- Yup schemas exist in server/src/validation/
- Frontend re-implements validation logic
- No shared validation rules

**Missing**: Shared validation module or types export from server

**Impact**: MEDIUM - Client/server validation mismatch risk

#### 3. **Modal Management Context**

**Evidence**: Modal state scattered:

- NetworkNoteModal (own state)
- WigleLookupDialog (own state)
- NetworkTimeFrequencyModal (own state)
- Multiple admin dialogs (own state)

**Missing Hook**:

```typescript
useModalManager(modalType) → { isOpen, open, close, data }
```

**Impact**: MEDIUM - Scaling pain as more modals added

#### 4. **Pagination Hook**

**Evidence**: Pagination implemented independently in:

- useNetworkData (pagination state)
- AnalyticsPage (manual limit/offset)
- Multiple tables (custom pagination logic)

**Missing Hook**:

```typescript
usePagination(total, itemsPerPage) → { page, pageSize, offset, hasMore, nextPage, prevPage }
```

**Impact**: LOW-MEDIUM - Duplication, inconsistent UX

#### 5. **Table Column Management**

**Evidence**: Table columns/sorting/filtering scattered:

- NetworkTableHeaderGrid (custom column logic)
- cellRenderers.tsx (inline rendering)
- AnalyticsCharts (chart-specific rendering)

**Missing**: Column definition schema and rendering engine

**Impact**: MEDIUM - Duplicated table logic

---

## Service/Hook Layer Violations

### Services with DOM/Ref Access (Anti-Pattern)

**Scan Results**:

- ✅ NO services found accessing DOM directly
- ✅ NO services directly managing Mapbox GL refs
- ✅ Proper separation: hooks manage refs, services handle data

**Assessment**: CLEAN - Proper layer boundaries

---

## State Management Assessment

### Centralization vs Scattering

| State Type       | Location                | Pattern        | Assessment                            |
| ---------------- | ----------------------- | -------------- | ------------------------------------- |
| **Global State** | filterStore (Zustand)   | ✅ Centralized | Single source of truth for filters    |
| **Page State**   | Component local + hooks | ⚠️ Scattered   | Each page manages own state           |
| **Form State**   | Component local         | ⚠️ Scattered   | No shared form state management       |
| **Modal State**  | Component local         | ⚠️ Scattered   | Each modal manages own state          |
| **Server Fetch** | Custom hooks            | ✅ Centralized | useNetworkData, useObservations, etc. |
| **Auth State**   | useAuth context         | ✅ Centralized | AuthProvider in App.tsx               |
| **UI State**     | Component local         | ✅ Acceptable  | Localized to component scope          |

**Overall Assessment**: **PARTIALLY MODULAR**

- ✅ Data fetching: Well-abstracted via hooks
- ✅ Authentication: Centralized via context
- ✅ Filters: Centralized via Zustand
- ⚠️ Forms: Scattered, needs abstraction
- ⚠️ Modals: Scattered, needs management layer
- ⚠️ Page state: Duplicated patterns across pages

---

## Logic Extraction Opportunities

### Components with Extractable Logic

#### 1. **WiglePage** → Extract 3 hooks

```typescript
// Extract to hooks/wigle/
useWigleMapState(); // Map refs, initialization
useWigleLayerState(); // Layer visibility (already exists as useWigleLayers)
useWigleClusterColors(); // Cluster color caching and updates
```

#### 2. **ConfigurationTab** → Extract form management

```typescript
// Extract to hooks/admin/
useConfigurationForm(panel); // Form state, validation, submission per panel
```

#### 3. **NetworkNoteModal** → Extract form logic

```typescript
// Extract to hooks/network/
useNetworkNoteForm(bssid); // Note CRUD, validation, loading state
```

#### 4. **AnalyticsCharts** → Extract rendering logic

```typescript
// Extract to services/analytics/
analyticsChartRenderer.ts; // Chart configuration, color mapping, legend rendering
```

**Total Extractable Logic**: ~600 lines across 4 components
**Estimated Time**: 6-8 hours refactoring

---

## Integration Testing Gaps

### Hooks Not Under Test

- `useAsyncData` (generic utility - should have tests)
- `usePageFilters` (context integration - no tests found)
- `useFilterURLSync` (side-effect heavy - needs tests)
- Admin hooks (isolated to admin feature - acceptable)

### API Layer Tests

- **adminApi.ts**: No mock/integration tests for 20+ operations
- **Other APIs**: Basic tests exist in client/src/api/**tests**

**Recommendation**: Add integration tests for:

1. Filter state synchronization (filterStore ↔ URL ↔ API)
2. adminApi operations (CRUD, bulk operations)
3. Authentication flow (login, logout, refresh)

---

## Performance Considerations

### Hook-Level Optimizations

| Hook                | Issue                              | Impact | Solution                                 |
| ------------------- | ---------------------------------- | ------ | ---------------------------------------- |
| `useAdaptedFilters` | Recalculates on every store change | MEDIUM | Already optimized with Zustand selectors |
| `useNetworkData`    | Refetches on filter change         | LOW    | Debouncing needed (hook param)           |
| `useObservations`   | N+1 risk if called in loop         | MEDIUM | Batch BSSID fetching recommended         |
| `useKepler`         | Large viewport transformations     | MEDIUM | Memoization + worker thread candidate    |

### Caching Strategy

- ✅ Filter state cached in localStorage (filterStore)
- ⚠️ Network data cached per fetch (no persistent cache)
- ⚠️ Observations not cached between requests
- ✅ Auth token cached in secure storage

**Recommendation**: Add Redis-backed caching for:

1. Observation data (24-hour TTL)
2. Network metadata (7-day TTL)
3. Geocoding results (persistent)

---

## Scoring Summary

### Hooks & Custom Logic Layer Score: **7/10 - GOOD**

**Breakdown**:
| Category | Score | Status |
|----------|-------|--------|
| Data Fetching Hooks | 8/10 | ✅ Well-structured |
| Form State Management | 4/10 | ⚠️ Scattered |
| Modal Management | 5/10 | ⚠️ Ad-hoc |
| API Organization | 6/10 | ⚠️ adminApi bloated |
| State Centralization | 7/10 | ⚠️ Partial |
| Validation Logic | 5/10 | ⚠️ Duplicated |
| Error Handling | 6/10 | ⚠️ Inconsistent |
| Testing Coverage | 6/10 | ⚠️ Gaps in hooks |

---

## Key Findings

### Strengths

1. ✅ **Data Fetching Abstraction**: Well-designed custom hooks (useNetworkData, useObservations)
2. ✅ **Centralized Filter State**: Zustand implementation with page scoping
3. ✅ **URL Synchronization**: Filter state syncs with URL for bookmarking
4. ✅ **Authentication Isolation**: useAuth context provides clean abstraction
5. ✅ **Utility Organization**: Utilities well-scoped by domain
6. ✅ **Constants Management**: Centralized, organized by feature
7. ✅ **API Client Pattern**: Axios-based with interceptors

### Critical Gaps

1. ⛔ **adminApi.ts (GOD SERVICE)**: 600 lines handling 20+ domains
   - Solution: Split into 10+ domain-specific modules
   - Effort: 4-6 hours
   - Priority: HIGH

2. ⛔ **Form State Duplication**: Logic repeated in 15+ components
   - Solution: Create useForm hook
   - Effort: 2-3 hours
   - Priority: HIGH

3. ⛔ **Modal State Scattered**: 5+ modals manage own state
   - Solution: Create useModalManager context
   - Effort: 2-3 hours
   - Priority: MEDIUM

4. ⛔ **Validation Logic Mismatch**: Client/server validation diverges
   - Solution: Share validation schema from server
   - Effort: 3-4 hours
   - Priority: MEDIUM

5. ⛔ **Observation Fetching Duplication**: useObservations + useNetworkObservations
   - Solution: Consolidate into single hook
   - Effort: 1-2 hours
   - Priority: LOW

### High-Priority Actions

1. **Split adminApi.ts** into domain-specific modules (HIGH priority, 4-6 hours)
2. **Extract useForm hook** for form state management (HIGH priority, 2-3 hours)
3. **Create useModalManager** for modal coordination (MEDIUM priority, 2-3 hours)
4. **Share validation schema** between client/server (MEDIUM priority, 3-4 hours)
5. **Add integration tests** for hooks and API calls (MEDIUM priority, 4-5 hours)

---

## Conclusion

The logic layer demonstrates **strong patterns for data fetching and global state** (filters, auth) but shows **scattered patterns for forms, modals, and validation**. The primary risk is the **adminApi.ts "god service"** which should be split into 10+ domain-specific modules.

**Overall Score**: **7/10 - GOOD with critical improvements needed**

- Strengths: Custom hook architecture, filter synchronization, API client pattern
- Gaps: Form abstraction, modal management, adminApi consolidation
- Path Forward: Extract form/modal management; split adminApi; share validation schemas

Recommended timeline: **15-20 hours refactoring over 2 sprints**
