# Observability Implementation

**Date:** 2025-12-06  
**Status:** ✅ COMPLETE

## Overview

Added production-grade observability features:
1. **Health Check Endpoint** - For load balancers and orchestrators
2. **Request ID Middleware** - For distributed tracing and log correlation

## 1. Health Check Endpoint

### Endpoint
```
GET /health
```

### Response Format
```json
{
  "status": "healthy",
  "timestamp": "2025-12-06T05:15:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 5
    },
    "secrets": {
      "status": "ok",
      "required_count": 2,
      "loaded_count": 2
    },
    "keyring": {
      "status": "ok"
    },
    "memory": {
      "status": "ok",
      "heap_used_mb": 150,
      "heap_max_mb": 256
    }
  }
}
```

### Status Levels

| Status | HTTP Code | Meaning |
|--------|-----------|---------|
| `healthy` | 200 | All checks pass |
| `degraded` | 200 | Optional checks fail (keyring down, high memory) |
| `unhealthy` | 503 | Critical checks fail (database down, secrets missing) |

### Health Checks

#### 1. Database Check
- **Test:** `SELECT 1` query
- **Measures:** Connection latency in milliseconds
- **Critical:** Yes - returns 503 if fails

#### 2. Secrets Check
- **Test:** Verifies required secrets loaded
- **Required:** `db_password`, `mapbox_token`
- **Critical:** Yes - returns 503 if missing

#### 3. Keyring Check
- **Test:** Attempts to read from keyring
- **Critical:** No - returns degraded if fails (env vars still work)

#### 4. Memory Check
- **Test:** Heap usage percentage
- **Warning:** If >80% of heap used
- **Critical:** No - returns degraded if high

### Usage Examples

#### Kubernetes Liveness Probe
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
```

#### Docker Healthcheck
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

#### Load Balancer
```nginx
upstream shadowcheck {
  server app1:3001;
  server app2:3001;
}

# Health check
location /health {
  proxy_pass http://shadowcheck;
  proxy_connect_timeout 1s;
  proxy_read_timeout 1s;
}
```

#### Monitoring Script
```bash
#!/bin/bash
response=$(curl -s http://localhost:3001/health)
status=$(echo $response | jq -r '.status')

if [ "$status" != "healthy" ]; then
  echo "ALERT: Service is $status"
  echo $response | jq .
  exit 1
fi
```

## 2. Request ID Middleware

### Features
- Generates unique UUID for each request
- Accepts existing request ID from `X-Request-ID` header
- Adds `X-Request-ID` to response headers
- Attaches `requestId` and `startTime` to request object
- Included in error logs automatically

### Usage in Routes

```javascript
router.get('/api/example', async (req, res) => {
  const { requestId, startTime } = req;
  
  console.log(`[${requestId}] Processing request...`);
  
  try {
    const result = await someOperation();
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Completed in ${duration}ms`);
    res.json(result);
  } catch (err) {
    console.error(`[${requestId}] Error:`, err.message);
    throw err;
  }
});
```

### Error Responses

Errors automatically include request ID:

```json
{
  "error": {
    "message": "Network not found",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Log Correlation

All error logs include request ID:

```
[550e8400-e29b-41d4-a716-446655440000] Error: Network not found
[550e8400-e29b-41d4-a716-446655440000] Error details: {...}
```

### Distributed Tracing

Pass request ID between services:

```javascript
// Service A
const response = await fetch('http://service-b/api/data', {
  headers: {
    'X-Request-ID': req.requestId
  }
});

// Service B receives same request ID
// Logs from both services can be correlated
```

### Client Usage

Clients can provide their own request IDs:

```bash
curl -H "X-Request-ID: my-custom-id-123" http://localhost:3001/api/networks
```

Response will include the same ID:

```
X-Request-ID: my-custom-id-123
```

## Implementation Details

### Files Created
1. `src/api/routes/v1/health.js` - Health check endpoint
2. `src/middleware/requestId.js` - Request ID middleware
3. `tests/unit/health.test.js` - Health endpoint tests (6 tests)
4. `tests/unit/requestId.test.js` - Middleware tests (5 tests)

### Files Modified
1. `server.js` - Added middleware and health route
2. `utils/errorHandler.js` - Include request ID in error logs

### Test Coverage
```
Health Check: 6/6 tests passing
Request ID:   5/5 tests passing
Total:        11/11 tests passing
```

## Monitoring Integration

### Prometheus Metrics (Future Enhancement)

```javascript
// Example metrics endpoint
GET /metrics

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/networks",status="200"} 1234

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 850
http_request_duration_seconds_bucket{le="0.5"} 1200
```

### Logging Best Practices

```javascript
// Good: Include request ID
console.log(`[${req.requestId}] User query: ${query}`);

// Good: Include timing
const duration = Date.now() - req.startTime;
console.log(`[${req.requestId}] Query completed in ${duration}ms`);

// Good: Structured logging
console.log(JSON.stringify({
  requestId: req.requestId,
  method: req.method,
  path: req.path,
  duration,
  status: res.statusCode
}));
```

## Performance Impact

- **Health Check:** ~5-10ms per request (database query)
- **Request ID:** <1ms per request (UUID generation)
- **Memory:** Negligible (~100 bytes per request)

## Security Considerations

1. **Health Endpoint:** No authentication required (safe to expose)
   - Returns no sensitive data
   - Only status information
   - Can be rate-limited if needed

2. **Request IDs:** Safe to expose
   - UUIDs are not predictable
   - No sensitive information
   - Useful for support/debugging

## Next Steps (Optional Enhancements)

1. **Metrics Endpoint** - Prometheus-compatible metrics
2. **Structured Logging** - JSON logs with request context
3. **APM Integration** - New Relic, Datadog, etc.
4. **Custom Health Checks** - Add application-specific checks
5. **Performance Monitoring** - Track response times per endpoint

## Troubleshooting

### Health Check Returns 503

**Database Error:**
```json
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "error",
      "error": "Connection refused"
    }
  }
}
```
**Fix:** Check database connection, credentials, network

**Secrets Missing:**
```json
{
  "status": "unhealthy",
  "checks": {
    "secrets": {
      "status": "error",
      "required_count": 2,
      "loaded_count": 1
    }
  }
}
```
**Fix:** Ensure all required secrets are configured

### Request IDs Not Appearing

**Check middleware order:**
```javascript
// Request ID must be FIRST
app.use(requestIdMiddleware);
app.use(otherMiddleware);
```

**Check error handler:**
```javascript
// Error handler must use req.requestId
console.error(`[${req.requestId}] Error:`, err);
```

## Conclusion

Both observability features are production-ready and provide:

1. **Reliability** - Health checks for orchestration
2. **Debuggability** - Request IDs for log correlation
3. **Monitoring** - Foundation for metrics and APM
4. **Operations** - Better incident response and troubleshooting

**Status:** ✅ Ready for production deployment
