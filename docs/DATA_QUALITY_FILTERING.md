# Data Quality Filtering - Admin Implementation

## Overview

Quality filtering is now handled **at the database level before materialized view refresh**, not at query time. This ensures:

- Accurate distance calculations (no artifacts inflating max_distance_meters)
- Accurate threat detection (no false positives from data quality issues)
- No performance penalty at query time
- Metrics reflect actual network behavior

## Architecture

### Quality Flag Columns

Added to `observations` table:

- `is_temporal_cluster` - Batch imports (>50 obs at same time/location)
- `is_duplicate_coord` - Coordinate artifacts (>1000 obs at same location)
- `is_extreme_signal` - Invalid signal levels (outside -120 to 0 dBm)
- `is_quality_filtered` - Combined flag (any quality issue)
- `quality_filter_applied_at` - Timestamp of last quality filter run

### Materialized View Integration

`app.api_network_explorer_mv` now excludes quality-filtered observations:

```sql
FROM observations o
WHERE UPPER(o.bssid) = UPPER(n.bssid)
  AND (is_quality_filtered = false OR is_quality_filtered IS NULL)
```

This means distances, threat scores, and all metrics are calculated on **clean data only**.

## Admin API

> **Note:** The endpoints in this section are defined in `dataQualityAdminService.ts` but are **not currently exposed via API routes**. This service is not wired into any Express router. The documented endpoints do not exist in the running application. This section is preserved for reference if the admin API is implemented in the future.

### GET /api/admin/data-quality/stats

Get current quality filter statistics:

```json
{
  "ok": true,
  "stats": {
    "totalObservations": 566400,
    "temporalClusters": 1250,
    "duplicateCoords": 340,
    "extremeSignals": 89,
    "totalFiltered": 1679,
    "lastApplied": "2026-02-26T12:00:00.000Z"
  }
}
```

### GET /api/admin/data-quality/config

Get quality filter configuration:

```json
{
  "ok": true,
  "config": {
    "enabled": true,
    "temporalThreshold": 50,
    "duplicateThreshold": 1000,
    "signalMin": -120,
    "signalMax": 0
  }
}
```

### PUT /api/admin/data-quality/config

Update quality filter thresholds:

```bash
curl -X PUT http://localhost:3001/api/admin/data-quality/config \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "temporalThreshold": 50,
    "duplicateThreshold": 1000,
    "signalMin": -120,
    "signalMax": 0
  }'
```

### POST /api/admin/data-quality/apply

Apply quality filters to observations (marks rows with quality flags):

```bash
curl -X POST http://localhost:3001/api/admin/data-quality/apply
```

Returns updated statistics after application.

**Note**: After applying quality filters, you must refresh the materialized view:

```sql
REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;
```

### POST /api/admin/data-quality/clear

Clear all quality flags (reset to unfiltered state):

```bash
curl -X POST http://localhost:3001/api/admin/data-quality/clear
```

## Workflow

### Initial Setup

1. Run migrations via `./sql/run-migrations.sh` (quality columns are included in `20260216_consolidated_002_core_tables.sql`)
2. Configure thresholds via API or database
3. Apply quality filters: `POST /api/admin/data-quality/apply`
4. Refresh materialized view
5. Verify stats: `GET /api/admin/data-quality/stats`

### Regular Maintenance

After each data import:

1. Apply quality filters (marks new observations)
2. Refresh materialized view (excludes filtered observations)
3. Check stats to monitor data quality trends

### Adjusting Thresholds

If you see too many/few observations filtered:

1. Update config: `PUT /api/admin/data-quality/config`
2. Clear existing flags: `POST /api/admin/data-quality/clear`
3. Re-apply with new thresholds: `POST /api/admin/data-quality/apply`
4. Refresh materialized view

## Performance

### Before (Query-Time Filtering)

- `qualityFilter='all'`: 60s timeout
- Full table scans with `NOT IN` subqueries
- Every query pays the cost

### After (Database-Level Filtering)

- Quality filter application: ~5-10s (one-time, admin-triggered)
- Query time: No change (~100ms)
- Materialized view refresh: Slightly faster (fewer observations)

## Migration Path

### Removing Old Quality Filter

The query-time `qualityFilter` has been removed from:

- `NETWORK_ONLY_FILTERS` constant
- `universalFilterQueryBuilder.ts` logic
- Frontend filter UI (recommended)

> **Clarification:** As of the current codebase, `qualityFilter` is commented out of the `NETWORK_ONLY_FILTERS` Set in `server/src/services/filterQueryBuilder/constants.ts` (line 109) but the key itself remains in `FILTER_KEYS`, the frontend filter store (`filterStore.ts`), `client/src/types/filters.ts`, and the `QualityFilters.tsx` UI component. The filter is no longer applied at query time via the universal filter builder, but it has not been fully removed from the frontend or type definitions.

### Database Changes

```sql
-- Add columns
ALTER TABLE observations ADD COLUMN is_quality_filtered BOOLEAN DEFAULT FALSE;

-- Add indexes
CREATE INDEX idx_obs_quality_filtered ON observations(is_quality_filtered)
WHERE is_quality_filtered = true;

-- Update materialized view
DROP MATERIALIZED VIEW app.api_network_explorer_mv CASCADE;
CREATE MATERIALIZED VIEW app.api_network_explorer_mv AS ...
  WHERE (is_quality_filtered = false OR is_quality_filtered IS NULL)
```

## Monitoring

### Check Quality Trends

```sql
SELECT
  DATE(quality_filter_applied_at) as date,
  COUNT(*) FILTER (WHERE is_temporal_cluster) as temporal,
  COUNT(*) FILTER (WHERE is_duplicate_coord) as duplicate,
  COUNT(*) FILTER (WHERE is_extreme_signal) as extreme
FROM observations
WHERE is_quality_filtered = true
GROUP BY DATE(quality_filter_applied_at)
ORDER BY date DESC;
```

### Verify Materialized View

```sql
-- Count observations per network (should exclude filtered)
SELECT bssid, COUNT(*)
FROM observations
WHERE (is_quality_filtered = false OR is_quality_filtered IS NULL)
GROUP BY bssid
LIMIT 10;
```

## Files

- `server/src/services/admin/dataQualityAdminService.ts` - Service implementation
- `server/src/api/routes/v1/dataQuality.ts` - API routes
- `sql/migrations/20260216_consolidated_002_core_tables.sql` - Quality filter columns/indexes
- `sql/migrations/20260216_consolidated_008_views_and_materialized_views.sql` - MV quality filtering
- `server/src/config/container.ts` - DI registration

## Benefits

1. **Accurate Metrics**: Distances and threats calculated on clean data
2. **No False Positives**: Artifacts don't trigger threat detection
3. **Performance**: No query-time overhead
4. **Flexibility**: Admin can adjust thresholds and re-apply
5. **Transparency**: Stats show exactly what's filtered and why
