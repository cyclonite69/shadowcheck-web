# Recent Fixes Quick Reference

Quick reference guide for the major fixes applied to ShadowCheck in January 2026.

## 🔧 Fixed Issues Summary

| Issue                             | Status   | Impact | Solution                                 |
| --------------------------------- | -------- | ------ | ---------------------------------------- |
| GeoSpatial table bogus defaults   | ✅ Fixed | High   | Use latest observation data              |
| Analytics widgets "No data"       | ✅ Fixed | High   | Add missing API calls + fix data sources |
| Max distance ~238m incorrect      | ✅ Fixed | Medium | Use PostGIS ST_Distance                  |
| Encryption filters not applying   | ✅ Fixed | Medium | Explicitly enable filter on toggle       |
| Threat score columns not sortable | ✅ Fixed | Medium | Add to API_SORT_MAP                      |
| WiGLE observations not rendering  | ✅ Fixed | Medium | Fix schema namespace (public→app)        |
| Manufacturer fields empty         | ✅ Fixed | Low    | Add radio_manufacturers JOIN             |

## 🚀 Quick Verification Commands

### Test Networks API

```bash
curl -s "http://localhost:3001/api/networks?limit=3&location_mode=latest_observation" | jq '.networks[] | {bssid, signal, frequency, channel, manufacturer}'
```

### Test Analytics Endpoints

```bash
curl -s "http://localhost:3001/api/analytics/temporal-activity" | jq '.data | length'
curl -s "http://localhost:3001/api/analytics/radio-type-over-time" | jq '.data | length'
curl -s "http://localhost:3001/api/analytics/threat-trends" | jq '.data | length'
```

### Test Distance Calculations

```bash
curl -s "http://localhost:3001/api/networks?limit=3" | jq '.networks[] | {bssid, max_distance_meters}'
```

### Test Sorting

```bash
curl -s "http://localhost:3001/api/networks?sort=rule_score&order=DESC&limit=3" | jq '.networks[] | {bssid, rule_score}'
```

### Test Encryption Filters

```bash
curl -s "http://localhost:3001/api/v2/networks/filtered?filters=%7B%22encryptionTypes%22%3A%5B%22WPA3%22%5D%7D&enabled=%7B%22encryptionTypes%22%3Atrue%7D&limit=5"
```

### Test WiGLE Observations

```bash
curl -s "http://localhost:3001/api/networks/wigle-observations/batch" -X POST -H "Content-Type: application/json" -d '{"bssids":["18:0C:7A:EA:20:57"]}'
```

## 📁 Key Files Modified

### Backend Changes

- `/server/src/api/routes/v1/networks.js` - Networks API data source fix
- `/server/src/services/analyticsService.js` - Analytics endpoints fixes
- `/server/src/services/filterQueryBuilder/universalFilterQueryBuilder.js` - Query fixes

### Frontend Changes

- `/client/src/components/analytics/utils/dataTransformers.ts` - Field name fixes
- `/client/src/components/analytics/hooks/useAnalyticsData.ts` - Missing API calls
- `/client/src/components/geospatial/NetworkTableRow.tsx` - Invalid value handling
- `/client/src/constants/network.ts` - Sortable columns mapping

### Tests Added

- `/tests/integration/networks-data-integrity.test.js` - Regression tests

## 🔍 Root Causes

1. **Data Source Confusion**: API using aggregated materialized views instead of latest observation data
2. **Field Name Mismatches**: Backend response fields not matching frontend transformers
3. **Missing API Integration**: Frontend not calling all required analytics endpoints
4. **Schema Namespace Issues**: Code looking for 'public' schema but tables in 'app' schema
5. **Incomplete Mappings**: Missing columns in sortable fields configuration

## 🛠️ Development Workflow

### Restart Services After Changes

```bash
# Stop server
pkill -f "node.*server" 2>/dev/null || true

# Rebuild frontend
npm run build

# Start server
npm start > server.log 2>&1 &
```

### Check Logs

```bash
tail -f server.log
```

### Run Tests

```bash
npm test -- --testNamePattern="networks API data integrity"
```

## 📚 Related Documentation

- [Troubleshooting Recent Fixes](TROUBLESHOOTING_RECENT_FIXES.md) - Detailed troubleshooting
- [API Reference](API_REFERENCE.md) - Updated API documentation
- [Integration Tests](../tests/integration/README.md) - Test coverage details

## 🎯 Prevention Checklist

- [ ] Verify data source consistency (materialized views vs. tables)
- [ ] Check field name mappings between backend and frontend
- [ ] Validate schema references (public vs. app)
- [ ] Test geographic calculations with real coordinates
- [ ] Ensure all sortable columns are mapped in both frontend and backend
- [ ] Add regression tests for critical functionality

---

**Last Updated:** 2026-01-30  
**Version:** Post-fixes  
**Status:** All issues resolved ✅
