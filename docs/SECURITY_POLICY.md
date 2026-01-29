# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in ShadowCheck-Static, please report it privately:

1. **DO NOT** open a public GitHub issue
2. Email: [Your security contact email]
3. Include detailed steps to reproduce
4. Allow reasonable time for a fix before public disclosure

## Secure Development Practices

This project follows strict security guidelines:

### No Secrets in Code

- ✅ All credentials stored in encrypted keyring (~/.local/share/shadowcheck/keyring.enc)
- ✅ .env files are gitignored and contain only placeholders
- ✅ API keys never committed to version control
- ✅ Database passwords retrieved from system keyring

### Security Features

- AES-256-GCM encryption for credential storage
- Machine-specific encryption keys
- **Role-Based Access Control (RBAC)**: Admin-only gating for sensitive operations
- **Database Least Privilege**: Restricted `shadowcheck_user` (read-only) vs `shadowcheck_admin` (write access)
- Rate limiting (1000 req/15min per IP)
- CORS origin restrictions
- Input validation on all endpoints
- SQL injection protection via parameterized queries

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Known Security Considerations

1. **Keyring Storage**: File-based encrypted keyring (~/.local/share/shadowcheck/)
   - Only accessible by the user who created it
   - Uses machine-specific encryption key
   - Not suitable for multi-user environments without additional access controls

2. **Admin Interface**: Protected by role-based authentication
   - Access to `/admin` requires a user with the `admin` role
   - Sensitive backend routes (tagging, imports, backups) are protected by `requireAdmin` middleware

3. **Database**: PostgreSQL with PostGIS
   - **Multi-user security**:
     - `shadowcheck_user`: Used for general app operation. Restricted to read-only access on production tables.
     - `shadowcheck_admin`: Used for administrative tasks (imports, tagging). Requires separate password.
   - Credentials should never be hardcoded
   - Use environment variables or keyring for passwords
   - Enable SSL connections in production

## Security Audit History

- **2025-12-04**: Comprehensive security audit completed
  - Fixed XSS vulnerabilities in frontend
  - Removed hardcoded credentials
  - Implemented encrypted keyring storage
  - Added CORS restrictions
  - Added request size limiting
