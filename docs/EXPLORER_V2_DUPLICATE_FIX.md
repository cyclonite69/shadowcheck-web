# ShadowCheck Explorer v2 Duplicate Fix & Sorting Enhancement

## Problem Summary

**Duplicate BSSIDs in Explorer**: The `public.api_network_explorer` view was returning duplicate rows for the same BSSID, causing incorrect counts and confusing the UI.

**Root Cause**: Cartesian product from the manufacturer join:

```sql
LEFT JOIN app.radio_manufacturers rm
  ON UPPER(REPLACE(SUBSTRING(ap.bssid, 1, 8), ':', '')) = rm.prefix_24bit
```

The `app.radio_manufacturers` table contains **multiple rows per `prefix_24bit`** (different registry types, assignments, etc.), causing each BSSID to appear multiple times in the result set.

**Client-Side Sorting Limitation**: Sorting was happening on loaded pages only, not the entire database, making it impossible to get true "top threats" or properly sorted results.

## Solution Implemented

### 1. Database View Fix (`20251220_fix_duplicate_bssids_in_explorer.sql`)

**Deduplication Strategy**: Added a CTE to deduplicate manufacturers before joining:

```sql
unique_manufacturers AS (
  SELECT DISTINCT ON (prefix_24bit)
    prefix_24bit,
    organization_name AS manufacturer,
    organization_address AS manufacturer_address
  FROM app.radio_manufacturers
  WHERE prefix_24bit IS NOT NULL
  ORDER BY prefix_24bit, organization_name
)
```

**Key Changes**:

- Uses `DISTINCT ON (prefix_24bit)` to ensure exactly one manufacturer per prefix
- Orders by `organization_name` for deterministic selection
- Joins with this deduplicated CTE instead of the raw table

**Invariant Restored**: `COUNT(*) = COUNT(DISTINCT bssid)` now holds true.

### 2. API Enhancement (`src/api/routes/v1/explorer.js`)

**Multi-Column Sorting**: Enhanced `/api/explorer/networks-v2` to support:

- Comma-separated sort columns: `?sort=threat,signal,observations`
- Comma-separated sort orders: `&order=desc,desc,asc`
- Proper mapping of frontend column names to database columns
- Threat score sorting: `threat` maps to `(threat->>'score')::numeric`

**Page-Based Pagination**: Switched from offset-based to page-based for better UX:

- `?page=1&limit=500` instead of `?offset=0&limit=500`
- Returns `hasMore` flag for infinite scroll

### 3. Frontend Fix (`src/components/GeospatialExplorer.tsx`)

**Server-Side Sorting Only**:

- Removed all client-side sorting logic
- Always requests sorted data from API
- Resets pagination AND clears loaded rows on sort change
- Added `sort` to fetch dependencies to trigger re-fetch on sort change

**Multi-Column Sort UI**:

- Shift+click to add columns to sort
- Visual indicators show sort order and priority
- Proper column mapping (e.g., `lastSeen` → `last_seen`)

## How Sorting Now Works

1. **User clicks column header** → Frontend updates `sort` state
2. **Sort state change** → Triggers `useEffect` that clears data and resets pagination
3. **API request** → Sends `?sort=col1,col2&order=desc,asc` to server
4. **Database query** → `ORDER BY col1 DESC, col2 ASC` applied to entire dataset
5. **Paginated results** → Returns first 500 rows from sorted dataset
6. **Infinite scroll** → Loads next 500 rows maintaining sort order

## Verification

**No Duplicates**:

```sql
SELECT COUNT(*) = COUNT(DISTINCT bssid) AS no_duplicates
FROM public.api_network_explorer;
-- Should return: true
```

**Threat Sorting**:

```sql
SELECT bssid, ssid, threat->>'level', threat->>'score'
FROM public.api_network_explorer
ORDER BY (threat->>'score')::numeric DESC NULLS LAST
LIMIT 10;
-- Should return highest threat scores first
```

## Backward Compatibility

- `/api/explorer/networks` (v1) unchanged
- All existing field mappings preserved
- Threat intelligence additive (no breaking changes)
- Legacy HTML pages unaffected

## Performance Impact

- **Positive**: Deduplication eliminates unnecessary rows
- **Neutral**: CTE adds minimal overhead vs. Cartesian product elimination
- **Positive**: Page-based pagination more efficient than large offsets
- **Positive**: Database-level sorting eliminates client-side processing

The fix ensures data integrity while maintaining full backward compatibility and improving performance.
