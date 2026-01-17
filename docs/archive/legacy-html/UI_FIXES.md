# ShadowCheck UI Fixes

## Issues Identified

### 1. Network Explorer - Pagination Display (300 of 117,687)

**Status**: ✅ Working as designed

- Infinite scroll is implemented and functional
- Shows 300 networks initially, loads more on scroll
- Filter and search work correctly
- **Recommendation**: Add visual indicator showing "Scroll for more" or current page

### 2. Threat Surveillance - Limited Threat Display (5 of 61)

**Status**: ⚠️ Needs Investigation

- Pagination limit set to 50 per page
- Infinite scroll implemented
- Only 5 threats visible despite 61 total
- **Root Cause**: Likely API limiting results or CSS height constraint

### 3. Analytics Dashboard

**Status**: ℹ️ Incomplete description in user message

## Fixes Applied

### Fix 1: Increase Threat List Visibility

**File**: `public/surveillance.html`
**Line**: 571

Change pagination limit from 50 to 100 for better initial display:

```javascript
const pagination = {
  activeThreats: { page: 1, limit: 100, hasMore: true, loading: false, totalCount: 0 },
  confirmedThreats: { page: 1, limit: 100, hasMore: true, loading: false, totalCount: 0 },
  taggedSafe: { page: 1, limit: 100, hasMore: true, loading: false, totalCount: 0 },
};
```

### Fix 2: Add Scroll Indicator to Network Explorer

**File**: `public/networks.html`

Add visual feedback showing more networks are available:

```html
<div
  id="scroll-indicator"
  style="text-align: center; padding: 12px; color: #94a3b8; font-size: 12px;"
>
  ↓ Scroll down to load more networks ↓
</div>
```

### Fix 3: Improve Threat List Container Height

**File**: `public/surveillance.html`

Ensure threat list containers have adequate height:

```css
.panel-content {
  max-height: 600px; /* Increased from potential constraint */
  overflow-y: auto;
}
```

## Testing Checklist

- [ ] Network Explorer loads 300+ networks
- [ ] Infinite scroll triggers on Network Explorer
- [ ] Threat Surveillance shows all 61 threats (or loads them on scroll)
- [ ] Threat severity filter works correctly
- [ ] Search functionality works on Network Explorer
- [ ] Analytics charts render completely

## API Endpoints to Verify

1. `GET /api/threats/quick?page=1&limit=50` - Check if returning all threats
2. `GET /api/networks?page=1&limit=100` - Verify network pagination
3. Check server.js for any hardcoded limits

## Next Steps

1. Check browser console for JavaScript errors
2. Verify API responses match expected pagination
3. Test infinite scroll trigger points
4. Confirm CSS isn't hiding content
