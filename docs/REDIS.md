# Redis Caching Implementation

## Overview

Redis is now integrated for API response caching, reducing database load and improving response times.

## Features

- **Automatic fallback**: Works without Redis (gracefully degrades)
- **60-second cache** on `/api/networks` endpoint
- **Works locally and on AWS**
- **Minimal memory**: 512MB limit with LRU eviction

## Setup

### Install Redis Client

```bash
npm install
```

### Start Redis (Local)

```bash
docker-compose up -d redis
```

Redis is already configured in `docker-compose.yml`.

### Start Redis (AWS)

Redis is included in `deploy/aws/docker/docker-compose.fullstack.yml`.

## Configuration

Environment variables (optional):

```bash
REDIS_HOST=localhost  # or shadowcheck_redis in Docker
REDIS_PORT=6379
```

## Usage

### Cached Endpoints

- `GET /api/networks` - 60 seconds

### Add Caching to More Endpoints

```typescript
import { cacheMiddleware } from '../../../middleware/cacheMiddleware';

// Cache for 5 minutes (300 seconds)
router.get('/api/analytics/temporal', cacheMiddleware(300), async (req, res) => {
  // Your handler
});
```

### Clear Cache

```typescript
import { cacheService } from '../services/cacheService';

// Clear specific key
await cacheService.del('api:/networks:{}');

// Clear all API cache
await cacheService.clear('api:*');
```

## Performance Impact

**Without Redis:**

- `/api/networks`: ~200-500ms (database query every time)

**With Redis:**

- First request: ~200-500ms (cache miss, query database)
- Subsequent requests: ~5-10ms (cache hit, from memory)

**Memory Usage:**

- ~512MB allocated
- Actual usage depends on cached data
- LRU eviction when full

## Monitoring

### Check Redis Status

```bash
# Local
docker exec shadowcheck_static_redis redis-cli ping

# AWS
docker exec shadowcheck_redis redis-cli ping
```

### View Cache Stats

```bash
docker exec shadowcheck_static_redis redis-cli INFO stats
```

### View Cached Keys

```bash
docker exec shadowcheck_static_redis redis-cli KEYS "api:*"
```

### Monitor Memory

```bash
docker exec shadowcheck_static_redis redis-cli INFO memory
```

## Troubleshooting

### Redis Not Connecting

Check logs:

```bash
docker logs shadowcheck_static_redis
docker logs shadowcheck_static_api | grep -i redis
```

The app will continue working without Redis (caching disabled).

### Clear All Cache

```bash
docker exec shadowcheck_static_redis redis-cli FLUSHALL
```

### Restart Redis

```bash
docker-compose restart redis
```

## Future Enhancements

Potential additions:

1. **Session storage** - User login sessions
2. **Rate limiting** - Per-IP request tracking
3. **More endpoints** - Cache analytics, threats, etc.
4. **Cache invalidation** - Clear cache on data updates
5. **Redis Cluster** - For high availability

## Disabling Redis

To disable Redis:

1. Remove from `docker-compose.yml`
2. Don't set `REDIS_HOST` environment variable
3. App will work normally without caching

## Notes

- Cache keys include query parameters (different filters = different cache)
- Only GET requests are cached
- POST/PUT/DELETE requests bypass cache
- Cache is in-memory (fast but volatile)
- Data persists to disk with AOF (survives restarts)
