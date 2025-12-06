# Unified System Implementation Guide

## Current Status

### ✅ Completed
1. **Snap-to-Grid**: Cards snap to 20px grid (toggle with "🔲 Snap" button)
2. **Scrollable Pages**: All pages can scroll when cards exceed viewport
3. **Card Library**: Reusable network list, threat list, and map components
4. **Resizable/Movable**: All cards can be resized and repositioned
5. **Layout Persistence**: Layouts saved per-page in localStorage

### ⚠️ Needs Fixing
1. **Navigation Uniformity**: Complex pages (networks, geospatial, surveillance, analytics) have custom headers
2. **Header Integration**: Need to standardize all headers to use grid layout

## Design Decisions & Best Practices

### 1. Shared Components (Implemented)
**File**: `/assets/js/unified-card-library.js`

- **Network List Card**: Reusable across Networks and Geospatial pages
- **Threat List Card**: Reusable across Surveillance and any page
- **Map Viewer Card**: Can be added to any page

**Benefits**:
- Single source of truth for data display
- Consistent filtering and sorting
- Column customization per-card instance

### 2. Snap-to-Grid (Implemented)
**Grid Size**: 20px
**Toggle**: "🔲 Snap" button in header

**Benefits**:
- Clean, aligned layouts
- Easier to create organized dashboards
- Can be disabled for pixel-perfect positioning

### 3. Scrollable Pages (Implemented)
**CSS**: `.app-main { overflow-y: auto; }`

**Benefits**:
- Unlimited cards per page
- No viewport constraints
- Future-proof for adding more cards

### 4. Column Customization (Framework Ready)
Each card can have different visible columns:
- Networks page: Show all technical columns
- Geospatial page: Show location-focused columns
- Saved per-card instance

### 5. Card Library System (Implemented)
Any card can be added to any page via:
```javascript
window.cardManager.addCard('networkList', 'container-id');
```

## Recommended Next Steps

### Priority 1: Fix Navigation Uniformity

All pages should use this exact header structure:
```html
<header class="app-header">
    <div class="header-left">
        <div class="logo">SC</div>
        <span class="font-semibold">ShadowCheck</span>
    </div>
    <nav class="nav-links">
        <a href="/" class="nav-link">Dashboard</a>
        <a href="/networks.html" class="nav-link">Networks</a>
        <a href="/geospatial.html" class="nav-link">Geospatial</a>
        <a href="/surveillance.html" class="nav-link">Surveillance</a>
        <a href="/analytics.html" class="nav-link">Analytics</a>
        <a href="/admin.html" class="nav-link">Admin</a>
    </nav>
    <div class="header-right">
        <button class="btn btn-sm" onclick="window.unifiedCards.toggleSnap()">🔲 Snap</button>
        <button class="btn btn-sm" onclick="window.unifiedCards.resetLayout()">↺ Reset</button>
        <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Online</span>
        </div>
    </div>
</header>
```

**CSS ensures**:
- Grid layout: `grid-template-columns: 1fr auto 1fr`
- Nav always centered
- Left/right sections flex to edges

### Priority 2: Implement Column Picker

Add modal for selecting visible columns:
```javascript
CardLibrary.networkList.openColumnPicker('container-id');
```

Should show:
- Checkboxes for each available column
- Drag to reorder columns
- Save per-card instance

### Priority 3: Integrate Unified Filters

Add to each card that needs filtering:
```javascript
window.unifiedFilters.subscribe((filters) => {
    CardLibrary.networkList.loadData(containerId, columns, filters);
});
```

### Priority 4: Card Library UI

Create modal to add cards to current page:
- Show available card types
- Preview of each card
- Click to add to page
- Saved to page configuration

## File Structure

```
/assets/
  /styles/
    unified.css                 # Core styles with grid header
  /js/
    unified-header.js           # Header component (auto-inject)
    unified-components.js       # Resizable/movable + snap-to-grid
    unified-card-library.js     # Reusable card components

/public/
  index.html                    # ✅ Uses unified header
  admin.html                    # ✅ Uses unified header
  ml-train.html                 # ✅ Uses unified header
  networks.html                 # ⚠️ Custom header (needs update)
  geospatial.html               # ⚠️ Custom header (needs update)
  surveillance.html             # ⚠️ Custom header (needs update)
  analytics.html                # ⚠️ Custom header (needs update)
```

## Usage Examples

### Add Network List to Any Page
```javascript
const container = document.createElement('div');
container.id = 'my-network-list';
container.className = 'panel';
document.querySelector('.app-main').appendChild(container);

CardLibrary.networkList.render(container, {
    columns: ['ssid', 'bssid', 'signal', 'lastSeen'],
    filters: { type: 'W' }
});

window.unifiedCards.enableCard(container);
```

### Add Threat List to Geospatial Page
```javascript
const container = document.createElement('div');
container.id = 'threat-sidebar';
container.className = 'panel';
container.style.cssText = 'position: absolute; right: 20px; top: 80px; width: 400px;';
document.querySelector('.app-main').appendChild(container);

CardLibrary.threatList.render(container);
window.unifiedCards.enableCard(container);
```

### Subscribe to Global Filters
```javascript
window.unifiedFilters.subscribe((filters) => {
    console.log('Active filters:', filters);
    // Re-render all cards with new filters
    CardLibrary.networkList.loadData('network-list', columns, filters);
    CardLibrary.threatList.loadData('threat-list', columns, filters);
});
```

## Benefits of This Approach

1. **Consistency**: Same components everywhere
2. **Flexibility**: Users customize their view
3. **Maintainability**: Update one component, affects all instances
4. **Extensibility**: Easy to add new card types
5. **User Experience**: Persistent layouts, snap-to-grid, scrollable
6. **Performance**: Only load data for visible cards

## Future Enhancements

1. **Card Templates**: Save/load entire page layouts
2. **Card Linking**: Click network → highlight on map
3. **Real-time Updates**: WebSocket for live data
4. **Mobile Support**: Touch events for drag/resize
5. **Card Minimization**: Collapse cards to title bar
6. **Multi-page Layouts**: Tabs or workspace switcher
