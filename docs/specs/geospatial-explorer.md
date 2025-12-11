# Geospatial Explorer React Migration Spec

**Date**: 2025-12-10
**Status**: Ready for Kiro CLI Implementation

## Overview

Migrate the legacy HTML-based geospatial explorer to a modern React + Vite implementation with **draggable, resizable panels** matching the existing interactive dashboard aesthetic.

## Current State Analysis

### Existing HTML Implementation

**Location**: `public/geospatial.html`

**Current Features**:

- Full database network list with filters
- Threat severity filtering
- Geospatial map with Mapbox GL JS
- Numbered observation points with connecting "wires"
- Detailed tooltips on hover
- Multi-network selection and display

**Current API Endpoints**:

```javascript
GET /api/kepler/data?bbox=&limit=     // Network data for map
GET /api/kepler/observations           // All observation points
GET /api/networks/search               // Network search/filter
```

### Existing React Components (Reference Style)

- `src/components/Dashboard.tsx` - Draggable/resizable cards
- `src/components/NetworksTablePage.tsx` - Advanced table patterns
- `src/components/AnalyticsPage.tsx` - Data visualization
- `src/components/GeospatialDashboard.tsx` - Basic map integration

## Target Architecture

### Component Structure

```
GeospatialExplorer/
├── index.tsx                    # Main page component
├── GeospatialMap.tsx           # Map with markers, lines, tooltips
├── NetworkTable.tsx            # Unified network/threat explorer
├── ThreatPanel.tsx             # Optional separate threat view
├── ColumnChooser.tsx           # Column visibility controls
├── hooks/
│   ├── useNetworks.ts          # Network data fetching
│   ├── useObservations.ts      # Observation data fetching
│   ├── useLayoutPersistence.ts # Save/restore panel positions
│   └── useSelection.ts         # Multi-select state management
└── types.ts                    # TypeScript interfaces
```

## Layout Requirements

### Panel System

**Library**: `react-grid-layout` or `react-rnd`

**Three Primary Panels**:

1. **Map Panel** (Geospatial Intelligence)
   - Default: 70% width, 60% height
   - Top/center position
   - Draggable + Resizable
   - Maintains Mapbox GL instance when moved/resized

2. **Network Explorer Panel**
   - Default: 100% width, 40% height
   - Below map
   - Draggable + Resizable
   - Internal scrolling for table body
   - Sticky header

3. **Threat Explorer Panel** (Optional)
   - Can be integrated as columns in Network Explorer OR
   - Separate panel: 30% width, stacked with Network Explorer
   - Draggable + Resizable

**Persistence**:

```typescript
interface PanelLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

localStorage.setItem('geospatial-layout', JSON.stringify(layouts));
```

## Data Requirements

### Network Schema (from app.networks)

```typescript
interface Network {
  bssid: string;
  ssid: string;
  type: 'W' | 'E' | 'B' | 'L' | 'N' | 'G';
  channel: number;
  frequency: number;
  encryption: string;
  max_signal: number;
  bestlevel: number;
  manufacturer: string;
  device_type: string;
  latitude: number;
  longitude: number;
  location: GeoJSON.Point;
  first_seen: string;
  last_seen: string;
  ml_threat_score: number;
  capabilities: string;
}
```

### Observation Schema (from app.observations)

```typescript
interface Observation {
  bssid: string;
  location: GeoJSON.Point;
  signal_dbm: number;
  observed_at: string;
  source_type: string;
  source_device: string;
  accuracy_meters: number;
  altitude_meters: number;
  fingerprint: string;
  sequence?: number; // Client-side: chronological order
}
```

## API Contracts

### Existing Endpoints (Keep Unchanged)

**Network Data**:

```http
GET /api/kepler/data?bbox=minLon,minLat,maxLon,maxLat&limit=N
Response: GeoJSON FeatureCollection
```

**Observations**:

```http
GET /api/kepler/observations?bbox=&limit=
Response: GeoJSON FeatureCollection
```

**Network Search**:

```http
GET /api/networks/search?q=&type=&sort=&order=&offset=&limit=
Response: { networks: Network[], total: number }
```

### New Endpoints (If Needed)

**Observations by BSSID(s)**:

```http
POST /api/observations/by-bssids
Body: { bssids: string[] }
Response: { observations: Observation[] }
```

**Network with Observation Count**:

```http
GET /api/networks/with-stats?offset=&limit=&sort=&filter=
Response: { networks: NetworkWithStats[], total: number }
```

## Map Implementation

### Behavior Requirements (Port from HTML)

1. **Numbered Markers**
   - Each observation gets a sequential number (1, 2, 3, ...)
   - Order: chronological by `observed_at`
   - Number displayed as marker label

2. **Connecting Lines ("Wires")**
   - Draw line segments between consecutive observations
   - Use GeoJSON LineString
   - Style: `stroke-color: #3B82F6, stroke-width: 2`

3. **Tooltips**

   ```html
   BSSID: xx:xx:xx:xx:xx:xx Signal: -XX dBm Time: YYYY-MM-DD HH:mm:ss Source: [source_type]
   Accuracy: ±X meters Altitude: X meters
   ```

4. **Multi-Network Display**
   - Different color per network
   - All observations numbered independently per network
   - Toggle visibility per network

### Map Component Structure

```typescript
interface GeospatialMapProps {
  selectedNetworks: Network[];
  observations: Map<string, Observation[]>; // bssid -> observations
  onMarkerClick?: (observation: Observation) => void;
  onMarkerHover?: (observation: Observation | null) => void;
}

function GeospatialMap({ selectedNetworks, observations }: GeospatialMapProps) {
  // Initialize Mapbox GL
  // Render numbered markers
  // Draw connecting lines
  // Add tooltips
  // Handle resize events
}
```

## Network Table Implementation

### Features

**Full-Database Semantics**:

- All sorting/filtering server-side
- Client sees "infinite" list via virtualization
- Lazy loading with intersection observer

**Columns** (configurable):

```typescript
const DEFAULT_COLUMNS = [
  { key: 'select', label: '', width: 40, fixed: true },
  { key: 'bssid', label: 'BSSID', width: 140, sortable: true },
  { key: 'ssid', label: 'SSID', width: 180, sortable: true },
  { key: 'type', label: 'Type', width: 80, sortable: true },
  { key: 'max_signal', label: 'Signal', width: 90, sortable: true },
  { key: 'encryption', label: 'Security', width: 120, sortable: true },
  { key: 'first_seen', label: 'First Seen', width: 160, sortable: true },
  { key: 'last_seen', label: 'Last Seen', width: 160, sortable: true },
  { key: 'ml_threat_score', label: 'Threat', width: 100, sortable: true },
  { key: 'manufacturer', label: 'Manufacturer', width: 160, sortable: false },
];
```

**Filters**:

- Text search (SSID, BSSID) - debounced 300ms
- Type filter (W, E, B, L, N, G)
- Threat severity filter
- Signal strength range
- Date range (first_seen, last_seen)

**Selection**:

```typescript
interface SelectionState {
  selectedBssids: Set<string>;
  selectAll: boolean;
  selectAllFilteredCount: number;
}
```

**Actions**:

- Display on Map (multi-select)
- Export selected (CSV, JSON)
- Tag as Threat/Safe
- Delete (with confirmation)

### Table Component Structure

```typescript
interface NetworkTableProps {
  onSelectionChange: (bssids: Set<string>) => void;
  onRowClick?: (network: Network) => void;
  selectedBssids?: Set<string>;
}

function NetworkTable({ onSelectionChange, onRowClick }: NetworkTableProps) {
  const { networks, loading, error, fetchMore } = useNetworks({
    filters,
    sort,
    limit: 50,
  });

  // Virtualized list with react-window or react-virtual
  // Debounced search
  // Server-side sort
  // Intersection observer for infinite scroll
}
```

## Hooks API

### useNetworks

```typescript
interface UseNetworksOptions {
  filters?: {
    search?: string;
    type?: string[];
    threatMin?: number;
    signalMin?: number;
    dateRange?: [string, string];
  };
  sort?: { field: string; order: 'asc' | 'desc' }[];
  limit?: number;
  enabled?: boolean;
}

interface UseNetworksReturn {
  networks: Network[];
  total: number;
  loading: boolean;
  error: Error | null;
  fetchMore: () => Promise<void>;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

function useNetworks(options: UseNetworksOptions): UseNetworksReturn;
```

### useObservations

```typescript
interface UseObservationsOptions {
  bssids: string[];
  enabled?: boolean;
}

interface UseObservationsReturn {
  observations: Map<string, Observation[]>; // bssid -> sorted observations
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function useObservations(options: UseObservationsOptions): UseObservationsReturn;
```

### useLayoutPersistence

```typescript
interface Layout {
  [panelId: string]: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

function useLayoutPersistence(defaultLayout: Layout): {
  layout: Layout;
  saveLayout: (layout: Layout) => void;
  resetLayout: () => void;
};
```

## Performance Optimizations

1. **Debounced Search**: 300ms delay on text input
2. **Request Cancellation**: Cancel stale API requests using AbortController
3. **Virtualized List**: `react-window` for table body
4. **Memoization**:
   - `useMemo` for filtered/sorted data
   - `useCallback` for event handlers
   - `React.memo` for row components
5. **Map Optimization**:
   - Cluster markers when > 1000 observations
   - Use GeoJSON sources for better performance
   - Debounce map move/zoom events

## Styling Guidelines

### Follow Existing Patterns

**Background** (from Dashboard.tsx):

```tsx
className =
  'relative w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950';
```

**Card Style** (draggable panels):

```tsx
className =
  'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg shadow-xl';
```

**Header**:

```tsx
className = 'flex items-center justify-between p-4 border-b border-slate-700';
```

**Table** (from NetworksTablePage.tsx):

```tsx
className = 'w-full border-collapse';
// Sticky header
className = 'sticky top-0 z-10 bg-slate-800';
// Row hover
className = 'hover:bg-slate-700/50 transition-colors';
```

**Threat Badges**:

```tsx
// Critical
className =
  'px-2 py-1 text-xs font-semibold rounded bg-red-900/30 text-red-300 border border-red-800';
// High
className =
  'px-2 py-1 text-xs font-semibold rounded bg-orange-900/30 text-orange-300 border border-orange-800';
// Medium
className =
  'px-2 py-1 text-xs font-semibold rounded bg-yellow-900/30 text-yellow-300 border border-yellow-800';
// Low
className =
  'px-2 py-1 text-xs font-semibold rounded bg-green-900/30 text-green-300 border border-green-800';
```

## Implementation Checklist

- [ ] Set up `GeospatialExplorer` page component
- [ ] Implement draggable/resizable layout with `react-grid-layout`
- [ ] Port map implementation from HTML (numbering, wires, tooltips)
- [ ] Create `useNetworks` hook with server-side filtering/sorting
- [ ] Create `useObservations` hook for multi-BSSID queries
- [ ] Implement virtualized network table
- [ ] Add column chooser with localStorage persistence
- [ ] Implement multi-select with "Display on Map" action
- [ ] Add threat severity filtering and badges
- [ ] Implement layout persistence (localStorage)
- [ ] Add debounced search
- [ ] Test with 100k+ networks (performance)
- [ ] Test panel drag/resize with active map
- [ ] Test multi-network display on map
- [ ] Add loading states and error handling
- [ ] Write component documentation
- [ ] Update routing in App.tsx

## Legacy Code References

**HTML Implementation**:

- `public/geospatial.html` - Map setup, numbering logic, tooltips
- `public/js/geospatial.js` - Event handlers, API calls (if exists)

**Backend Routes**:

- `src/api/routes/v1/geospatial.js` - Existing endpoints
- `server.js` lines 225-343 - Kepler.gl data endpoints

**Database Schema**:

- `app.networks` - Network metadata
- `app.observations` - Individual observation points

## Testing Strategy

1. **Unit Tests**:
   - Hook logic (useNetworks, useObservations)
   - Selection state management
   - Column visibility persistence

2. **Integration Tests**:
   - API endpoint responses
   - Map rendering with observations
   - Table filtering/sorting

3. **Performance Tests**:
   - 100k networks in table
   - 10k observations on map
   - Panel drag/resize with active map

4. **Manual Testing**:
   - Multi-network selection and display
   - Column customization
   - Layout persistence across reload
   - Responsive behavior

## Kiro CLI Prompt

See `KIRO_GEOSPATIAL_PROMPT.txt` for the full implementation prompt.

---

**Next Steps**:

1. Run Kiro CLI with specification prompt
2. Review generated components
3. Test with production database
4. Iterate on UX/performance
5. Deploy to production build
