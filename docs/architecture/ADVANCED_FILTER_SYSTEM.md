# Advanced Multi-Target Filter System

## Overview
ShadowCheck implements a **granular, multi-target filter system** where each individual filter can be selectively applied to specific endpoints, cards, and components independently. This provides unprecedented flexibility in data exploration and visualization.

## Core Concept: Filter Targeting

### Traditional Global Filter (What I Initially Described)
```
One filter → Applied everywhere
- Filter A affects ALL endpoints
- No granular control
```

### ShadowCheck Advanced Filter System (Actual Design)
```
Multiple filters with independent targeting:
- Filter A: Apply to endpoints [networks, threats] + cards [network-count]
- Filter B: Apply to nothing (defined but inactive)
- Filter C: Apply to ALL endpoints and ALL cards
- Filter D: Apply to single endpoint [analytics/timeline]
- Filter E: Apply to map layers only
```

## Filter Object Structure

### Enhanced Filter Definition
```typescript
interface FilterDefinition {
  id: string;                    // Unique filter identifier
  name: string;                  // User-friendly name
  type: FilterType;              // 'spatial' | 'temporal' | 'network' | 'threat' | 'source'
  config: FilterConfig;          // Filter-specific configuration
  targets: FilterTarget[];       // Where this filter applies
  enabled: boolean;              // Quick enable/disable toggle
  priority: number;              // Application order (for conflicting filters)
}

interface FilterTarget {
  type: 'endpoint' | 'card' | 'component' | 'layer' | 'all';
  identifier?: string;           // Specific target ID (optional for 'all')
}

// Examples of filter configurations
type FilterConfig =
  | SpatialFilterConfig
  | TemporalFilterConfig
  | NetworkFilterConfig
  | ThreatFilterConfig
  | SourceFilterConfig;

interface SpatialFilterConfig {
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center?: { lat: number; lon: number; radius: number };
  polygon?: Array<[number, number]>;
}

interface TemporalFilterConfig {
  dateRange?: { start: string; end: string };
  timeOfDay?: { start: number; end: number };
  relativeTime?: { value: number; unit: 'hours' | 'days' | 'weeks' };
}

interface NetworkFilterConfig {
  bssid?: string[];
  ssid?: string;
  type?: string[];
  frequency?: number[];
  signalRange?: { min: number; max: number };
  encryption?: string[];
}

interface ThreatFilterConfig {
  minThreatScore?: number;
  maxThreatScore?: number;
  tags?: string[];
  behaviors?: string[];
}

interface SourceFilterConfig {
  deviceIds?: string[];
  sourceTags?: string[];
  excludeExternal?: boolean;
}
```

## Filter Examples

### Example 1: Geographic Filter for Threats Only
```typescript
const homeAreaFilter: FilterDefinition = {
  id: 'filter-home-area',
  name: 'Home Area',
  type: 'spatial',
  config: {
    center: { lat: 42.3601, lon: -71.0589, radius: 500 } // 500m radius
  },
  targets: [
    { type: 'endpoint', identifier: '/api/threats/detect' },
    { type: 'card', identifier: 'threat-count-card' },
    { type: 'layer', identifier: 'threats-layer' }
  ],
  enabled: true,
  priority: 1
};
```

### Example 2: Time Range for Analytics, Not Map
```typescript
const last24HoursFilter: FilterDefinition = {
  id: 'filter-last-24h',
  name: 'Last 24 Hours',
  type: 'temporal',
  config: {
    relativeTime: { value: 24, unit: 'hours' }
  },
  targets: [
    { type: 'endpoint', identifier: '/api/analytics/timeline' },
    { type: 'endpoint', identifier: '/api/analytics/hourly' },
    { type: 'card', identifier: 'obs-count-card' },
    // NOTE: Map layers NOT included - they show all time
  ],
  enabled: true,
  priority: 2
};
```

### Example 3: WiFi Only - Apply Everywhere
```typescript
const wifiOnlyFilter: FilterDefinition = {
  id: 'filter-wifi-only',
  name: 'WiFi Networks Only',
  type: 'network',
  config: {
    type: ['W'] // W = WiFi
  },
  targets: [
    { type: 'all' } // Apply to ALL endpoints, cards, components, layers
  ],
  enabled: true,
  priority: 3
};
```

### Example 4: High Threat Score - Defined But Disabled
```typescript
const highThreatFilter: FilterDefinition = {
  id: 'filter-high-threat',
  name: 'High Threat Score (>80)',
  type: 'threat',
  config: {
    minThreatScore: 80
  },
  targets: [
    { type: 'all' }
  ],
  enabled: false, // Defined but not applied
  priority: 4
};
```

### Example 5: Specific BSSID for Single Card
```typescript
const targetNetworkFilter: FilterDefinition = {
  id: 'filter-target-bssid',
  name: 'Suspicious Device',
  type: 'network',
  config: {
    bssid: ['AA:BB:CC:DD:EE:FF']
  },
  targets: [
    { type: 'card', identifier: 'network-detail-card' }
    // Only this ONE card gets this filter
  ],
  enabled: true,
  priority: 5
};
```

## Filter Manager State

```typescript
interface FilterManagerState {
  filters: FilterDefinition[];              // All defined filters
  activeFilterIds: Set<string>;             // Currently enabled filter IDs
  targetMap: Map<string, Set<string>>;      // Target → Filter IDs mapping
}

// Example state
const filterState: FilterManagerState = {
  filters: [
    homeAreaFilter,
    last24HoursFilter,
    wifiOnlyFilter,
    highThreatFilter,    // enabled: false
    targetNetworkFilter
  ],
  activeFilterIds: new Set([
    'filter-home-area',
    'filter-last-24h',
    'filter-wifi-only',
    // 'filter-high-threat' NOT included (disabled)
    'filter-target-bssid'
  ]),
  targetMap: new Map([
    ['/api/threats/detect', new Set(['filter-home-area', 'filter-wifi-only'])],
    ['/api/analytics/timeline', new Set(['filter-last-24h', 'filter-wifi-only'])],
    ['threat-count-card', new Set(['filter-home-area', 'filter-wifi-only'])],
    ['network-detail-card', new Set(['filter-target-bssid', 'filter-wifi-only'])],
    // ... etc
  ])
};
```

## Filter Application Logic

### Computing Effective Filters for a Target
```typescript
function getFiltersForTarget(
  targetType: 'endpoint' | 'card' | 'component' | 'layer',
  targetId: string,
  filterState: FilterManagerState
): FilterDefinition[] {
  const applicableFilters: FilterDefinition[] = [];

  for (const filter of filterState.filters) {
    // Skip disabled filters
    if (!filter.enabled) continue;

    // Check if filter applies to this target
    const applies = filter.targets.some(target => {
      // Universal 'all' target
      if (target.type === 'all') return true;

      // Specific target match
      if (target.type === targetType && target.identifier === targetId) {
        return true;
      }

      // Wildcard matching (e.g., '/api/threats/*')
      if (target.identifier && target.identifier.includes('*')) {
        const pattern = target.identifier.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(targetId);
      }

      return false;
    });

    if (applies) {
      applicableFilters.push(filter);
    }
  }

  // Sort by priority
  return applicableFilters.sort((a, b) => a.priority - b.priority);
}

// Usage examples
const threatEndpointFilters = getFiltersForTarget(
  'endpoint',
  '/api/threats/detect',
  filterState
);
// Returns: [homeAreaFilter, wifiOnlyFilter]

const timelineFilters = getFiltersForTarget(
  'endpoint',
  '/api/analytics/timeline',
  filterState
);
// Returns: [last24HoursFilter, wifiOnlyFilter]

const detailCardFilters = getFiltersForTarget(
  'card',
  'network-detail-card',
  filterState
);
// Returns: [targetNetworkFilter, wifiOnlyFilter]
```

## Filter Panel UI

### Design Concept
```
┌─────────────────────────────────────────────────────────────────────┐
│  Filter Manager                                           [+ New]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🗺️  Home Area                                            [✓] [⚙] │
│  ├─ Type: Spatial (500m radius)                                    │
│  ├─ Applies to: /api/threats/detect, threat-count-card,           │
│  │              threats-layer                                      │
│  └─ [Edit Targets]                                                 │
│                                                                     │
│  📅 Last 24 Hours                                          [✓] [⚙] │
│  ├─ Type: Temporal (relative)                                      │
│  ├─ Applies to: /api/analytics/timeline, /api/analytics/hourly,   │
│  │              obs-count-card                                     │
│  └─ [Edit Targets]                                                 │
│                                                                     │
│  📡 WiFi Only                                              [✓] [⚙] │
│  ├─ Type: Network (type filter)                                    │
│  ├─ Applies to: ALL endpoints and components                       │
│  └─ [Edit Targets]                                                 │
│                                                                     │
│  ⚠️  High Threat Score                                     [  ] [⚙] │
│  ├─ Type: Threat (score > 80)                                      │
│  ├─ Applies to: ALL (when enabled)                                 │
│  └─ [Edit Targets]                                  [DISABLED]     │
│                                                                     │
│  🎯 Suspicious Device                                      [✓] [⚙] │
│  ├─ Type: Network (BSSID)                                          │
│  ├─ Applies to: network-detail-card                                │
│  └─ [Edit Targets]                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Target Selector Modal
```
┌─────────────────────────────────────────────────────────────┐
│  Edit Filter Targets: "Home Area"                      [×] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Quick Select:                                              │
│  [ ] Apply to All    [ ] Apply to None                     │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                             │
│  📡 API Endpoints                                           │
│  [✓] /api/threats/detect                                   │
│  [ ] /api/threats/quick                                    │
│  [ ] /api/networks                                         │
│  [ ] /api/analytics/timeline                               │
│  [ ] /api/dashboard/stats                                  │
│                                                             │
│  📊 Dashboard Cards                                         │
│  [✓] threat-count-card                                     │
│  [ ] network-count-card                                    │
│  [ ] obs-count-card                                        │
│  [ ] signal-strength-card                                  │
│                                                             │
│  🗺️  Map Layers                                            │
│  [✓] threats-layer                                         │
│  [ ] networks-layer                                        │
│  [ ] heatmap-layer                                         │
│  [ ] routes-layer                                          │
│                                                             │
│  📋 Components                                              │
│  [ ] networks-explorer                                     │
│  [ ] threats-explorer                                      │
│  [ ] timeline-chart                                        │
│                                                             │
│                               [Cancel]  [Save Targets]     │
└─────────────────────────────────────────────────────────────┘
```

## API Integration

### Filter Parameter Encoding
```typescript
// Instead of single global filter:
// OLD: ?filter=base64(globalFilterObject)

// NEW: Send only applicable filters for this endpoint
function buildFilterParam(
  endpointId: string,
  filterState: FilterManagerState
): string {
  const applicableFilters = getFiltersForTarget('endpoint', endpointId, filterState);

  // Merge all applicable filter configs
  const mergedConfig = mergeFilterConfigs(applicableFilters);

  // Encode as base64
  const filterJson = JSON.stringify(mergedConfig);
  return btoa(filterJson).replace(/\+/g, '-').replace(/\//g, '_');
}

// Usage
const threatsApiUrl = `/api/threats/detect?filter=${buildFilterParam(
  '/api/threats/detect',
  filterState
)}`;
// This endpoint gets: homeAreaFilter + wifiOnlyFilter merged

const timelineApiUrl = `/api/analytics/timeline?filter=${buildFilterParam(
  '/api/analytics/timeline',
  filterState
)}`;
// This endpoint gets: last24HoursFilter + wifiOnlyFilter merged
```

### Merging Multiple Filters
```typescript
function mergeFilterConfigs(filters: FilterDefinition[]): any {
  const merged: any = {};

  for (const filter of filters) {
    // Spatial filters - take most restrictive
    if (filter.config.bounds) {
      if (!merged.bounds) {
        merged.bounds = filter.config.bounds;
      } else {
        // Intersection of bounding boxes
        merged.bounds = {
          north: Math.min(merged.bounds.north, filter.config.bounds.north),
          south: Math.max(merged.bounds.south, filter.config.bounds.south),
          east: Math.min(merged.bounds.east, filter.config.bounds.east),
          west: Math.max(merged.bounds.west, filter.config.bounds.west),
        };
      }
    }

    // Temporal filters - take intersection
    if (filter.config.dateRange) {
      if (!merged.dateRange) {
        merged.dateRange = filter.config.dateRange;
      } else {
        merged.dateRange = {
          start: new Date(Math.max(
            new Date(merged.dateRange.start).getTime(),
            new Date(filter.config.dateRange.start).getTime()
          )).toISOString(),
          end: new Date(Math.min(
            new Date(merged.dateRange.end).getTime(),
            new Date(filter.config.dateRange.end).getTime()
          )).toISOString(),
        };
      }
    }

    // Network filters - combine (union for some, intersection for others)
    if (filter.config.type) {
      merged.type = merged.type
        ? merged.type.filter((t: string) => filter.config.type.includes(t)) // Intersection
        : filter.config.type;
    }

    if (filter.config.bssid) {
      merged.bssid = merged.bssid
        ? [...new Set([...merged.bssid, ...filter.config.bssid])] // Union
        : filter.config.bssid;
    }

    // Threat filters - take most restrictive
    if (filter.config.minThreatScore !== undefined) {
      merged.minThreatScore = Math.max(
        merged.minThreatScore ?? 0,
        filter.config.minThreatScore
      );
    }
  }

  return merged;
}
```

## Component Integration

### Hook for Component-Level Filtering
```typescript
// Custom hook to get filters for current component
function useComponentFilters(componentId: string) {
  const { filterState } = useFilterManager();

  const filters = useMemo(() =>
    getFiltersForTarget('component', componentId, filterState),
    [componentId, filterState]
  );

  const mergedConfig = useMemo(() =>
    mergeFilterConfigs(filters),
    [filters]
  );

  return {
    filters,          // Individual filters
    mergedConfig,     // Merged configuration
    hasFilters: filters.length > 0,
    filterNames: filters.map(f => f.name)
  };
}

// Usage in component
function NetworksExplorer() {
  const { mergedConfig, filterNames } = useComponentFilters('networks-explorer');

  // Fetch data with component-specific filters
  const { data } = useQuery(['networks', mergedConfig], () =>
    fetchNetworks(mergedConfig)
  );

  return (
    <div>
      {filterNames.length > 0 && (
        <div className="filter-badge">
          Active filters: {filterNames.join(', ')}
        </div>
      )}
      <NetworkTable data={data} />
    </div>
  );
}
```

## Advanced Use Cases

### Scenario 1: Compare Filtered vs Unfiltered
```typescript
// Two cards showing same metric with different filters
const filteredThreatCount: FilterDefinition = {
  id: 'home-threats',
  name: 'Home Area Threats',
  type: 'spatial',
  config: { /* home area */ },
  targets: [{ type: 'card', identifier: 'home-threat-count' }]
};

const unfilteredThreatCount: FilterDefinition = {
  id: 'all-threats',
  name: 'All Threats',
  type: 'threat',
  config: {},
  targets: [{ type: 'card', identifier: 'total-threat-count' }]
};

// Result: Two threat count cards side-by-side
// - "Home Area: 15 threats"
// - "Total: 142 threats"
```

### Scenario 2: Map Shows All, Table Shows Filtered
```typescript
const timeFilter: FilterDefinition = {
  id: 'recent',
  name: 'Last Hour',
  type: 'temporal',
  config: { relativeTime: { value: 1, unit: 'hours' } },
  targets: [
    { type: 'component', identifier: 'networks-explorer' },
    { type: 'component', identifier: 'threats-explorer' }
    // Map layers NOT targeted - shows all time
  ]
};

// Result: Map shows all historical data, but tables show only last hour
```

### Scenario 3: Different Filters Per Endpoint
```typescript
const filters = [
  {
    id: 'wifi-networks',
    config: { type: ['W'] },
    targets: [{ type: 'endpoint', identifier: '/api/networks' }]
  },
  {
    id: 'all-threats',
    config: { type: ['W', 'B', 'E'] }, // WiFi, Bluetooth, BLE
    targets: [{ type: 'endpoint', identifier: '/api/threats/detect' }]
  }
];

// Networks API: Only WiFi
// Threats API: WiFi + Bluetooth + BLE
```

## Benefits of This Design

### Maximum Flexibility
- Apply filters **surgically** to specific targets
- Mix and match filters per component
- Compare filtered vs unfiltered views simultaneously

### Performance Optimization
- Only apply expensive filters where needed
- Map can show all data while tables show filtered subset
- Reduce unnecessary API calls

### User Empowerment
- Users control exactly what each filter affects
- Save complex multi-filter configurations
- Share specific filtered views

### Developer Convenience
- Components declare their filter needs
- Automatic filter merging and conflict resolution
- Centralized filter management with distributed application

---

**Status**: Advanced Specification Complete
**Complexity**: High
**Implementation Priority**: Core Infrastructure
**Estimated Effort**: 5-7 days for full implementation
