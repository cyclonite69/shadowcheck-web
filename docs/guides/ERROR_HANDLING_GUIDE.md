# Error Handling Implementation Guide

## Overview

ShadowCheckStatic now has a comprehensive typed error system that:

- Prevents information disclosure in production
- Provides consistent error responses
- Integrates with structured logging
- Differentiates between client and server errors
- Never exposes sensitive details (stack traces, SQL queries, etc.) to users

## Error Class Hierarchy

```
AppError (base)
├── ValidationError (400)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── ConflictError (409)
├── DuplicateError (409)
├── InvalidStateError (409)
├── RateLimitError (429)
├── BusinessLogicError (422)
├── DatabaseError (500)
├── QueryError (500)
├── ExternalServiceError (502/503)
└── TimeoutError (504)
```

## Quick Usage Examples

### Validation Error

```javascript
const { ValidationError } = require('../errors/AppError');

// In route handler
if (!bssid) {
  throw new ValidationError('BSSID is required', [
    { parameter: 'bssid', error: 'Must not be empty' },
  ]);
}
```

### Not Found Error

```javascript
const { NotFoundError } = require('../errors/AppError');

const network = await query('SELECT * FROM networks WHERE bssid = $1', [bssid]);
if (!network.rows.length) {
  throw new NotFoundError('Network');
}
```

### Database Error

```javascript
const { DatabaseError } = require('../errors/AppError');

try {
  await query('UPDATE networks SET ...');
} catch (error) {
  throw new DatabaseError(error, 'Failed to update network');
}
```

### Duplicate Error

```javascript
const { DuplicateError } = require('../errors/AppError');

const existing = await query('SELECT * FROM networks WHERE bssid = $1', [bssid]);
if (existing.rows.length > 0) {
  throw new DuplicateError('Network', bssid);
}
```

### Business Logic Error

```javascript
const { BusinessLogicError } = require('../errors/AppError');

if (network.threat_score > 90 && !authorized) {
  throw new BusinessLogicError('Cannot tag high-threat networks without authorization');
}
```

## Error Response Format

### Validation Error (400)

```json
{
  "ok": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "details": [
      {
        "parameter": "bssid",
        "error": "BSSID must be a MAC address"
      }
    ]
  }
}
```

### Not Found Error (404)

```json
{
  "ok": false,
  "error": {
    "message": "Network not found",
    "code": "NOT_FOUND",
    "statusCode": 404
  }
}
```

### Database Error (500) - Production

```json
{
  "ok": false,
  "error": {
    "message": "A database error occurred. Please try again later.",
    "code": "DATABASE_ERROR",
    "statusCode": 500
  }
}
```

### Database Error (500) - Development

```json
{
  "ok": false,
  "error": {
    "message": "Failed to update network",
    "code": "DATABASE_ERROR",
    "statusCode": 500,
    "database": {
      "code": "23505",
      "detail": "duplicate key value violates unique constraint"
    }
  }
}
```

### Rate Limit Error (429)

```json
{
  "ok": false,
  "error": {
    "message": "Too many requests. Please try again after 60 seconds.",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "retryAfter": 60
  }
}
```

## Implementation Checklist

### Step 1: Update server.js

Replace the old error handler:

```javascript
// OLD
const errorHandler = require('./utils/errorHandler');
app.use(errorHandler);

// NEW
const { createErrorHandler, notFoundHandler, asyncHandler } = require('./src/errors/errorHandler');
const logger = require('./src/logging/logger'); // (See Phase 4)

// Register 404 handler before error handler
app.use(notFoundHandler);

// Register error handler at the end
app.use(createErrorHandler(logger));
```

### Step 2: Update Route Handlers

Wrap route handlers with asyncHandler:

```javascript
// OLD
app.get('/api/networks/:bssid', async (req, res, next) => {
  try {
    // logic
  } catch (err) {
    next(err);
  }
});

// NEW
app.get(
  '/api/networks/:bssid',
  asyncHandler(async (req, res) => {
    // logic - errors automatically caught and passed to error handler
  })
);
```

### Step 3: Throw Typed Errors in Handlers

```javascript
const { ValidationError, NotFoundError, DatabaseError } = require('../errors/AppError');
const { asyncHandler } = require('../errors/errorHandler');

app.get(
  '/api/tag-network/:bssid',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { tag_type, confidence } = req.body;

    // Validation
    if (!tag_type) {
      throw new ValidationError('Tag type is required');
    }

    // Check if exists
    const network = await query('SELECT * FROM networks WHERE bssid = $1', [req.params.bssid]);
    if (!network.rows.length) {
      throw new NotFoundError('Network');
    }

    // Database operation
    try {
      const result = await query('INSERT INTO network_tags (bssid, tag_type) VALUES ($1, $2)', [
        req.params.bssid,
        tag_type,
      ]);
      res.json({ ok: true, tag: result.rows[0] });
    } catch (error) {
      throw new DatabaseError(error, 'Failed to tag network');
    }
  })
);
```

## Safe Error Messages

The error system automatically provides safe user-facing messages:

```javascript
const error = new DatabaseError(pgError);
console.log(error.message); // "A database error occurred. Please try again later."
console.log(error.getUserMessage()); // Same as above
```

Never expose:

- ❌ Stack traces
- ❌ SQL queries
- ❌ Database table/column names
- ❌ File paths
- ❌ System configuration
- ❌ API keys or credentials

Always provide:

- ✅ User-friendly error message
- ✅ Error code for debugging
- ✅ HTTP status code
- ✅ Validation details (for 400 errors)

## Best Practices

1. **Throw typed errors, not generic Error**

   ```javascript
   // ❌ Bad
   throw new Error('Network not found');

   // ✅ Good
   throw new NotFoundError('Network');
   ```

2. **Include context when throwing**

   ```javascript
   // ✅ Good
   throw new DatabaseError(pgError, 'Failed to update network threat score');
   ```

3. **Use asyncHandler for all async routes**

   ```javascript
   // ❌ Bad - manual try/catch
   app.get('/api/data', async (req, res, next) => {
     try {
       // ...
     } catch (err) {
       next(err);
     }
   });

   // ✅ Good - automatic error catching
   app.get(
     '/api/data',
     asyncHandler(async (req, res) => {
       // ...
     })
   );
   ```

4. **Validate early**

   ```javascript
   // Validation errors should occur before database operations
   app.post(
     '/api/networks',
     validateBody({ bssid: validateBSSID }),
     asyncHandler(async (req, res) => {
       // Body already validated, safe to use
     })
   );
   ```

5. **Catch and re-throw database errors**
   ```javascript
   try {
     await query(sql, params);
   } catch (error) {
     // Never let raw database errors reach the user
     throw new DatabaseError(error);
   }
   ```

## Migration Guide

### Migrating Existing Error Handling

Before:

```javascript
app.get('/api/networks', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM networks');
    res.json(rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});
```

After:

```javascript
app.get(
  '/api/networks',
  asyncHandler(async (req, res) => {
    const { rows } = await query('SELECT * FROM networks');
    res.json(rows);
  })
);
// Errors automatically caught, logged, and formatted
```

## Error Logging

Errors are automatically logged based on severity:

- **500+ (Server Errors)**: Full stack trace and details
- **400-499 (Client Errors)**: Warning level, minimal details
- **Other**: Debug level

Log format includes:

- Timestamp
- Error code
- Status code
- Message
- Path and method
- User ID
- Request ID
- Stack trace (dev only)

## Custom Error Types

Add new error types by extending AppError:

```javascript
class PaymentError extends AppError {
  constructor(message, paymentId) {
    super(message, 402, 'PAYMENT_ERROR');
    this.paymentId = paymentId;
  }

  getUserMessage() {
    return 'Payment processing failed. Please try again.';
  }
}
```

## Testing Errors

Example test for error handling:

```javascript
test('returns 404 when network not found', async () => {
  const response = await request(app).get('/api/networks/invalid-bssid').expect(404);

  expect(response.body).toEqual({
    ok: false,
    error: {
      message: 'Network not found',
      code: 'NOT_FOUND',
      statusCode: 404,
    },
  });
});

test('returns validation error with details', async () => {
  const response = await request(app)
    .post('/api/tag-network')
    .send({ bssid: 'invalid' })
    .expect(400);

  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(response.body.error.details).toBeDefined();
});
```

## Summary

The new error handling system provides:

1. **Security**: No sensitive information exposed to users
2. **Consistency**: All errors follow the same format
3. **Debugging**: Clear error codes and detailed logging
4. **User Experience**: Helpful, non-technical error messages
5. **Maintainability**: Easy to add new error types
6. **Integration**: Works with structured logging (Phase 4)

Next steps:

- Implement structured logging (Phase 4)
- Add comprehensive tests for error scenarios
- Document API error responses
- Update frontend error handling
