# Contributing to ShadowCheck

🎉 Thanks for your interest in contributing to ShadowCheck! This project aims to be the premier open-source SIGINT forensics platform.

## Ways to Contribute

### 🐛 Bug Reports

- Use GitHub Issues with the "bug" label
- Include steps to reproduce
- Provide system information (OS, Node.js version, etc.)
- Include relevant logs or screenshots

### 💡 Feature Requests

- Use GitHub Issues with the "enhancement" label
- Describe the use case and expected behavior
- Consider security and performance implications

### 🔧 Code Contributions

- Fork the repository
- Create a feature branch: `git checkout -b feature/amazing-feature`
- Make your changes
- Add or update regression tests whenever behavior changes or new features are added
- Ensure code passes linting: `npm run lint`
- Commit with descriptive messages
- Push and create a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 18+ with PostGIS
- Git

### Quick Start

```bash
git clone https://github.com/cyclonite69/shadowcheck-web.git
cd shadowcheck-web
npm install
# Secrets policy: do not write credentials to disk in local .env files, seed files, or helper scripts.
# Load secrets from AWS Secrets Manager or approved runtime environment injection paths.
npm start
```

### Database Setup

```bash
createdb shadowcheck
psql -d shadowcheck -c "CREATE EXTENSION postgis;"
```

## Code Style

- Use ESLint configuration provided
- Follow existing code patterns
- Use meaningful variable names
- Keep functions focused and small

## Ten Commandments

1. Secrets shall never be written to disk.
2. AWS Secrets Manager shall remain the source of truth for secrets.
3. Core tables shall remain canonical.
4. Enrichment data shall live in separate source-owned tables.
5. Cross-source merging shall happen in views or materialized views, not core tables.
6. Source precision shall be preserved end-to-end.
7. Rounding, truncation, and shortening shall remain presentation concerns only.
8. Refactors shall not leave cruft, duplicate paths, or half-migrated code behind.
9. Behavior changes require regression tests; new features require test coverage.
10. Bootstrap, restore, import, and upgrade are separate contracts and must be validated separately.

## Testing

```bash
npm test                 # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
```

## Areas Needing Help

### 🔥 High Priority

- **Performance optimization** for large datasets (1M+ networks)
- **Machine learning models** for threat detection
- **Mobile app** integration
- **Real-time streaming** from hardware sensors

### 🛡️ Security & Privacy

- **Encryption** for sensitive data at rest
- **Anonymous data collection** options
- **GDPR compliance** features
- **Audit logging** system

### 📊 Analytics & Visualization

- **New chart types** for network analysis
- **3D visualization** improvements
- **Export formats** (KML, Shapefile, etc.)
- **Dashboard customization**

### 🌐 Integrations

- **WiGLE API** enhancements
- **Kismet integration**
- **Hardware sensor** support (RTL-SDR, etc.)
- **Cloud storage** backends

## Pull Request Process

1. **Fork & Branch**: Create a feature branch from `master`
2. **Develop**: Make your changes with tests and remove any refactor cruft introduced along the way
3. **Test**: Ensure all tests pass
4. **Document**: Update README/docs if needed
5. **Submit**: Create PR with clear description
6. **Review**: Address feedback from maintainers
7. **Merge**: Squash and merge when approved

## Commit Message Format

```
type(scope): brief description

Longer description if needed

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Community Guidelines

- **Be respectful** and inclusive
- **Help others** learn and contribute
- **Focus on the mission**: Better SIGINT tools for everyone
- **Security first**: Consider implications of changes
- **Document everything**: Code should be self-explanatory

## Recognition

Contributors will be:

- Listed in README.md
- Credited in release notes
- Invited to maintainer discussions (for regular contributors)

## Questions?

- 💬 **Discussions**: Use GitHub Discussions for questions
- 🐛 **Issues**: Use GitHub Issues for bugs/features
- 📧 **Security**: Use private disclosure for security issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Ready to contribute?** Check out [good first issues](https://github.com/cyclonite69/shadowcheck-web/labels/good%20first%20issue) to get started! 🚀
