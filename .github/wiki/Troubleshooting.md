# Troubleshooting

**Docs references (repo):** [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md)

> **Common issues and solutions for ShadowCheck**

---

## Database Connection Errors

### Problem: Connection Refused

**Symptoms:**

- `ECONNREFUSED` error
- Cannot connect to PostgreSQL

**Solution:**

```bash
# Verify Docker PostgreSQL is running
docker ps | grep postgres

# Or check local PostgreSQL
sudo systemctl status postgresql

# Test connection
docker exec postgres psql -U shadowcheck_user -d shadowcheck_db
```

### Problem: Password Authentication Failed

**Solution:**

```bash
# Reset password in PostgreSQL
sudo -u postgres psql
postgres=# ALTER USER shadowcheck_user WITH PASSWORD 'new_password';

# Update AWS Secrets Manager
# (Set db_password to "new_password")
```

---

## Map is Blank

**Symptoms:**

- Map area is empty/gray
- No map tiles loading

**Solutions:**

1. Verify `mapbox_token` is set in AWS Secrets Manager
2. Check browser console for Mapbox GL errors
3. Ensure token has correct permissions

---

## Dashboard Shows Zeros

**Symptoms:**

- All metrics showing 0
- No network data displayed

**Solution:**

```sql
-- Check data exists
SELECT COUNT(*) FROM public.networks;

-- Verify home location
SELECT * FROM app.location_markers WHERE name = 'home';

-- Check materialized views are refreshed
REFRESH MATERIALIZED VIEW analytics_summary_mv;
```

---

## High Memory Usage

**Symptoms:**

- `JavaScript heap out of memory` error
- Server crashes with large datasets

**Solution:**

```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

---

## Port Already in Use

**Symptoms:**

- `EADDRINUSE: address already in use :::3001`

**Solution:**

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change PORT in .env
PORT=3002
```

---

## Migration Errors

### Problem: Relation Already Exists

**Solution (Development Only):**

```bash
# Drop and recreate schema
psql -U shadowcheck_user -d shadowcheck_db -c "DROP SCHEMA app CASCADE; CREATE SCHEMA app;"

# Re-run migrations
psql -U shadowcheck_admin -d shadowcheck_db -f sql/migrations/00_init_schema.sql
```

---

## Slow Queries

**Symptoms:**

- API requests taking >5 seconds
- Dashboard loading slowly

**Solution:**

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Analyze and vacuum
ANALYZE;
VACUUM ANALYZE;
```

---

## Access Denied on Admin Page

**Symptoms:**

- "Access Denied" message on Admin page
- Cannot perform admin operations

**Solution:**

1. Verify `db_admin_password` secret is configured
2. Check user has `admin` role in database
3. Ensure API key is set for protected endpoints

---

## Debugging Steps

### Enable Debug Logging

```bash
# Set environment variable
DEBUG=shadowcheck:* npm start

# Or in .env
LOG_LEVEL=debug
```

### Check Server Logs

```bash
# View Docker logs
docker-compose logs -f api

# Check structured logs
cat logs/combined.log
```

---

## Related Documentation

- [Development](Development) - Development setup
- [Installation](Installation) - Complete setup guide
- [Database](Database) - Database operations
- [Recent Fixes](https://github.com/cyclonite69/shadowcheck-web/blob/main/alignment_audit_report.md) - Comprehensive code-documentation alignment audit
