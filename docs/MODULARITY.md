# Modularity Framework

## Philosophy

ShadowCheck uses **responsibility-based modularity**, not arbitrary line limits.

A single-responsibility 800-line file is better than a forced 3-way 300-line split.

## The 4-Test Framework

Every module (file/function/component) should pass these tests:

### TEST 1: Primary Responsibility

**"In one sentence, what is this file's main job?"**

✅ **Good answers:**

- "Handle GET /networks requests"
- "Validate network BSSID formats"
- "Render the Mapbox map viewport"

❌ **Bad answers:**

- "Handle networks, cache data, validate, and format responses"
- "Render the map, manage layers, handle zoom, and track analytics"

**Decision:** Can you answer in one sentence? If no, it's doing too much.

### TEST 2: Distinct Jobs Count

**"How many separate, unrelated jobs is this doing?"**

List them:

```
Job 1: [What]
Job 2: [What]
Job 3: [What]
```

✅ **1-2 jobs:** Probably OK to keep together
❌ **3+ distinct jobs:** Needs splitting

### TEST 3: Cohesion Test

**"Do all lines exist because of the primary responsibility?"**

- ✅ YES: "Every line is needed for X" → KEEP
- ❌ NO: "Some lines are utils, some are edge cases" → SPLIT

### TEST 4: Independence Test

**"Could someone understand this module without reading the rest of the app?"**

- ✅ YES: "It's self-contained" → GOOD BOUNDARY
- ❌ NO: "Requires knowledge of 5 other modules" → TIGHT COUPLING

## Current Modularity Status

### Files That PASSED All Tests (Keep As-Is)

#### `networks/list.ts` (835 lines)

- **Primary:** Handle GET /networks endpoint
- **Jobs:** 1 (single endpoint implementation)
- **Cohesion:** ✅ All 835 lines serve parameter parsing → SQL building → response formatting for one endpoint
- **Independence:** ✅ Understands /networks in isolation
- **Verdict:** KEEP - Coherent despite size

#### `AnalyticsCharts.tsx` (501 lines)

- **Primary:** Orchestrate analytics dashboard charts
- **Jobs:** 1 (display multiple chart types for analytics)
- **Cohesion:** ✅ All charts contribute to single analytics view
- **Independence:** ✅ Analytics dashboard self-contained
- **Verdict:** KEEP - Single orchestration purpose

### Files That FAILED Tests (Need Refactoring)

#### PRIORITY 1: `universalFilterQueryBuilder.ts` (2010 lines)

- **Primary:** Build database filter queries
- **Jobs:** 4+ distinct query builders for different domains
- **Cohesion:** ❌ ObservationFilters, NetworkQueries, GeospatialQueries, AnalyticsQueries all mixed
- **Independence:** ❌ Can't understand one builder without reading others
- **Verdict:** SPLIT into 5 modules
  - `ObservationFilterBuilder.ts` (~500 lines)
  - `NetworkQueryBuilder.ts` (~600 lines)
  - `GeospatialQueryBuilder.ts` (~250 lines)
  - `AnalyticsQueryBuilder.ts` (~400 lines)
  - `index.ts` coordinator (~200 lines)

#### PRIORITY 2: `GeospatialExplorer.tsx` (622 lines)

- **Primary:** Display interactive geospatial map
- **Jobs:** 3+ (map rendering, controls, resizing, sidebar)
- **Cohesion:** ❌ Map viewport, controls, layout handling mixed
- **Independence:** ❌ Hard to understand what "explorer" means
- **Verdict:** SPLIT into 4 modules
  - `MapContainer.tsx` - Viewport & rendering (~150 lines)
  - `LocationControls.tsx` - Map controls (~80 lines)
  - `ResizeHandler.tsx` - Container sizing (~60 lines)
  - `GeospatialExplorer.tsx` - Container (~200 lines)

#### PRIORITY 2: `KeplerPage.tsx` (626 lines)

- **Primary:** Display Kepler.gl visualization
- **Jobs:** 3+ (Kepler init, controls, filters, rendering)
- **Cohesion:** ❌ Initialization, interaction, filtering mixed
- **Independence:** ❌ Can't separate visualization from controls
- **Verdict:** SPLIT into 4 modules
  - `KeplerVisualization.tsx` - Rendering (~200 lines)
  - `KeplerControls.tsx` - User controls (~100 lines)
  - `KeplerFilters.tsx` - Data filtering (~80 lines)
  - `KeplerPage.tsx` - Container (~150 lines)

#### PRIORITY 3: `ConfigurationTab.tsx` (501 lines)

- **Primary:** Configuration settings interface
- **Jobs:** 6 distinct config domains (Mapbox, Google Maps, AWS, Geocoding, Smarty, WiGLE)
- **Cohesion:** ❌ Six unrelated configuration sections mixed
- **Independence:** ❌ Can't extract individual config types
- **Verdict:** SPLIT by configuration domain
  - `MapboxConfig.tsx` - Mapbox settings
  - `GoogleMapsConfig.tsx` - Google Maps settings
  - `AWSConfig.tsx` - AWS settings
  - `GeocodingConfig.tsx` - Geocoding settings
  - `SmartyConfig.tsx` - Smarty settings
  - `WiGLEConfig.tsx` - WiGLE settings
  - `ConfigurationTab.tsx` - Container (~100 lines)

## Refactoring Workflow

### Before Refactoring

1. Run the 4 tests
2. Document findings
3. Plan extraction points
4. **Get approval** (don't split unnecessarily)

### During Refactoring

1. Extract ONE module
2. Ensure all imports still work
3. Test the extraction
4. Commit
5. Repeat

### After Refactoring

1. Update `docs/ARCHITECTURE.md`
2. Update module catalog
3. Add JSDoc to new modules
4. Note extraction pattern for future use

## Principles

### ✅ DO

- Extract when a file has multiple unrelated responsibilities
- Keep files together when all code serves one purpose
- Document WHY you kept/split a file
- Test each extraction independently

### ❌ DON'T

- Split just because a file is "long"
- Keep a file together just because it's "short"
- Create artificial module boundaries
- Extract before you understand the code

## Examples

### Good Modularity

```
Analytics Service (500 lines)
├── coreAnalytics.ts - Temporal, signal queries
├── threatAnalytics.ts - Security queries
├── networkAnalytics.ts - Network queries
├── helpers.ts - Utilities
└── index.ts - Coordinator
```

Each file = one analytics domain ✅

### Bad Modularity

```
UserPreferences Component (350 lines)
├── DarkMode.tsx (50 lines)
├── Language.tsx (50 lines)
├── Notifications.tsx (50 lines)
├── Privacy.tsx (50 lines)
└── Container.tsx (150 lines)
```

Split for no reason - should be one preferences component ❌

## Adding New Modules

When adding features:

1. **Ask:** "Does this fit the primary responsibility?"
   - YES: Add to existing module
   - NO: Create new module

2. **Test:** Will this module pass the 4 tests?
   - YES: Proceed
   - NO: Rethink the design

3. **Document:** Update ARCHITECTURE.md with the new module

## Questions?

- **Should I split this file?** Run the 4 tests
- **Where should this feature go?** Find the module with matching primary responsibility
- **This file is 400 lines, should I split?** Only if it fails the 4 tests
- **This file is 600 lines, is it OK?** Only if it passes the 4 tests

The framework answers all questions.
