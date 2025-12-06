# ShadowCheck Unified System - Quick Start

## What's New? 🎉

### 1. Resizable & Movable Cards ✅
- **Resize**: Drag the `⋮⋮` handle in bottom-right corner
- **Move**: Drag the card header to reposition
- **Layouts Saved**: Your layout is saved automatically per-page

### 2. Snap-to-Grid ✅
- **Toggle**: Click "🔲 Snap" button in header
- **Grid Size**: 20px for clean alignment
- **Turn Off**: For pixel-perfect positioning

### 3. Scrollable Pages ✅
- Pages now scroll when cards exceed viewport
- Add unlimited cards without space constraints

### 4. Reset Layout ✅
- Click "↺ Reset" button to restore default layout
- Clears saved positions and sizes for current page

### 5. Reusable Card Components ✅
- Network List card
- Threat List card  
- Map Viewer card
- Can be added to any page

## Current Issues to Fix

### Navigation Bar Not Uniform ⚠️
**Problem**: Complex pages (networks, geospatial, surveillance, analytics) have custom headers that don't match the unified grid layout.

**Solution**: Need to update these 4 pages to use the standardized header structure.

**Impact**: Navigation links won't be perfectly centered on these pages until fixed.

## How to Use

### Resize a Card
1. Hover over bottom-right corner of any card
2. Look for the `⋮⋮` handle
3. Click and drag to resize
4. Release to save

### Move a Card
1. Click and hold on the card header (title bar)
2. Drag to new position
3. Release to save
4. Card becomes absolutely positioned

### Toggle Snap-to-Grid
1. Click "🔲 Snap: ON" button in header
2. Button changes to "🔲 Snap: OFF"
3. Cards will snap to 20px grid when ON
4. Free positioning when OFF

### Reset Your Layout
1. Click "↺ Reset" button in header
2. Page reloads with default layout
3. All custom positions/sizes cleared

## Best Practices

### Organizing Your Dashboard
1. **Enable Snap**: Turn on snap-to-grid for clean alignment
2. **Size Cards**: Resize cards to show the right amount of data
3. **Position Cards**: Arrange by priority (top-left = most important)
4. **Save Often**: Layout saves automatically, but test by refreshing

### Multi-Monitor Setup
1. **Disable Snap**: For precise positioning across monitors
2. **Maximize Cards**: Resize cards to fill available space
3. **Vertical Stacking**: Stack cards vertically for tall monitors

### Adding More Cards (Coming Soon)
- Card library UI will let you add cards to any page
- Network list can appear on geospatial page
- Threat list can appear on dashboard
- Map can appear on surveillance page

## Keyboard Shortcuts (Future)
- `Ctrl+R`: Reset layout
- `Ctrl+S`: Toggle snap
- `Ctrl+L`: Open card library
- `Esc`: Cancel drag/resize

## Troubleshooting

### Card Won't Move
- Make sure you're clicking the header, not the content
- Avoid clicking buttons or inputs in the header

### Card Won't Resize
- Look for the `⋮⋮` handle in bottom-right corner
- Make sure you're not clicking the header

### Layout Not Saving
- Check browser localStorage is enabled
- Try clearing cache and resetting layout

### Navigation Not Centered
- This is a known issue on 4 pages (networks, geospatial, surveillance, analytics)
- Will be fixed in next update

## Files Modified

✅ `/assets/styles/unified.css` - Grid header, scrollable pages, card styles
✅ `/assets/js/unified-components.js` - Snap-to-grid, resize, move
✅ `/assets/js/unified-card-library.js` - Reusable card components
✅ `/assets/js/unified-header.js` - Standardized header
✅ All HTML pages - Include unified scripts

## Next Steps

1. **Fix Navigation**: Update 4 complex pages to use unified header
2. **Column Picker**: Add UI to customize visible columns per card
3. **Card Library UI**: Modal to add cards to any page
4. **Global Filters**: Integrate unified filter system
5. **Card Templates**: Save/load entire page layouts

## Questions?

See `UNIFIED_IMPLEMENTATION.md` for detailed technical documentation.
