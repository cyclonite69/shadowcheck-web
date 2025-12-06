# Database Configuration Consolidation Guide

## Problem Analysis

### Current Situation (Dual Configuration)

**server.js** (lines 138-150):
- Force hardcoded IPv4: `'127.0.0.1'`
- Max connections: 5
- Idle timeout: 10 seconds
- Connection timeout: 5 seconds
- Search path: 'public'
- Purpose: Specific to Docker environments

**src/config/database.js** (lines 19-28):
- Uses configurable host: `process.env.DB_HOST`
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds
- Purpose: General reusable configuration

### Issues with Dual Configuration
1. **Confusion**: Which config is used? When?
2. **Inconsistency**: Different timeouts and connection limits
3. **Maintenance**: Changes need to happen in two places
4. **Docker Issues**: Special-case hardcoding in server.js
5. **Testing**: Different configs for different environments
6. **Production Risk**: Forgetting to update one config

---

## Solution: Unified Configuration

### Strategy

Create a single, **environment-aware** database configuration that:
- Supports all environments (development, testing, production, Docker)
- Uses environment variables effectively
- Provides reasonable defaults
- Validates configuration at startup
- Logs configuration decisions

### New Structure

```
src/config/
├── database.js          (NEW - unified)
├── environment.js       (NEW - env validation)
└── constants.js         (existing)
```

---

## Implementation Plan

### Step 1: Environment Validation

Create `src/config/environment.js` to validate and document required variables:

```javascript
/**
 * Environment Variable Validation
 * Ensures all required database configuration exists at startup
 */

const requiredEnvVars = [
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_PORT',
];

const optionalEnvVars = {
  'DB_HOST': 'localhost',           // Default: localhost
  'DB_POOL_MAX': '20',              // Default: 20 connections
  'DB_IDLE_TIMEOUT': '30000',       // Default: 30 seconds
  'DB_CONNECTION_TIMEOUT': '5000',  // Default: 5 seconds
  'LOG_LEVEL': 'info',              // Default: info
  'NODE_ENV': 'development',        // Default: development
};

function validateEnvironment() {
  const missing = [];
  
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    console.error('Please set these variables before starting the server.');
    process.exit(1);
  }
  
  // Log configuration being used
  console.log('Database Configuration:');
  console.log(`  Host: ${process.env.DB_HOST || optionalEnvVars.DB_HOST}`);
  console.log(`  Port: ${process.env.DB_PORT}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Pool Max: ${process.env.DB_POOL_MAX || optionalEnvVars.DB_POOL_MAX}`);
}

module.exports = {
  validateEnvironment,
  requiredEnvVars,
  optionalEnvVars,
};
```

### Step 2: Unified Database Configuration

Update `src/config/database.js` to be environment-aware:

```javascript
/**
 * Unified Database Configuration
 * Works across all environments: development, testing, production, Docker
 */

const { Pool } = require('pg');
require('dotenv').config();
const { validateEnvironment } = require('./environment');

// Validate environment at startup
validateEnvironment();

// Determine host based on environment
function getHost() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // In Docker, use service name instead of localhost
  if (nodeEnv === 'docker' || process.env.DOCKER_ENV === 'true') {
    return process.env.DB_HOST || 'db'; // 'db' is service name in docker-compose
  }
  
  // In development/testing, prefer localhost
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return process.env.DB_HOST || 'localhost';
  }
  
  // In production, use configured host (must be set)
  return process.env.DB_HOST;
}

// Determine pool size based on environment
function getPoolMax() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const configuredMax = parseInt(process.env.DB_POOL_MAX);
  
  // In testing, use smaller pool
  if (nodeEnv === 'test') {
    return configuredMax || 5;
  }
  
  // Default: 20 connections
  return configuredMax || 20;
}

// Determine timeouts based on environment
function getTimeouts() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // In Docker, use longer timeouts for stability
  if (process.env.DOCKER_ENV === 'true') {
    return {
      idle: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connection: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
    };
  }
  
  // In production, use configured values or defaults
  return {
    idle: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connection: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000,
  };
}

const host = getHost();
const poolMax = getPoolMax();
const timeouts = getTimeouts();

// Create unified connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: host,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  max: poolMax,
  idleTimeoutMillis: timeouts.idle,
  connectionTimeoutMillis: timeouts.connection,
  application_name: 'shadowcheck-static',
  // Optional: Add IPv4 preference for Docker
  ...(process.env.DOCKER_ENV === 'true' && {
    options: '-c search_path=public',
  }),
});

// Error handling
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
  // Don't exit - let application handle gracefully
});

// Query wrapper with retry logic
async function query(text, params = [], tries = 2) {
  const transientErrors = ['57P01', '53300', '08006', '08003', '08000'];
  
  try {
    return await pool.query(text, params);
  } catch (error) {
    if (tries > 1 && (transientErrors.includes(error.code) || 
        ['ETIMEDOUT', 'ECONNRESET'].includes(error.errno))) {
      console.warn(`Transient database error, retrying... (${tries - 1} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return query(text, params, tries - 1);
    }
    throw error;
  }
}

// Connection testing
async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    console.log('✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
}

// Graceful shutdown
async function closePool() {
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (error) {
    console.error('Error closing pool:', error);
  }
}

module.exports = {
  pool,
  query,
  testConnection,
  closePool,
  CONFIG: {
    // Standard configuration constants
    MIN_VALID_TIMESTAMP: 946684800000, // Jan 1, 2000
    THREAT_THRESHOLD: parseInt(process.env.THREAT_THRESHOLD) || 40,
    MIN_OBSERVATIONS: parseInt(process.env.MIN_OBSERVATIONS) || 2,
    MAX_PAGE_SIZE: 5000,
    DEFAULT_PAGE_SIZE: 100,
  },
  // Export configuration for debugging
  DEBUG: {
    host,
    poolMax,
    timeouts,
    nodeEnv: process.env.NODE_ENV,
    dockerEnv: process.env.DOCKER_ENV,
  },
};
```

---

## Migration Steps

### Step 1: Create Environment Validation

1. Create `src/config/environment.js`
2. Define required and optional environment variables
3. Add validation function

### Step 2: Update Database Configuration

1. Update `src/config/database.js` with unified config
2. Add environment-aware logic
3. Add validation at startup

### Step 3: Update server.js

Replace hardcoded pool with import from `src/config/database.js`:

```javascript
// OLD (lines 138-180)
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  host: '127.0.0.1',  // HARDCODED!
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: 5432,
  max: 5,
  // ...
});
const query = (text, params, tries) => queryWithPool(pool, text, params, tries);

// NEW
const { pool, query } = require('./src/config/database');
```

### Step 4: Update package.json Scripts

Add environment-specific startup scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "start:docker": "NODE_ENV=production DOCKER_ENV=true node server.js",
    "start:dev": "NODE_ENV=development LOG_LEVEL=debug nodemon server.js",
    "start:test": "NODE_ENV=test node server.js",
    "db:test-connection": "node -e \"const { testConnection } = require('./src/config/database'); testConnection();\""
  }
}
```

### Step 5: Update .env.example

```bash
# Database Configuration
DB_USER=shadowcheck_user
DB_PASSWORD=your_secure_password
DB_HOST=localhost            # Default: localhost (Docker: db)
DB_PORT=5432                 # Default: 5432
DB_NAME=shadowcheck

# Database Pool Configuration
DB_POOL_MAX=20              # Default: 20
DB_IDLE_TIMEOUT=30000       # Default: 30 seconds
DB_CONNECTION_TIMEOUT=5000  # Default: 5 seconds

# Environment
NODE_ENV=development        # development|test|production
DOCKER_ENV=false           # true if running in Docker
LOG_LEVEL=info             # debug|info|warn|error

# Other Configuration
PORT=3001
THREAT_THRESHOLD=40
MIN_OBSERVATIONS=2
```

---

## Configuration Reference

### Development Environment

```bash
NODE_ENV=development
DB_HOST=localhost
DB_POOL_MAX=10
LOG_LEVEL=debug
```

**Result**: 
- Connects to localhost
- Small connection pool (10)
- Detailed logging
- 5-second connection timeout

### Docker Environment

```bash
NODE_ENV=production
DOCKER_ENV=true
DB_HOST=db
DB_POOL_MAX=20
LOG_LEVEL=warn
```

**Result**:
- Connects to `db` service (docker-compose)
- Moderate connection pool (20)
- Limited logging
- 10-second connection timeout (for stability)

### Production Environment

```bash
NODE_ENV=production
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_POOL_MAX=30
DB_IDLE_TIMEOUT=60000
LOG_LEVEL=warn
```

**Result**:
- Connects to production database
- Large connection pool (30)
- Minimal logging
- 60-second idle timeout

---

## Testing Unified Configuration

### Test 1: Verify Startup

```bash
LOG_LEVEL=debug node server.js
```

Should see:
```
Database Configuration:
  Host: localhost
  Port: 5432
  Database: shadowcheck
  User: shadowcheck_user
  Pool Max: 20
✓ Database connection successful
```

### Test 2: Test Connection

```bash
npm run db:test-connection
```

### Test 3: Docker Configuration

```bash
NODE_ENV=production DOCKER_ENV=true node server.js
```

Should connect to `db` service instead of localhost.

---

## Rollback Plan

If issues occur:

1. **Revert server.js** imports
2. **Keep old `src/config/database.js`** as backup
3. **Run tests** to verify original functionality
4. **Debug** specific issue and reapply fix

---

## Benefits of Consolidation

✅ **Single source of truth** for database configuration
✅ **Environment-aware** behavior (dev, test, prod, docker)
✅ **Reduced confusion** - no dual configs
✅ **Easier maintenance** - one place to update
✅ **Better defaults** - sensible for all environments
✅ **Validated at startup** - fail early if config invalid
✅ **Clear logging** - see what config is being used
✅ **Scalable** - easy to add new environments

---

## Migration Checklist

- [ ] Create `src/config/environment.js`
- [ ] Update `src/config/database.js` with unified logic
- [ ] Update `server.js` to import from config
- [ ] Update `package.json` scripts
- [ ] Update `.env.example`
- [ ] Test local development startup
- [ ] Test Docker startup
- [ ] Remove old database.js backup
- [ ] Test all endpoints still work
- [ ] Update documentation
- [ ] Commit changes

---

## Questions & Answers

**Q: Why not just use the existing database.js?**
A: The hardcoded config in server.js suggests specific Docker requirements. The unified approach honors both while being configurable.

**Q: What about connection pooling for clusters?**
A: The unified config handles typical single-instance deployments. For clusters, consider external connection pooling (PgBouncer) and manage via environment variables.

**Q: Will this break existing deploys?**
A: No. The unified config uses the same environment variables and defaults to backward-compatible values.

**Q: How do I add new environments?**
A: Update the config functions (`getHost()`, `getPoolMax()`, `getTimeouts()`) with new logic for the environment type.

---

## Summary

Database configuration consolidation eliminates confusion and maintenance burden by:

1. **Unified Configuration** - Single source of truth
2. **Environment-Aware** - Correct defaults for each context
3. **Validated** - Fail fast if config incomplete
4. **Clear Logging** - Visibility into what's being used
5. **Backward Compatible** - No breaking changes
