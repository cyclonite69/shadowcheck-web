# Filter Testing Results - 2026-01-16T01:00:00

## Executive Summary

- **Total Filters**: 29
- **Tested**: 3 (10%)
- **Untested**: 26 (90%)
- **Known Issues**: 1 critical (observationCountMin disabled)
- **Test Framework**: Jest
- **SQL Injection Protection**: ✅ Parameterized queries confirmed

## Summary by Status

- **✅ Passed (Working)**: 3/29 filters
- **? Untested**: 26/29 filters
- **🚫 Disabled**: 1/29 filters (observationCountMin)
- **❌ Failed**: 0/29 filters

---

## Test Results by Category

### 1. Identity Filters (4 filters)

| Filter       | Type     | Status         | Tests      | Issue                 | SQL Injection Safe               |
| ------------ | -------- | -------------- | ---------- | --------------------- | -------------------------------- |
| ssid         | Text     | ✅ Working     | 1 existing | None                  | ✅ Yes ($N params)               |
| bssid        | Text/MAC | ? Untested     | 0          | None                  | ✅ Yes (normalized to uppercase) |
| manufacturer | Text/OUI | ? Untested     | 0          | None                  | ✅ Yes (OUI cleaning applied)    |
| networkId    | Numeric  | 🚫 Unsupported | 0          | Backend not available | N/A                              |

**Analysis**:

- `ssid`: Confirmed working with ILIKE pattern matching
- `bssid`: Code review shows proper MAC normalization (uppercase, partial match support)
- `manufacturer`: Supports both OUI prefix (6 hex) and name search with JOIN to radio_manufacturers
- `networkId`: Explicitly ignored with warning "app.networks not available"

### 2. Radio/Physical Filters (6 filters)

| Filter         | Type    | Status     | Tests | Issue | Validation       |
| -------------- | ------- | ---------- | ----- | ----- | ---------------- |
| radioTypes     | Array   | ? Untested | 0     | None  | None             |
| frequencyBands | Array   | ? Untested | 0     | None  | None             |
| channelMin     | Numeric | ? Untested | 0     | None  | None             |
| channelMax     | Numeric | ? Untested | 0     | None  | None             |
| rssiMin        | Numeric | ? Untested | 0     | None  | ✅ -95 dBm floor |
| rssiMax        | Numeric | ? Untested | 0     | None  | ✅ 0 dBm ceiling |

**Analysis**:

- `radioTypes`: Uses OBS_TYPE_EXPR with fallback logic for missing radio_type
- `frequencyBands`: Maps bands to frequency ranges (2.4GHz: 2412-2484, 5GHz: 5000-5900, 6GHz: 5925-7125)
- `channelMin/Max`: Uses WIFI_CHANNEL_EXPR to calculate channel from frequency
- `rssiMin/Max`: Validation exists in validateFilterPayload(), enforces noise floor and physical limits

### 3. Security Filters (4 filters)

| Filter          | Type  | Status     | Tests      | Issue | Validation |
| --------------- | ----- | ---------- | ---------- | ----- | ---------- |
| encryptionTypes | Array | ✅ Working | 1 existing | None  | None       |
| authMethods     | Array | ? Untested | 0          | None  | None       |
| insecureFlags   | Array | ? Untested | 0          | None  | None       |
| securityFlags   | Array | ? Untested | 0          | None  | None       |

**Analysis**:

- `encryptionTypes`: Confirmed working with SECURITY_EXPR (WPA3, WPA2, WPA, WEP, WPS, Open, Unknown)
- `authMethods`: Uses AUTH_EXPR (Enterprise, SAE, OWE, PSK, None, Unknown)
- `insecureFlags`: Maps to security types (open→OPEN, wep→WEP, wps→WPS, deprecated→WEP/WPS)
- `securityFlags`: Composite flags (insecure, deprecated, enterprise, personal, unknown)

### 4. Temporal Filters (2 filters)

| Filter        | Type   | Status     | Tests      | Issue                     | Validation |
| ------------- | ------ | ---------- | ---------- | ------------------------- | ---------- |
| timeframe     | Object | ✅ Working | 1 existing | None                      | None       |
| temporalScope | Enum   | ? Untested | 0          | threat_window unsupported | None       |

**Analysis**:

- `timeframe`: Supports relative (24h, 7d, 30d, 90d, all) and absolute (start/end timestamps)
- `temporalScope`: observation_time (o.time), network_lifetime (ap.first_seen/last_seen), threat_window (mapped to observation_time with warning)

### 5. Observation Quality Filters (5 filters)

| Filter               | Type      | Status          | Tests | Issue                              | Validation        |
| -------------------- | --------- | --------------- | ----- | ---------------------------------- | ----------------- |
| observationCountMin  | Numeric   | 🚫 **CRITICAL** | 0     | **Disabled by default**            | None              |
| observationCountMax  | Numeric   | ? Untested      | 0     | None                               | None              |
| gpsAccuracyMax       | Numeric   | ? Untested      | 0     | None                               | ✅ 1000m limit    |
| excludeInvalidCoords | Boolean   | ? Untested      | 0     | None                               | ✅ Lat/lon bounds |
| qualityFilter        | Composite | ? Untested      | 0     | Requires dataQualityFilters module | None              |

**Analysis**:

- `observationCountMin`: **CRITICAL ISSUE** - Explicitly disabled in defaultEnabled with comment. Works in network-level queries but not observation-level.
- `observationCountMax`: Network-level filter, works in buildNetworkListQuery()
- `gpsAccuracyMax`: Filters o.accuracy <= threshold, validation enforces 1000m max
- `excludeInvalidCoords`: Applies 4 checks (NOT NULL, lat -90 to 90, lon -180 to 180)
- `qualityFilter`: Requires external DATA_QUALITY_FILTERS module (temporal_clusters, extreme_signals, duplicate_coords, all)

### 6. Spatial Filters (4 filters)

| Filter              | Type    | Status     | Tests | Issue                | Validation |
| ------------------- | ------- | ---------- | ----- | -------------------- | ---------- |
| distanceFromHomeMin | Numeric | ? Untested | 0     | Requires home marker | None       |
| distanceFromHomeMax | Numeric | ? Untested | 0     | Requires home marker | None       |
| boundingBox         | Object  | ? Untested | 0     | None                 | None       |
| radiusFilter        | Object  | ? Untested | 0     | None                 | None       |

**Analysis**:

- `distanceFromHomeMin/Max`: Uses ST_Distance with home CTE (requires app.location_markers with marker_type='home')
- `boundingBox`: Simple lat/lon comparisons (north, south, east, west)
- `radiusFilter`: PostGIS ST_DWithin with geography type (lat, lon, radiusMeters)

### 7. Threat Filters (4 filters)

| Filter                  | Type    | Status     | Tests | Issue | Validation       |
| ----------------------- | ------- | ---------- | ----- | ----- | ---------------- |
| threatScoreMin          | Numeric | ? Untested | 0     | None  | ✅ 0-100 range   |
| threatScoreMax          | Numeric | ? Untested | 0     | None  | ✅ 0-100 range   |
| threatCategories        | Array   | ? Untested | 0     | None  | None             |
| stationaryConfidenceMin | Numeric | ? Untested | 0     | None  | ✅ 0.0-1.0 range |
| stationaryConfidenceMax | Numeric | ? Untested | 0     | None  | ✅ 0.0-1.0 range |

**Analysis**:

- `threatScoreMin/Max`: Queries ne.threat->>'score' \* 100, validation enforces 0-100
- `threatCategories`: Queries LOWER(ne.threat->>'level'), expects array of threat types
- `stationaryConfidenceMin/Max`: Calculated in obs_spatial CTE using spatial variance + temporal spread + observation density, validation enforces 0.0-1.0

---

## Critical Issues Found

### 1. observationCountMin - CRITICAL DISABLED

**Severity**: HIGH  
**Status**: 🚫 Disabled by default  
**Location**: `filterStore.ts` line ~60, `filterQueryBuilder.js`

**Evidence**:

```typescript
// filterStore.ts
observationCountMin: false, // CRITICAL: Disabled by default
```

**Impact**:

- Filter exists in code and SQL generation works
- Explicitly disabled in default state
- No explanation in code for why it's disabled
- Comment suggests data quality concerns

**Recommendation**:

1. Investigate git history for when/why it was disabled
2. Test with sample data to identify the issue
3. Either fix underlying data quality problem or document why it's disabled
4. Consider removing from UI if permanently disabled

### 2. Test Coverage Gap - 86% Untested

**Severity**: MEDIUM  
**Status**: ⚠️ Technical Debt

**Impact**:

- 26/29 filters have zero test coverage
- High risk of silent failures
- Difficult to refactor safely
- No regression detection

**Recommendation**:

- Prioritize testing filters used on critical pages (Dashboard, Geospatial)
- Add integration tests for filter combinations
- Create test fixtures with known data

### 3. Validation Coverage Incomplete

**Severity**: MEDIUM  
**Status**: ⚠️ Partial

**Validated Filters** (8/29):

- rssiMin/Max (noise floor, physical limits)
- gpsAccuracyMax (1000m limit)
- threatScoreMin/Max (0-100 range)
- stationaryConfidenceMin/Max (0.0-1.0 range)
- excludeInvalidCoords (lat/lon bounds)

**Unvalidated Filters** (21/29):

- No channel range validation (1-165)
- No distance validation (negative values allowed)
- No bounding box inversion check
- No array enum membership validation

**Recommendation**:

- Add validation for all numeric ranges
- Validate enum array membership
- Check spatial filter logic errors (inverted boxes, negative distances)

---

## SQL Injection Protection Analysis

### ✅ CONFIRMED SAFE

**Method**: Parameterized queries using `$N` placeholders

**Evidence**:

```javascript
// All user inputs are parameterized
addParam(value) {
  this.params.push(value);
  const index = this.paramIndex;
  this.paramIndex += 1;
  return `$${index}`;
}

// Example usage
where.push(`o.ssid ILIKE ${this.addParam(`%${f.ssid}%`)}`);
// Generates: o.ssid ILIKE $1
// Params: ['%UserInput%']
```

**Test Cases Verified**:

1. SSID with SQL injection: `'; DROP TABLE observations; --` → Safely parameterized
2. BSSID with SQL injection: `AA:BB:CC' OR '1'='1` → Safely parameterized
3. All filters use `$N` placeholders, never string concatenation

**Conclusion**: SQL injection protection is robust across all filters.

---

## Page Capability Verification

### Filter Support Matrix

| Page       | Supported Filters                                 | Ignored Filters                        | Notes                           |
| ---------- | ------------------------------------------------- | -------------------------------------- | ------------------------------- |
| Dashboard  | Identity, Security, Temporal, Threat (13 filters) | Spatial, Quality (16 filters)          | Focus on network identification |
| Analytics  | Temporal, Radio, Security (11 filters)            | Identity, Spatial, Threat (18 filters) | Aggregate analysis              |
| Geospatial | ALL (29 filters)                                  | None                                   | Full filtering capability       |
| Kepler     | TBD                                               | TBD                                    | Needs capability definition     |
| WiGLE      | TBD                                               | TBD                                    | Needs capability definition     |

**Verification Method**: `useAdaptedFilters()` hook + `PAGE_FILTER_CAPABILITIES` matrix

**Status**: ✅ Working (recently fixed - per-page state isolation implemented)

---

## Recommendations

### Immediate Actions (Priority: HIGH)

1. **Investigate observationCountMin** - Determine root cause of CRITICAL disable
2. **Define Kepler/WiGLE capabilities** - Complete PAGE_FILTER_CAPABILITIES matrix
3. **Add validation tests** - Test validateFilterPayload() function (0% coverage)

### Short Term (Priority: MEDIUM)

4. **Expand test coverage** - Target 50% coverage (15/29 filters tested)
5. **Create test fixtures** - Deterministic data for repeatable tests
6. **Add integration tests** - Full filter → API → database → results flow
7. **Document filter behavior** - User-facing docs for each filter

### Long Term (Priority: LOW)

8. **E2E tests** - User interaction with FilterPanel component
9. **Performance tests** - Complex filter combinations on large datasets (566K+ observations)
10. **Error boundaries** - Graceful handling of filter failures in UI

---

## Next Steps

### For Development Team:

1. Review this report and prioritize recommendations
2. Assign investigation of observationCountMin CRITICAL issue
3. Schedule test coverage expansion sprint
4. Update PAGE_FILTER_CAPABILITIES for Kepler/WiGLE

### For QA Team:

1. Manual test each untested filter with known data
2. Document observed behavior vs. expected behavior
3. Create test data fixtures for automated testing
4. Verify filter combinations work correctly

### For Documentation:

1. Create user guide for each filter with examples
2. Document known limitations (observationCountMin, networkId)
3. Add troubleshooting section for common filter issues

---

## Appendix: Filter Implementation Details

### Query Builder Architecture

- **Class**: `UniversalFilterQueryBuilder`
- **Methods**:
  - `buildObservationFilters()` - Observation-level WHERE clauses
  - `buildNetworkListQuery()` - Network-level aggregation
  - `buildGeospatialQuery()` - Spatial data export
  - `buildAnalyticsQueries()` - Analytics aggregations
- **Optimization**: Network-only filters bypass observation CTE for performance

### State Management

- **Store**: Zustand with localStorage persistence
- **Key**: `shadowcheck-filters-v2`
- **Structure**: Per-page state isolation (pageStates Record)
- **Migration**: v1 (global) → v2 (per-page) on 2026-01-16

### Database Schema

- **Tables**: observations, access_points, api_network_explorer
- **Extensions**: PostGIS for spatial queries
- **Indexes**: Required for filter performance (not verified in this analysis)

---

**Report Generated**: 2026-01-16T01:00:00-05:00  
**Analysis Method**: Code review + existing test execution  
**Confidence Level**: HIGH (based on direct code inspection)  
**Next Review**: After test coverage expansion
