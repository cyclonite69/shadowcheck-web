# Changelog

All notable changes to ShadowCheck will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- OpenAPI 3.0 specification for comprehensive API documentation
- Husky pre-commit hooks with ESLint, Prettier, and secret detection
- Node.js version management with `.nvmrc` file

### Changed

- Improved development workflow with automated code quality checks

## [1.0.0] - 2025-12-10

### Added

- ML network reassessment feature for threat detection
- Network filtering, search, and threat tagging capabilities
- `/api/networks/tag-threats` endpoint for bulk threat tagging
- Radio icon system for network type visualization
- Community features and visibility improvements
- Demo-ready features and enhanced documentation
- Enhanced admin interface with visualization features
- Turbo SQLite import for fast data ingestion

### Changed

- Completely rewritten ML reassessment algorithm with improved accuracy
- Simplified ML scoring algorithm for better performance
- Enhanced surveillance detection UI with improved threat APIs
- Optimized network filtering and sorting

### Fixed

- Network tagging authentication requirement removed for better usability
- ML trainer threat/safe counting accuracy
- ML reassess data compatibility issues
- JSON parsing errors in ML reassess endpoint
- Admin page layout system stability
- Dashboard control buttons header visibility
- BaseComponents initialization across all pages
- Analytics API paths consistency
- Mapbox token management in admin page

### Security

- Removed hardcoded passwords from test files
- Implemented secretsManager for all credential handling
- Added pre-commit hooks with secret detection

## [0.9.0] - 2025-12-06

### Added

- Production-ready observability and monitoring
- Comprehensive secrets management system
- Mapbox token setup guide and documentation
- Network marker loading controls on geospatial page

### Changed

- Migrated to modular route architecture
- Improved error handling and logging
- Enhanced dashboard service initialization

### Fixed

- Missing mapbox settings endpoint handling
- Surveillance page API paths and column names
- Dashboard service initialization timing
- Undefined function references in network row handling
- Analytics page API endpoint paths

## [0.8.0] - 2025-12-05

### Added

- PostgreSQL 18 + PostGIS 3.6 Docker container setup
- React 18 + Vite frontend build system
- Threat detection algorithm v2 with improved scoring
- Network observation tracking with geospatial analysis
- WiGLE database integration
- User tagging system (LEGIT, FALSE_POSITIVE, INVESTIGATE, THREAT)

### Changed

- Migrated from local PostgreSQL to Dockerized setup
- Modernized frontend build pipeline with Vite
- Refactored API routes to v1 structure

### Security

- Implemented Docker secrets management
- Added keyring-based credential storage
- Enhanced SQL injection protection

## [0.7.0] - 2025-11-20

### Added

- Initial wireless network threat detection capabilities
- Basic dashboard and analytics
- Network discovery and tracking
- SQLite import functionality

### Changed

- Core database schema design
- Network aggregation logic

## [0.6.0] - 2025-11-01

### Added

- Initial project setup
- Basic Express.js server
- PostgreSQL database integration
- Network data models

---

## Version History Summary

- **1.0.0** (2025-12-10): ML enhancement, bulk tagging, improved UI/UX
- **0.9.0** (2025-12-06): Production observability, secrets management
- **0.8.0** (2025-12-05): Docker migration, React frontend, PostGIS integration
- **0.7.0** (2025-11-20): Core threat detection algorithms
- **0.6.0** (2025-11-01): Initial project foundation

---

## Types of Changes

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

---

For detailed API changes, see [API.md](docs/API.md).
For migration guides, see [docs/MIGRATION.md](docs/MIGRATION.md).
For security advisories, see [SECURITY.md](SECURITY.md).
