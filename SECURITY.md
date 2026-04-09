# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via:

- **Email**: [Create an issue with "SECURITY" prefix]
- **Private vulnerability disclosure**: Use GitHub's private vulnerability reporting feature

### What to Include

Please include the following information:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Measures

ShadowCheck implements several security measures:

### Database Security

- Parameterized queries to prevent SQL injection
- Connection pooling with limits
- Credential storage via AWS Secrets Manager (no secrets on disk)
- Database user with minimal required privileges

### API Security

- Rate limiting on all API endpoints
- Input validation and sanitization
- CORS configuration
- Content Security Policy headers

### Data Protection

- No hardcoded secrets in source code
- Environment-based configuration
- Secure session management
- Data validation on all inputs
- Immutable policy: secrets are never written to disk at runtime (`.env`, `.pgpass`, `secrets/*.txt`)
- Enforced by automated guardrails:
  - local pre-commit secret scanning
  - `npm run policy:secrets` in CI
  - `gitleaks` in CI on push / PR
  - scheduled full-history secret scanning in CI

### Secret Rotation

- Database credential rotation is supported by [scripts/rotate-db-password.sh](/home/dbcooper/repos/shadowcheck-web/scripts/rotate-db-password.sh)
- Treat any committed credential as burned: rotate it even if repo history was rewritten
- `db_password` and `db_admin_password` live in AWS Secrets Manager secret `shadowcheck/config`

### Infrastructure

- PostgreSQL with PostGIS for secure geospatial operations
- Express.js with security middleware
- Compression and security headers
- Error handling without information disclosure

## Responsible Disclosure

We follow responsible disclosure practices:

1. Report received and acknowledged within 48 hours
2. Initial assessment within 7 days
3. Regular updates on progress
4. Public disclosure coordinated after fix is available
5. Credit given to security researchers (if desired)

## Security Updates

Security updates are prioritized and released as soon as possible. Users are encouraged to:

- Keep dependencies updated
- Monitor security advisories
- Use strong database credentials
- Rotate exposed credentials immediately
- Enable HTTPS in production
- Regularly backup data

## Contact

For security-related questions or concerns, please create an issue with the "SECURITY" label.

# Known Security Issues

## sqlite3 tar Dependency Vulnerability (Accepted Risk)

- **Status**: Accepted
- **Severity**: High (but build-time only)
- **Rationale**: Vulnerability exists in node-gyp build dependency chain. Does not affect runtime security. Attack surface limited to npm install phase with malicious packages.
- **Mitigation**: Package.json is version controlled; all dependencies are from trusted sources.
- **Future**: Consider migration to better-sqlite3 for cleaner dependency tree.
