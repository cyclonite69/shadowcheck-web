# ShadowCheck Full-Screen Refactor Plan

## Current Status
**ALL 9 pages need refactoring** to use the unified full-screen layout system.

## Issues Found
- ❌ No pages use `unified.css`
- ⚠️ All pages have inline `<style>` tags
- ❌ No pages use `app-container` structure
- ⚠️ 7 pages use old CSS files (theme.css, components.css, layout.css)

## Pages to Refactor
1. ✅ **index.html** - Dashboard (metrics + panels)
2. ✅ **networks.html** - Full-screen table with filters
3. ✅ **geospatial.html** - Map + sidebars
4. ✅ **surveillance.html** - Surveillance detection
5. ✅ **analytics.html** - Analytics dashboard
6. ✅ **admin.html** - Admin panel
7. ⚠️ **ml-train.html** - ML training (low priority)
8. ⚠️ **test-*.html** - Test pages (can be deleted)

## Refactoring Steps Per Page

### 1. Replace CSS imports
```html
<!-- OLD -->
<link rel="stylesheet" href="/assets/styles/theme.css">
<link rel="stylesheet" href="/assets/styles/components.css">
<link rel="stylesheet" href="/assets/styles/layout.css">

<!-- NEW -->
<link rel="stylesheet" href="/assets/styles/unified.css">
```

### 2. Remove inline `<style>` tags
Move any custom styles to unified.css or use utility classes

### 3. Wrap in app-container
```html
<body>
    <div class="app-container">
        <header class="app-header">...</header>
        <main class="app-main">...</main>
    </div>
</body>
```

### 4. Standardize header navigation
All pages use same header with active state on current page

### 5. Ensure full-screen usage
- Main content uses `flex: 1`
- Panels use `flex: 1` for full height
- No scrolling on body, only in `.panel-body`

## Priority Order
1. **index.html** - Most visible
2. **networks.html** - Most used
3. **geospatial.html** - Complex layout
4. **surveillance.html** - Core feature
5. **analytics.html** - Dashboard
6. **admin.html** - Settings

## Testing Checklist
- [ ] No horizontal scrollbar
- [ ] No vertical scrollbar on body
- [ ] Header fixed at 56px
- [ ] Content fills 100% of remaining space
- [ ] Tables scroll within panels
- [ ] Maps fill panel completely
- [ ] Responsive on different screen sizes
- [ ] Navigation highlights active page

## Files Created
- ✅ `/assets/styles/unified.css` - Unified CSS system
- ✅ `LAYOUT_STANDARD.md` - Layout documentation
- ✅ `audit-pages.sh` - Compliance checker
- ✅ `REFACTOR_PLAN.md` - This file

## Next Steps
Run: `./audit-pages.sh` after each page refactor to track progress
