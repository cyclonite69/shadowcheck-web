# Systematic Implementation Plan

## Core Principles
1. **One feature at a time** - Complete before moving to next
2. **Test after each step** - Verify nothing breaks
3. **Commit after each feature** - Can rollback if needed
4. **Modular components** - Single source of truth
5. **Progressive enhancement** - Don't break existing functionality

## Phase 1: Foundation (DO FIRST)
### 1.1 Create Base Component System
**File**: `/public/assets/js/base-components.js`
- UnifiedHeader component (single source)
- UnifiedFilter component (reusable)
- UnifiedTable component (networks + threats)
- UnifiedCard wrapper (resize/move/snap)

**Commit**: "feat: Add base component system"

### 1.2 Create Unified Header Template
**File**: `/public/components/header.html` or inline in JS
- Logo + Title (left)
- Navigation (center)
- Tools (right): Add Card, Snap, Reset, Filters

**Commit**: "feat: Add unified header template"

### 1.3 Test Foundation
- Load on one page (index.html)
- Verify header renders
- Verify tools work
- **Commit**: "test: Verify foundation on index.html"

## Phase 2: Unified Table Component
### 2.1 Create UnifiedTable Class
**Features**:
- Column configuration
- Search/filter
- Sort
- Pagination
- Selection (checkboxes)
- Double-click handler
- Jump to map

**File**: `/public/assets/js/unified-table.js`

**Commit**: "feat: Add UnifiedTable component"

### 2.2 Implement for Networks
- Replace networks page table
- Test all features work
- **Commit**: "feat: Networks page uses UnifiedTable"

### 2.3 Implement for Threats
- Replace surveillance page table
- Test all features work
- **Commit**: "feat: Threats page uses UnifiedTable"

## Phase 3: Unified Filters
### 3.1 Create UnifiedFilter Class
**Features**:
- Global search
- Type filter
- Security filter
- Custom filters per card
- Subscribe/notify pattern

**File**: `/public/assets/js/unified-filters.js`

**Commit**: "feat: Add UnifiedFilter system"

### 3.2 Connect to Tables
- Networks table subscribes
- Threats table subscribes
- Test filtering works
- **Commit**: "feat: Connect filters to tables"

## Phase 4: Map Integration
### 4.1 Jump to Map - Single
- Double-click network → map
- Pass BSSID + coords via URL
- Map highlights network
- **Commit**: "feat: Single network jump to map"

### 4.2 Jump to Map - Multiple
- Select multiple networks
- Button in header or table
- Map fits bounds to all
- **Commit**: "feat: Multiple networks jump to map"

### 4.3 Jump to Map - Threats
- Same as networks
- Works from surveillance page
- **Commit**: "feat: Threats jump to map"

## Phase 5: Card System
### 5.1 Card Library
- Network card (uses UnifiedTable)
- Threat card (uses UnifiedTable)
- Map card
- **Commit**: "feat: Add card library"

### 5.2 Add Card Button
- Opens modal
- Shows available cards
- Adds to current page
- **Commit**: "feat: Add card button in header"

### 5.3 Card Persistence
- Save which cards on which pages
- Restore on load
- **Commit**: "feat: Card persistence"

## Phase 6: Polish
### 6.1 Column Selector
- Modal to choose columns
- Per-table configuration
- Save preferences
- **Commit**: "feat: Column selector"

### 6.2 Scrollable Cards
- All card bodies scroll
- Headers stay fixed
- **Commit**: "feat: Scrollable card bodies"

### 6.3 Snap to Grid
- Already implemented
- Test on all cards
- **Commit**: "test: Verify snap on all cards"

## Implementation Order (DO IN THIS EXACT ORDER)

### Step 1: Create base-components.js ✅ NEXT
```javascript
// Single file with all base components
class UnifiedHeader { }
class UnifiedFilter { }
class UnifiedTable { }
class UnifiedCard { }
```

### Step 2: Test on index.html
- Load base-components.js
- Render header
- Verify it works
- **COMMIT**

### Step 3: Roll out to other pages ONE AT A TIME
- networks.html
- Test, commit
- geospatial.html
- Test, commit
- surveillance.html
- Test, commit
- analytics.html
- Test, commit

### Step 4: Add UnifiedTable
- Create component
- Test on networks page
- **COMMIT**
- Roll out to surveillance
- **COMMIT**

### Step 5: Add filters
- Create UnifiedFilter
- Connect to tables
- **COMMIT**

### Step 6: Map integration
- Single jump
- **COMMIT**
- Multiple jump
- **COMMIT**

## File Structure (Clean)

```
/public/assets/js/
  base-components.js          # Core: Header, Filter, Table, Card
  unified-table.js            # Table component (if separate)
  unified-filters.js          # Filter system (if separate)
  card-library.js             # Available cards
  
/public/assets/styles/
  unified.css                 # Single CSS file for everything
  
/public/
  index.html                  # Uses base-components
  networks.html               # Uses base-components + UnifiedTable
  geospatial.html             # Uses base-components + Map
  surveillance.html           # Uses base-components + UnifiedTable
  analytics.html              # Uses base-components + Charts
  admin.html                  # Uses base-components
```

## Testing Checklist (After Each Step)

- [ ] Page loads without errors
- [ ] Header renders correctly
- [ ] Navigation works
- [ ] Tools in header work
- [ ] Cards are resizable
- [ ] Cards are movable
- [ ] Snap to grid works
- [ ] Data populates
- [ ] Filters work
- [ ] Search works
- [ ] Selection works
- [ ] Jump to map works

## Git Workflow

```bash
# After each feature
git add -A
git commit -m "feat: [description]"

# If something breaks
git log --oneline  # Find last good commit
git reset --hard <commit-hash>

# Create checkpoint branches
git branch checkpoint-phase1
git branch checkpoint-phase2
```

## Current Issues to Fix

1. **Networks page not populating** - API call issue
2. **Header not uniform** - Inline styles conflict
3. **No unified filters** - Each page has own
4. **No unified table** - Each page has own
5. **Cards not all resizable** - Script loading issue

## Next Immediate Actions

1. Fix networks page API call
2. Create base-components.js with UnifiedHeader
3. Test on index.html
4. Roll out to one page at a time
5. Commit after each success

## Success Criteria

✅ All pages load and populate data
✅ All pages have identical header
✅ All cards resizable/movable
✅ All tables have same search/filter
✅ Jump to map works from any page
✅ Column selector works
✅ No breaking changes between commits
