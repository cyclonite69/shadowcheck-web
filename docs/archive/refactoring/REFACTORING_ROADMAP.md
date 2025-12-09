# Server.js Refactoring Roadmap

**Date:** 2025-12-05  
**Current State:** 2029 lines, 26 endpoints inline  
**Target State:** <200 lines, modular route files  
**Goal:** Zero functional changes, improved maintainability

---

## Current State Audit

### server.js Statistics
- **Total Lines:** 2029
- **Total Endpoints:** 26 (25 API + 1 root)
- **Existing Route Modules:** 7 (not being used)
- **Problem:** All endpoints defined inline, no separation of concerns

### Existing Route Files (NOT USED)
```
src/api/routes/v1/
├── analytics.js       (8 routes defined, not mounted)
├── backup.js          (2 routes)
├── dashboard.js       (2 routes)
├── export.js          (3 routes)
├── location-markers.js (2 routes)
├── settings.js        (7 routes)
└── threats.js         (1 route)
```

**Status:** These files exist but are NOT imported/mounted in server.js

---

## Endpoint Inventory

### 1. Geospatial/Mapbox (3 endpoints)
- `GET /` - Root redirect
- `GET /api/mapbox-token` - Mapbox API token
- ✅ `GET /api/location-markers` - Get all markers (EXISTS in location-markers.js)
- ✅ `POST /api/location-markers/home` - Set home location (EXISTS)
- ✅ `DELETE /api/location-markers/home` - Delete home (EXISTS)

**Action:** Use existing location-markers.js, add mapbox-token route

### 2. WiGLE Integration (2 endpoints)
- `GET /api/wigle/network/:bssid` - Get WiGLE data for network
- `GET /api/wigle/search` - Search WiGLE database

**Action:** Create new wigle.js route file

### 3. Dashboard (1 endpoint)
- ✅ `GET /api/dashboard-metrics` - Dashboard statistics (EXISTS in dashboard.js)

**Action:** Use existing dashboard.js

### 4. Analytics (5 endpoints)
- ✅ `GET /api/analytics/network-types` - Network type distribution (EXISTS)
- ✅ `GET /api/analytics/signal-strength` - Signal strength distribution (EXISTS)
- ✅ `GET /api/analytics/temporal-activity` - Hourly activity (EXISTS)
- ✅ `GET /api/analytics/radio-type-over-time` - Radio types over time (EXISTS)
- ✅ `GET /api/analytics/security` - Security protocol distribution (EXISTS)

**Action:** Use existing analytics.js (already complete!)

### 5. Threats (2 endpoints)
- ✅ `GET /api/threats/quick` - Quick threat detection (EXISTS in threats.js)
- `GET /api/threats/detect` - Detailed threat analysis

**Action:** Add detect endpoint to existing threats.js

### 6. Admin (3 endpoints)
- `GET /api/observations/check-duplicates/:bssid` - Check for duplicates
- `POST /api/admin/cleanup-duplicates` - Clean up duplicate observations
- `POST /api/admin/refresh-colocation` - Refresh colocation data

**Action:** Create new admin.js route file

### 7. Machine Learning (2 endpoints)
- `POST /api/ml/train` - Train ML model
- `GET /api/ml/status` - Get model status

**Action:** Create new ml.js route file

### 8. Networks (6 endpoints)
- `GET /api/networks` - List all networks (with pagination/filtering)
- `GET /api/networks/search/:ssid` - Search by SSID
- `GET /api/networks/observations/:bssid` - Get observations for network
- `GET /api/networks/tagged` - Get tagged networks
- `POST /api/tag-network` - Tag a network (requires auth)
- `DELETE /api/tag-network/:bssid` - Remove tag (requires auth)

**Action:** Create new networks.js route file

### 9. Manufacturer Lookup (1 endpoint)
- `GET /api/manufacturer/:bssid` - Get manufacturer from MAC

**Action:** Add to networks.js (related to network metadata)

---

## Refactoring Plan

### Phase 1: Use Existing Route Files (5 files)
These files already exist and are complete - just need to mount them:

1. ✅ **analytics.js** - 5 endpoints (complete)
2. ✅ **dashboard.js** - 1 endpoint (complete)
3. ✅ **location-markers.js** - 3 endpoints (complete)
4. ✅ **threats.js** - 1 endpoint (needs 1 more added)
5. ✅ **backup.js** - 2 endpoints (complete, for admin use)
6. ✅ **export.js** - 3 endpoints (complete, for admin use)
7. ✅ **settings.js** - 7 endpoints (complete, for admin use)

**Action:** Import and mount these in server.js

### Phase 2: Create New Route Files (4 files)

#### 2.1 networks.js (7 endpoints)
```
GET    /api/networks
GET    /api/networks/search/:ssid
GET    /api/networks/observations/:bssid
GET    /api/networks/tagged
POST   /api/tag-network
DELETE /api/tag-network/:bssid
GET    /api/manufacturer/:bssid
```

**Dependencies:**
- `query` from database config
- `requireAuth` middleware
- `sanitizeBSSID` utility
- `escapeLikePattern` from utils/escapeSQL
- `CONFIG` from database config

#### 2.2 wigle.js (2 endpoints)
```
GET /api/wigle/network/:bssid
GET /api/wigle/search
```

**Dependencies:**
- `query` from database config

#### 2.3 admin.js (3 endpoints)
```
GET  /api/observations/check-duplicates/:bssid
POST /api/admin/cleanup-duplicates
POST /api/admin/refresh-colocation
```

**Dependencies:**
- `query` from database config
- `requireAuth` middleware (optional)

#### 2.4 ml.js (2 endpoints)
```
POST /api/ml/train
GET  /api/ml/status
```

**Dependencies:**
- `query` from database config
- ML trainer module

#### 2.5 geospatial.js (2 endpoints)
```
GET / (root redirect)
GET /api/mapbox-token
```

**Dependencies:**
- `MAPBOX_TOKEN` from env

### Phase 3: Update server.js

**Remove:** All inline endpoint definitions (1800+ lines)

**Keep:**
- Express app setup
- Middleware (cors, compression, rate limiting, body parser)
- Static file serving
- Error handling middleware
- Server startup logic

**Add:**
- Import all route modules
- Mount routes with `app.use()`

**Target:** <200 lines

---

## Route File Structure Template

```javascript
const express = require('express');
const router = express.Router();
const { query, CONFIG } = require('../../config/database');

// Middleware (if needed)
const requireAuth = (req, res, next) => {
  // Auth logic
};

// Routes
router.get('/endpoint', async (req, res, next) => {
  try {
    // Handler logic
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

---

## Migration Strategy

### Step 1: Mount Existing Routes (Low Risk)
```javascript
// In server.js
const analyticsRoutes = require('./src/api/routes/v1/analytics');
const dashboardRoutes = require('./src/api/routes/v1/dashboard');
const locationMarkersRoutes = require('./src/api/routes/v1/location-markers');
const threatsRoutes = require('./src/api/routes/v1/threats');

app.use('/api', analyticsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', locationMarkersRoutes);
app.use('/api', threatsRoutes);
```

**Test:** Verify these 10 endpoints still work

### Step 2: Create networks.js (Medium Risk)
- Extract 7 network-related endpoints
- Test each endpoint individually
- Verify SQL injection fixes are preserved

### Step 3: Create wigle.js (Low Risk)
- Extract 2 WiGLE endpoints
- Simple passthrough queries

### Step 4: Create admin.js (Low Risk)
- Extract 3 admin endpoints
- Low traffic, internal use

### Step 5: Create ml.js (Low Risk)
- Extract 2 ML endpoints
- Isolated functionality

### Step 6: Create geospatial.js (Low Risk)
- Extract root redirect + mapbox token
- Simple endpoints

### Step 7: Clean up server.js
- Remove all extracted code
- Verify <200 lines
- Test all endpoints

---

## Testing Checklist

### Automated Tests
- [ ] Run existing test suite
- [ ] All 44 SQL injection tests pass
- [ ] All 34 LIKE escaping tests pass
- [ ] All 26 integration tests pass

### Manual Endpoint Testing
- [ ] GET / (root)
- [ ] GET /api/mapbox-token
- [ ] GET /api/location-markers
- [ ] POST /api/location-markers/home
- [ ] DELETE /api/location-markers/home
- [ ] GET /api/wigle/network/:bssid
- [ ] GET /api/wigle/search
- [ ] GET /api/dashboard-metrics
- [ ] GET /api/analytics/network-types
- [ ] GET /api/analytics/signal-strength
- [ ] GET /api/analytics/temporal-activity
- [ ] GET /api/analytics/radio-type-over-time
- [ ] GET /api/analytics/security
- [ ] GET /api/threats/quick
- [ ] GET /api/threats/detect
- [ ] GET /api/observations/check-duplicates/:bssid
- [ ] POST /api/admin/cleanup-duplicates
- [ ] POST /api/admin/refresh-colocation
- [ ] POST /api/ml/train
- [ ] GET /api/ml/status
- [ ] GET /api/networks
- [ ] GET /api/networks/search/:ssid
- [ ] GET /api/networks/observations/:bssid
- [ ] GET /api/networks/tagged
- [ ] POST /api/tag-network
- [ ] DELETE /api/tag-network/:bssid
- [ ] GET /api/manufacturer/:bssid

### Verification
- [ ] Same HTTP status codes
- [ ] Same response format
- [ ] Same error handling
- [ ] Same authentication behavior
- [ ] SQL injection fixes preserved
- [ ] LIKE escaping preserved

---

## Risk Assessment

### Low Risk (Can do immediately)
- Mounting existing route files (already tested)
- Creating wigle.js (simple passthrough)
- Creating admin.js (low traffic)
- Creating ml.js (isolated)
- Creating geospatial.js (simple)

### Medium Risk (Needs careful testing)
- Creating networks.js (complex, high traffic)
- Must preserve SQL injection fixes
- Must preserve LIKE escaping
- Must preserve authentication

### High Risk (None)
- No high-risk changes if done incrementally

---

## Rollback Plan

If issues arise:
1. Keep old server.js as server.js.backup
2. Can revert by: `mv server.js.backup server.js`
3. Each route file is independent - can revert individually
4. Git history preserves all changes

---

## Success Criteria

- [ ] server.js reduced from 2029 to <200 lines
- [ ] All 26 endpoints work identically
- [ ] All tests pass
- [ ] No functional changes
- [ ] Code is more maintainable
- [ ] New developers can find endpoints easily
- [ ] Each domain has its own file

---

## File Structure After Refactoring

```
src/api/routes/v1/
├── admin.js           (3 endpoints) - NEW
├── analytics.js       (5 endpoints) - EXISTS
├── backup.js          (2 endpoints) - EXISTS
├── dashboard.js       (1 endpoint)  - EXISTS
├── export.js          (3 endpoints) - EXISTS
├── geospatial.js      (2 endpoints) - NEW
├── location-markers.js (3 endpoints) - EXISTS
├── ml.js              (2 endpoints) - NEW
├── networks.js        (7 endpoints) - NEW
├── settings.js        (7 endpoints) - EXISTS
├── threats.js         (2 endpoints) - UPDATE (add 1)
└── wigle.js           (2 endpoints) - NEW
```

**Total:** 12 route files, 39 endpoints

---

## Next Steps

1. ✅ Create this roadmap
2. Create networks.js (highest priority, most complex)
3. Create wigle.js
4. Create admin.js
5. Create ml.js
6. Update threats.js (add detect endpoint)
7. Create geospatial.js
8. Update server.js to mount all routes
9. Test everything
10. Remove old code from server.js
11. Verify <200 lines

---

**Estimated Time:** 2-3 hours  
**Risk Level:** LOW (if done incrementally)  
**Breaking Changes:** NONE (zero functional changes)
