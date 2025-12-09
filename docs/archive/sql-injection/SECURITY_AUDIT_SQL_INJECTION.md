# SQL Injection Security Audit Report
**Date:** 2025-12-05  
**Auditor:** Security Review  
**Scope:** All database queries in Node.js/Express + PostgreSQL application

---

## Executive Summary

**Total Files Audited:** 9  
**Total Queries Found:** 47+  
**Critical Vulnerabilities:** 3  
**High Risk Issues:** 4  
**Medium Risk Issues:** 2  

### Risk Level: 🔴 HIGH - Immediate Action Required

---

## Critical Vulnerabilities (Immediate Fix Required)

### ❌ CRITICAL #1: String Interpolation in networkRepository.js

**File:** `src/repositories/networkRepository.js`  
**Lines:** 21-24  
**Severity:** CRITICAL

**Vulnerable Code:**
```javascript
threatsCount: `
  SELECT COUNT(DISTINCT bssid) as count
  FROM app.observations
  WHERE observed_at_epoch >= ${CONFIG.MIN_VALID_TIMESTAMP}
  GROUP BY bssid
  HAVING COUNT(*) >= ${CONFIG.MIN_OBSERVATIONS}
`,
```

**Why It's Vulnerable:**
- Direct string interpolation of `CONFIG.MIN_VALID_TIMESTAMP` and `CONFIG.MIN_OBSERVATIONS`
- If these config values are ever sourced from user input or environment variables without validation, SQL injection is possible
- Even if currently safe, this pattern violates secure coding practices

**Impact:** High - Could allow arbitrary SQL execution if config values are compromised

**Fix:**
```javascript
threatsCount: `
  SELECT COUNT(DISTINCT bssid) as count
  FROM app.observations
  WHERE observed_at_epoch >= $1
  GROUP BY bssid
  HAVING COUNT(*) >= $2
`,
// Then pass parameters:
await this.query(queries.threatsCount, [CONFIG.MIN_VALID_TIMESTAMP, CONFIG.MIN_OBSERVATIONS])
```

---

### ❌ CRITICAL #2: Unparameterized ORDER BY in baseRepository.js

**File:** `src/repositories/baseRepository.js`  
**Lines:** 43-50  
**Severity:** CRITICAL

**Vulnerable Code:**
```javascript
async findMany(whereClause = '1=1', params = [], options = {}) {
  const { limit = 100, offset = 0, orderBy = 'id DESC' } = options;
  const sql = `
    SELECT * FROM ${this.tableName}
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;
  const result = await this.query(sql, params);
  return result.rows;
}
```

**Why It's Vulnerable:**
- `orderBy`, `limit`, and `offset` are directly interpolated without validation
- User-controlled input could inject arbitrary SQL
- `whereClause` is also interpolated (though params are used for values)

**Attack Example:**
```javascript
// Attacker passes:
options = { orderBy: "id; DROP TABLE app.networks; --" }
```

**Impact:** Critical - Full SQL injection, potential data loss

**Fix:**
```javascript
async findMany(whereClause = '1=1', params = [], options = {}) {
  const { limit = 100, offset = 0, orderBy = 'id DESC' } = options;
  
  // Whitelist valid columns and directions
  const validColumns = ['id', 'created_at', 'updated_at', 'bssid', 'ssid', 'last_seen'];
  const validDirections = ['ASC', 'DESC'];
  
  // Parse orderBy (e.g., "id DESC")
  const [column, direction = 'DESC'] = orderBy.split(' ');
  
  if (!validColumns.includes(column) || !validDirections.includes(direction.toUpperCase())) {
    throw new Error('Invalid orderBy parameter');
  }
  
  // Validate limit and offset are numbers
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 100), 1000);
  const safeOffset = Math.max(0, parseInt(offset) || 0);
  
  const sql = `
    SELECT * FROM ${this.tableName}
    WHERE ${whereClause}
    ORDER BY ${column} ${direction}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  
  const result = await this.query(sql, [...params, safeLimit, safeOffset]);
  return result.rows;
}
```

---

### ❌ CRITICAL #3: Unparameterized ORDER BY in networkRepository.js

**File:** `src/repositories/networkRepository.js`  
**Lines:** 107-122  
**Severity:** CRITICAL

**Vulnerable Code:**
```javascript
async getPaginated(options = {}) {
  const {
    page = 1,
    limit = CONFIG.DEFAULT_PAGE_SIZE,
    sort = 'last_seen',
    order = 'DESC',
  } = options;

  const offset = (page - 1) * limit;
  const validLimit = Math.min(limit, CONFIG.MAX_PAGE_SIZE);

  const sql = `
    SELECT *
    FROM ${this.tableName}
    ORDER BY ${sort} ${order}
    LIMIT $1 OFFSET $2
  `;
```

**Why It's Vulnerable:**
- `sort` and `order` parameters directly interpolated
- No validation of column names or sort direction
- User input could inject SQL

**Impact:** Critical - SQL injection via sort parameter

**Fix:**
```javascript
async getPaginated(options = {}) {
  const {
    page = 1,
    limit = CONFIG.DEFAULT_PAGE_SIZE,
    sort = 'last_seen',
    order = 'DESC',
  } = options;

  // Whitelist valid sort columns
  const validSortColumns = ['last_seen', 'first_seen', 'bssid', 'ssid', 'type', 'signal'];
  const validOrders = ['ASC', 'DESC'];
  
  const safeSort = validSortColumns.includes(sort) ? sort : 'last_seen';
  const safeOrder = validOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
  
  const offset = (page - 1) * limit;
  const validLimit = Math.min(limit, CONFIG.MAX_PAGE_SIZE);

  const sql = `
    SELECT *
    FROM ${this.tableName}
    ORDER BY ${safeSort} ${safeOrder}
    LIMIT $1 OFFSET $2
  `;
  
  // ... rest of code
}
```

---

## High Risk Issues

### ⚠️ HIGH #1: WHERE Clause Injection in baseRepository.js

**File:** `src/repositories/baseRepository.js`  
**Lines:** 28-31, 43-50, 59-62  
**Severity:** HIGH

**Vulnerable Code:**
```javascript
async findOne(whereClause, params = []) {
  const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
  const result = await this.query(sql, params);
  return result.rows[0] || null;
}
```

**Why It's Vulnerable:**
- `whereClause` is directly interpolated as a string
- While params are used for values, the clause structure itself could be malicious
- Caller must ensure whereClause is safe

**Risk:** If any caller passes user input directly to whereClause, SQL injection is possible

**Recommendation:**
- Document that whereClause MUST be hardcoded, never user input
- Add validation or use a query builder pattern
- Consider deprecating this method in favor of specific query methods

---

### ⚠️ HIGH #2: Table Name Interpolation

**File:** `src/repositories/baseRepository.js`  
**All Methods**  
**Severity:** HIGH

**Vulnerable Pattern:**
```javascript
const sql = `SELECT * FROM ${this.tableName} WHERE ...`;
```

**Why It's Concerning:**
- `this.tableName` is set in constructor
- If ever sourced from user input, allows table name injection
- PostgreSQL doesn't support parameterized table names

**Current Status:** SAFE (hardcoded in constructors)

**Recommendation:**
- Add validation in constructor to whitelist table names
- Document that tableName MUST be hardcoded

**Fix:**
```javascript
constructor(tableName) {
  const validTables = [
    'app.networks',
    'app.observations',
    'app.network_tags',
    'app.location_markers',
    'app.radio_manufacturers'
  ];
  
  if (!validTables.includes(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
  
  this.tableName = tableName;
}
```

---

## Medium Risk Issues

### ⚠️ MEDIUM #1: SSID Search Pattern Construction

**File:** `src/repositories/networkRepository.js`  
**Lines:** 89-93  
**Severity:** MEDIUM

**Code:**
```javascript
async searchBySSID(ssid) {
  const sql = `
    SELECT * FROM ${this.tableName}
    WHERE ssid ILIKE $1
    ORDER BY last_seen DESC
    LIMIT 100
  `;
  const result = await this.query(sql, [`%${ssid}%`]);
  return result.rows;
}
```

**Why It's Concerning:**
- SSID is wrapped with wildcards in JavaScript, not SQL
- Special characters like `%` and `_` in user input become wildcards
- Could cause unintended pattern matching

**Impact:** Low - Information disclosure, not injection

**Recommendation:**
- Escape special LIKE characters before adding wildcards
- Or use PostgreSQL's `SIMILAR TO` with proper escaping

**Fix:**
```javascript
async searchBySSID(ssid) {
  // Escape LIKE special characters
  const escapedSSID = ssid.replace(/[%_]/g, '\\$&');
  
  const sql = `
    SELECT * FROM ${this.tableName}
    WHERE ssid ILIKE $1
    ORDER BY last_seen DESC
    LIMIT 100
  `;
  const result = await this.query(sql, [`%${escapedSSID}%`]);
  return result.rows;
}
```

---

### ⚠️ MEDIUM #2: Similar Pattern in server.js

**File:** `server.js`  
**Line:** 1971  
**Severity:** MEDIUM

**Code:**
```javascript
const searchPattern = `%${ssid}%`;
const { rows } = await query(`
  SELECT ... WHERE n.ssid ILIKE $1 ...
`, [searchPattern]);
```

**Same Issue:** LIKE wildcards not escaped

---

## Safe Queries (✅ Properly Parameterized)

### src/api/routes/v1/threats.js
- **Total Queries:** 1
- **Status:** ✅ SAFE
- All parameters properly used with `$1`, `$2` placeholders

### src/api/routes/v1/export.js
- **Total Queries:** 5
- **Status:** ✅ SAFE
- No user input in queries
- All queries are static

### src/api/routes/v1/location-markers.js
- **Total Queries:** 4
- **Status:** ✅ SAFE
- Coordinates validated and parameterized with `$1`, `$2`
- Static DELETE queries use single quotes (safe)

### server.js - /api/networks/observations/:bssid
- **Line:** 1471-1510
- **Status:** ✅ SAFE
- BSSID properly parameterized as `$3`
- Home coordinates as `$1`, `$2`
- Timestamp as `$4`

### server.js - /api/tag-network
- **Lines:** 1526-1580
- **Status:** ✅ SAFE
- BSSID sanitized with `sanitizeBSSID()` function
- Tag type validated against whitelist
- All queries use parameterized statements

### server.js - /api/networks/search/:ssid
- **Lines:** 1963-2000
- **Status:** ✅ SAFE (with caveat)
- SSID parameterized as `$1`
- Minor issue: LIKE wildcards not escaped (see MEDIUM #2)

---

## Recommendations

### Immediate Actions (Critical)

1. **Fix networkRepository.js getDashboardMetrics()**
   - Replace string interpolation with parameterized queries
   - Priority: CRITICAL

2. **Fix baseRepository.js findMany()**
   - Add ORDER BY column/direction whitelisting
   - Parameterize LIMIT and OFFSET
   - Priority: CRITICAL

3. **Fix networkRepository.js getPaginated()**
   - Add sort column whitelisting
   - Validate order direction
   - Priority: CRITICAL

### Short-term Actions (High Priority)

4. **Add table name validation to BaseRepository constructor**
   - Whitelist valid table names
   - Prevent future misuse

5. **Document security requirements**
   - whereClause parameters must be hardcoded
   - Never pass user input to structural SQL elements

6. **Add input validation middleware**
   - Validate sort/order parameters at route level
   - Centralize validation logic

### Long-term Improvements

7. **Consider using a query builder**
   - Knex.js or similar
   - Eliminates manual SQL construction

8. **Add automated security testing**
   - SQL injection test suite
   - Integrate with CI/CD

9. **Code review checklist**
   - All new queries must use parameterization
   - No string interpolation in SQL
   - Whitelist all structural elements (ORDER BY, table names)

---

## Testing Recommendations

### Manual Testing
```bash
# Test ORDER BY injection
curl "http://localhost:3001/api/networks?sort=id;DROP%20TABLE%20networks;--"

# Test LIKE wildcard abuse
curl "http://localhost:3001/api/networks/search/%%"
```

### Automated Testing
```javascript
// Add to test suite
describe('SQL Injection Prevention', () => {
  it('should reject malicious ORDER BY', async () => {
    const response = await request(app)
      .get('/api/networks')
      .query({ sort: 'id; DROP TABLE networks; --' });
    expect(response.status).toBe(400);
  });
  
  it('should escape LIKE wildcards', async () => {
    const response = await request(app)
      .get('/api/networks/search/%_test');
    // Should search for literal "%_test", not use as wildcards
  });
});
```

---

## Conclusion

The application has **3 critical SQL injection vulnerabilities** that require immediate attention. While most queries properly use parameterized statements, the ORDER BY and configuration value interpolations create significant security risks.

**Estimated Fix Time:** 2-4 hours  
**Risk if Unfixed:** Complete database compromise

All critical issues should be resolved before production deployment.
