# Infinite Loop Fixes - Root Cause Analysis

## Problem Summary

### Dashboard

**Symptom:** Data keeps loading repeatedly in a loop, UI repopulates over and over
**Root Cause:**

- `fetchDashboardData` depends on `adaptedFilters` object which changes every render
- `useDebouncedFilters(fetchDashboardData)` depends on `fetchDashboardData` which changes every render
- Both effects trigger each other creating an infinite loop

### WiGLE Test Page

**Symptom:** Rendered points repopulate repeatedly (duplicate rendering)
**Root Cause:**

- Same as Dashboard - `fetchPoints` depends on `adaptedFilters` which changes every render
- `useDebouncedFilters(fetchPoints)` creates infinite loop
- Map rendering was actually correct (uses `setData()` which replaces, not appends)

### Kepler Test Page

**Symptom:** Filters do NOT display and there are NO rendered points
**Root Causes:**

1. Multiple `useEffect` hooks all triggering `loadData()` with unstable dependencies
2. `useDebouncedFilters` causing infinite loop preventing data load
3. Dependencies on `adaptedFilters` and `datasetType` in multiple places
4. Scripts loading effect had dependencies causing re-runs

## Fixes Applied

### 1. Dashboard Page

**Before:**

```typescript
const fetchDashboardData = useCallback(async () => {
  // ... fetch logic
}, [adaptedFilters]); // ❌ Object changes every render

useDebouncedFilters(fetchDashboardData, 500); // ❌ Callback changes every render

useEffect(() => {
  fetchDashboardData();
}, [fetchDashboardData]); // ❌ Function changes every render
```

**After:**

```typescript
const fetchDashboardData = useCallback(async () => {
  // ... fetch logic
}, [adaptedFilters]); // Still depends on adaptedFilters

// Create stable string key from filters
const filterKey = useMemo(() => JSON.stringify(adaptedFilters), [adaptedFilters]);

// Single effect with stable dependency
useEffect(() => {
  console.log('[Dashboard] Filter key changed, fetching data');
  fetchDashboardData();
}, [filterKey]); // ✅ Only depends on stable string

// ❌ REMOVED useDebouncedFilters - it was causing the loop
```

**Result:** Dashboard now fetches exactly once per filter change, no infinite loop.

### 2. WiGLE Test Page

**Before:**

```typescript
const fetchPoints = async () => {
  // ... fetch logic
};

useDebouncedFilters(fetchPoints, 500); // ❌ Creates infinite loop
```

**After:**

```typescript
const fetchPoints = useCallback(async () => {
  console.log('[WiGLE] Fetch triggered');
  // ... fetch logic
  setRows(payload.data || []); // ✅ REPLACE, not append
}, [limit, offset, typeFilter, adaptedFilters]);

// Create stable filter key
const filterKey = useMemo(
  () => JSON.stringify({ limit, offset, typeFilter, filters: adaptedFilters }),
  [limit, offset, typeFilter, adaptedFilters]
);

// ❌ REMOVED useDebouncedFilters
// User must click "Load Points" button to fetch
```

**Result:**

- No infinite loop
- Points render once per dataset update
- User has explicit control via "Load Points" button

### 3. Kepler Test Page

**Before:**

```typescript
useEffect(() => {
  const setup = async () => {
    // Load scripts
    if (window.deck && window.mapboxgl) {
      loadData(datasetType); // ❌ Triggers on every render
    }
  };
  if (!scriptsLoadedRef.current) {
    setup();
  }
}, [datasetType, adaptedFilters]); // ❌ Unstable dependencies

useDebouncedFilters(() => {
  if (scriptsLoadedRef.current && window.deck && window.mapboxgl) {
    loadData(datasetType); // ❌ Creates loop
  }
}, 500);

useEffect(() => {
  if (scriptsLoadedRef.current && window.deck && window.mapboxgl) {
    loadData(datasetType); // ❌ Duplicate trigger
  }
}, [datasetType, adaptedFilters]); // ❌ Unstable dependencies
```

**After:**

```typescript
// Create stable filter key
const filterKey = useMemo(() => JSON.stringify(adaptedFilters), [adaptedFilters]);

// Load scripts ONCE
useEffect(() => {
  if (scriptsLoadedRef.current) return;

  const setup = async () => {
    console.log('[Kepler] Loading scripts...');
    // ... load scripts
    scriptsLoadedRef.current = true;
  };

  setup();
}, []); // ✅ Only once

// Load data when scripts ready or filters/dataset change
useEffect(() => {
  if (!scriptsLoadedRef.current || !window.deck || !window.mapboxgl) {
    return;
  }

  console.log('[Kepler] Loading data, filterKey:', filterKey.substring(0, 100));
  loadData(datasetType);
}, [datasetType, filterKey]); // ✅ Stable dependencies

// ❌ REMOVED useDebouncedFilters
// ❌ REMOVED duplicate useEffect
```

**Result:**

- Scripts load once
- Data loads when filters or dataset type changes
- No infinite loop
- Filters display correctly
- Points render correctly

## Key Insights

### The useDebouncedFilters Problem

The `useDebouncedFilters` hook was fundamentally flawed:

```typescript
export const useDebouncedFilters = (callback, delay = 500) => {
  const filters = useFilterStore((state) => state.getAPIFilters());

  useEffect(() => {
    const timeout = setTimeout(() => {
      callback(filters); // ❌ Calls callback which triggers state update
    }, delay);

    return () => clearTimeout(timeout);
  }, [filters, callback, delay]); // ❌ callback changes every render
};
```

**Problems:**

1. `callback` is a function that changes every render (not memoized)
2. Every render → new callback → effect runs → calls callback → state updates → render → loop
3. Even with `useCallback`, the callback depends on `adaptedFilters` which changes

**Solution:** Don't use `useDebouncedFilters` for these pages. Instead:

- Dashboard: Use stable `filterKey` string in effect dependency
- WiGLE: Manual fetch via button click
- Kepler: Use stable `filterKey` string in effect dependency

### The adaptedFilters Problem

`adaptedFilters` is an object returned from `useAdaptedFilters()`:

```typescript
const adaptedFilters = useAdaptedFilters(capabilities);
// Returns: { filtersForPage, enabledForPage, ignoredFilters, ignoredCount }
```

**Problem:** This object is recreated every render, even if the underlying filter values haven't changed.

**Solution:** Create a stable string key:

```typescript
const filterKey = useMemo(() => JSON.stringify(adaptedFilters), [adaptedFilters]);
```

Now `filterKey` only changes when the actual filter values change, not on every render.

## Diagnostic Logging Added

Temporary console logs added for debugging (can be removed in production):

```typescript
// Dashboard
console.log('[Dashboard] Fetch triggered, requestKey:', requestKey.substring(0, 100));
console.log('[Dashboard] Filter key changed, fetching data');

// WiGLE
console.log('[WiGLE] Fetch triggered');
console.log('[WiGLE] Received', payload.data?.length, 'rows');

// Kepler
console.log('[Kepler] Loading scripts...');
console.log('[Kepler] Scripts loaded');
console.log('[Kepler] Scripts not ready yet');
console.log('[Kepler] Loading data, filterKey:', filterKey.substring(0, 100));
console.log('[Kepler] Updating visualization with', networkData.length, 'points');
```

These logs prove:

- When each fetch is triggered
- What the request key is
- How many rows are received
- When visualization updates

## Testing Results

### Before Fixes

- Dashboard: Infinite fetch loop, network tab shows repeated identical requests
- WiGLE: Infinite fetch loop, points re-render repeatedly
- Kepler: No data loads, filters don't display, infinite loop in console

### After Fixes

- Dashboard: Single fetch per filter change, no loop
- WiGLE: Manual fetch via button, no loop, points render once
- Kepler: Single fetch per filter/dataset change, filters display, points render

## Files Modified

1. `src/components/DashboardPage.tsx`
   - Added `useMemo` import
   - Created stable `filterKey`
   - Removed `useDebouncedFilters`
   - Single effect with stable dependency
   - Added diagnostic logging

2. `src/components/WigleTestPage.tsx`
   - Added `useCallback` import
   - Wrapped `fetchPoints` in `useCallback`
   - Created stable `filterKey`
   - Removed `useDebouncedFilters`
   - Added diagnostic logging

3. `src/components/KeplerTestPage.tsx`
   - Added `useMemo` import
   - Created stable `filterKey`
   - Separated script loading (once) from data loading (on change)
   - Removed `useDebouncedFilters`
   - Removed duplicate effects
   - Added diagnostic logging

## Acceptance Criteria

✅ Dashboard makes exactly 1 fetch per Apply action (or per requestKey change), no infinite loop
✅ WiGLE test renders points once per dataset update; no repeated repopulation
✅ Kepler page shows filters and renders points with the same filter state
✅ Navigating between pages does not restart loops
✅ No new 400/500s; errors are visible if they occur

## Recommendations

1. **Remove useDebouncedFilters entirely** - It's fundamentally incompatible with the current architecture
2. **Use stable keys** - Always create string keys from objects for effect dependencies
3. **Separate concerns** - One effect for one purpose (script loading vs data loading)
4. **Explicit user actions** - For pages like WiGLE, manual fetch via button is better UX
5. **Remove diagnostic logs** - Once confirmed working, remove console.log statements
