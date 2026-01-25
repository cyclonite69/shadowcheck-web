# Universal Filter System - Implementation Guide

## Overview

ShadowCheck now has a **universal filter system** that works consistently across all pages with graceful degradation for unsupported filters.

## Architecture

### 1. Canonical Filter Schema

**Location:** `client/src/types/filters.ts`

Single source of truth for all filter definitions:

- Identity filters (SSID, BSSID, manufacturer)
- Radio/physical layer (types, frequency, channel, RSSI)
- Security (encryption, auth methods, flags)
- Temporal (timeframe, scope)
- Observation quality (count, GPS accuracy)
- Spatial (distance, bounding box, radius)
- Threat (score, categories, confidence)

### 2. Universal Filter Store

**Location:** `client/src/stores/filterStore.ts`

Zustand-based store with:

- `filters`: Canonical filter values
- `enabled`: Per-filter enable/disable flags
- URL synchronization (encode/decode)
- Validation layer
- Preset management

### 3. Page Capability System

**Location:** `client/src/utils/filterCapabilities.ts`

Each page declares which filters it supports:

```typescript
export const PAGE_CAPABILITIES = {
  geospatial: createFullCapabilities(), // All filters
  analytics: createFullCapabilities(), // All filters
  dashboard: {
    supported: {
      radioTypes: true,
      timeframe: true,
      threatScoreMin: true,
      // ... only supported filters
    },
  },
  kepler: {
    /* ... */
  },
  wigle: {
    /* ... */
  },
};
```

### 4. Filter Adaptation

**Function:** `adaptFiltersToPage(filters, enabled, capabilities)`

Takes canonical filters and page capabilities, returns:

- `filtersForPage`: Only supported filters
- `enabledForPage`: Enabled flags for supported filters
- `ignoredFilters`: Active but unsupported filters
- `ignoredCount`: Count of ignored filters

### 5. React Hooks

**Location:** `client/src/hooks/useAdaptedFilters.ts`

```typescript
// Get adapted filters for current page
const adaptedFilters = useAdaptedFilters(capabilities);

// Get filter payload for API requests
const { filters, enabled } = useFilterPayload(capabilities);
```

### 6. UI Components

**ActiveFiltersSummary** (`client/src/components/ActiveFiltersSummary.tsx`)

- Shows active filters
- Indicates ignored filters with warning
- Compact and expanded modes
- Clear all button

## Page Integration

### Dashboard

```typescript
const capabilities = getPageCapabilities('dashboard');
const adaptedFilters = useAdaptedFilters(capabilities);
useFilterURLSync();

// In fetch function
const { filtersForPage, enabledForPage } = adaptedFilters;
const params = new URLSearchParams({
  filters: JSON.stringify(filtersForPage),
  enabled: JSON.stringify(enabledForPage),
});
```

**Supported Filters:**

- Radio types
- Timeframe
- Threat scores
- Encryption types
- Security flags

### Kepler Test Page

```typescript
const capabilities = getPageCapabilities('kepler');
const adaptedFilters = useAdaptedFilters(capabilities);
```

**Supported Filters:**

- SSID, BSSID
- Radio types
- RSSI range
- Timeframe
- Encryption types
- Threat scores
- Bounding box

### WiGLE Test Page

```typescript
const capabilities = getPageCapabilities('wigle');
const adaptedFilters = useAdaptedFilters(capabilities);
```

**Supported Filters:**

- SSID, BSSID
- Radio types
- RSSI min
- Timeframe
- Encryption types

### Geospatial Explorer

Already uses full filter system - no changes needed.

### Analytics Page

Already uses full filter system - no changes needed.

## User Experience

### Filter Application

1. User opens filter panel on any page
2. Sets filters (e.g., WiFi only, last 7 days, RSSI > -70)
3. Clicks Apply
4. Filters are applied to current page
5. URL updates with filter state
6. Navigate to another page → filters persist
7. Unsupported filters are ignored gracefully

### Active Filters Summary

**Compact Mode:**

```
✓ 3 active  ⚠ 2 ignored  ✕ Clear
```

**Expanded Mode:**

```
Active Filters (3)
  Radio Types: W
  Timeframe: 7d
  RSSI Min: -70

Ignored on This Page (2)
  Threat Score Min: 50
  Bounding Box: {...}
```

### URL Synchronization

Filters are encoded in URL query params:

```
/dashboard?filters={...}&enabled={...}
```

- Shareable links preserve filters
- Refresh preserves filters
- Back/forward navigation works

## API Integration

### Request Format

All pages send the same payload structure:

```json
{
  "filters": {
    "radioTypes": ["W"],
    "timeframe": { "type": "relative", "relativeWindow": "7d" },
    "rssiMin": -70
  },
  "enabled": {
    "radioTypes": true,
    "timeframe": true,
    "rssiMin": true
  }
}
```

### Backend Handling

Backend endpoints receive filters and apply only what they support. Unsupported filters are safely ignored (no 400 errors).

## Benefits

### For Users

- Consistent filter experience across all pages
- Filters persist when navigating
- Clear indication of what's active/ignored
- Shareable filtered views via URL

### For Developers

- No duplicated filter logic
- Single source of truth
- Type-safe filter handling
- Easy to add new filters
- Easy to add new pages

## Adding a New Filter

1. Add to `NetworkFilters` interface in `client/src/types/filters.ts`
2. Add to `defaultFilters` and `defaultEnabled` in `client/src/stores/filterStore.ts`
3. Add to FilterPanel UI in `client/src/components/FilterPanel.tsx`
4. Update page capabilities in `client/src/utils/filterCapabilities.ts`
5. Backend handles it automatically (if supported)

## Adding a New Page

1. Import hooks:

```typescript
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { useFilterURLSync } from '../hooks/useFilteredData';
```

2. Declare capabilities:

```typescript
const capabilities = getPageCapabilities('mypage');
// Or define inline:
const capabilities = {
  supported: {
    radioTypes: true,
    timeframe: true,
    // ... filters this page supports
  },
};
```

3. Use adapted filters:

```typescript
const adaptedFilters = useAdaptedFilters(capabilities);
useFilterURLSync();

// In fetch
const { filtersForPage, enabledForPage } = adaptedFilters;
```

4. Add UI:

```tsx
<ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
<FilterPanel density="compact" />
```

## Testing

### Manual Test Checklist

- [ ] Set filters on Dashboard → navigate to Kepler → filters persist
- [ ] Set unsupported filter → shows as "ignored" on pages that don't support it
- [ ] Clear filters → all pages update
- [ ] Refresh page → filters restore from URL
- [ ] Share URL with filters → recipient sees same filtered view
- [ ] No 400 errors when applying filters
- [ ] Filter panel shows correct active/ignored counts

### Example Test Flow

1. Go to Dashboard
2. Open filters, set: Radio Types = WiFi, Timeframe = 7d, Threat Score Min = 50
3. Apply → Dashboard shows filtered data
4. Navigate to WiGLE test page
5. See: "✓ 2 active ⚠ 1 ignored" (Threat Score not supported)
6. Load data → WiFi and 7d filters apply, threat score ignored
7. Copy URL, open in new tab → same filters active
8. Clear filters → all pages reset

## Files Modified

### New Files

- `client/src/utils/filterCapabilities.ts` - Page capability system
- `client/src/components/ActiveFiltersSummary.tsx` - Filter summary UI
- `client/src/hooks/useAdaptedFilters.ts` - Adapted filter hooks

### Modified Files

- `client/src/components/DashboardPage.tsx` - Universal filter integration
- `client/src/components/KeplerTestPage.tsx` - Universal filter integration
- `client/src/components/WigleTestPage.tsx` - Universal filter integration

### Existing (Reused)

- `client/src/types/filters.ts` - Canonical filter schema
- `client/src/stores/filterStore.ts` - Universal filter store
- `client/src/components/FilterPanel.tsx` - Filter UI
- `client/src/hooks/useFilteredData.ts` - URL sync hook

## Performance

- Filters are debounced (500ms) to avoid excessive API calls
- URL updates use `replaceState` (no history spam)
- Adapted filters are memoized
- No re-render storms

## Security

- All filter values are validated before API calls
- RSSI values clamped to valid ranges
- Malformed filters degrade gracefully
- No SQL injection risk (parameterized queries on backend)

## Future Enhancements

- Filter presets (save/load common filter combinations)
- Filter history (recent filter sets)
- Advanced filter builder UI
- Filter templates per use case
- Export filtered data
