# SQL Injection Prevention

> **Consolidated from**: SECURITY_AUDIT_SQL_INJECTION.md, SQL_INJECTION_FIXES.md, SQL_INJECTION_FIXES_QUICK_REF.md

## Overview

All SQL queries in ShadowCheck use **parameterized queries** to prevent SQL injection attacks. This document outlines the implementation and best practices.

## Quick Reference

### ✅ SAFE - Parameterized Queries
```javascript
const { query } = require('../config/database');

// Good: Parameters passed separately
const result = await query(
  'SELECT * FROM app.networks_legacy WHERE bssid = $1',
  [bssid]
);

// Good: Multiple parameters
const result = await query(
  'SELECT * FROM app.networks_legacy WHERE type = $1 AND rssi > $2',
  [networkType, minSignal]
);

// Good: LIKE queries with escaping
const { escapeLike } = require('../utils/escapeSQL');
const result = await query(
  'SELECT * FROM app.networks_legacy WHERE ssid LIKE $1',
  [`%${escapeLike(userInput)}%`]
);
```

### ❌ UNSAFE - String Interpolation
```javascript
// Bad: Direct string interpolation
const result = await query(
  `SELECT * FROM networks WHERE bssid = '${bssid}'`
);

// Bad: Template literals
const result = await query(
  `SELECT * FROM networks WHERE type = '${type}'`
);

// Bad: String concatenation
const result = await query(
  'SELECT * FROM networks WHERE ssid = ' + ssid
);
```

## Implementation

### Database Query Wrapper

All queries use `src/config/database.js::query()`:

```javascript
async function query(text, params = [], tries = 2) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    // Automatic retry for transient errors
    if (tries > 1 && isTransientError(err)) {
      await sleep(1000);
      return query(text, params, tries - 1);
    }
    throw err;
  }
}
```

### LIKE Query Escaping

Special characters in LIKE patterns must be escaped:

```javascript
// src/utils/escapeSQL.js
function escapeLike(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\\/g, '\\\\')  // Backslash
    .replace(/%/g, '\\%')    // Percent
    .replace(/_/g, '\\_');   // Underscore
}

// Usage
const ssidPattern = `%${escapeLike(userInput)}%`;
const result = await query(
  'SELECT * FROM networks WHERE ssid LIKE $1 ESCAPE E'\\\\'',
  [ssidPattern]
);
```

## Audited Endpoints

All API endpoints have been audited and fixed. Status: ✅ **All Clear**

### Core Endpoints
- ✅ `/api/networks` - Parameterized filters
- ✅ `/api/networks/:bssid` - Parameterized BSSID lookup
- ✅ `/api/networks/search/:ssid` - LIKE escaping applied
- ✅ `/api/threats/quick` - Parameterized severity filter
- ✅ `/api/threats/detect` - Parameterized threshold

### Analytics Endpoints
- ✅ `/api/analytics/network-types` - No user input
- ✅ `/api/analytics/signal-strength` - Parameterized range filters
- ✅ `/api/analytics/temporal-activity` - Parameterized date filters

### Data Modification
- ✅ `POST /api/tag-network` - Parameterized insert/update
- ✅ `DELETE /api/tag-network/:bssid` - Parameterized delete
- ✅ `POST /api/ml/train` - No user input in queries

## Testing

### Manual Testing
```bash
# Test LIKE escaping
curl "http://localhost:3001/api/networks/search/%25test%25"

# Test parameterized BSSID
curl "http://localhost:3001/api/networks/AA:BB:CC'; DROP TABLE networks;--"

# Test filter injection
curl "http://localhost:3001/api/threats/quick?minSeverity=0 OR 1=1"
```

### Automated Tests
```javascript
// tests/security/sql-injection.test.js
describe('SQL Injection Prevention', () => {
  it('should escape LIKE patterns', async () => {
    const response = await request(app)
      .get('/api/networks/search/%test_value')
      .expect(200);

    // Should not return all networks
    expect(response.body.networks.length).toBeLessThan(100);
  });

  it('should reject malicious BSSID', async () => {
    const response = await request(app)
      .get("/api/networks/'; DROP TABLE networks;--")
      .expect(400);

    expect(response.body.error).toMatch(/invalid/i);
  });
});
```

## Validation Layers

### Layer 1: Input Validation
```javascript
// src/validation/schemas.js
const Joi = require('joi');

const bssidSchema = Joi.string()
  .pattern(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i)
  .required();

const ssidSchema = Joi.string()
  .max(32)
  .required();
```

### Layer 2: Parameterized Queries
```javascript
// Always use $1, $2, etc. placeholders
const result = await query(
  'SELECT * FROM networks WHERE bssid = $1',
  [bssid]
);
```

### Layer 3: LIKE Escaping
```javascript
// Escape special characters in LIKE patterns
const { escapeLike } = require('../utils/escapeSQL');
const pattern = `%${escapeLike(userInput)}%`;
```

## Common Patterns

### Search Queries
```javascript
// SSID search
const { escapeLike } = require('../utils/escapeSQL');
const pattern = `%${escapeLike(ssid)}%`;
const result = await query(
  `SELECT * FROM networks WHERE ssid LIKE $1 ESCAPE E'\\\\'`,
  [pattern]
);
```

### Filter Queries
```javascript
// Multiple filters
const filters = [];
const params = [];

if (minSignal) {
  filters.push(`rssi >= $${params.length + 1}`);
  params.push(minSignal);
}

if (networkType) {
  filters.push(`type = $${params.length + 1}`);
  params.push(networkType);
}

const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
const result = await query(
  `SELECT * FROM networks ${whereClause}`,
  params
);
```

### Dynamic ORDER BY
```javascript
// Whitelist allowed sort columns
const allowedSortColumns = ['last_seen', 'rssi', 'bssid'];
const sortColumn = allowedSortColumns.includes(sort) ? sort : 'last_seen';

// Safe: sortColumn is whitelisted, not user input
const result = await query(
  `SELECT * FROM networks ORDER BY ${sortColumn} ${order}`,
  []
);
```

## Security Checklist

When adding new endpoints:

- [ ] All user input is passed via query parameters array (`$1`, `$2`, etc.)
- [ ] No string interpolation or concatenation in SQL
- [ ] LIKE patterns use `escapeLike()` utility
- [ ] Dynamic ORDER BY uses whitelist
- [ ] Input validation schema defined
- [ ] Tests include SQL injection attempts
- [ ] Code review completed

## See Also

- [Input Validation Guide](../guides/VALIDATION_IMPLEMENTATION_GUIDE.md)
- [Error Handling Guide](../guides/ERROR_HANDLING_GUIDE.md)
- [Security Policy](../../SECURITY.md)
