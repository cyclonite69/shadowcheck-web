# Chart/Map Auto-Resize Fix

## Issue Description

When resizing chart panels (either by dragging the resize handle or using the expand button), the Chart.js charts would not automatically fill the newly available space, leaving blank areas.

## Root Cause

Chart.js charts do not automatically recalculate their dimensions when their container changes size. The library needs to be explicitly told to resize via the `chart.resize()` method.

## Solution Implemented

### 1. **ResizeObserver API Integration**

Added `ResizeObserver` to watch for panel size changes:

```javascript
if (window.ResizeObserver) {
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      // Debounce resize to avoid too many calls
      clearTimeout(entry.target.resizeTimeout);
      entry.target.resizeTimeout = setTimeout(() => {
        resizeChartsInPanel(entry.target);
      }, 100);
    }
  });
  resizeObserver.observe(panel);
}
```

**Benefits:**

- Automatically detects ANY size change to panels
- Works for drag-resize, expand/collapse, and CSS changes
- Debounced to prevent performance issues
- Modern browser API (supported by all current browsers)

### 2. **Chart Resize Functions**

Created dedicated functions to resize charts:

```javascript
// Resize charts within a specific panel
function resizeChartsInPanel(panel) {
  const canvases = panel.querySelectorAll('canvas');
  canvases.forEach((canvas) => {
    const chartId = canvas.id;
    if (chartId === 'threatChart' && threatChart) {
      threatChart.resize();
    } else if (chartId === 'temporalChart' && temporalChart) {
      temporalChart.resize();
    }
  });
}

// Resize all charts on the page
function resizeAllCharts() {
  if (threatChart) threatChart.resize();
  if (temporalChart) temporalChart.resize();
}
```

### 3. **Integrated with Existing Resize Events**

**Drag-to-Resize:**

```javascript
document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const delta = e.clientY - startY;
  const newHeight = Math.max(200, Math.min(startHeight + delta, window.innerHeight - 200));
  panel.style.height = newHeight + 'px';

  // Trigger chart resize during drag
  resizeChartsInPanel(panel);
});
```

**On Mouse Release:**

```javascript
document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    savePanelSizes();
    // Final chart resize after drag completes
    resizeChartsInPanel(panel);
  }
});
```

**Expand/Collapse:**

```javascript
function togglePanelExpand(panel) {
  panel.classList.toggle('expanded');
  savePanelSizes();

  // Resize charts after expand/collapse animation
  setTimeout(() => {
    resizeChartsInPanel(panel);
    // Also resize other visible charts since grid layout changes
    resizeAllCharts();
  }, 50);
}
```

**Window Resize:**

```javascript
window.addEventListener('resize', () => {
  clearTimeout(window.windowResizeTimeout);
  window.windowResizeTimeout = setTimeout(() => {
    resizeAllCharts();
  }, 150);
});
```

### 4. **CSS Improvements**

Updated chart container styles for better responsiveness:

```css
.chart-container {
  height: 100%;
  width: 100%;
  position: relative;
  min-height: 200px;
}

.chart-container canvas {
  width: 100% !important;
  height: 100% !important;
}
```

**Changes:**

- Added `width: 100%` to ensure horizontal filling
- Added `min-height: 200px` to prevent charts from collapsing too small
- Force canvas dimensions with `!important` to override Chart.js inline styles

## How It Works

### Resize Event Flow

```
User Action (Drag/Expand/Window Resize)
    ↓
Panel Size Changes
    ↓
ResizeObserver Detects Change
    ↓
Debounce Timer (100ms)
    ↓
resizeChartsInPanel() Called
    ↓
Finds All Canvas Elements in Panel
    ↓
Calls chart.resize() on Each Chart.js Instance
    ↓
Chart.js Recalculates Dimensions
    ↓
Chart Redraws at New Size
    ↓
Chart Fills Available Space ✅
```

### Multiple Trigger Points

The solution handles resize from multiple sources:

1. **Drag Handle**: Calls `resizeChartsInPanel()` during and after drag
2. **ResizeObserver**: Catches any other size changes (CSS, animations, etc.)
3. **Expand/Collapse**: Explicitly resizes after toggle
4. **Window Resize**: Global resize when browser window changes
5. **Grid Layout Reflow**: When one panel expands, others adjust automatically

## Chart.js Configuration

Both charts already had the correct configuration:

```javascript
options: {
    responsive: true,
    maintainAspectRatio: false,  // ← Allows filling container height
    // ... other options
}
```

**Key Settings:**

- `responsive: true`: Chart responds to container size changes
- `maintainAspectRatio: false`: Allows chart to stretch to fill height
- Without these, the fix would not work!

## Testing Scenarios

### ✅ Tested Behaviors

1. **Drag Resize Vertical**
   - Drag panel bottom edge down → Chart expands to fill
   - Drag panel bottom edge up → Chart shrinks smoothly
   - No blank space remains

2. **Expand/Collapse Button**
   - Click ⛶ to expand panel → Chart fills full width
   - Click ⛶ again to collapse → Chart returns to original size
   - Other charts adjust when grid reflows

3. **Window Resize**
   - Maximize browser window → All charts expand proportionally
   - Restore window size → All charts shrink proportionally
   - No layout breaks or blank spaces

4. **Grid Reflow**
   - Narrow window → Panels stack vertically, charts resize
   - Wide window → Panels side-by-side, charts resize
   - Responsive breakpoints trigger chart resizes

5. **Mixed Actions**
   - Expand one panel, resize another → Both charts adjust correctly
   - Resize window while panel is expanded → Chart stays filled
   - Restore saved panel sizes on reload → Charts render at correct size

## Performance Considerations

### Debouncing Strategy

**ResizeObserver Debounce: 100ms**

- Prevents excessive resize calls during continuous resize
- Balances responsiveness with performance
- Chart updates feel smooth, not laggy

**Window Resize Debounce: 150ms**

- Slightly longer delay for window resize (more expensive)
- Prevents resize storm when user drags window edge
- Single resize call after user stops dragging

**Drag Resize: Immediate**

- No debounce during drag for instant feedback
- Final resize on mouseup ensures accuracy
- Smooth visual experience during interaction

### Optimization Details

- **Selective Resizing**: Only resizes charts in the affected panel
- **Conditional Execution**: Checks if chart exists before calling resize
- **Timeout Cleanup**: Clears previous timeouts to prevent queue buildup
- **ResizeObserver**: More efficient than polling or MutationObserver

## Browser Compatibility

### ResizeObserver Support

| Browser | Version | Support |
| ------- | ------- | ------- |
| Chrome  | 64+     | ✅ Full |
| Edge    | 79+     | ✅ Full |
| Firefox | 69+     | ✅ Full |
| Safari  | 13.1+   | ✅ Full |
| Opera   | 51+     | ✅ Full |

**Fallback:** If `ResizeObserver` is not available (very old browsers), the manual resize triggers (drag, expand, window resize) still work.

**Polyfill Available:** Can add `resize-observer-polyfill` for IE11 support if needed.

## Troubleshooting

### Chart Still Not Resizing

**Possible Causes:**

1. **Chart Instance Not Created**
   - Solution: Wait for charts to load before resizing
   - Check: `console.log(threatChart)` - should not be `null`

2. **ResizeObserver Not Supported**
   - Solution: Add polyfill or use manual triggers only
   - Check: `console.log(window.ResizeObserver)` - should be a function

3. **CSS Conflicts**
   - Solution: Check for fixed width/height on containers
   - Use browser DevTools to inspect `.chart-container` computed styles

4. **JavaScript Errors**
   - Solution: Check browser console for errors
   - Ensure Chart.js library is loaded

### Blank Space Still Appears

**Possible Causes:**

1. **Canvas Has Inline Styles**
   - Solution: CSS `!important` rules should override
   - Check: Inspect canvas element for `style="width: 300px"` etc.

2. **Parent Container Has Padding**
   - Solution: Use `box-sizing: border-box` or adjust calculations
   - Check: `.panel-content` padding might reduce available space

3. **Chart.js Configuration Issue**
   - Solution: Verify `maintainAspectRatio: false` is set
   - Check: Chart options when initializing

### Performance Issues

**Symptoms:** Laggy resize, slow chart updates

**Solutions:**

1. **Increase Debounce Delay**

   ```javascript
   entry.target.resizeTimeout = setTimeout(() => {
     resizeChartsInPanel(entry.target);
   }, 200); // Increase from 100ms to 200ms
   ```

2. **Disable Animations During Resize**

   ```javascript
   chart.resize(0); // 0 = no animation
   ```

3. **Limit Chart Data Points**
   - Reduce number of data points in charts
   - Use data aggregation for large datasets

## Code Locations

**File:** `public/surveillance.html`

**Key Changes:**

- Lines 374-384: Chart container CSS improvements
- Lines 1493-1494: Resize during drag
- Lines 1501-1502: Resize after drag complete
- Lines 1506-1518: ResizeObserver integration
- Lines 1524-1530: Window resize handler
- Lines 1533-1550: Chart resize functions
- Lines 1556-1561: Resize on expand/collapse

## Future Enhancements

### Potential Improvements

1. **Adaptive Animation Speed**
   - Disable animations during rapid resize
   - Re-enable after resize completes
   - Smoother experience

2. **Aspect Ratio Presets**
   - Button to lock/unlock aspect ratio
   - Preset ratios: 16:9, 4:3, 1:1
   - Save preference to localStorage

3. **Multi-Chart Synchronization**
   - When one chart zooms, others zoom too
   - Synchronized axis ranges
   - Useful for comparison views

4. **Chart-Specific Resize Options**
   - Per-chart resize behavior settings
   - Some charts maintain aspect ratio, others don't
   - User preference storage

5. **Smart Resize Throttling**
   - Detect performance issues
   - Auto-adjust debounce timing
   - Optimize based on device capabilities

---

**Version:** 1.0
**Date:** 2025-12-04
**Status:** ✅ Implemented and Tested
**Browsers Tested:** Chrome 120+, Firefox 121+, Safari 17+
