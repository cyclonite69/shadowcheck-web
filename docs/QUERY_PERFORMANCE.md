# Query Performance Tracking

## Overview

Enhanced diagnostics for filter query execution to identify slow queries and filter application issues.

## Features

### 1. Execution Time Tracking

- **Build time**: Time to construct SQL query
- **Query time**: Database execution time
- **Total time**: End-to-end request time

### 2. Filter Application Metrics

- Which filters were applied
- Which filters were ignored (and why)
- Warnings generated during query building

### 3. Query Path Tracking

- **Fast path**: Network-only filters using materialized view
- **Slow path**: Observation CTE with complex joins
- **Unfiltered**: No filters enabled

### 4. Automatic Slow Query Logging

- Logs queries taking >1s total time
- Logs queries with >500ms database time
- Includes filter count and warnings

## Usage

### Enable Performance Tracking

Set environment variable:

```bash
export TRACK_QUERY_PERFORMANCE=true
```

### Enable Debug Logging

```bash
export DEBUG_QUERY_PERFORMANCE=true
```

### API Response

When `TRACK_QUERY_PERFORMANCE=true`, the API response includes:

```json
{
  "ok": true,
  "data": [...],
  "performance": {
    "totalTimeMs": 245,
    "buildTimeMs": 12,
    "queryTimeMs": 230
  }
}
```

### Log Output

Slow queries automatically log:

```json
{
  "level": "warn",
  "message": "[v2/filtered] Slow query detected",
  "totalTime": 1250,
  "buildTime": 15,
  "queryTime": 1230,
  "resultCount": 500,
  "filterCount": 3,
  "enabledCount": 3,
  "warnings": 0
}
```

## Diagnostics Workflow

1. **Enable tracking**: `TRACK_QUERY_PERFORMANCE=true`
2. **Reproduce slow query** in the UI
3. **Check logs** for slow query warnings
4. **Identify bottleneck**:
   - High `buildTime` → Query builder complexity
   - High `queryTime` → Database/index issue
   - Warnings → Filter misconfiguration

## Performance Thresholds

- **Slow query**: >1000ms total
- **Slow database**: >500ms query execution
- **Target**: <200ms for typical filtered queries

## Files

- `server/src/utils/queryPerformanceTracker.ts` - Performance tracking utility
- `server/src/api/routes/v2/filtered.ts` - Execution time tracking
- `server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts` - Filter metrics
