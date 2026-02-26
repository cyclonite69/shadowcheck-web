# Filter System Fix - February 26, 2026

## Problem

When enabling a single filter in the explorer, no rows were returned. The filter system appeared to not be hitting the frontend anymore.

## Root Cause

In `client/src/hooks/useNetworkData.ts` (lines 117-123), the code was filtering out disabled filters from the `filters` object before sending to the API:

```typescript
const activeFilters = Object.fromEntries(
  Object.entries(debouncedFilterState.filters).filter(
    ([key]) => debouncedFilterState.enabled[key as keyof typeof debouncedFilterState.enabled]
  )
);
```

This removed filter values for disabled filters, but the backend expects:

1. The complete `filters` object with all filter values
2. The `enabled` object to determine which filters to apply

By stripping out disabled filter values, the frontend was sending incomplete data to the backend.

## Solution

Changed `useNetworkData.ts` to send the complete filters object:

```typescript
const params = new URLSearchParams({
  limit: String(NETWORK_PAGE_LIMIT),
  offset: String(pagination.offset),
  sort: sortKeys.join(','),
  order: sort.map((entry) => entry.direction.toUpperCase()).join(','),
  filters: JSON.stringify(debouncedFilterState.filters), // Send complete object
  enabled: JSON.stringify(debouncedFilterState.enabled),
  includeTotal: includeTotal ? '1' : '0',
});
```

## Additional Changes

Added debug logging to trace filter flow:

- `client/src/hooks/useFilteredData.ts` - logs filter payload and request URL
- `client/src/stores/filterStore.ts` - logs debounced filter triggers
- `client/src/hooks/useNetworkData.ts` - logs filter state before API call

## Testing

Run `./test-filter-fix.sh` to verify:

1. No filters returns data
2. Single filter (RSSI) returns filtered data
3. Multiple filters work correctly

## Files Modified

- `client/src/hooks/useNetworkData.ts` - Fixed filter payload
- `client/src/hooks/useFilteredData.ts` - Added debug logging
- `client/src/stores/filterStore.ts` - Added debug logging
- `test-filter-fix.sh` - Created test script

## Backend Architecture (No Changes Needed)

The backend at `server/src/api/routes/v2/filtered.ts` correctly:

1. Parses both `filters` and `enabled` from query params
2. Uses `UniversalFilterQueryBuilder` to apply only enabled filters
3. Returns `appliedFilters` and `ignoredFilters` for transparency
