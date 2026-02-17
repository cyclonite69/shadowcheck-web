# Filter Panel Bug Fix Plan

## Issues Identified

### 1. Duplicate Security Section (CRITICAL)

**Location:** `client/src/components/FilterPanel.tsx` lines 103-125

**Problem:** SecurityFilters component is rendered TWICE:

- First render: lines 103-113
- Second render: lines 114-125 (with comment `{/* Security */}`)

**Root Cause:** Copy-paste error during refactoring

**Impact:** Users see two identical "Security" dropdowns with duplicate filters

---

### 2. Missing Data Quality Filters

**Location:** `client/src/components/filters/sections/QualityFilters.tsx`

**Current Filters (4 total):**

- ✅ Min Observations
- ✅ Max Observations
- ✅ Min Unique Days
- ✅ Max Unique Days

**Missing Filters (3 total):**

- ❌ GPS Accuracy Max (meters)
- ❌ Exclude Invalid Coordinates (boolean toggle)
- ❌ Quality Filter Preset (dropdown: none/temporal/extreme/duplicate/all)

**Evidence:**

- Backend supports these filters: `server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts` lines 122-138
- Type definitions exist: `client/src/types/filters.ts` lines 38-40
- Filter constants defined: `server/src/services/filterQueryBuilder/constants.ts` lines 28-30

---

## Fix Plan

### Fix 1: Remove Duplicate Security Section

**File:** `client/src/components/FilterPanel.tsx`

**Action:** Delete lines 114-125 (second SecurityFilters render)

**Before:**

```tsx
<SecurityFilters
  filters={filters}
  enabled={enabled}
  isCompact={isCompact}
  listLayoutClass={listLayoutClass}
  listItemTextClass={listItemTextClass}
  onSetFilter={setFilter}
  onToggleFilter={toggleFilter}
  onEnableFilter={enableFilter}
/>;
{
  /* Security */
}
<SecurityFilters
  filters={filters}
  enabled={enabled}
  isCompact={isCompact}
  listLayoutClass={listLayoutClass}
  listItemTextClass={listItemTextClass}
  onSetFilter={setFilter}
  onToggleFilter={toggleFilter}
  onEnableFilter={enableFilter}
/>;
```

**After:**

```tsx
<SecurityFilters
  filters={filters}
  enabled={enabled}
  isCompact={isCompact}
  listLayoutClass={listLayoutClass}
  listItemTextClass={listItemTextClass}
  onSetFilter={setFilter}
  onToggleFilter={toggleFilter}
  onEnableFilter={enableFilter}
/>
```

---

### Fix 2: Add Missing Data Quality Filters

**File:** `client/src/components/filters/sections/QualityFilters.tsx`

**Action:** Add 3 new FilterInput components after existing 4 filters

**New Filter 1: GPS Accuracy Max**

```tsx
<FilterInput
  label="GPS Accuracy Max (m)"
  enabled={enabled.gpsAccuracyMax || false}
  onToggle={() => onToggleFilter('gpsAccuracyMax')}
  compact={isCompact}
>
  <input
    type="number"
    value={filters.gpsAccuracyMax ?? ''}
    onChange={(e) => onSetFilter('gpsAccuracyMax', parseInt(e.target.value, 10))}
    placeholder="100"
    min="1"
    max="10000"
    className={controlClass}
  />
</FilterInput>
```

**New Filter 2: Exclude Invalid Coordinates**

```tsx
<FilterInput
  label="Exclude Invalid Coords"
  enabled={enabled.excludeInvalidCoords || false}
  onToggle={() => onToggleFilter('excludeInvalidCoords')}
  compact={isCompact}
>
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={filters.excludeInvalidCoords || false}
      onChange={(e) => onSetFilter('excludeInvalidCoords', e.target.checked)}
      className="w-4 h-4"
    />
    <span className="text-xs text-slate-400">Filter out (0,0) and invalid GPS</span>
  </div>
</FilterInput>
```

**New Filter 3: Quality Filter Preset**

```tsx
<FilterInput
  label="Quality Preset"
  enabled={enabled.qualityFilter || false}
  onToggle={() => onToggleFilter('qualityFilter')}
  compact={isCompact}
>
  <select
    value={filters.qualityFilter || 'none'}
    onChange={(e) => onSetFilter('qualityFilter', e.target.value)}
    className={controlClass}
  >
    <option value="none">None</option>
    <option value="temporal">Temporal (single-day)</option>
    <option value="extreme">Extreme (outliers)</option>
    <option value="duplicate">Duplicates</option>
    <option value="all">All Quality Checks</option>
  </select>
</FilterInput>
```

---

## Testing Checklist

After applying fixes:

1. ✅ Verify only ONE "Security" section appears in filter panel
2. ✅ Verify Security section contains 4 filters:
   - Encryption Types
   - Auth Methods
   - Insecure Flags
   - Security Inference Flags
3. ✅ Verify "Data Quality" section contains 7 filters:
   - Min Observations
   - Max Observations
   - Min Unique Days
   - Max Unique Days
   - GPS Accuracy Max (m)
   - Exclude Invalid Coords
   - Quality Preset
4. ✅ Test each new filter:
   - GPS Accuracy Max: Enter value, verify API call includes `gpsAccuracyMax` param
   - Exclude Invalid Coords: Toggle checkbox, verify API call includes `excludeInvalidCoords` param
   - Quality Preset: Select option, verify API call includes `qualityFilter` param
5. ✅ Verify filter enable/disable toggles work for all 3 new filters
6. ✅ Verify filter state persists in filterStore
7. ✅ Test preset save/load includes new filters

---

## Files to Modify

1. `client/src/components/FilterPanel.tsx` (remove duplicate)
2. `client/src/components/filters/sections/QualityFilters.tsx` (add 3 filters)

---

## Estimated Impact

- **Lines Changed:** ~60 lines
- **Risk Level:** LOW (isolated component changes)
- **Breaking Changes:** NONE
- **Backend Changes Required:** NONE (backend already supports these filters)
