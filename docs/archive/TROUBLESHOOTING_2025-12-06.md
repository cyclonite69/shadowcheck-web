# Troubleshooting Session - 2025-12-06

## Issue Report
- **Time:** 2025-12-06 01:30
- **Problem:** Dashboard and analytics endpoints not returning data
- **Symptoms:**
  - Dashboard: Error "Cannot read properties of undefined (reading 'getMetrics')"
  - Analytics: 404 Not Found errors

## Root Causes Identified

### 1. Dashboard Service Not Initialized
**Problem:** Dashboard routes require initialization with DashboardService, but `initDashboardRoutes()` was never called in server.js.

**Error:**
```json
{
  "error": "Failed to fetch dashboard metrics",
  "details": "Cannot read properties of undefined (reading 'getMetrics')"
}
```

**Root Cause:** The dashboard routes use dependency injection pattern:
```javascript
// dashboard.js exports both router and init function
module.exports = { router, initDashboardRoutes };

// But server.js only mounted the router without initializing
app.use('/api', dashboardRoutes.router); // ❌ Service undefined
```

**Fix Applied:**
```javascript
// Initialize dashboard routes with dependencies
const NetworkRepository = require('./src/repositories/networkRepository');
const DashboardService = require('./src/services/dashboardService');
const networkRepository = new NetworkRepository();
const dashboardService = new DashboardService(networkRepository);
dashboardRoutes.initDashboardRoutes({ dashboardService });

// Then mount the router
app.use('/api', dashboardRoutes.router); // ✅ Service initialized
```

### 2. Analytics Routes Working (No Issue)
**Finding:** Analytics routes were actually working, just at different paths than expected.

**Expected:** `/api/analytics/network-types`  
**Actual:** `/api/network-types`

**Reason:** Analytics routes are defined without the `/analytics` prefix:
```javascript
// analytics.js
router.get('/network-types', ...) // Not '/analytics/network-types'
```

This is correct - the routes are mounted at `/api` and define their own paths.

## Changes Made

### File: `server.js`
**Location:** Lines 183-192

**Before:**
```javascript
const { query } = require('./src/config/database');

app.use('/', healthRoutes);
app.use('/', geospatialRoutes);
app.use('/api', networksRoutes);
// ... other routes
app.use('/api', dashboardRoutes.router); // ❌ Not initialized
```

**After:**
```javascript
const { query } = require('./src/config/database');

// Initialize dashboard routes with dependencies
const NetworkRepository = require('./src/repositories/networkRepository');
const DashboardService = require('./src/services/dashboardService');
const networkRepository = new NetworkRepository();
const dashboardService = new DashboardService(networkRepository);
dashboardRoutes.initDashboardRoutes({ dashboardService });

app.use('/', healthRoutes);
app.use('/', geospatialRoutes);
app.use('/api', networksRoutes);
// ... other routes
app.use('/api', dashboardRoutes.router); // ✅ Initialized
```

## Verification

### Dashboard Endpoint
```bash
curl http://localhost:3001/api/dashboard-metrics | jq .
```

**Result:** ✅ Working
```json
{
  "totalNetworks": 117687,
  "threatsCount": 53282,
  "surveillanceCount": 24,
  "enrichedCount": 0,
  "wifiCount": 36391,
  "btCount": 5754,
  "bleCount": 75163,
  "lteCount": 259,
  "gsmCount": 120
}
```

### Analytics Endpoints
```bash
curl http://localhost:3001/api/network-types | jq .
```

**Result:** ✅ Working
```json
{
  "ok": true,
  "data": [
    {"type": "BLE", "count": 75965},
    {"type": "WiFi", "count": 36391},
    {"type": "BT", "count": 4952},
    {"type": "LTE", "count": 302},
    {"type": "NR", "count": 50},
    {"type": "GSM", "count": 27}
  ]
}
```

## Available Analytics Endpoints

All analytics endpoints are at `/api/` (not `/api/analytics/`):

1. `GET /api/network-types` - Network type distribution
2. `GET /api/signal-strength` - Signal strength distribution
3. `GET /api/temporal-activity` - Activity over time
4. `GET /api/radio-type-over-time` - Radio type trends
5. `GET /api/security` - Security/encryption stats
6. `GET /api/top-networks` - Top networks by observations
7. `GET /api/dashboard` - Dashboard analytics
8. `GET /api/bulk` - Bulk analytics data

## Lessons Learned

1. **Dependency Injection Pattern:** When routes use DI, ensure initialization happens before mounting
2. **Route Prefixes:** Check actual route definitions, not assumptions about prefixes
3. **Server Restart:** Always restart server after code changes to test fixes
4. **Error Messages:** "Cannot read properties of undefined" often indicates missing initialization

## Status

✅ **RESOLVED**
- Dashboard endpoint working
- Analytics endpoints working
- All data returning correctly
- Server running stable

## Next Steps

- Monitor for any related issues
- Consider adding startup validation for DI dependencies
- Document DI pattern for future route additions
