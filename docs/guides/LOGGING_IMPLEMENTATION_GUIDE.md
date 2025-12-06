# Structured Logging Implementation Guide

## Overview

ShadowCheckStatic now implements enterprise-grade structured logging with Winston that provides:
- **Multiple transports**: Console, file, error-specific files
- **Log levels**: error, warn, info, http, debug
- **Structured JSON format**: Machine-readable, queryable logs
- **Request tracing**: Unique ID per request across all logs
- **Security auditing**: Track data access and suspicious activity
- **Performance monitoring**: Identify slow requests automatically

## Architecture

### Log Files
```
data/logs/
├── error.log       - Only errors (5MB max, keeps 5 files)
├── combined.log    - All logs (5MB max, keeps 5 files)
└── debug.log       - Debug level and above (5MB max, keeps 5 files)
```

### Log Levels (in order of severity)
1. **error** (0) - Fatal issues requiring immediate attention
2. **warn** (1) - Warnings, security events, slow requests
3. **info** (2) - General information, API calls, data access
4. **http** (3) - HTTP request/response details
5. **debug** (4) - Detailed debugging information

## Installation

### Step 1: Update package.json

Add required dependencies:
```bash
npm install winston uuid
```

This adds:
- `winston@^3.11.0` - Logging library
- `uuid@^9.0.0` - Request ID generation

### Step 2: File Structure

```
src/
├── logging/
│   ├── logger.js       - Winston configuration
│   └── middleware.js   - Logging middleware
├── errors/
├── validation/
```

## Usage

### Basic Logging

```javascript
const logger = require('./src/logging/logger');

logger.error('Something went wrong', { detail: 'extra info' });
logger.warn('Warning message');
logger.info('Information message');
logger.http('HTTP event');
logger.debug('Debug information');
```

### Request-Scoped Logging

Each request automatically gets a unique ID and scoped logger:

```javascript
app.use(requestIdMiddleware);

app.get('/api/networks', (req, res) => {
  // req.id - unique request ID
  // req.logger - logger with this request's ID in all logs
  
  req.logger.info('Processing network list request');
  req.logger.debug('Query parameters:', req.query);
});
```

### Security Event Logging

```javascript
const { logSecurityEvent } = require('./src/logging/middleware');

app.post('/api/login', (req, res) => {
  if (failedAttempts > 3) {
    logSecurityEvent(req, 'Failed login attempts', {
      attempts: failedAttempts,
      userId: req.body.username,
    });
  }
});
```

### Database Query Logging

```javascript
const { logQuery, logQueryError } = require('./src/logging/middleware');

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    logQuery(text, params, Date.now() - start);
    return result;
  } catch (error) {
    logQueryError(text, params, error);
    throw error;
  }
}
```

### Performance Monitoring

```javascript
const { performanceMiddleware } = require('./src/logging/middleware');

// Log requests taking longer than 2 seconds
app.use(performanceMiddleware(2000));
```

### Data Access Logging (Compliance)

```javascript
const { logDataAccess } = require('./src/logging/middleware');

app.get('/api/networks', (req, res) => {
  const networks = await query('SELECT * FROM networks');
  logDataAccess(req, 'networks', 'SELECT', networks.length);
  res.json(networks);
});
```

## Integration with Error Handler

The logging system integrates seamlessly with the error handler from Phase 3:

```javascript
const { createErrorHandler } = require('./src/errors/errorHandler');
const logger = require('./src/logging/logger');

// Register at the end of middleware stack
app.use(createErrorHandler(logger));
```

Errors are automatically logged with:
- Stack traces (development only)
- Error codes
- HTTP status codes
- Request context (path, method, IP)
- Request ID for tracing

## Log Output Examples

### Console Output (Development)
```
2025-12-05 04:10:15 info: Server started on port 3001
2025-12-05 04:10:16 http: Incoming: GET /api/networks
2025-12-05 04:10:16 debug: Database query
2025-12-05 04:10:16 http: Response: GET /api/networks 200
```

### File Output (JSON Format)
```json
{
  "level": "error",
  "message": "Database query error: connection refused",
  "timestamp": "2025-12-05 04:10:16:123",
  "code": "ECONNREFUSED",
  "query": "SELECT * FROM networks WHERE...",
  "paramCount": 2,
  "detail": "connect ECONNREFUSED 127.0.0.1:5432"
}
```

## Configuration

### Environment Variables

```bash
# Set log level (default: info)
LOG_LEVEL=debug

# Production uses 'warn' to reduce log volume
LOG_LEVEL=warn

# Development uses 'debug' for detailed info
LOG_LEVEL=debug
```

### Log Retention

Files are automatically rotated:
- **Max file size**: 5MB
- **Max files per type**: 5 (oldest deleted when exceeded)
- **Total potential storage**: ~75MB

## Helper Methods

### Logger Instance Methods

```javascript
// Core logging
logger.error(msg, meta)
logger.warn(msg, meta)
logger.info(msg, meta)
logger.http(msg, meta)
logger.debug(msg, meta)

// Specialized helpers
logger.logRequest(req)          // Log incoming request
logger.logResponse(req, status, duration)  // Log response
logger.logQuery(query, params, duration)   // Log DB query
logger.logSecurityEvent(event, details)    // Log security event
logger.logPerformance(metric, value, unit) // Log metric
logger.createRequestLogger(id)  // Get request-scoped logger
```

### Middleware Functions

```javascript
requestIdMiddleware              // Adds request ID
requestLoggingMiddleware         // Logs req/res
performanceMiddleware(ms)        // Tracks slow requests
logSecurityEvent(req, event)     // Log security events
logQuery(query, params, ms)      // Log DB queries
logQueryError(query, params, err) // Log query errors
logDataAccess(req, resource, action, count) // Compliance logging
```

## Request ID Tracing

Every request gets a unique ID that:
1. Is generated or extracted from `X-Request-ID` header
2. Is available as `req.id`
3. Is included in response header `X-Request-ID`
4. Automatically included in all logs for that request

### Example: Tracing a Request Across Logs

Request arrives with ID `550e8400-e29b-41d4-a716-446655440000`:

```json
// Incoming request
{"requestId": "550e8400-e29b-41d4-a716-446655440000", "message": "Incoming: GET /api/networks", ...}

// Database query
{"requestId": "550e8400-e29b-41d4-a716-446655440000", "message": "Database query", ...}

// Response
{"requestId": "550e8400-e29b-41d4-a716-446655440000", "message": "Response: GET /api/networks 200", ...}
```

Grep all logs for this request: `grep "550e8400-e29b-41d4-a716-446655440000" data/logs/*.log`

## Best Practices

1. **Use appropriate log levels**
   ```javascript
   // ✅ Correct
   logger.error('Database connection failed');  // Server errors
   logger.warn('Slow query detected');          // Warnings
   logger.info('User logged in');               // Important events
   logger.debug('Processing filter parameter'); // Development info
   
   // ❌ Wrong
   logger.info('Database connection failed');   // Too verbose for prod
   logger.debug('User action');                 // Important info buried
   ```

2. **Include context in metadata**
   ```javascript
   // ✅ Good
   logger.warn('Failed login attempt', {
     userId: user.id,
     attempts: failCount,
     ip: req.ip,
   });
   
   // ❌ Bad
   logger.warn('Failed login');  // No context
   ```

3. **Never log sensitive data**
   ```javascript
   // ✅ Safe
   logger.info('User authenticated', { userId: user.id });
   
   // ❌ Dangerous
   logger.info('User authenticated', { password: user.password });
   ```

4. **Use request-scoped logger in routes**
   ```javascript
   // ✅ Good - includes request ID
   req.logger.info('Processing request', { query: req.query });
   
   // ❌ Bad - missing request ID
   logger.info('Processing request', { query: req.query });
   ```

5. **Log at entry and exit points**
   ```javascript
   app.post('/api/networks', asyncHandler(async (req, res) => {
     req.logger.info('Creating network');
     
     try {
       const network = await createNetwork(req.body);
       req.logger.info('Network created', { networkId: network.id });
       res.json(network);
     } catch (error) {
       req.logger.error('Network creation failed', { error: error.message });
       throw error;
     }
   }));
   ```

## Integration Checklist

- [ ] Add winston and uuid to package.json
- [ ] Create `src/logging/logger.js`
- [ ] Create `src/logging/middleware.js`
- [ ] Update `server.js` to use logging middleware
- [ ] Replace `console.log` with `logger.info`, `logger.debug`, etc.
- [ ] Add request ID middleware to beginning of middleware stack
- [ ] Add request logging middleware after request ID middleware
- [ ] Add performance monitoring middleware
- [ ] Integrate with error handler from Phase 3
- [ ] Test logging in development (check `data/logs/`)
- [ ] Configure LOG_LEVEL environment variable
- [ ] Document logging in API docs
- [ ] Set up log monitoring/analysis tool (optional)

## Monitoring and Analysis

### Common Log Queries

```bash
# Show all errors
grep '"level":"error"' data/logs/error.log

# Show all errors for a specific request
grep "550e8400-e29b-41d4-a716-446655440000" data/logs/combined.log

# Show slow requests
grep '"durationMs":' data/logs/combined.log | grep -v '"durationMs":0'

# Show security events
grep '"event":' data/logs/combined.log

# Count requests by path
grep '"path":' data/logs/combined.log | sort | uniq -c
```

## Next Steps

After logging is integrated:
1. Monitor logs during development
2. Adjust log levels as needed
3. Add log analysis tools (ELK stack, Datadog, etc.)
4. Set up alerts for critical errors
5. Review logs weekly for security events
6. Archive old logs per retention policy

## Troubleshooting

### Logs not appearing

1. Check LOG_LEVEL environment variable
2. Verify `data/logs/` directory exists and is writable
3. Check file permissions: `ls -la data/logs/`
4. Verify middleware is registered in correct order

### Disk space issues

1. Check log file sizes: `du -sh data/logs/*`
2. Logs rotate automatically at 5MB
3. Older rotated files are kept (max 5 per type)
4. Manually clean old logs if needed: `rm data/logs/*.gz`

### Performance impact

- Structured logging adds minimal overhead (~1-2ms per request)
- File I/O is asynchronous (non-blocking)
- JSON parsing slightly slower than plaintext
- Benefits outweigh costs in production

## References

- Winston Documentation: https://github.com/winstonjs/winston
- UUID Specification: https://tools.ietf.org/html/rfc4122
- Structured Logging: https://www.kartar.net/2015/12/structured-logging/
- Log Levels (Syslog): https://tools.ietf.org/html/rfc5424#section-6.2.1
