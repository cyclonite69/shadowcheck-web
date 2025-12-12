# Input Validation Implementation Guide

## Overview

This guide documents the comprehensive input validation system created for ShadowCheckStatic. It provides:

- **Reusable validation functions** for all common parameter types
- **Express middleware** for automatic validation
- **Consistent error handling** across all endpoints

## Quick Start

### 1. Import Validation Modules

```javascript
const { validateBSSID, validatePagination, validateCoordinates } = require('../validation/schemas');
const { paginationMiddleware, bssidParamMiddleware } = require('../validation/middleware');
```

### 2. Apply Middleware to Routes

#### Simple Pagination Example

```javascript
// Before fix
app.get('/api/networks', async (req, res) => {
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);
  // Manual validation...
});

// After fix - Using middleware
app.get('/api/networks', paginationMiddleware(5000), async (req, res) => {
  // req.pagination = { page, limit, offset }
  const { rows } = await query(
    `
      SELECT * FROM app.networks
      LIMIT $1 OFFSET $2
    `,
    [req.pagination.limit, req.pagination.offset]
  );
});
```

#### Validating Path Parameters

```javascript
// Before fix - Manual validation in route
app.delete('/api/tag-network/:bssid', (req, res) => {
  const cleanBSSID = sanitizeBSSID(req.params.bssid);
  if (!cleanBSSID) {
    return res.status(400).json({ error: 'Invalid BSSID' });
  }
  // ... rest of handler
});

// After fix - Using middleware
app.delete('/api/tag-network/:bssid', bssidParamMiddleware, async (req, res) => {
  // req.params.bssid is already validated and sanitized
  const result = await query('DELETE FROM app.network_tags WHERE bssid = $1', [req.params.bssid]);
});
```

## Validation Schemas API

### BSSID Validation

```javascript
const result = validateBSSID('AA:BB:CC:DD:EE:FF');
// Returns: { valid: true, cleaned: 'AA:BB:CC:DD:EE:FF' }

const result = validateBSSID('invalid');
// Returns: { valid: false, error: 'BSSID must be...' }
```

### Pagination Validation

```javascript
const result = validatePagination(req.query.page, req.query.limit, 5000);
// Returns: { valid: true, page: 1, limit: 50 }
```

### Coordinates Validation

```javascript
const result = validateCoordinates(37.7749, -122.4194);
// Returns: { valid: true, lat: 37.7749, lon: -122.4194 }
```

### Tag Type Validation

```javascript
const result = validateTagType('threat');
// Returns: { valid: true, normalized: 'THREAT' }
```

### Time Range Validation (Analytics)

```javascript
const result = validateTimeRange('24h');
// Returns: { valid: true, value: '24h' }

const result = validateTimeRange('invalid');
// Returns: { valid: false, error: 'Range must be one of...' }
```

### Confidence/Severity Validation

```javascript
const result = validateConfidence(75.5);
// Returns: { valid: true, value: 75.5 }

const result = validateSeverity(150);
// Returns: { valid: false, error: 'Severity must be between 0 and 100' }
```

### Signal Strength Validation

```javascript
const result = validateSignalStrength(-65);
// Returns: { valid: true, value: -65 }
```

## Middleware API

### paginationMiddleware

Automatically validates page/limit parameters and attaches `req.pagination`

```javascript
app.get('/api/data', paginationMiddleware(1000), handler);
// req.pagination = { page, limit, offset }
```

### bssidParamMiddleware

Validates and sanitizes BSSID from path parameter

```javascript
app.get('/api/network/:bssid', bssidParamMiddleware, handler);
// req.params.bssid is sanitized
```

### coordinatesMiddleware

Validates latitude/longitude from body or query

```javascript
app.post('/api/location', coordinatesMiddleware('body'), handler);
// req.validated.latitude and req.validated.longitude are set
```

### sortMiddleware

Validates sort column and order

```javascript
const allowedColumns = {
  lastseen: 'n.last_seen',
  signal: 'n.bestlevel',
  ssid: 'n.ssid',
};

app.get('/api/networks', sortMiddleware(allowedColumns), handler);
// req.sorting = { column: 'n.last_seen', order: 'DESC' }
```

### sanitizeMiddleware

Removes dangerous characters from inputs

```javascript
app.use(sanitizeMiddleware);
```

### createParameterRateLimit

Rate-limits requests by specific parameter value

```javascript
// Limit to 100 requests per BSSID per 5 minutes
const bssidRateLimit = createParameterRateLimit('bssid', 100, 5 * 60 * 1000);

app.get('/api/observations/:bssid', bssidRateLimit, handler);
```

## Implementation Patterns

### Pattern 1: Query Parameter Validation

```javascript
const middleware = validateQuery({
  page: schemas.validatePagination,
  range: schemas.validateTimeRange,
});

app.get('/api/analytics', middleware, (req, res) => {
  // Use validated values
  const { page, range } = req.validated;
});
```

### Pattern 2: Body Parameter Validation

```javascript
const middleware = validateBody({
  bssid: schemas.validateBSSID,
  tag_type: schemas.validateTagType,
  confidence: schemas.validateConfidence,
});

app.post('/api/tag-network', middleware, (req, res) => {
  const { bssid, tag_type, confidence } = req.validated;
});
```

### Pattern 3: Combined Middleware Stack

```javascript
app.get(
  '/api/networks',
  sanitizeMiddleware, // Clean dangerous characters
  paginationMiddleware(5000), // Validate pagination
  sortMiddleware(columnMap), // Validate sorting
  async (req, res) => {
    // All inputs validated, ready to use
  }
);
```

## Error Response Format

All validation errors follow this format:

```json
{
  "ok": false,
  "error": "Validation failed",
  "details": [
    {
      "parameter": "page",
      "error": "Page must be a positive integer"
    },
    {
      "parameter": "limit",
      "error": "Limit cannot exceed 5000"
    }
  ]
}
```

## Adding Custom Validators

Create new validators by following this pattern:

```javascript
// In src/validation/schemas.js
function validateCustomType(value) {
  // Do validation logic
  if (valid) {
    return { valid: true, value: processedValue };
  }
  return { valid: false, error: 'Error message' };
}

module.exports = {
  // ... existing exports
  validateCustomType,
};
```

Then use it:

```javascript
const result = validateCustomType(someValue);
if (!result.valid) {
  return res.status(400).json({ ok: false, error: result.error });
}
const cleanValue = result.value;
```

## Best Practices

1. **Always validate external input** - Never trust user input
2. **Fail early** - Validate at the middleware level, before hitting database
3. **Provide clear error messages** - Help API consumers understand what went wrong
4. **Use specific validators** - More specific validators catch more edge cases
5. **Combine validators** - Use `combineValidations()` for multi-field validation
6. **Sanitize alongside validation** - Remove dangerous characters while validating
7. **Test validation** - Each validator should have corresponding tests

## Migration Guide

### Step 1: Add Middleware to Existing Routes

Gradually migrate existing routes to use validation middleware:

```javascript
// Old code
app.get('/api/networks', async (req, res) => {
  const page = parseInt(req.query.page);
  if (isNaN(page) || page <= 0) {
    return res.status(400).json({ error: 'Invalid page' });
  }
  // ...
});

// New code
app.get('/api/networks', paginationMiddleware(), async (req, res) => {
  const { page, limit, offset } = req.pagination;
  // ...
});
```

### Step 2: Update Route Handlers

Replace manual validation with validated parameters:

```javascript
// Before
const { bssid } = req.params;
const validation = sanitizeBSSID(bssid);
if (!validation) {
  return res.status(400).json({ error: 'Invalid BSSID' });
}
const cleanBSSID = validation;

// After
const { bssid } = req.params; // Already validated by middleware
```

## Checklist for Implementation

- [ ] Add validation middleware to `/api/networks` endpoint
- [ ] Add validation middleware to `/api/threats/quick` endpoint
- [ ] Add validation middleware to `/api/tag-network` endpoint
- [ ] Add validation middleware to `/api/location-markers` endpoint
- [ ] Add validation middleware to all analytics endpoints
- [ ] Add validation middleware to all export endpoints
- [ ] Create test suite for validation functions
- [ ] Create test suite for middleware
- [ ] Update API documentation with validation rules
- [ ] Train team on validation patterns
