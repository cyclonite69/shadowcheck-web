# Geospatial Intelligence Page Layout Specification

## Current Architecture (As-Is)

The Geospatial Intelligence page currently has:

- ✅ NetworksExplorer component (with local filters)
- ✅ ThreatsExplorer component (with local filters)
- ✅ Heatmap, Routes, and Timeline sidebars
- ❌ Missing: Mapbox map at top
- ❌ Issue: Local filters instead of global filter

## Target Architecture (To-Be)

### Layout Structure

```
┌────────────────────────────────────────────────────────────┐
│  Geospatial Intelligence Header                           │
│  "Unified network, threat, and spatial intelligence"      │
├────────────────────────────────────────────────────────────┤
│  📊 Stats Cards (Networks, Heat Tiles, Routes, Threats)   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  🗺️  MAPBOX MAP (Full Width, 600px height)               │
│     - deck.gl 3D layers                                   │
│     - Network markers                                      │
│     - Threat indicators                                    │
│     - Heatmap overlay                                      │
│     - Route paths                                          │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  📡 Networks Explorer  |  ⚠️  Threats Explorer            │
│  (Combined side-by-side, no local filters)                │
│                                                            │
│  ┌─────────────────┐  │  ┌─────────────────┐             │
│  │ BSSID | SSID    │  │  │ BSSID | Score   │             │
│  │ --------------- │  │  │ --------------- │             │
│  │ aa:bb  WiFi-1   │  │  │ xx:yy  95 pts   │             │
│  │ cc:dd  WiFi-2   │  │  │ zz:aa  87 pts   │             │
│  └─────────────────┘  │  └─────────────────┘             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
GeospatialIntelligencePage
├── Header (Title + Description)
├── StatsCards (4 metric cards)
├── MapboxMap (deck.gl integrated)
│   ├── NetworksLayer (deck.gl ScatterplotLayer)
│   ├── ThreatsLayer (deck.gl IconLayer)
│   ├── HeatmapLayer (deck.gl HeatmapLayer)
│   └── RoutesLayer (deck.gl PathLayer)
├── Combined Explorers Row
│   ├── NetworksExplorer (50% width, NO filters)
│   └── ThreatsExplorer (50% width, NO filters)
└── (Optional: Sidebar with Heatmap/Routes/Timeline - can be collapsible)
```

## Key Principles

### 1. No Local Filters

- **Remove all filter UI** from NetworksExplorer
- **Remove all filter UI** from ThreatsExplorer
- **Remove search boxes, dropdowns, range sliders**
- Components receive **pre-filtered data** from global filter context

### 2. Map-First Design

- Mapbox map is the **primary** interaction point
- Map occupies **full width** above explorers
- Map height: **600px** (adjustable)
- Clicking map markers updates explorers selection

### 3. Unified Data Flow

```
Global Filter Context
       ↓
   API Calls (with filter params)
       ↓
   ┌─────────┬────────────┬──────────────┐
   ↓         ↓            ↓              ↓
Map Data   Networks   Threats    Stats Cards
```

### 4. Responsive Layout

```
Desktop (≥1280px):
- Map: Full width
- Explorers: 50% / 50% side-by-side

Tablet (768px - 1279px):
- Map: Full width
- Explorers: Stacked vertically

Mobile (<768px):
- Map: Full width, 400px height
- Explorers: Stacked, collapsed by default
```

## Implementation Checklist

### Phase 1: Map Integration

- [ ] Install and configure Mapbox GL JS
- [ ] Create MapboxMap component with deck.gl
- [ ] Add network markers layer
- [ ] Add threat indicators layer
- [ ] Add heatmap overlay
- [ ] Add route paths layer
- [ ] Wire up map click → explorer selection

### Phase 2: Explorer Refactoring

- [ ] Remove search input from NetworksExplorer
- [ ] Remove type filter dropdown from NetworksExplorer
- [ ] Remove signal range slider from NetworksExplorer
- [ ] Remove all local filter state from NetworksExplorer
- [ ] Remove search input from ThreatsExplorer
- [ ] Remove threat score filter from ThreatsExplorer
- [ ] Remove all local filter state from ThreatsExplorer

### Phase 3: Layout Updates

- [ ] Update GeospatialIntelligencePage layout to:
  - Header at top
  - Stats cards below header
  - Map full-width below stats
  - Explorers side-by-side below map
- [ ] Make sidebar (Heatmap/Routes/Timeline) collapsible
- [ ] Add responsive breakpoints

### Phase 4: Route Cleanup

- [ ] Remove /networks route from App.tsx
- [ ] Remove /threats route from App.tsx
- [ ] Delete NetworksPage.tsx component
- [ ] Delete NetworksTablePage.tsx component
- [ ] Delete ThreatsExplorerPage.tsx component

### Phase 5: Global Filter Preparation

- [ ] Create FilterContext (client/src/contexts/FilterContext.tsx)
- [ ] Create FilterPanel component (client/src/components/FilterPanel.tsx)
- [ ] Add FilterProvider to App.tsx root
- [ ] Update API calls to include filter parameter
- [ ] Update backend to parse and apply filters

## Component APIs

### NetworksExplorer (Simplified)

```typescript
interface NetworksExplorerProps {
  networks: NetworkRow[]; // Pre-filtered from API
  onSelect: (bssid: string) => void;
  selectedBssid: string | null;
  title?: string;
}

// NO PROPS for filters - managed globally
```

### ThreatsExplorer (Simplified)

```typescript
interface ThreatsExplorerProps {
  networks: NetworkRow[]; // Pre-filtered from API (threats only)
  onSelect: (bssid: string) => void;
  selectedBssid: string | null;
  title?: string;
}

// NO PROPS for filters - managed globally
```

### MapboxMap (New Component)

```typescript
interface MapboxMapProps {
  networks: NetworkRow[];
  threats: NetworkRow[];
  heatmap: HeatTile[];
  routes: RouteRow[];
  onNetworkClick: (bssid: string) => void;
  selectedBssid: string | null;
}
```

## Data Flow Example

### Before (Local Filters)

```
User types in search box
  ↓
Local state updates (setSearch)
  ↓
Component filters data locally
  ↓
Table re-renders with filtered subset
```

### After (Global Filter)

```
User interacts with Global Filter Panel
  ↓
Global filter context updates
  ↓
API call triggered with filter params
  ↓
Backend filters data in PostgreSQL
  ↓
Filtered data returned to frontend
  ↓
All components (Map, Explorers, Cards) receive filtered data
  ↓
No client-side filtering needed
```

## File Structure Changes

### Files to Keep (Modified)

- ✅ `client/src/components/GeospatialIntelligencePage.tsx` (updated layout)
- ✅ `client/src/components/NetworksExplorer.tsx` (remove filters)
- ✅ `client/src/components/ThreatsExplorer.tsx` (remove filters)

### Files to Delete

- ❌ `client/src/components/NetworksPage.tsx`
- ❌ `client/src/components/NetworksTablePage.tsx`
- ❌ `client/src/components/ThreatsExplorerPage.tsx`

### Files to Create

- ➕ `client/src/components/MapboxMap.tsx` (Mapbox + deck.gl integration)
- ➕ `client/src/contexts/FilterContext.tsx` (Global filter state)
- ➕ `client/src/components/FilterPanel.tsx` (Global filter UI)

## Migration Steps

### Step 1: Document Current State ✅

- This document

### Step 2: Remove Unused Pages

```bash
git rm client/src/components/NetworksPage.tsx
git rm client/src/components/NetworksTablePage.tsx
git rm client/src/components/ThreatsExplorerPage.tsx
```

### Step 3: Update Routes

```diff
// client/src/App.tsx
- <Route path="/networks" element={<NetworksPage />} />
- <Route path="/threats" element={<ThreatsExplorerPage />} />
```

### Step 4: Refactor Explorers

- Remove filter UI components
- Remove local state (useState for filters)
- Remove filter logic
- Accept pre-filtered data as props

### Step 5: Update Geospatial Intelligence Page

- Add Map component at top
- Rearrange explorers below map
- Update grid layout

### Step 6: Commit Changes

```
git add -A
git commit -m "Consolidate explorers into Geospatial Intelligence page

- Remove separate Networks and Threats explorer pages
- Move explorers below Mapbox map on Geospatial Intelligence page
- Remove local filters in preparation for global filter system
- Update routing to remove redundant pages"
```

---

**Status**: Specification Complete
**Next Action**: Begin implementation starting with file deletions
**Estimated Effort**: 2-3 hours
**Dependencies**: Mapbox token required for map integration
