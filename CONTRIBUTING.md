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
- Add tests if applicable
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
git clone https://github.com/cyclonite69/shadowcheck-static.git
cd shadowcheck-static
npm install
cp .env.example .env
# Edit .env with your database credentials
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
- Add JSDoc comments for functions
- Use meaningful variable names
- Keep functions focused and small

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
2. **Develop**: Make your changes with tests
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

**Ready to contribute?** Check out [good first issues](https://github.com/cyclonite69/shadowcheck-static/labels/good%20first%20issue) to get started! 🚀
