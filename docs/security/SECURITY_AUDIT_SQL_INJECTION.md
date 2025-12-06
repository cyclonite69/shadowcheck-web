# SQL Injection Vulnerability Audit Report

## Executive Summary
Found **1 CRITICAL** SQL injection vulnerability and **multiple instances** of template literal usage in SQL queries. The primary risk is in the `/api/analytics/radio-type-over-time` endpoint.

## Vulnerability Details

### CRITICAL: Dynamic INTERVAL in WHERE Clause
**File:** `server.js`
**Lines:** 524-526, 528-550
**Severity:** HIGH (CVSS 7.5)

```javascript
// VULNERABLE CODE
const whereClause = range === 'all'
  ? 'WHERE last_seen IS NOT NULL AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $1'
  : `WHERE last_seen >= NOW() - INTERVAL '${interval}' AND last_seen IS NOT NULL AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $1`;

const { rows } = await query(`
  WITH time_counts AS (
    SELECT
      ${dateFormat} as date,  // ALSO VULNERABLE - dateFormat in template literal
      ...
    FROM app.networks
    ${whereClause}  // INJECTED INTO QUERY
    ...
  )
  SELECT * FROM time_counts
`, [CONFIG.MIN_VALID_TIMESTAMP]);
```

**Problem:**
1. `interval` variable is embedded in template literal within SQL
2. `dateFormat` variable is embedded in template literal within SQL
3. `whereClause` is embedded as template literal, then concatenated

**Attack Vector:**
```
GET /api/analytics/radio-type-over-time?range=24h' OR '1'='1
```
While `interval` is validated by switch statement, the pattern is insecure and sets bad precedent.

### MEDIUM: dateFormat in Template Literal
**Lines:** 531
**Issue:** Although dateFormat values are limited by switch statement, embedding it directly in the query is not best practice.

### GOOD: Properly Parameterized Queries
**Examples:**
- Line 469: Correctly uses `$1` parameter
- Line 1507: Correctly uses `$1, $2, $3, $4` parameters
- Line 1566-1568: Correctly uses `$1` parameter

## Impact Assessment

### Scenario 1: Input Validation Bypass
If input validation is ever removed or bypassed, the query becomes vulnerable.

### Scenario 2: Code Refactoring Risk
Future developers may copy this pattern, spreading the vulnerability.

### Scenario 3: Indirect Injection
If any variable used to populate `interval` or `dateFormat` comes from an untrusted source in the future, the system becomes vulnerable.

## Compliance Issues
- **OWASP Top 10 2021:** A03:2021 – Injection
- **CWE-89:** SQL Injection
- **PCI DSS 6.5.1:** Injection attacks

## Recommendations

### Priority 1: Fix IMMEDIATELY
Refactor to use proper parameterized queries with CASE statements in SQL:

```javascript
// SECURE CODE
const { rows } = await query(`
  WITH time_counts AS (
    SELECT
      CASE $1
        WHEN '24h' THEN DATE_TRUNC('hour', last_seen)
        WHEN '7d' THEN DATE(last_seen)
        WHEN '30d' THEN DATE(last_seen)
        WHEN '90d' THEN DATE(last_seen)
        WHEN 'all' THEN DATE_TRUNC('week', last_seen)
      END as date,
      CASE
        WHEN type = 'W' THEN 'WiFi'
        ...
      END as network_type,
      COUNT(*) as count
    FROM app.networks
    WHERE last_seen IS NOT NULL
      AND EXTRACT(EPOCH FROM last_seen) * 1000 >= $2
      AND CASE $1
            WHEN 'all' THEN TRUE
            WHEN '24h' THEN last_seen >= NOW() - INTERVAL '24 hours'
            WHEN '7d' THEN last_seen >= NOW() - INTERVAL '7 days'
            WHEN '30d' THEN last_seen >= NOW() - INTERVAL '30 days'
            WHEN '90d' THEN last_seen >= NOW() - INTERVAL '90 days'
            ELSE FALSE
          END
    GROUP BY date, network_type
    ORDER BY date, network_type
  )
  SELECT * FROM time_counts
`, [range, CONFIG.MIN_VALID_TIMESTAMP]);
```

### Priority 2: Audit All Dynamic SQL
Search for all instances where variables are embedded in template literals within queries.

### Priority 3: Establish SQL Query Guidelines
Create a standard that:
- ALL parameterized values use `$1, $2, etc.` placeholders
- NO template literals for SQL structures
- Database logic (CASE statements) used for conditional queries
- Code review checklist for SQL queries

## Testing Strategy

### Unit Tests
```javascript
test('invalid range parameter is rejected', async () => {
  const response = await request(app)
    .get('/api/analytics/radio-type-over-time?range=invalid')
    .expect(400);
});

test('range parameter with SQL injection is rejected', async () => {
  const response = await request(app)
    .get(`/api/analytics/radio-type-over-time?range=24h' OR '1'='1`)
    .expect(400);
});
```

### Integration Tests
- Verify query executes correctly for each valid range
- Verify invalid ranges are rejected
- Verify no stack traces in responses

## Long-term Improvements

1. **Use Query Builder:** Consider using a library like `knex.js` or `query-generator` to programmatically build queries
2. **ORM:** Evaluate use of ORMs like `Sequelize` or `TypeORM` to prevent SQL injection entirely
3. **Static Analysis:** Add eslint rules to catch template literals in query functions
4. **Code Review:** Add automated code review for SQL queries

## Checklist

- [ ] Fix radio-type-over-time endpoint
- [ ] Audit all other dynamic SQL patterns
- [ ] Add unit tests for SQL injection attempts
- [ ] Create SQL query guidelines document
- [ ] Add pre-commit hook to check for template literals in queries
- [ ] Train team on parameterized queries
