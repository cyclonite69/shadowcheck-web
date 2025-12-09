# Observability Quick Reference

## Health Check

### Endpoint
```bash
GET /health
```

### Response
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2025-12-06T05:15:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": { "status": "ok", "latency_ms": 5 },
    "secrets": { "status": "ok", "required_count": 2, "loaded_count": 2 },
    "keyring": { "status": "ok" },
    "memory": { "status": "ok", "heap_used_mb": 150, "heap_max_mb": 256 }
  }
}
```

### Status Codes
- `200` - healthy or degraded
- `503` - unhealthy (database down, secrets missing)

### Kubernetes
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
```

### Docker
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

## Request IDs

### Automatic
Every request gets a unique UUID:
```
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000
```

### Custom
Provide your own:
```bash
curl -H "X-Request-ID: my-id-123" http://localhost:3001/api/networks
```

### In Routes
```javascript
router.get('/api/example', async (req, res) => {
  console.log(`[${req.requestId}] Processing...`);
  const duration = Date.now() - req.startTime;
  console.log(`[${req.requestId}] Done in ${duration}ms`);
});
```

### In Errors
Automatically included:
```json
{
  "error": {
    "message": "Not found",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### In Logs
```
[550e8400-e29b-41d4-a716-446655440000] Error: Network not found
```

## Monitoring

### Check Health
```bash
curl http://localhost:3001/health | jq .
```

### Monitor Logs
```bash
# Follow logs with request IDs
tail -f server.log | grep "\[.*\]"

# Find all logs for specific request
grep "550e8400-e29b-41d4-a716-446655440000" server.log
```

### Alert on Unhealthy
```bash
#!/bin/bash
status=$(curl -s http://localhost:3001/health | jq -r '.status')
if [ "$status" != "healthy" ]; then
  echo "ALERT: Service is $status"
  exit 1
fi
```

## Troubleshooting

### Health Check Fails

**Database error:**
```bash
curl http://localhost:3001/health | jq '.checks.database'
# Check connection, credentials
```

**Secrets missing:**
```bash
curl http://localhost:3001/health | jq '.checks.secrets'
# Verify secrets loaded
```

**High memory:**
```bash
curl http://localhost:3001/health | jq '.checks.memory'
# Restart or scale up
```

### Request ID Missing

**Check middleware order in server.js:**
```javascript
app.use(requestIdMiddleware); // Must be first
```

**Check error handler:**
```javascript
console.error(`[${req.requestId}] Error:`, err);
```

## Files

- `src/api/routes/v1/health.js` - Health endpoint
- `src/middleware/requestId.js` - Request ID middleware
- `utils/errorHandler.js` - Error handler with request IDs
- `OBSERVABILITY_IMPLEMENTATION.md` - Full documentation
