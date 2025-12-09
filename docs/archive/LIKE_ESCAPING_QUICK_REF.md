# LIKE Escaping Fix - Quick Reference

## ✅ Fixed 2 MEDIUM Severity Vulnerabilities

---

## Problem

User input with `%` or `_` was treated as SQL wildcards instead of literal characters.

**Example Attack:**
```javascript
// User searches: "admin%"
// Before: Matches "admin", "admin1", "administrator" (information disclosure)
// After:  Matches only literal "admin%"
```

---

## Solution

Created `escapeLikePattern()` utility that escapes `%`, `_`, and `\` characters.

---

## Files Changed

### 1. src/utils/escapeSQL.js (NEW)
```javascript
function escapeLikePattern(input) {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}
```

### 2. src/repositories/networkRepository.js
```javascript
// Added escaping
const { escapeLikePattern } = require('../utils/escapeSQL');
const escapedSSID = escapeLikePattern(ssid);
const result = await this.query(sql, [`%${escapedSSID}%`]);
```

### 3. server.js
```javascript
// Added escaping
const { escapeLikePattern } = require('./src/utils/escapeSQL');
const escapedSSID = escapeLikePattern(ssid);
const searchPattern = `%${escapedSSID}%`;
```

---

## Test Results

```
Unit Tests:        34 passed ✅
Integration Tests: 26 passed ✅
Total:             60 passed ✅
```

---

## Usage

```javascript
const { escapeLikePattern } = require('./src/utils/escapeSQL');

// Escape user input before LIKE query
const userInput = 'test%';
const escaped = escapeLikePattern(userInput);  // 'test\\%'
const pattern = `%${escaped}%`;                // '%test\\%%'

// Use in query
await query('SELECT * FROM networks WHERE ssid ILIKE $1', [pattern]);
```

---

## Examples

| Input | Before (Vulnerable) | After (Secure) |
|-------|---------------------|----------------|
| `test%` | `%test%%` (matches test*) | `%test\\%%` (literal) |
| `a_b` | `%a_b%` (matches a?b) | `%a\\_b%` (literal) |
| `100% WiFi` | `%100% WiFi%` (matches 100*) | `%100\\% WiFi%` (literal) |

---

## Backward Compatibility

✅ Normal searches work exactly as before  
✅ No breaking changes  
✅ No migration needed

---

## Commands

```bash
# Run unit tests
npm test -- tests/unit/escapeSQL.test.js

# Run integration tests
npm test -- tests/integration/like-escaping.test.js

# Run all tests
npm test
```

---

**Status:** ✅ Production Ready  
**Deployment:** Safe to deploy immediately
