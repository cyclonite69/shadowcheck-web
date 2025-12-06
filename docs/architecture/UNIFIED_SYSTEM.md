# ShadowCheck Unified System

## Overview
A comprehensive unified component system providing consistent navigation, resizable/movable cards, and global filtering across all pages.

## Features Implemented

### 1. Centered Navigation
- **Grid-based header**: 3-column layout (left | center | right)
- **Perfectly centered nav**: Navigation links always centered regardless of content
- **Consistent across all pages**: Same header structure everywhere

### 2. Resizable Cards
- **All panels are resizable**: Drag the resize handle (⋮⋮) in bottom-right corner
- **Persistent layouts**: Card sizes saved per-page in localStorage
- **Reset button**: Click "↺ Reset" in header to restore default layout

### 3. Movable Cards
- **Drag to reposition**: Click and drag panel headers to move cards
- **Absolute positioning**: Cards can be placed anywhere on screen
- **Layout persistence**: Positions saved automatically

### 4. Unified Filter System (Ready for Integration)
- **Global filter bar**: Can be added to any page
- **Cross-component filtering**: All components can subscribe to filter changes
- **Filter types**: Search, Type, Security, and more

## Usage

### For Developers

#### Enable Resizable/Movable Cards
Cards are automatically enabled on page load. To manually enable:

```javascript
const panel = document.querySelector('.panel');
window.unifiedCards.enableCard(panel);
```

#### Reset Layout
```javascript
window.unifiedCards.resetLayout(); // Resets current page
```

#### Add Global Filter Bar
```javascript
const main = document.querySelector('.app-main');
window.unifiedFilters.createFilterBar(main);
```

#### Subscribe to Filter Changes
```javascript
window.unifiedFilters.subscribe((filters) => {
    console.log('Filters changed:', filters);
    // Re-render your data with filters applied
});
```

#### Set/Get Filters Programmatically
```javascript
window.unifiedFilters.setFilter('search', 'test');
window.unifiedFilters.setFilter('type', 'W');
const allFilters = window.unifiedFilters.getAllFilters();
```

## Files

### Core System
- `/assets/styles/unified.css` - Unified styles with grid header and card system
- `/assets/js/unified-header.js` - Consistent header component
- `/assets/js/unified-components.js` - Resizable cards and filter system

### Integration
All pages automatically load:
```html
<script src="/assets/js/unified-header.js"></script>
<script src="/assets/js/unified-components.js"></script>
```

## Layout Storage

Layouts are stored in localStorage:
```javascript
{
  "/index.html": {
    "card-abc123": {
      "width": "400px",
      "height": "300px",
      "left": "100px",
      "top": "200px"
    }
  }
}
```

## Next Steps

### To Add Global Filtering to a Page:

1. Add filter bar to page:
```javascript
document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('.app-main');
    window.unifiedFilters.createFilterBar(main);
});
```

2. Subscribe to filter changes:
```javascript
window.unifiedFilters.subscribe((filters) => {
    // Filter your data
    const filtered = data.filter(item => {
        if (filters.search && !item.name.includes(filters.search)) return false;
        if (filters.type && item.type !== filters.type) return false;
        return true;
    });
    renderData(filtered);
});
```

### To Add Custom Filters:

Extend the filter bar HTML in `unified-components.js`:
```javascript
<select id="global-custom" class="filter-select">
    <option value="">Custom Filter</option>
    <option value="value1">Option 1</option>
</select>
```

Then add event listener:
```javascript
document.getElementById('global-custom').addEventListener('change', (e) => {
    this.setFilter('custom', e.target.value);
});
```

## Benefits

✅ **Consistency**: Same navigation and behavior across all pages  
✅ **Flexibility**: Users can customize their layout  
✅ **Persistence**: Layouts saved automatically  
✅ **Extensibility**: Easy to add new filters and features  
✅ **Performance**: Minimal overhead, uses native browser APIs  

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile: Touch events not yet implemented (future enhancement)
