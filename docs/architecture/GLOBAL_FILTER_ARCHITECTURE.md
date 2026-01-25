# Global Filter Architecture

## Overview

ShadowCheck implements a **repository-wide global filter system** that affects all endpoints, cards, and data displays across the application. This replaces individual component-level filters with a unified, centralized filtering mechanism.

## Design Principles

### 1. Single Source of Truth

- One global filter state shared across all components
- Managed at the application root level
- Persists across page navigation
- Synchronized with URL query parameters for shareability

### 2. Universal Application

The global filter affects:

- **API Endpoints**: All backend queries (networks, threats, observations, analytics)
- **Dashboard Cards**: Real-time metrics and statistics
- **Map Visualizations**: Mapbox layers and deck.gl renderings
- **Data Tables**: Networks Explorer and Threats Explorer
- **Charts**: Analytics and timeline visualizations

### 3. Filter Types

#### Spatial Filters

- **Bounding Box**: Geographic area selection via map interaction
- **Radius**: Distance from a point (home, work, custom marker)
- **Polygon**: Custom drawn areas on map

#### Temporal Filters

- **Date Range**: Start and end timestamps
- **Time of Day**: Hour-based filtering
- **Relative Time**: Last N hours/days/weeks

#### Network Filters

- **BSSID**: Specific MAC address(es)
- **SSID**: Network name (supports wildcards)
- **Type**: WiFi, Bluetooth, Cellular (W, E, B, L, N, G)
- **Frequency**: 2.4GHz, 5GHz, 6GHz
- **Signal Strength**: dBm range
- **Encryption**: Open, WPA2, WPA3, etc.

#### Threat Filters

- **Threat Level**: Threshold-based (>40 points, etc.)
- **Tags**: LEGIT, THREAT, FALSE_POSITIVE, INVESTIGATE
- **Behavioral**: Seen at home, seen away, tracking indicators

#### Source Filters

- **Device ID**: Which collection device
- **Source Tag**: Data source identifier
- **External**: Include/exclude external observations

## Architecture

### State Management

```typescript
interface GlobalFilter {
  // Spatial
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center?: { lat: number; lon: number; radius: number };
  polygon?: Array<[number, number]>;

  // Temporal
  dateRange?: { start: string; end: string };
  timeOfDay?: { start: number; end: number }; // 0-23 hours

  // Network
  bssid?: string[];
  ssid?: string;
  type?: string[];
  frequency?: number[];
  signalRange?: { min: number; max: number };

  // Threat
  minThreatScore?: number;
  tags?: string[];

  // Source
  deviceIds?: string[];
  excludeExternal?: boolean;
}
```

### Context Provider

```typescript
// client/src/contexts/FilterContext.tsx
export const FilterContext = createContext<{
  filter: GlobalFilter;
  setFilter: (filter: Partial<GlobalFilter>) => void;
  clearFilter: () => void;
  applyFilter: () => void;
}>(null);

export function FilterProvider({ children }) {
  const [filter, setFilterState] = useState<GlobalFilter>({});

  // Sync with URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Parse filter from URL
  }, []);

  const setFilter = (partial: Partial<GlobalFilter>) => {
    setFilterState(prev => ({ ...prev, ...partial }));
    // Update URL
  };

  return (
    <FilterContext.Provider value={{ filter, setFilter, clearFilter, applyFilter }}>
      {children}
    </FilterContext.Provider>
  );
}
```

### Filter UI Component

```
┌─────────────────────────────────────────────────────────────┐
│  Global Filter Panel                                    [×] │
├─────────────────────────────────────────────────────────────┤
│  📍 Spatial    📅 Temporal    📡 Network    ⚠️  Threat      │
├─────────────────────────────────────────────────────────────┤
│  Active Filters:                                            │
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │ 🗺️  Map Bounds  │  │ 📅 Last 24h  │  │ ⚠️  Score > 40 │ │
│  │     [Clear]     │  │    [Clear]   │  │     [Clear]    │ │
│  └─────────────────┘  └──────────────┘  └────────────────┘ │
│                                                             │
│  [Clear All]                          [Apply Filter]       │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Infrastructure (Current)

- [x] Create FilterContext and Provider
- [ ] Implement URL synchronization
- [ ] Build global filter state management
- [ ] Create filter UI component structure

### Phase 2: Component Integration

- [ ] Update NetworksExplorer to consume global filter
- [ ] Update ThreatsExplorer to consume global filter
- [ ] Update Dashboard cards to consume global filter
- [ ] Update Map components to consume global filter

### Phase 3: API Integration

- [ ] Modify API routes to accept filter parameters
- [ ] Update backend queries to apply filters
- [ ] Implement filter validation and sanitization
- [ ] Add filter performance optimizations

### Phase 4: Advanced Features

- [ ] Saved filter presets
- [ ] Filter history (undo/redo)
- [ ] Filter sharing (copy filter URL)
- [ ] Smart filter suggestions based on context

## API Contract

### Request Format

```http
GET /api/networks?filter=base64encodedfilter
GET /api/threats/detect?filter=base64encodedfilter
GET /api/analytics/timeline?filter=base64encodedfilter
```

### Filter Query Parameter

```javascript
// Encode filter as base64 URL-safe JSON
const filterJson = JSON.stringify(globalFilter);
const filterParam = btoa(filterJson).replace(/\+/g, '-').replace(/\//g, '_');
```

### Backend Parsing

```javascript
// server/server.js or middleware
function parseGlobalFilter(req, res, next) {
  if (req.query.filter) {
    try {
      const decoded = atob(req.query.filter.replace(/-/g, '+').replace(/_/g, '/'));
      req.globalFilter = JSON.parse(decoded);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid filter parameter' });
    }
  }
  next();
}
```

### SQL Query Construction

```javascript
function applyGlobalFilter(query, filter, params) {
  const conditions = [];
  let paramIndex = params.length + 1;

  // Spatial filters
  if (filter.bounds) {
    conditions.push(`
      lat BETWEEN $${paramIndex} AND $${paramIndex + 1}
      AND lon BETWEEN $${paramIndex + 2} AND $${paramIndex + 3}
    `);
    params.push(filter.bounds.south, filter.bounds.north, filter.bounds.west, filter.bounds.east);
    paramIndex += 4;
  }

  // Temporal filters
  if (filter.dateRange) {
    conditions.push(`observed_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`);
    params.push(filter.dateRange.start, filter.dateRange.end);
    paramIndex += 2;
  }

  // Network filters
  if (filter.type) {
    conditions.push(`type = ANY($${paramIndex})`);
    params.push(filter.type);
    paramIndex++;
  }

  // Threat filters
  if (filter.minThreatScore) {
    conditions.push(`ml_threat_score >= $${paramIndex}`);
    params.push(filter.minThreatScore);
    paramIndex++;
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  return { query, params };
}
```

## Component Refactoring

### Before (Local Filters)

```typescript
function NetworksExplorer() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [signalFilter, setSignalFilter] = useState<number>(-100);

  // Local filtering logic
  const filtered = networks.filter(n =>
    n.ssid.includes(search) &&
    (typeFilter.length === 0 || typeFilter.includes(n.type)) &&
    n.signal >= signalFilter
  );

  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {/* More local filter controls */}
      <NetworkTable data={filtered} />
    </div>
  );
}
```

### After (Global Filter)

```typescript
function NetworksExplorer() {
  const { filter } = useFilter(); // Global context

  // No local filtering - data comes pre-filtered from API
  const { data: networks } = useFilteredNetworks(filter);

  return (
    <div>
      {/* No filter controls - managed globally */}
      <NetworkTable data={networks} />
    </div>
  );
}
```

## Benefits

### For Users

- **Consistency**: Same filter applies everywhere
- **Efficiency**: Set filter once, affects all views
- **Shareability**: Share filtered views via URL
- **Context Preservation**: Filter persists across navigation

### For Developers

- **DRY**: No duplicated filter logic
- **Maintainability**: Single filter implementation
- **Performance**: Server-side filtering reduces data transfer
- **Testability**: Centralized filter logic easier to test

## Migration Strategy

### Step 1: Remove Local Filters

1. Identify all components with local filter state
2. Remove filter UI elements (search boxes, dropdowns, sliders)
3. Remove filter state management (useState, local logic)
4. Update components to receive pre-filtered data

### Step 2: Implement Global Filter

1. Create FilterContext
2. Build FilterPanel component
3. Add to application root
4. Wire up to API calls

### Step 3: Update API Endpoints

1. Add filter parameter parsing middleware
2. Update query builders to apply filters
3. Test with various filter combinations
4. Optimize database queries with appropriate indexes

### Step 4: Documentation & Training

1. Update API documentation
2. Create user guide for global filter
3. Add inline help/tooltips
4. Document performance characteristics

## Performance Considerations

### Database Optimization

- Ensure indexes on filtered columns: `(lat, lon)`, `observed_at`, `type`, `ml_threat_score`
- Use materialized views for complex filters
- Implement query result caching
- Monitor slow queries and optimize

### Frontend Optimization

- Debounce filter changes (300ms)
- Implement virtual scrolling for large result sets
- Use React.memo for filter-agnostic components
- Lazy load filter panel when not in use

### API Optimization

- Implement pagination for large result sets
- Use HTTP caching headers
- Consider GraphQL for flexible filtering
- Rate limit filter-heavy endpoints

## Security

### Input Validation

- Validate filter parameters server-side
- Sanitize SQL inputs (use parameterized queries)
- Limit filter complexity to prevent DoS
- Enforce reasonable bounds (date ranges, numeric limits)

### Authorization

- Respect user permissions in filtered queries
- Don't expose data user shouldn't see
- Log filter usage for audit trail

## Future Enhancements

### Advanced Filtering

- Natural language filter input ("networks seen at home last week")
- Machine learning-suggested filters
- Correlation filters (show networks seen with X)
- Geofencing with custom polygon drawing

### Visualization

- Visual filter builder (drag-and-drop)
- Filter preview (show affected data count before applying)
- Filter analytics (most common filters, performance impact)

### Collaboration

- Share filter presets with team
- Subscribe to filter changes
- Filter templates for common use cases

---

**Status**: Design Phase
**Last Updated**: 2025-12-11
**Author**: Claude Sonnet 4.5
**Review**: Pending
