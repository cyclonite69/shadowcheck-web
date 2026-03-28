# Development Guide

> **Complete guide for ShadowCheck development**

---

## Prerequisites

- **Node.js** 22+ (LTS recommended)
- **PostgreSQL** 18+ with PostGIS extension
- **Docker** (optional, for containerized development)
- **Git**

---

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/cyclonite69/shadowcheck-web.git
cd shadowcheck-web
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Secrets policy: do not create local .env files with credentials; use AWS Secrets Manager or explicit env-var overrides
docker compose up -d
```

### 4. Start Development

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run dev:frontend
```

---

## DevContainer Setup (Recommended)

### Prerequisites

- Docker Desktop
- VS Code with Dev Containers extension

### Steps

1. Open in DevContainer (VS Code will prompt)
2. Wait for container build
3. Start developing:
   ```bash
   npm run dev          # Backend (port 3001)
   npm run dev:frontend # Frontend (port 5173)
   ```

---

## Development Workflow

### Local Shell Helpers

To streamline local development, source the included helper aliases:

```bash
source ./scripts/local-dev-aliases.sh
```

**Common Tasks:**

- `scroot` - Repository root navigation.
- `sclocal` - Generic `docker compose` wrapper.
- `scapi` - Reset/rebuild API with AWS development defaults.
- `scgrafana` - Launch local monitoring stack.
- `scdb` - Connect to `shadowcheck_user` database.
- `scdba` - Connect to `shadowcheck_admin` database.

### Available Scripts

```bash
# Development

**Docs version (repo):** [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md)
npm run dev              # Backend with nodemon
npm run dev:frontend     # Frontend with Vite HMR

# Building
npm run build            # Build frontend and server
npm run build:frontend   # Build React app
npm run build:server     # Compile TypeScript

# Testing
npm test                 # Run all tests
npm run test:cov         # Tests with coverage
npm run test:integration # Integration tests only

# Code Quality
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix issues
npm run format:check     # Prettier check
npm run format           # Auto-format

# Docker
npm run docker:up        # Start containers
npm run docker:down      # Stop containers
```

---

## Adding a New API Endpoint

1. **Create route handler** in `server/src/api/routes/v1/`:

```typescript
// server/src/api/routes/v1/my-feature.ts
import { Router } from 'express';
import { container } from '../../../config/container';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const service = container.get('myService');
    const data = await service.getData();
    res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
```

2. **Add business logic** in `server/src/services/`:

```typescript
// server/src/services/myService.ts
export class MyService {
  async getData() {
    // Business logic here
  }
}
```

3. **Register in container**:

```typescript
// server/src/config/container.ts
container.register('myService', new MyService());
```

4. **Mount route** in server initialization

---

## Adding a Frontend Component

1. **Create component**:

```tsx
// client/src/components/MyComponent.tsx
import React from 'react';

export const MyComponent: React.FC = () => {
  return <div className="p-4">My Component</div>;
};
```

2. **Add route** in `App.tsx`:

```tsx
import { lazy } from 'react';
const MyComponent = lazy(() => import('./components/MyComponent'));

<Route path="/my-route" element={<MyComponent />} />;
```

3. **Add navigation link** in `Navigation.tsx`

---

## Database Management

### Common Operations

```bash
# Connect to database
docker exec -it postgres psql -U shadowcheck_user -d shadowcheck_db

# Run migration
docker exec -i postgres psql -U shadowcheck_user -d shadowcheck_db < sql/migrations/your_migration.sql

# Backup database
pg_dump -U shadowcheck_user -d shadowcheck_db -F c -f backup_$(date +%Y%m%d).dump
```

### Useful Queries

```sql
-- Count networks by type
SELECT type, COUNT(*) FROM public.networks GROUP BY type;

-- Recent observations
SELECT * FROM public.observations
WHERE time >= EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000
LIMIT 10;

-- Tagged networks
SELECT bssid, tag_type, confidence FROM app.network_tags;
```

---

## Testing

### Run Tests

```bash
# All tests
npm test

# Specific test
npm test -- tests/unit/your-test.test.js

# With coverage
npm run test:cov
```

### Writing Tests

```javascript
// tests/api/dashboard-metrics.test.js
const request = require('supertest');
const app = require('../../server');

describe('GET /api/dashboard-metrics', () => {
  it('should return dashboard metrics', async () => {
    const response = await request(app).get('/api/dashboard-metrics').expect(200);

    expect(response.body).toHaveProperty('totalNetworks');
  });
});
```

---

## Code Quality

### Pre-commit Hooks

Husky runs automatically for repo checks such as the secret-scan flow.

- ESLint
- Prettier

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

---

## Troubleshooting

### Database Connection Errors

```bash
# Verify Docker PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec postgres psql -U shadowcheck_user -d shadowcheck_db
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Memory Issues

```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

---

## Related Documentation

- [Architecture](Architecture) - System design
- [API Reference](API-Reference) - REST API documentation
- [Database](Database) - Schema reference
- [Troubleshooting](Troubleshooting) - Common issues
