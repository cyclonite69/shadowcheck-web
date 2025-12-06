# Implementation Plan: Unified Header + Full Functionality

## Current State
- ✅ base-components.js exists with UnifiedHeader class
- ❌ networks.html has custom header (not using UnifiedHeader)
- ❌ analytics.html has custom header (not using UnifiedHeader)
- ❌ Networks page functionality incomplete
- ❌ Analytics page functionality incomplete

## Required Changes

### 1. Networks Explorer (networks.html)
**Replace custom header with:**
```html
<div id="app-container"></div>
<script>
  const header = new UnifiedHeader('networks');
  header.inject(document.getElementById('app-container'));
</script>
```

**Ensure functionality:**
- ✅ Network table rendering (already works)
- ✅ Search/filter (already works)
- ✅ Infinite scroll (already works)
- ✅ Multi-select checkboxes (already works)
- ✅ "Show on Map" button (already works)
- ❌ Column visibility toggle (needs implementation)
- ❌ Sortable columns (needs implementation)
- ❌ Export functionality (needs implementation)

### 2. Analytics Dashboard (analytics.html)
**Replace custom header with:**
```html
<div id="app-container"></div>
<script>
  const header = new UnifiedHeader('analytics');
  header.inject(document.getElementById('app-container'));
</script>
```

**Ensure functionality:**
- ❌ Chart rendering (needs API integration)
- ❌ Time range selector (needs implementation)
- ❌ Network type distribution chart
- ❌ Signal strength histogram
- ❌ Temporal activity chart
- ❌ Security type breakdown
- ❌ Trends over time

### 3. All Other Pages
**Verify unified header on:**
- [ ] index.html (dashboard)
- [ ] geospatial.html
- [ ] surveillance.html
- [ ] admin.html
- [ ] ml-train.html

## Implementation Order

1. **Phase 1: Replace Headers** (15 min)
   - Update networks.html header
   - Update analytics.html header
   - Test navigation works

2. **Phase 2: Networks Functionality** (30 min)
   - Add column visibility toggle
   - Add sortable columns
   - Add export buttons (CSV, JSON)

3. **Phase 3: Analytics Functionality** (45 min)
   - Implement Chart.js integration
   - Add time range selector
   - Connect to API endpoints:
     - /api/analytics/network-types
     - /api/analytics/signal-strength
     - /api/analytics/temporal-activity
     - /api/analytics/security
     - /api/analytics/radio-type-over-time

4. **Phase 4: Testing** (15 min)
   - Test all navigation links
   - Test all functionality on each page
   - Verify responsive behavior

## Minimal Code Changes

### networks.html
```html
<!-- REMOVE lines 26-100 (custom header) -->
<!-- ADD after <body> -->
<div id="app-container"></div>
<div class="container">
  <!-- existing main content -->
</div>

<!-- ADD before closing </body> -->
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const header = new UnifiedHeader('networks');
    header.inject(document.getElementById('app-container'));
  });
</script>
```

### analytics.html
```html
<!-- REMOVE lines 26-100 (custom header) -->
<!-- ADD after <body> -->
<div id="app-container"></div>
<div class="container">
  <!-- existing main content -->
</div>

<!-- ADD before closing </body> -->
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const header = new UnifiedHeader('analytics');
    header.inject(document.getElementById('app-container'));
  });
</script>
```

## Success Criteria
- [ ] All pages have identical header
- [ ] All navigation links work
- [ ] Networks table fully functional
- [ ] Analytics charts render
- [ ] No console errors
- [ ] Responsive on mobile
