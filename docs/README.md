# ShadowCheck Documentation

Welcome to the ShadowCheck documentation! This guide will help you navigate all available documentation.

## 📋 Documentation Overview

### Getting Started

- [Development Setup](DEVELOPMENT.md) - Local environment setup
- [Deployment](DEPLOYMENT.md) - Production deployment
- [Configuration](CONFIG.md) - Configuration reference

### Architecture & Design

- [Architecture Overview](ARCHITECTURE.md) - System architecture & module organization
- [Modularity Framework](MODULARITY.md) - How we structure code (NEW)
- [Database Schema](DATABASE_RADIO_ARCHITECTURE.md) - Database design
- [Security Policy](SECURITY_POLICY.md) - Security considerations

### Development

- [Frontend Guide](CLIENT.md) - React components & hooks
- [Backend Guide](BACKEND.md) or [API Reference](API_REFERENCE.md) - Server & API
- [Testing](TESTING.md) - Testing strategy
- [Scripts](SCRIPTS.md) - Utility scripts

### Reference

- [Configuration](CONFIG.md) - All configuration options
- [Secrets Management](SECRETS.md) - Managing secrets
- [Authentication](AUTH.md) - Auth & authorization
- [Redis Caching](REDIS.md) - Redis setup & usage

### Archived Sessions

See `docs/archive/sessions/` for historical development notes and modularity session records.

## 🚀 Quick Links

### Key Files

- **Module Organization:** See [ARCHITECTURE.md](ARCHITECTURE.md#server-module-organization)
- **Modularity Framework:** [MODULARITY.md](MODULARITY.md) - How to identify what should be split
- **API Endpoints:** [API_REFERENCE.md](API_REFERENCE.md)
- **Environment Setup:** [CONFIG.md](CONFIG.md)

### Current Status

- **Modularity:** Fast Phase complete (3 files modularized)
- **Audit:** 6 files audited, 4 scheduled for refactoring
- **Build:** ✅ Passing
- **Tests:** Running

---

| I want to...              | Go to...                                 |
| ------------------------- | ---------------------------------------- |
| Get started quickly       | [README.md](../README.md)                |
| Understand architecture   | [ARCHITECTURE.md](ARCHITECTURE.md)       |
| Set up development env    | [DEVELOPMENT.md](DEVELOPMENT.md)         |
| Deploy to production      | [DEPLOYMENT.md](DEPLOYMENT.md)           |
| Configure the application | [CONFIG.md](CONFIG.md)                   |
| Understand the API        | [API_REFERENCE.md](API_REFERENCE.md)     |
| Learn about features      | [FEATURES.md](FEATURES.md)               |
| Run tests                 | [TESTING.md](TESTING.md)                 |
| Configure authentication  | [AUTH.md](AUTH.md)                       |
| Set up secrets            | [SECRETS.md](SECRETS.md)                 |
| View security policy      | [SECURITY_POLICY.md](SECURITY_POLICY.md) |

---

## Documentation Structure

```
docs/
├── README.md                    # This file
├── ARCHITECTURE.md              # System architecture overview
├── API_REFERENCE.md             # Complete API documentation
├── AUTH.md                     # Authentication & authorization
├── BACKEND.md                  # Backend development guide
├── CLIENT.md                   # Frontend documentation
├── CONFIG.md                   # Configuration reference
├── DATABASE_RADIO_ARCHITECTURE.md  # Database schema
├── DEPLOYMENT.md               # Production deployment guide
├── DEVELOPMENT.md              # Development setup guide
├── FEATURES.md                # Feature catalog
├── MODULARITY.md              # Modularity framework (NEW)
├── REDIS.md                   # Redis caching documentation
├── SCRIPTS.md                # Utility scripts reference
├── SECURITY_POLICY.md         # Security policy
├── SECRETS.md                 # Secrets management guide
├── TESTING.md                 # Testing guide
│
├── architecture/               # Detailed architecture docs
│   ├── PROJECT_STRUCTURE.md
│   └── ... (specialized architecture docs)
│
├── archive/                   # Historical documentation
│   ├── sessions/              # Development session notes
│   └── ... (archived content)
│
├── bugfixes/                  # Bug fix documentation
│
├── deployment/                # Deployment guides
│
├── development/               # Development guides
│
├── getting-started/            # Getting started guides
│
├── guides/                    # Implementation guides
│
├── integrations/              # Integration documentation
│
├── security/                  # Security documentation
│
├── setup/                     # Setup guides
│
└── testing/                   # Testing documentation
```

---

## Core Documentation

### Getting Started

1. **[README.md](../README.md)** - Project overview and quick start
2. **[DEVELOPMENT.md](DEVELOPMENT.md)** - Set up your development environment
3. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Understand the system design

### Configuration & Setup

- **[CONFIG.md](CONFIG.md)** - Environment variables and configuration
- **[SECRETS.md](SECRETS.md)** - Secrets management with keyring
- **[AUTH.md](AUTH.md)** - Authentication configuration

### Development

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Local development workflow
- **[TESTING.md](TESTING.md)** - Testing guidelines
- **[SCRIPTS.md](SCRIPTS.md)** - Available utility scripts

### Deployment

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment
- **[REDIS.md](REDIS.md)** - Redis caching setup
- See `deploy/` directory for environment-specific guides

---

## Reference Documentation

### API

- **[API_REFERENCE.md](API_REFERENCE.md)** - Complete REST API reference
- **[openapi.yaml](../openapi.yaml)** - OpenAPI specification

### Database

- **[DATABASE_RADIO_ARCHITECTURE.md](DATABASE_RADIO_ARCHITECTURE.md)** - Database schema
- **[REDIS.md](REDIS.md)** - Redis caching

### Features

- **[FEATURES.md](FEATURES.md)** - Comprehensive feature catalog
- **architecture/** - Detailed architecture documentation

### Security

- **[SECURITY_POLICY.md](SECURITY_POLICY.md)** - Security policy
- **[SECRETS.md](SECRETS.md)** - Secrets management
- **security/** - Additional security documentation

---

## Topic Index

### Authentication & Security

- [AUTH.md](AUTH.md) - Authentication setup
- [SECURITY_POLICY.md](SECURITY_POLICY.md) - Security policy
- [SECRETS.md](SECRETS.md) - Secrets management

### Development

- [DEVELOPMENT.md](DEVELOPMENT.md) - Dev setup
- [TESTING.md](TESTING.md) - Testing
- [SCRIPTS.md](SCRIPTS.md) - Scripts reference

### Deployment

- [DEPLOYMENT.md](DEPLOYMENT.md) - Main deployment guide
- [REDIS.md](REDIS.md) - Redis
- `deploy/` - Environment-specific guides

### Architecture

- [ARCHITECTURE.md](ARCHITECTURE.md) - System overview
- [DATABASE_RADIO_ARCHITECTURE.md](DATABASE_RADIO_ARCHITECTURE.md) - Database
- `architecture/` - Detailed docs

### Features & UI

- [FEATURES.md](FEATURES.md) - Feature catalog
- [CLIENT.md](CLIENT.md) - Frontend docs
- `guides/` - Implementation guides

---

## Troubleshooting

- **[DEVELOPMENT.md](DEVELOPMENT.md#troubleshooting)** - Common development issues
- **[DEPLOYMENT.md](DEPLOYMENT.md#troubleshooting)** - Deployment issues

---

## Archive

Historical documentation is stored in `docs/archive/`:

- **sessions/** - Development session notes from 2025
- **bugfixes/** - Historical bug fix documentation

These files are kept for reference but are not actively maintained.

---

## Contributing

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)** - Community standards
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history

---

**Last Updated:** 2026-02-11
