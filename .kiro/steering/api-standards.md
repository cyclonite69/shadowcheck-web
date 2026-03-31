---
inclusion: always
---

# ShadowCheck — API Standards

## Route Organization

Routes live in `server/src/api/routes/` with two versions:

- `v1/`: Primary API surface (~30 route files covering all domains)
- `v2/`: Filtered/paginated endpoints (networks, threats, filtered analytics)

Routes are mounted in `server/src/utils/routeMounts.ts` via `mountApiRoutes()`.

## Authentication Gates

All routes pass through an API gate controlled by `API_GATE_ENABLED` (default: `true`):

- `userGate` (`requireAuth`): Applied to most data endpoints
- `adminGate` (`requireAdmin`): Applied to admin, backup, ML, settings, import endpoints
- Public (no gate): `/health`, `/api/auth/*`, agency offices, federal courthouses

Auth uses session-based tokens. Token extraction order:

1. `session_token` cookie (preferred)
2. `Authorization: Bearer <token>` header (fallback)

## Health Endpoint

`GET /health` — always public, returns structured health check:

```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "ISO-8601",
  "uptime": 12345,
  "checks": {
    "database": { "status": "ok", "latency_ms": 2 },
    "secrets": { "status": "ok", "required_count": 2, "loaded_count": 2 },
    "memory": { "status": "ok", "heap_used_mb": 85, "heap_max_mb": 256 }
  }
}
```

- Returns 200 for healthy/degraded, 503 for unhealthy
- `db_password` is the only critical secret; `mapbox_token` absence degrades but doesn't fail
- Memory warning triggers at >80% heap usage
- Docker healthcheck hits this endpoint every 30s

## Response Conventions

- Success: return JSON body directly (no envelope wrapper)
- Paginated lists include: `{ networks: [...], total, count, limit, offset }`
- Errors: `{ error: "message", code: "ERROR_CODE" }` with appropriate HTTP status
- Auth errors use codes: `NO_TOKEN`, `INVALID_SESSION`, `AUTH_ERROR`, `ADMIN_REQUIRED`

## Route Configuration Limits

Defined in `server/src/config/routeConfig.ts`:

| Context            | Default Limit | Max Limit |
| ------------------ | ------------- | --------- |
| Filtered endpoints | 500           | 5,000     |
| Geospatial         | 5,000         | 500,000   |
| Observations       | 500,000       | 1,000,000 |
| Networks (v1)      | 100           | 1,000     |
| Explorer           | 500           | 5,000     |
| Kepler             | No limit      | No limit  |

Kepler endpoints intentionally have no default caps — filters are used instead.

## Query Parameterization

All database queries must use parameterized queries (`$1`, `$2`, etc.). String interpolation
of user input into SQL is forbidden. The `BaseRepository` enforces column/table whitelists.
Sort columns and directions are validated against allowlists before use.

Important: the `r` alias in filter query builder SQL means different things in different
query paths (`obs_rollup` in network slow path vs simple `rollup` in geospatial path).
Observation count filtering uses `ne.observations` from the materialized view, which is
available in all query paths. Never reference `r.observation_count` in shared WHERE builders.

## Slow Query Tracking

Configurable thresholds via env vars:

- `SLOW_FILTERED_TOTAL_MS`: 1000ms (total request time)
- `SLOW_FILTERED_QUERY_MS`: 500ms (individual query time)
- `SLOW_GEOSPATIAL_QUERY_MS`: 2000ms

## API Client (Frontend)

`client/src/api/client.ts` provides a centralized `ApiClient` class:

- Base URL: `VITE_API_URL` or `/api`
- 120s request timeout (double the backend statement timeout)
- Credentials: `include` (for session cookies)
- Domain-specific modules: `networkApi.ts`, `adminApi.ts`, `analyticsApi.ts`, etc.

## Adding a New Route

1. Create route file in `server/src/api/routes/v1/` (or `v2/`)
2. Export an Express Router
3. Add to `server/src/utils/serverDependencies.ts` (loadRouteModules)
4. Add to `server/src/utils/routeMounts.ts` (mountApiRoutes) with appropriate gate
5. Add client API module in `client/src/api/` if needed
