# Testing Strategy & Guidelines

This document outlines the testing strategy, practices, and guidelines for ShadowCheckStatic.

## Test Framework

The project uses **Jest** as the primary testing framework.

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Lint and format check
npm run lint
npm run format:check
```

## Test Structure

```
tests/
├── setup.ts                 # Test setup and configuration
├── sql-injection-fixes.test.ts
├── wigle-import-auth.test.js
├── api/
│   └── dashboard.test.ts   # API endpoint tests
├── helpers/
│   └── integrationEnv.ts    # Integration test helpers
├── integration/
│   ├── README.md           # Integration test documentation
│   ├── explorer-v2.test.ts
│   ├── like-escaping.test.ts
│   ├── networks-data-integrity.test.ts
│   ├── observability.test.ts
│   ├── route-refactoring-verification.test.ts
│   └── sql-injection-fixes.test.ts
└── unit/
    ├── escapeSQL.test.ts
    ├── filterQueryBuilder.test.ts
    ├── filters-systematic.test.ts
    ├── health.test.ts
    ├── observationCountMin-investigation.test.ts
    └── requestId.test.ts
```

## Test Types

### 1. Unit Tests (`tests/unit/`)

Unit tests verify individual functions and modules in isolation.

**Location**: `tests/unit/`

**Naming Convention**: `*.test.ts`

**Examples**:

- [`escapeSQL.test.ts`](tests/unit/escapeSQL.test.ts) - SQL escaping utilities
- [`filterQueryBuilder.test.ts`](tests/unit/filterQueryBuilder.test.ts) - Filter query builder
- [`health.test.ts`](tests/unit/health.test.ts) - Health check endpoints
- [`requestId.test.ts`](tests/unit/requestId.test.ts) - Request ID middleware

**Best Practices**:

- Mock external dependencies (database, file system, network calls)
- Test edge cases and error conditions
- Keep tests fast (< 100ms each)
- Use descriptive test names

### 2. Integration Tests (`tests/integration/`)

Integration tests verify the interaction between multiple components or API endpoints.

**Location**: `tests/integration/`

**Naming Convention**: `*.test.ts`

**Examples**:

- [`explorer-v2.test.ts`](tests/integration/explorer-v2.test.ts) - Explorer v2 functionality
- [`like-escaping.test.ts`](tests/integration/like-escaping.test.ts) - SQL LIKE escaping
- [`networks-data-integrity.test.ts`](tests/integration/networks-data-integrity.test.ts) - Data integrity
- [`observability.test.ts`](tests/integration/observability.test.ts) - Observability features
- [`route-refactoring-verification.test.ts`](tests/integration/route-refactoring-verification.test.ts) - Route tests
- [`sql-injection-fixes.test.ts`](tests/integration/sql-injection-fixes.test.ts) - SQL injection prevention

**See also**: [`integration/README.md`](tests/integration/README.md)

### 3. API Tests (`tests/api/`)

API tests verify REST endpoint behavior.

**Location**: `tests/api/`

**Examples**:

- [`dashboard.test.ts`](tests/api/dashboard.test.ts) - Dashboard API tests

### 4. Helper Files (`tests/helpers/`)

Utilities for test setup and configuration.

**Examples**:

- [`integrationEnv.ts`](tests/helpers/integrationEnv.ts) - Integration environment setup

## Test Configuration

### Jest Configuration

See [`jest.config.js`](jest.config.js) for Jest configuration.

```javascript
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  collectCoverageFrom: ['server/**/*.ts', '!server/**/*.d.ts'],
  coverageDirectory: 'coverage',
  // ... more config
};
```

### Test Setup

The [`tests/setup.ts`](tests/setup.ts) file contains:

- Mock setups- Global test configuration
- Environment variable defaults
- Database connection handling

## Writing Tests

### Unit Test Example

```typescript
import { escapeSQL } from '../server/src/utils/escapeSQL';

describe('escapeSQL', () => {
  it('should escape single quotes', () => {
    const input = "O'Reilly";
    const result = escapeSQL(input);
    expect(result).toBe("O''Reilly");
  });

  it('should escape percent and underscore for LIKE', () => {
    const input = '100%_match';
    const result = escapeSQL(input, true);
    expect(result).toBe('100\\%\\_match');
  });
});
```

### Integration Test Example

```typescript
import request from 'supertest';
import { createApp } from '../server/src/utils/appInit';

describe('Explorer API', () => {
  let app: Express.Application;

  beforeAll(async () => {
    app = await createApp();
  });

  it('should return networks with 200', async () => {
    const response = await request(app).get('/api/v1/explorer/networks').expect(200);

    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

## Coverage Requirements

| Type       | Minimum | Target |
| ---------- | ------- | ------ |
| Statements | 70%     | 80%    |
| Branches   | 60%     | 70%    |
| Functions  | 70%     | 80%    |
| Lines      | 70%     | 80%    |

Run `npm run test:cov` to generate coverage reports.

## Client-Side Tests

Client-side tests are located in:

- [`client/src/components/admin/hooks/__tests__/`](client/src/components/admin/hooks/__tests__/)

**Example**:

- [`useMLTraining.test.js`](client/src/components/admin/hooks/__tests__/useMLTraining.test.js)

## Security Testing

### SQL Injection Testing

Special attention is given to SQL injection prevention:

- [`sql-injection-fixes.test.ts`](tests/integration/sql-injection-fixes.test.ts)
- [`escapeSQL.test.ts`](tests/unit/escapeSQL.test.ts)

All user inputs must be properly escaped. See [`server/src/utils/escapeSQL.ts`](server/src/utils/escapeSQL.ts).

### API Security Tests

Test cases include:

- Authentication bypass attempts
- Authorization failures
- Input validation failures
- Rate limiting behavior

## Running Tests

### Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/filterQueryBuilder.test.ts

# Run with coverage
npm run test:cov

# Watch mode
npm test -- --watch

# Run integration tests only
npm test -- --testPathPattern=integration
```

### CI/CD Integration

Tests run automatically on:

- Pull requests
- Merges to main/develop branches
- See [`.circleci/config.yml`](.circleci/config.yml)

## Test Data Management

### Fixtures

Test fixtures are managed in:

- `tests/fixtures/` (if exists)
- Inline in test files
- Database seeding scripts

### Mock Data

Use mocking for:

- Database queries
- External API calls
- File system operations
- Network requests

## Best Practices

### DO

- ✅ Write tests before fixing bugs (TDD recommended)
- ✅ Use descriptive test names
- ✅ Test edge cases and error conditions
- ✅ Keep tests independent and isolated
- ✅ Use setup/teardown functions appropriately
- ✅ Aim for high coverage on critical paths

### DON'T

- ❌ Commit tests that fail
- ❌ Skip tests without a good reason
- ❌ Test implementation details (test behavior)
- ❌ Make tests dependent on execution order
- ❌ Use hardcoded environment values

## Debugging Tests

### Common Issues

1. **Timeout errors**: Increase timeout for slow operations

   ```typescript
   it('should handle slow query', async () => {
     jest.setTimeout(30000);
     // ...
   }, 30000);
   ```

2. **Database connection errors**: Ensure test database is running

   ```bash
   # Check database connection
   npm run docker:up
   ```

3. **Memory issues**: Run tests sequentially
   ```bash
   npm test -- --runInBand
   ```

## Continuous Integration

See the CI configuration:

- [`.circleci/config.yml`](.circleci/config.yml)
- [`.github/workflows/`](.github/workflows/)

## Related Documentation

- [Development Guide](DEVELOPMENT.md)
- [API Reference](API_REFERENCE.md)
- [Security Guidelines](SECURITY.md)
- [Database Schema](DATABASE_SCHEMA_ENTITIES.md)
