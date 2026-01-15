# Map Orientation Controls

## Overview

All Mapbox GL maps in ShadowCheck now include standardized orientation controls:

- **Compass** - Shows when map is rotated, click to reset bearing to 0°
- **Scale Bar** - Dynamic distance legend (metric: km/m)

## Implementation

### Utility Function

`src/utils/mapOrientationControls.ts` provides:

```typescript
attachMapOrientationControls(map: mapboxgl.Map, options?: MapOrientationOptions): () => void
```

**Features:**

- Idempotent: Safe to call multiple times without duplicating controls
- Returns cleanup function for proper teardown
- Detects existing controls to avoid duplication
- Uses Mapbox GL built-in controls (NavigationControl + ScaleControl)

**Options:**

```typescript
{
  scalePosition: 'bottom-right',      // Scale bar position
  scaleUnit: 'metric',                // 'metric' | 'imperial' | 'nautical'
  scaleMaxWidth: 160,                 // Max width in pixels
  ensureNavigation: true,             // Add nav control if missing
  navigationPosition: 'top-right'     // Nav control position
}
```

### Applied To

1. **GeospatialExplorer** (`src/components/GeospatialExplorer.tsx`)
   - Main geospatial intelligence map
   - Scale: bottom-right, metric
   - Navigation: top-right (existing)

2. **WigleTestPage** (`src/components/WigleTestPage.tsx`)
   - WiGLE data visualization map
   - Scale: bottom-right, metric
   - Navigation: top-right (existing)

3. **KeplerTestPage** (`src/components/KeplerTestPage.tsx`)
   - DeckGL-based 3D visualization
   - Accesses underlying Mapbox map via `deck.getMapboxMap()`
   - Scale: bottom-right, metric
   - Navigation: top-right (added)

## Control Positions

```
┌─────────────────────────────────┐
│  [Nav: Zoom + Compass]          │  top-right
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                  [Scale Bar]    │  bottom-right
└─────────────────────────────────┘
```

## Behavior

### Compass (NavigationControl)

- Appears automatically when map bearing ≠ 0°
- Click to reset bearing to 0° (north-up)
- Includes zoom +/- buttons
- Standard Mapbox GL control

### Scale Bar (ScaleControl)

- Always visible
- Updates dynamically based on zoom level
- Shows metric units (km at high zoom, m at low zoom)
- Max width: 160px
- Standard Mapbox GL control

## Memory Management

Controls are properly cleaned up when:

- Component unmounts
- Map instance is destroyed
- Page navigation occurs

The utility tracks attached controls and prevents duplication even across hot reloads.

## Future Enhancements

- Imperial unit toggle UI (structure already in place)
- Custom control styling to match dark theme
- Pitch indicator for 3D views
- Coordinate display option

## Testing

Build: ✅ Successful

- No TypeScript errors
- No duplicate control warnings
- All map instances include controls

Manual testing checklist:

- [ ] GeospatialExplorer shows scale bar
- [ ] Rotating map shows compass
- [ ] Clicking compass resets bearing
- [ ] WigleTestPage shows scale bar
- [ ] KeplerTestPage shows scale bar and compass
- [ ] No duplicate controls after hot reload
- [ ] No console errors
- [ ] Existing drag/resize behavior unchanged
