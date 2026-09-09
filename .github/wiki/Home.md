# ShadowCheck Wiki

**Docs index (repo):** [docs/README.md](../../docs/README.md)

> **Production-grade SIGINT forensics and wireless network analysis platform**
>
> Real-time threat detection, geospatial correlation via PostGIS, and interactive analysis dashboards.

---

## Welcome to ShadowCheck

ShadowCheck is a comprehensive SIGINT (Signals Intelligence) forensics platform designed for wireless network threat detection. It analyzes WiFi, Bluetooth, and cellular observations to identify potential surveillance devices and anomalies using machine learning and geospatial analysis.

### ✨ Key Capabilities

| Feature                 | Description                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| **Threat Detection**    | ML-powered identification of surveillance devices with multi-factor scoring   |
| **Geospatial Analysis** | Interactive Mapbox visualization with spatial correlation and clustering      |
| **Network Analysis**    | Deep dive into 173,326+ unique networks with behavioral profiling             |
| **Universal Filters**   | 20+ filter types supporting complex temporal, spatial, and behavioral queries |
| **ML Training**         | Multi-algorithm threat detection with hyperparameter optimization             |
| **Geocoding Daemon**    | Continuous background address enrichment with multi-API support               |
| **ARM Spot Launcher**   | Optimized single-node AWS deployment for m7g/m6g instances                    |
| **Monitoring**          | Standalone Grafana stack with "Tactical Overview" dashboards                  |

### 🛠️ Technology Stack

**Backend:**

- Node.js 22+ (TypeScript)
- Express.js REST API
- PostgreSQL 18 + PostGIS 3.6
- Redis 7.0 (Caching, Sessions)
- Winston structured logging

**Frontend:**

- React 19 (TypeScript)
- Vite 8 build system
- Tailwind CSS v4
- Mapbox GL JS / Deck.gl
- Zustand state management

**Infrastructure:**

- Docker + Docker Compose
- Jest 30.x testing framework
- GitHub Actions CI/CD

---

## Quick Links

### Getting Started

- [Installation](Installation) - Set up your development environment
- [Quick Start](https://github.com/cyclonite69/shadowcheck-web/blob/master/docs/guides/QUICK_START.md) - 5-minute setup tutorial
- [Repo README](https://github.com/cyclonite69/shadowcheck-web/blob/master/README.md) - current setup and entry points
- [Quick Reference](Quick-Reference) - Wiki navigation guide

### Documentation

- [Architecture](Architecture) - System design and data flow diagrams
- [Data Flow](Data-Flow) - Complete data flow visualizations
- [Deployment Guide](Deployment-Guide) - All deployment scenarios with diagrams
- [API Reference](API-Reference) - Complete REST API documentation
- [Development](Development) - Contributing and workflow
- [Database](Database) - Schema and query reference
- [Features](Features) - Complete feature catalog
- [Geocoding Daemon](https://github.com/cyclonite69/shadowcheck-web/blob/master/docs/GEOCODING_DAEMON.md) - Background enrichment guide

### 🗃️ Repository Documentation (Canonical)

These docs live directly in the codebase repository and act as the technical source of truth for runtime logic:

- **Subsystems & Features:**
  - [Badge Studio](../../docs/features/badge-studio.md) — Configuration flags, persistence, and UI rendering details.
  - [Geospatial Explorer](../../docs/features/geospatial.md) — Materialized view queries, column choosers, and nearest-place hydration.
  - [Surveillance Detection](../../docs/features/surveillance-detection.md) — Target OUI signatures, bodycam (BWC) classifiers, camera lists, and the SIGINT reference library.
  - [WiGLE Import Player](../../docs/features/wigle-import-player.md) — Paginated V2 ingestion lifecycle, run/page ledgers, and rate-limiting safety.
- **Database & Query Reference:**
  - [Universal Filters](../../docs/FILTERS.md) — 20+ query parameters mapped from API endpoints to PostgreSQL queries.
  - [Network Tables Schema](../../docs/schema/network-tables.md) — Database structures including sibling pairs, overrides, and detection logs.
  - [Observation & WiGLE Sources](../../docs/schema/observations-sources.md) — WiGLE import accounting and VISINT evidence details.
- **REST API Reference & Route Maps:**
  - [Curated API Reference](../../docs/API_REFERENCE.md) — Curated stable/operator-facing reference.
  - [API Route Inventory](../../docs/api/route-inventory.md) — Exhaustive Express route inventory.
  - [Manual-Only & Dangerous Endpoints](../../docs/api/manual-only-endpoints.md) — Dangerous/manual endpoints and automation restrictions.
- **Engineering Workflows:**
  - [Testing Standards](../../docs/TESTING.md) — Jest test suites, execution commands, and the 60% coverage gate.
  - [Documentation Maintenance](../../docs/maintenance/documentation-workflow.md) — Guidelines and procedures for updating repository docs and the wiki.
  - [Maintenance Cadence](../../docs/maintenance/maintenance-cadence.md) — Standing checklists, four cadence lanes, and AI audit prompts.

### Advanced Topics

- [Machine Learning](Machine-Learning) - ML threat detection system
- [Security](Security) - Security best practices and hardening
- [Intelligence Dashboards](https://github.com/cyclonite69/shadowcheck-web/blob/master/deploy/monitoring/INTELLIGENCE.md) - Forensic visualization guide

### Operations

- [Troubleshooting](Troubleshooting) - Common issues and solutions
- [Deployment](https://github.com/cyclonite69/shadowcheck-web/blob/master/docs/DEPLOYMENT.md) - Production deployment guide
- [Monitoring](https://github.com/cyclonite69/shadowcheck-web/blob/master/deploy/monitoring/README.md) - Monitoring stack and Grafana dashboards

---

## Project Statistics

- **566,400+** Location records
- **173,326+** Unique networks tracked
- **20+** Filter types
- **Multi-algorithm** ML threat detection
- **TypeScript** codebase with full type safety

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/cyclonite69/shadowcheck-web/blob/master/CONTRIBUTING.md) for details.

---

_Last Updated: 2026-03-28_  
_Version: 1.2.0_
