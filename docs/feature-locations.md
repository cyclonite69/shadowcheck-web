# Feature Locations Guide

## Filter Buttons

### Dashboard Page

**Location:** Top center, below the title
**Button:** "⚙ Show Filters" (gray button)
**When clicked:** Filter panel appears below with active filter summary

### Kepler Test Page

**Location:** Left side control panel, below "ShadowCheck" title
**Button:** "⚙ Show Filters" (full width button in controls)
**When clicked:** Filter panel appears on right side

### WiGLE Test Page

**Location:** Top toolbar, next to "Load Points" button
**Button:** "⚙ Filters" (gray button)
**When clicked:** Filter panel appears on right side

### Geospatial Explorer

**Location:** Already has filter panel integrated (left sidebar)
**Always visible:** Filter panel is part of the main UI

## Map Orientation Controls

### What They Are

1. **Compass** (Navigation Control)
   - Location: Top-right corner of map
   - Shows: Zoom +/- buttons and compass (when map is rotated)
   - Click compass: Resets map bearing to north

2. **Scale Bar** (Distance Legend)
   - Location: Bottom-right corner of map
   - Shows: Dynamic distance scale (km/m)
   - Updates: Automatically with zoom level

### Where They Appear

**GeospatialExplorer:** ✓ Has both controls
**WigleTestPage:** ✓ Has both controls  
**KeplerTestPage:** ✓ Has both controls (on underlying Mapbox map)
**Dashboard:** ✗ No map (dashboard cards only)

## Troubleshooting

### "I don't see the filter button"

**Dashboard:**

- Look at the very top center of the page
- Below "ShadowCheck Dashboard" title
- Small gray button with "⚙ Show Filters"

**Kepler:**

- Look at the left side panel (dark blue box)
- Below "Network Visualization" text
- Full-width button

**WiGLE:**

- Look at the top toolbar (dark gray bar)
- Right side, next to "Load Points" button
- Says "⚙ Filters"

### "I don't see the map controls"

**Scale Bar:**

- Bottom-right corner of map
- Small horizontal bar with distance
- May be subtle - look for "100m" or "1km" text

**Compass:**

- Top-right corner of map
- Zoom buttons (+/-) always visible
- Compass icon appears when you rotate the map
- Try rotating the map (right-click + drag) to see compass

### "The controls are there but hard to see"

The controls use Mapbox's default styling which is subtle. They are:

- Semi-transparent
- Small size
- Designed to not obstruct the map

To verify they're working:

1. **Scale bar:** Zoom in/out - the scale should update
2. **Compass:** Rotate map (right-click + drag) - compass appears
3. **Zoom:** Click +/- buttons - map should zoom

## Visual Reference

```
DASHBOARD PAGE:
┌─────────────────────────────────────┐
│   ShadowCheck Dashboard             │
│   Real-time network intelligence    │
│   [⚙ Show Filters] ← HERE           │
├─────────────────────────────────────┤
│                                     │
│   [Dashboard Cards]                 │
│                                     │
└─────────────────────────────────────┘

KEPLER PAGE:
┌──────────┬──────────────────────────┐
│ Controls │                          │
│ ┌──────┐ │                          │
│ │ 🛡️   │ │      MAP AREA            │
│ │Shadow│ │                          │
│ │Check │ │   [+]  ← Zoom (top-right)│
│ │      │ │   [-]                    │
│ │[⚙ Sh]│ │                          │
│ │[ow F]│ │                          │
│ │[ilte]│ │                          │
│ │[rs] │ │   [100m] ← Scale (bottom)│
│ └──────┘ │                          │
└──────────┴──────────────────────────┘
    ↑
  Filter button here

WIGLE PAGE:
┌─────────────────────────────────────┐
│ WiGLE v2 Test Map                   │
│ [Load Points] [⚙ Filters] ← HERE    │
├─────────────────────────────────────┤
│                                     │
│           MAP AREA                  │
│                                     │
│   [+]  ← Zoom (top-right)           │
│   [-]                               │
│                                     │
│   [100m] ← Scale (bottom-right)     │
└─────────────────────────────────────┘
```

## Testing Steps

1. **Open Dashboard**
   - Look for gray button below title
   - Click it
   - Filter panel should appear

2. **Open Kepler Test** (`/kepler-test`)
   - Look at left control panel
   - Click "Show Filters" button
   - Filter panel appears on right
   - Look at map corners for zoom/scale

3. **Open WiGLE Test** (`/wigle-test`)
   - Look at top toolbar
   - Click "Filters" button
   - Filter panel appears on right
   - Look at map corners for zoom/scale

4. **Test Map Controls**
   - Zoom in/out with +/- buttons
   - Watch scale bar update
   - Right-click + drag to rotate map
   - Compass should appear
   - Click compass to reset rotation
