# Security

**Docs version (repo):** [docs/SECURITY_POLICY.md](../../docs/SECURITY_POLICY.md)

> **Security best practices and hardening guide for ShadowCheck**

---

## Security Architecture

**Multi-Layered Approach:**

1. **Network Security**: HTTPS/TLS, firewall, rate limiting
2. **Application Security**: CORS, CSP headers, input validation
3. **Data Security**: SQL injection prevention, parameterized queries
4. **Access Control**: RBAC, session-based auth, API keys
5. **Secrets Management**: AWS Secrets Manager, never on disk, never in code

---

## Security Headers

```javascript
// Applied by securityHeaders middleware
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

---

## Secrets Management

### Source of Truth

1. AWS Secrets Manager (`shadowcheck/config`)
2. Environment variables only as explicit local overrides when AWS is unavailable

### Required Secrets

- `db_password` - PostgreSQL user password
- `db_admin_password` - PostgreSQL admin password
- `mapbox_token` - Mapbox GL JS token

### Secrets Lookup

Secrets are resolved at runtime through AWS Secrets Manager; environment variables may be used only for explicit local overrides. Full procedures live in [docs/SECRETS.md](../../docs/SECRETS.md).

### Password Rotation

Rotate database passwords every 60-90 days using `./scripts/rotate-db-password.sh`.
If a credential is ever committed, rotate it immediately even if git history was rewritten afterward.

### Secret Scanning

- Husky runs local pre-commit secret scanning
- CI runs `npm run policy:secrets` and `gitleaks` on push / PR
- CI also runs a scheduled full-history secret scan

---

## SQL Injection Prevention

All database queries use parameterized statements:

```typescript
// ✅ Safe - parameterized query
const result = await query('SELECT * FROM networks WHERE bssid = $1', [bssid]);

// ❌ Unsafe - never do this
const result = await query(`SELECT * FROM networks WHERE bssid = '${bssid}'`);
```

---

## Authentication & Authorization

### Role-Based Access Control (RBAC)

- **Admin Role**: Required for `/admin` page and data-modifying operations
- **User Role**: Standard access to dashboards and mapping

### API Key Authentication

Protected endpoints:

- `GET /api/admin/backup`
- `POST /api/admin/restore`

```bash
curl -H "x-api-key: your-key" http://localhost:3001/api/admin/backup
```

### Rate Limiting

- **Limit**: 1000 requests per 15 minutes per IP
- **Response**: 429 Too Many Requests when exceeded

---

## Security Best Practices

### ✅ DO

- Use AWS Secrets Manager for all environments
- Use environment variables only for explicit local overrides
- Rotate secrets regularly
- Use strong, randomly generated passwords
- Use parameterized queries for all database access
- Validate all user input
- Sanitize output (XSS prevention)
- Use HTTPS in production

### ❌ DON'T

- Commit `.env` files to git
- Hardcode secrets in source code
- Store secrets in Docker images
- Share secrets via email or chat
- Use weak or default passwords
- Use string concatenation for SQL queries

---

## Threat Model

**Primary Threat**: Unauthorized data access and manipulation

**Mitigations**:

- Rate limiting (1000 req/15min per IP)
- API key for sensitive endpoints
- CORS origin whitelisting
- SQL injection prevention
- XSS prevention
- Request body size limiting (10MB)

---

## Secrets Validation

Secrets are validated at application startup:

```javascript
// server/src/utils/validateSecrets.js
async function validateSecrets() {
  const required = ['db_password', 'mapbox_token'];

  for (const secret of required) {
    if (!secretsManager.get(secret)) {
      throw new Error(`Required secret '${secret}' not found`);
    }
  }
}
```

---

## Troubleshooting

### Secret Not Found

```
Error: Required secret 'db_password' not found
```

**Solution**:

1. Set via AWS Secrets Manager (e.g., update `db_password`)
2. Store secrets in AWS Secrets Manager and inject at runtime; do not write local secret files.

### Secrets Access Errors

```
Error: Access to AWS Secrets Manager denied
```

**Solution**:

1. Verify the IAM role/user has permissions for the secret
2. Confirm the AWS region and credential env vars are set
3. Keep secrets in AWS Secrets Manager and inject them at runtime (no file-backed secret stores)

---

## Related Documentation

- [Repo Secrets Doc](https://github.com/cyclonite69/shadowcheck-web/blob/main/docs/SECRETS.md) - Detailed secrets guide
- [Repo Security Policy](https://github.com/cyclonite69/shadowcheck-web/blob/main/docs/SECURITY_POLICY.md) - Database and operational security
- [Architecture](Architecture) - Security architecture overview
- [Development](Development) - Secure development practices
