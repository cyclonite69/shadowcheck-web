# Modular Architecture Implementation Guide

## Overview

ShadowCheckStatic now implements a modern, maintainable modular architecture that separates concerns and promotes code reusability. This guide documents the new structure and how to extend it.

## Architecture Layers

```
Request
   ↓
[Middleware Layer]
 ├─ Auth
 ├─ Validation
 ├─ Logging
 └─ Error Handling
   ↓
[Route Layer] (src/api/routes/v1/*)
 ├─ Receives request
 ├─ Validates input
 ├─ Calls service
 └─ Formats response
   ↓
[Service Layer] (src/services/*)
 ├─ Business logic
 ├─ Data transformation
 ├─ Error handling
 └─ External calls
   ↓
[Data Layer] (src/config/database.js)
 ├─ Query execution
 ├─ Connection management
 └─ Retry logic
   ↓
Database
```

## Directory Structure

```
src/
├── api/
│   └── routes/
│       └── v1/
│           ├── analytics.js      (NEW - modular)
│           ├── dashboard.js      (existing - modular)
│           ├── threats.js        (existing - modular)
│           ├── settings.js
│           ├── export.js
│           ├── backup.js
│           └── location-markers.js
├── services/
│   ├── analyticsService.js       (NEW - business logic)
│   ├── dashboardService.js       (existing)
│   ├── threatService.js          (future)
│   └── enrichmentService.js      (future)
├── errors/
│   ├── AppError.js               (Phase 3)
│   └── errorHandler.js
├── validation/
│   ├── schemas.js                (Phase 2)
│   └── middleware.js
├── logging/
│   ├── logger.js                 (Phase 4)
│   └── middleware.js
├── config/
│   ├── database.js               (Phase 5 - unified)
│   ├── environment.js            (Phase 5)
│   └── container.js              (dependency injection)
└── repositories/
    ├── baseRepository.js         (future)
    └── networkRepository.js      (future)
```

## New Modules Created

### 1. Analytics Service (`src/services/analyticsService.js`)

Encapsulates all analytics business logic:

```javascript
const analyticsService = require('./src/services/analyticsService');

// Individual functions
const networkTypes = await analyticsService.getNetworkTypes();
const signalDist = await analyticsService.getSignalStrengthDistribution();
const temporal = await analyticsService.getTemporalActivity(minTs);
const radioOverTime = await analyticsService.getRadioTypeOverTime('7d', minTs);
const security = await analyticsService.getSecurityDistribution();
const topNetworks = await analyticsService.getTopNetworks(100);
const dashStats = await analyticsService.getDashboardStats();

// Combined for initial load
const allData = await analyticsService.getBulkAnalytics();
```

**Benefits**:
- ✅ Reusable from multiple endpoints
- ✅ Testable in isolation
- ✅ Consistent error handling
- ✅ Easy to cache results
- ✅ Clear data transformations

### 2. Analytics Routes (`src/api/routes/v1/analytics.js`)

Thin route handlers that:
1. Validate input
2. Call service
3. Format response
4. Handle errors

```javascript
router.get('/network-types', asyncHandler(async (req, res) => {
  const data = await analyticsService.getNetworkTypes();
  res.json({ ok: true, data });
}));
```

**Benefits**:
- ✅ Clean, readable routes
- ✅ Consistent error handling via asyncHandler
- ✅ Automatic logging
- ✅ Input validation
- ✅ Easy to test

## Integration Pattern

### How to Add a New Modular Route

#### Step 1: Create Service Function

```javascript
// src/services/myNewService.js
async function getMyData(filters) {
  try {
    const { rows } = await query('SELECT * FROM app.table WHERE ...');
    return rows.map(row => transformRow(row));
  } catch (error) {
    throw new DatabaseError(error, 'Failed to get my data');
  }
}

module.exports = {
  getMyData,
};
```

#### Step 2: Create Route Handler

```javascript
// src/api/routes/v1/mynew.js
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../../errors/errorHandler');
const { ValidationError } = require('../../../errors/AppError');
const service = require('../../../services/myNewService');

router.get('/data', asyncHandler(async (req, res) => {
  req.logger?.info('Getting my data');
  const data = await service.getMyData(req.query.filters);
  res.json({ ok: true, data });
}));

module.exports = router;
```

#### Step 3: Register in server.js

```javascript
// In server.js, add after other route registrations
const myNewRoutes = require('./src/api/routes/v1/mynew');
app.use('/api/mynew', myNewRoutes);
```

#### Step 4: Test

```bash
curl http://localhost:3001/api/mynew/data
```

## Service Layer Best Practices

### ✅ DO

1. **Handle errors properly**
   ```javascript
   try {
     const result = await query(sql, params);
     return result;
   } catch (error) {
     throw new DatabaseError(error, 'User message');
   }
   ```

2. **Use consistent naming**
   ```javascript
   async function getThingById(id) { ... }
   async function listThings(filters) { ... }
   async function createThing(data) { ... }
   async function updateThing(id, data) { ... }
   async function deleteThing(id) { ... }
   ```

3. **Return clean data**
   ```javascript
   return rows.map(row => ({
     id: row.id,
     name: row.name,
     // Don't return internal fields
   }));
   ```

4. **Document with JSDoc**
   ```javascript
   /**
    * Get networks by type
    * @param {string} type - Network type filter
    * @param {number} limit - Results limit (default: 100)
    * @returns {Promise<Array>} Formatted network data
    */
   async function getNetworksByType(type, limit = 100) { ... }
   ```

### ❌ DON'T

1. **Don't expose database errors to routes**
   ```javascript
   // ❌ Bad
   throw error; // Raw database error
   
   // ✅ Good
   throw new DatabaseError(error, 'Friendly message');
   ```

2. **Don't mix concerns**
   ```javascript
   // ❌ Bad - mixing HTTP concerns
   res.json({ data });
   
   // ✅ Good - just return data
   return rows;
   ```

3. **Don't hardcode values**
   ```javascript
   // ❌ Bad
   const limit = 100;
   
   // ✅ Good
   const limit = config.DEFAULT_LIMIT;
   ```

4. **Don't ignore errors silently**
   ```javascript
   // ❌ Bad
   const result = await query(...).catch(() => null);
   
   // ✅ Good
   try {
     return await query(...);
   } catch (error) {
     throw new DatabaseError(error, 'Clear message');
   }
   ```

## Testing Modular Routes

### Unit Test Example

```javascript
const analyticsService = require('./src/services/analyticsService');
const { DatabaseError } = require('./src/errors/AppError');

describe('Analytics Service', () => {
  test('getNetworkTypes returns array', async () => {
    const result = await analyticsService.getNetworkTypes();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty('type');
    expect(result[0]).toHaveProperty('count');
  });

  test('getNetworkTypes handles database errors', async () => {
    // Mock database to fail
    jest.mock('../config/database', () => ({
      query: jest.fn().mockRejectedValue(new Error('DB error')),
    }));

    await expect(analyticsService.getNetworkTypes()).rejects.toThrow(DatabaseError);
  });
});
```

### Integration Test Example

```javascript
const request = require('supertest');
const app = require('./server');

describe('Analytics Routes', () => {
  test('GET /api/analytics/network-types returns 200', async () => {
    const response = await request(app)
      .get('/api/analytics/network-types')
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('Handles service errors gracefully', async () => {
    // Mock service to fail
    jest.mock('../services/analyticsService', () => ({
      getNetworkTypes: jest.fn().mockRejectedValue(new DatabaseError(...)),
    }));

    const response = await request(app)
      .get('/api/analytics/network-types')
      .expect(500);

    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe('DATABASE_ERROR');
  });
});
```

## Scaling the Architecture

### Adding a New Service

As the application grows, add new service modules for each major feature:

```
src/services/
├── analyticsService.js      ✅ Done
├── threatService.js         (future - threat scoring)
├── enrichmentService.js     (future - address enrichment)
├── networkService.js        (future - network CRUD)
├── observationService.js    (future - observation data)
└── authService.js           (future - authentication)
```

### Adding a Repository Layer

For complex data access patterns, add repositories:

```
src/repositories/
├── baseRepository.js         (base class)
├── networkRepository.js      (network CRUD)
├── observationRepository.js  (observation queries)
└── threatRepository.js       (threat queries)
```

### Dependency Injection Container

The existing `src/config/container.js` can be expanded:

```javascript
const container = {
  // Services
  analyticsService: analyticsService,
  threatService: threatService,
  
  // Repositories
  networkRepository: networkRepository,
  
  // Utilities
  logger: logger,
  config: CONFIG,
  
  // Factory method
  get(name) {
    return this[name];
  },
};
```

## Migration Checklist

### Phase 1: Analytics Module (✅ COMPLETE)
- [x] Create analyticsService.js
- [x] Create analytics.js routes
- [x] Documentation

### Phase 2: Threat Module (Future)
- [ ] Create threatService.js
- [ ] Extract threat logic from server.js
- [ ] Create threats.js routes
- [ ] Update server.js to use modular routes

### Phase 3: Network Module (Future)
- [ ] Create networkService.js
- [ ] Create networks.js routes
- [ ] Create networkRepository.js

### Phase 4: Observation Module (Future)
- [ ] Create observationService.js
- [ ] Extract observation queries

### Complete Modernization
- [ ] All legacy logic moved to services
- [ ] All routes modular
- [ ] server.js contains only middleware and route registration
- [ ] All logic in services and repositories

## Benefits of Modular Architecture

✅ **Maintainability**: Clear separation of concerns
✅ **Testability**: Each module can be tested independently
✅ **Reusability**: Services used by multiple routes
✅ **Scalability**: Easy to add new features
✅ **Readability**: Clear data flow and responsibility
✅ **Performance**: Easy to optimize individual services
✅ **Error Handling**: Consistent error management
✅ **Logging**: Centralized, structured logging

## Example: Comparing Old vs New

### Old (Monolithic)

```javascript
// server.js - 2000+ lines
app.get('/api/analytics/network-types', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT CASE WHEN type = 'W' THEN 'WiFi'...
      FROM app.networks...
    `);
    // Transform logic here
    // More logic
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/analytics/signal-strength', async (req, res) => {
  // Duplicate structure, different query
  // 50+ lines of similar code
});

// ... 50+ more analytics endpoints
```

### New (Modular)

```javascript
// src/services/analyticsService.js
async function getNetworkTypes() {
  const { rows } = await query(`...`);
  return rows.map(row => ({...}));
}

// src/api/routes/v1/analytics.js
router.get('/network-types', asyncHandler(async (req, res) => {
  const data = await analyticsService.getNetworkTypes();
  res.json({ ok: true, data });
}));

// server.js
const analyticsRoutes = require('./src/api/routes/v1/analytics');
app.use('/api/analytics', analyticsRoutes);
```

## References

- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices
- Express.js Patterns: https://expressjs.com/
- Service Layer Pattern: https://martinfowler.com/bliki/ServiceLayer.html
- Dependency Injection: https://en.wikipedia.org/wiki/Dependency_injection

## Summary

The new modular architecture:
1. **Separates concerns** - Routes, services, data layer
2. **Improves testability** - Mock services independently
3. **Enables reuse** - Services called by multiple routes
4. **Scales easily** - Add new modules without touching old code
5. **Maintains consistency** - Shared error handling, logging, validation

This foundation enables ShadowCheckStatic to grow from a monolithic application to a well-structured, enterprise-grade system.
