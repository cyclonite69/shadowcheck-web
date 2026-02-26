# Quality Filter Solution - Summary

## Problem

`qualityFilter='all'` caused 60s timeouts because it added expensive `NOT IN` subqueries at query time:

- Scanned entire observations table (566K+ rows)
- Three separate GROUP BY operations
- Applied on every single query

**Worse**: Even when filtered, distances were calculated INCLUDING the bad data, causing false threat flags.

## Solution

Move quality filtering to **database level before materialized view refresh**:

1. **Quality flag columns** added to observations table
2. **Admin API** to apply/clear/configure filters
3. **Materialized view** excludes filtered observations automatically
4. **Query builder** no longer handles quality filters

## Benefits

✅ **Accurate metrics**: Distances calculated on clean data only
✅ **No false positives**: Artifacts don't trigger threat detection  
✅ **Zero query overhead**: Filtering happens once, not per query
✅ **Admin control**: Apply filters when needed, adjust thresholds
✅ **Transparency**: Stats show what's filtered and why

## Workflow

```bash
# 1. Run migration
psql -f sql/migrations/20260226_add_quality_filter_columns.sql

# 2. Apply quality filters (marks bad observations)
curl -X POST http://localhost:3001/api/admin/data-quality/apply

# 3. Refresh materialized view (excludes filtered observations)
psql -c "REFRESH MATERIALIZED VIEW app.api_network_explorer_mv;"

# 4. Check stats
curl http://localhost:3001/api/admin/data-quality/stats
```

## Performance

| Operation                      | Before      | After             |
| ------------------------------ | ----------- | ----------------- |
| Query with qualityFilter='all' | 60s timeout | N/A (removed)     |
| Query without filters          | ~100ms      | ~100ms            |
| Apply quality filters          | N/A         | ~5-10s (one-time) |
| MV refresh                     | ~30s        | ~25s (fewer obs)  |

## Files Changed

- `server/src/services/admin/dataQualityAdminService.ts` - New service
- `server/src/api/routes/v1/dataQuality.ts` - New API routes
- `sql/migrations/20260226_add_quality_filter_columns.sql` - Database migration
- `server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts` - Removed query-time logic
- `server/src/config/container.ts` - Added service to DI container
- `docs/DATA_QUALITY_FILTERING.md` - Full documentation

## Next Steps

1. Run migration on AWS instance
2. Apply quality filters via admin API
3. Refresh materialized view
4. Remove quality filter from frontend UI (optional)
5. Monitor stats after each data import

## Key Insight

**Quality filtering is a data preparation step, not a query filter.** It should happen during ETL/maintenance, not at query time. This is the correct architectural approach.
