# ShadowCheck Documentation

Welcome to the ShadowCheck documentation! This guide will help you navigate all available documentation.

## 📚 Documentation Structure

```
docs/
├── getting-started/     # New user guides
├── architecture/        # System design & architecture
├── development/         # Development guides & workflows
├── deployment/          # Production deployment guides
├── security/            # Security policies & guides
├── reference/           # API & technical reference
├── features/            # Feature-specific documentation
├── guides/              # Implementation guides
├── enrichment/          # Network enrichment system
└── archive/             # Historical documentation
```

## 🚀 Getting Started

**New to ShadowCheck?** Start here:

1. **[Installation](getting-started/MAPBOX_SETUP.md)** - Initial setup & configuration
2. **[Quick Start Guide](guides/QUICK_START.md)** - Get up and running in 5 minutes
3. **[CLAUDE.md](../CLAUDE.md)** - Essential guide for AI-assisted development

## 📖 Core Documentation

### Architecture & Design
- **[System Architecture](ARCHITECTURE.md)** - High-level system design
- **[Database Schema](DATABASE_V2_SUMMARY.md)** - Database structure & entities
- **[API Design](API.md)** - API architecture & patterns
- **[Modular Architecture](architecture/)** - Detailed architecture docs

### Development
- **[Development Setup](DEVELOPMENT.md)** - Local development environment
- **[Testing Guide](development/)** - Writing & running tests
- **[Common Patterns](../CLAUDE.md#development-patterns)** - Code patterns & best practices

### Deployment
- **[Production Deployment](DEPLOYMENT.md)** - Deploy to production
- **[Docker Guide](deployment/)** - Containerized deployment
- **[Deployment Checklist](deployment/DEPLOYMENT_CHECKLIST.md)** - Pre-deploy verification

### Security
- **[Security Policy](../SECURITY.md)** - Vulnerability reporting
- **[Secrets Management](security/SECRETS_MANAGEMENT.md)** - Managing credentials
- **[SQL Injection Prevention](security/SQL_INJECTION_PREVENTION.md)** - Database security
- **[Keyring Architecture](security/KEYRING_ARCHITECTURE.md)** - Keyring implementation

## 🔍 Reference Documentation

### API Reference
- **[API Documentation](API.md)** - Complete API reference
- **[API Reference](API_REFERENCE.md)** - Endpoint details

### Database
- **[Database Schema V2](DATABASE_V2_SUMMARY.md)** - Current schema
- **[Legacy Schema](LEGACY_SCHEMA.md)** - Historical schema
- **[Database Triggers](DATABASE_TRIGGERS.md)** - Automated database operations

### Configuration
- **[Environment Variables](../CLAUDE.md#key-configuration)** - Configuration options
- **[Admin Settings](ADMIN_SETTINGS_GUIDE.md)** - Admin panel configuration

## ⚡ Features

### Core Features
- **[Threat Detection](features/THREAT_DETECTION_V3.md)** - Surveillance device detection
- **[ML System](ML_ITERATION_GUIDE.md)** - Machine learning implementation
- **[Surveillance Detection](SURVEILLANCE_DETECTION.md)** - Advanced threat analysis

### Enrichment System
- **[Production Enrichment](enrichment/PRODUCTION_ENRICHMENT.md)** - Multi-API enrichment
- **[API Keys Guide](enrichment/GET_FREE_API_KEYS.md)** - Obtaining API keys
- **[Free Address APIs](enrichment/FREE_ADDRESS_APIS.md)** - API comparison

### UI/UX Features
- **[Network Explorer](features/NETWORK_EXPLORER_ENHANCEMENTS.md)** - Network browsing
- **[Analytics Dashboard](features/ANALYTICS_DASHBOARD_IMPROVEMENTS.md)** - Data visualization
- **[Map Features](features/MAP_JUMP_FEATURE.md)** - Interactive mapping

## 📋 Implementation Guides

- **[Error Handling Guide](guides/ERROR_HANDLING_GUIDE.md)** - Error handling patterns
- **[Validation Guide](guides/VALIDATION_IMPLEMENTATION_GUIDE.md)** - Input validation
- **[Logging Guide](guides/LOGGING_IMPLEMENTATION_GUIDE.md)** - Structured logging

## 🗂️ Topic Index

### By Topic

**Authentication & Security**
- [Secrets Management](security/SECRETS_MANAGEMENT.md)
- [SQL Injection Prevention](security/SQL_INJECTION_PREVENTION.md)
- [Security Audit](SECURITY_AUDIT.md)
- [Security Policy](../SECURITY.md)

**Database**
- [Database Schema V2](DATABASE_V2_SUMMARY.md)
- [Database Triggers](DATABASE_TRIGGERS.md)
- [Legacy Schema](LEGACY_SCHEMA.md)
- [Migration Guide](DATABASE_V2_FINAL_PLAN.md)

**Deployment**
- [Production Deployment](DEPLOYMENT.md)
- [Deployment Checklist](deployment/DEPLOYMENT_CHECKLIST.md)
- [Docker Setup](../docker-compose.yml)

**Development**
- [Development Setup](DEVELOPMENT.md)
- [Testing](../CLAUDE.md#running-tests)
- [Code Style](../CLAUDE.md#code-style)
- [Common Patterns](../CLAUDE.md#development-patterns)

**Features**
- [Threat Detection](features/THREAT_DETECTION_V3.md)
- [Network Enrichment](enrichment/PRODUCTION_ENRICHMENT.md)
- [ML System](ML_ITERATION_GUIDE.md)
- [Surveillance Detection](SURVEILLANCE_DETECTION.md)

## 🔧 Troubleshooting

**Common Issues:**
- Database connection errors → [CLAUDE.md Troubleshooting](../CLAUDE.md#troubleshooting)
- Secrets not loading → [Secrets Management](security/SECRETS_MANAGEMENT.md#troubleshooting)
- Docker issues → [Deployment Guide](DEPLOYMENT.md)
- Test failures → [Development Guide](DEVELOPMENT.md)

**Historical Issues:**
- [Archived Troubleshooting](archive/TROUBLESHOOTING_2025-12-06.md)
- [Legacy Fixes](archive/)

## 📦 Archive

Historical documentation and completed initiatives:

- **[Refactoring](archive/refactoring/)** - Architecture refactoring docs
- **[Observability](archive/observability/)** - Logging & monitoring implementation
- **[Production Hardening](archive/production/)** - Production readiness work
- **[Security Fixes](archive/sql-injection/)** - Historical security improvements
- **[Session Notes](archive/sessions/)** - Development session summaries

## 🤝 Contributing

- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute
- **[Code of Conduct](../CODE_OF_CONDUCT.md)** - Community standards
- **[Changelog](../CHANGELOG.md)** - Version history

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/shadowcheck/issues)
- **Security**: See [SECURITY.md](../SECURITY.md)
- **Questions**: Check docs first, then open an issue

## 🎯 Quick Links

| I want to... | Go to... |
|--------------|----------|
| Get started quickly | [Quick Start](guides/QUICK_START.md) |
| Set up development env | [Development Setup](DEVELOPMENT.md) |
| Understand architecture | [Architecture](ARCHITECTURE.md) |
| Deploy to production | [Deployment](DEPLOYMENT.md) |
| Add a new feature | [CLAUDE.md](../CLAUDE.md#common-tasks) |
| Fix a security issue | [Security Policy](../SECURITY.md) |
| Report a bug | [GitHub Issues](https://github.com/your-org/shadowcheck/issues) |
| Configure secrets | [Secrets Management](security/SECRETS_MANAGEMENT.md) |
| Understand threat detection | [Threat Detection](features/THREAT_DETECTION_V3.md) |
| Use the API | [API Reference](API_REFERENCE.md) |

---

**Last Updated**: 2025-12-09
**Maintained By**: ShadowCheck Team
**License**: MIT
