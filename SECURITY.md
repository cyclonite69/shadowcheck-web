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
- Encrypted credential storage via system keyring
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
- Enable HTTPS in production
- Regularly backup data

## Contact

For security-related questions or concerns, please create an issue with the "SECURITY" label.
