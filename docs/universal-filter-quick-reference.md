# Universal Filter System - Quick Reference

## For Users

### Setting Filters

1. Click "Show Filters" button on any page
2. Configure desired filters
3. Click "Apply" to activate
4. Filters persist across page navigation

### Understanding Filter Status

- **✓ N active** - Filters currently applied to this page
- **⚠ N ignored** - Filters active but not supported by this page
- **✕ Clear** - Remove all filters

### Sharing Filtered Views

Copy the URL - it contains all active filters. Anyone opening that URL will see the same filtered data.

## For Developers

### Quick Integration (New Page)

```typescript
// 1. Import
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { ActiveFiltersSummary } from './ActiveFiltersSummary';
import { FilterPanel } from './FilterPanel';

// 2. Setup
const capabilities = getPageCapabilities('mypage');
const adaptedFilters = useAdaptedFilters(capabilities);
useFilterURLSync();

// 3. Use in fetch
const { filtersForPage, enabledForPage } = adaptedFilters;
const params = new URLSearchParams({
  filters: JSON.stringify(filtersForPage),
  enabled: JSON.stringify(enabledForPage),
});
fetch(`/api/myendpoint?${params}`);

// 4. UI
<ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
<FilterPanel density="compact" />
```

### Declaring Page Capabilities

Edit `src/utils/filterCapabilities.ts`:

```typescript
export const PAGE_CAPABILITIES = {
  mypage: {
    supported: {
      ssid: true,
      bssid: true,
      radioTypes: true,
      timeframe: true,
      // ... only filters this page supports
    },
    notes: 'Optional description',
  },
};
```

### Adding a New Filter

1. Add to `NetworkFilters` in `src/types/filters.ts`
2. Add default value in `src/stores/filterStore.ts`
3. Add UI in `src/components/FilterPanel.tsx`
4. Update page capabilities as needed

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                   User Sets Filters                     │
│                          ↓                              │
│              Universal Filter Store                     │
│         (src/stores/filterStore.ts)                     │
│                          ↓                              │
│                   URL Sync                              │
│                          ↓                              │
│              Page Declares Capabilities                 │
│         (src/utils/filterCapabilities.ts)               │
│                          ↓                              │
│              adaptFiltersToPage()                       │
│                          ↓                              │
│         ┌────────────────┴────────────────┐             │
│         ↓                                 ↓             │
│   filtersForPage                   ignoredFilters       │
│   (supported only)                 (unsupported)        │
│         ↓                                 ↓             │
│    API Request                      UI Warning          │
└─────────────────────────────────────────────────────────┘
```

## Key Files

| File                                      | Purpose                 |
| ----------------------------------------- | ----------------------- |
| `src/types/filters.ts`                    | Canonical filter schema |
| `src/stores/filterStore.ts`               | Universal filter store  |
| `src/utils/filterCapabilities.ts`         | Page capability system  |
| `src/hooks/useAdaptedFilters.ts`          | Adaptation hooks        |
| `src/components/ActiveFiltersSummary.tsx` | Filter status UI        |
| `src/components/FilterPanel.tsx`          | Filter configuration UI |

## Page Support Matrix

| Page       | SSID | BSSID | Radio | RSSI | Time | Encryption | Threat | Bbox |
| ---------- | ---- | ----- | ----- | ---- | ---- | ---------- | ------ | ---- |
| Geospatial | ✓    | ✓     | ✓     | ✓    | ✓    | ✓          | ✓      | ✓    |
| Analytics  | ✓    | ✓     | ✓     | ✓    | ✓    | ✓          | ✓      | ✓    |
| Dashboard  | -    | -     | ✓     | -    | ✓    | ✓          | ✓      | -    |
| Kepler     | ✓    | ✓     | ✓     | ✓    | ✓    | ✓          | ✓      | ✓    |
| WiGLE      | ✓    | ✓     | ✓     | ✓    | ✓    | ✓          | -      | -    |

## Common Patterns

### Fetch with Filters

```typescript
const fetchData = useCallback(async () => {
  const { filtersForPage, enabledForPage } = adaptedFilters;
  const params = new URLSearchParams({
    filters: JSON.stringify(filtersForPage),
    enabled: JSON.stringify(enabledForPage),
  });
  const response = await fetch(`/api/endpoint?${params}`);
  // ...
}, [adaptedFilters]);
```

### Debounced Updates

```typescript
useDebouncedFilters(fetchData, 500);
```

### Show/Hide Filters

```typescript
const [showFilters, setShowFilters] = useState(false);

<button onClick={() => setShowFilters(!showFilters)}>
  {showFilters ? '✕ Hide Filters' : '⚙ Show Filters'}
</button>

{showFilters && (
  <div>
    <ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
    <FilterPanel density="compact" />
  </div>
)}
```

## Troubleshooting

### Filters not persisting

- Check `useFilterURLSync()` is called
- Verify URL params are being set
- Check browser console for errors

### 400 errors from API

- Ensure using `filtersForPage` not raw `filters`
- Check page capabilities are declared
- Verify backend supports the filters

### Filters not updating

- Check debounce timing (500ms default)
- Verify `useDebouncedFilters` is called
- Check `adaptedFilters` dependency in useCallback

### UI not showing ignored filters

- Verify `ActiveFiltersSummary` is rendered
- Check `adaptedFilters` is passed correctly
- Ensure page capabilities are declared

## Performance Tips

- Filters are memoized - no unnecessary re-renders
- Debouncing prevents excessive API calls
- URL updates use replaceState (no history spam)
- Adapted filters computed only when filters/capabilities change

## Security Notes

- All filter values validated before API calls
- RSSI values clamped to valid ranges (-95 to 0)
- Malformed filters degrade gracefully
- No SQL injection risk (parameterized queries)
