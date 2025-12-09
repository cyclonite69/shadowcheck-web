# Production Fixes - Action Plan

**Goal:** Make application production-ready  
**Time Required:** 4-6 hours  
**Priority:** Complete before production deployment

---

## Quick Wins (30 minutes total)

### Fix #1: Add DB_HOST environment variable (2 min)

**File:** `server.js:121`

**Change:**
```javascript
// BEFORE
host: '127.0.0.1',

// AFTER
host: process.env.DB_HOST || '127.0.0.1',
```

**Also update:** `.env.example`
```bash
DB_HOST=localhost
```

---

### Fix #7: Add health check endpoint (10 min)

**File:** `server.js` (add before route mounting, around line 165)

```javascript
// ============================================================================
// 7.5. HEALTH CHECK
// ============================================================================
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
        version: require('./package.json').version
      });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message
    });
  }
});
```

---

### Fix #4: Add request ID middleware (15 min)

**Create:** `middleware/requestId.js`

```javascript
/**
 * Request ID Middleware
 * Adds unique ID to each request for tracing
 */

const crypto = require('crypto');

module.exports = (req, res, next) => {
  // Use existing request ID or generate new one
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  
  // Add to response headers
  res.setHeader('X-Request-ID', req.id);
  
  // Add to request object for logging
  req.startTime = Date.now();
  
  next();
};
```

**Update:** `server.js` (add after body parsing, around line 112)

```javascript
// Request ID tracking
app.use(require('./middleware/requestId'));
```

---

## Medium Priority (2 hours total)

### Fix #5: Add structured logging (1 hour)

**Install:**
```bash
npm install winston
```

**Create:** `utils/logger.js`

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'shadowcheck' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
    })
  ]
});

module.exports = logger;
```

**Update:** Replace console.log/error throughout codebase

**Files to update:**
- `server.js` - Replace all console.log/error
- `utils/errorHandler.js` - Use logger instead of console
- All route files - Use logger for errors

**Example:**
```javascript
// BEFORE
console.log('✓ Database connected successfully');
console.error('Pool error:', err.message);

// AFTER
const logger = require('./utils/logger');
logger.info('Database connected successfully');
logger.error('Pool error', { error: err.message });
```

---

### Fix #2 & #3: Migration tracking system (1 hour)

**Create:** `sql/migrations/00_schema_version.sql`

```sql
-- Schema version tracking
CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW(),
  description TEXT NOT NULL,
  checksum TEXT
);

-- Insert initial version
INSERT INTO app.schema_version (version, description)
VALUES (0, 'Initial schema version tracking')
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE app.schema_version IS 'Tracks applied database migrations';
```

**Create:** `scripts/check-schema.js`

```javascript
/**
 * Check database schema version
 * Run on startup to ensure migrations are current
 */

const { Pool } = require('pg');

const REQUIRED_VERSION = 3; // Update as migrations added

async function checkSchema() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: 5432,
  });

  try {
    // Check if schema_version table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'app' 
        AND table_name = 'schema_version'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ Schema version table not found');
      console.error('Run: psql -U $DB_USER -d $DB_NAME -f sql/migrations/00_schema_version.sql');
      process.exit(1);
    }

    // Check current version
    const { rows } = await pool.query('SELECT MAX(version) as version FROM app.schema_version');
    const currentVersion = rows[0]?.version || 0;

    if (currentVersion < REQUIRED_VERSION) {
      console.error(`❌ Schema version ${currentVersion} is outdated. Required: ${requiredVersion}`);
      console.error('Run migrations in sql/migrations/ directory');
      process.exit(1);
    }

    console.log(`✓ Schema version ${currentVersion} is current`);
  } catch (err) {
    console.error('❌ Schema check failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkSchema();
}

module.exports = checkSchema;
```

**Update:** `package.json`

```json
{
  "scripts": {
    "start": "node scripts/check-schema.js && node server.js",
    "dev": "nodemon server.js",
    "check-schema": "node scripts/check-schema.js"
  }
}
```

---

## Testing (30 minutes)

### Fix #6: Fix failing tests

**Run tests to identify failures:**
```bash
npm test -- --verbose
```

**Common issues:**
- Mock setup problems
- Async timing issues
- Environment variable dependencies

**Fix and verify:**
```bash
npm test
# Should show: Tests: 167 passed, 167 total
```

---

## Verification Checklist

After completing all fixes:

### Local Testing
- [ ] `npm test` - All tests pass
- [ ] `npm start` - Server starts without errors
- [ ] `curl http://localhost:3001/health` - Returns healthy status
- [ ] Check logs are JSON formatted (if NODE_ENV=production)
- [ ] Verify request IDs in response headers

### Database Testing
- [ ] Schema version check runs on startup
- [ ] Database connection retries work
- [ ] Health check detects database failures

### Security Testing
- [ ] SQL injection tests still pass
- [ ] LIKE escaping tests still pass
- [ ] Authentication still works

### Performance Testing
- [ ] Response times < 500ms for typical queries
- [ ] Static files cached properly
- [ ] Compression working

---

## Deployment Steps

### 1. Staging Deployment
```bash
# Set environment
export NODE_ENV=production
export DB_HOST=staging-db.example.com

# Run schema check
npm run check-schema

# Start server
npm start

# Test health check
curl https://staging.example.com/health

# Monitor logs for 24 hours
```

### 2. Production Deployment
```bash
# Same as staging but with production credentials
export NODE_ENV=production
export DB_HOST=prod-db.example.com

# Deploy
npm start

# Monitor
curl https://api.example.com/health
```

---

## Rollback Plan

If issues arise:

```bash
# Revert to previous version
git checkout HEAD~1

# Restart server
npm start

# Verify
curl http://localhost:3001/health
```

---

## Post-Deployment Monitoring

### First 24 Hours
- Monitor error rates
- Check response times
- Verify database connections
- Review logs for warnings

### First Week
- Analyze slow queries
- Check memory usage
- Verify no connection leaks
- Collect user feedback

---

## Estimated Timeline

| Task | Time | Priority |
|------|------|----------|
| Fix #1: DB_HOST | 2 min | HIGH |
| Fix #7: Health check | 10 min | HIGH |
| Fix #4: Request ID | 15 min | HIGH |
| Fix #5: Logging | 1 hour | HIGH |
| Fix #2/#3: Migrations | 1 hour | HIGH |
| Fix #6: Tests | 30 min | HIGH |
| Testing | 30 min | HIGH |
| Documentation | 1 hour | MEDIUM |

**Total:** 4-6 hours

---

## Success Criteria

✅ All 167 tests passing  
✅ Health check endpoint responding  
✅ Request IDs in all responses  
✅ Structured JSON logging  
✅ Schema version tracking  
✅ Server starts cleanly  
✅ No errors in logs  

**When complete:** Application is production-ready! 🚀
