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
- PostgreSQL 18 + PostGIS 3.5
- Redis 7.0 (Caching, Sessions)
- Winston structured logging

**Frontend:**

- React 19 (TypeScript)
- Vite 7 build system
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
- [Repo README](https://github.com/cyclonite69/shadowcheck-web/blob/main/README.md) - current setup and entry points
- [Quick Reference](Quick-Reference) - Wiki navigation guide

### Documentation

- [Architecture](Architecture) - System design and data flow diagrams
- [Data Flow](Data-Flow) - Complete data flow visualizations
- [Deployment Guide](Deployment-Guide) - All deployment scenarios with diagrams
- [API Reference](API-Reference) - Complete REST API documentation
- [Development](Development) - Contributing and workflow
- [Database](Database) - Schema and query reference
- [Features](Features) - Complete feature catalog
- [Geocoding Daemon](https://github.com/cyclonite69/shadowcheck-web/blob/main/docs/GEOCODING_DAEMON.md) - Background enrichment guide

### Advanced Topics

- [Machine Learning](Machine-Learning) - ML threat detection system
- [Security](Security) - Security best practices and hardening
- [Intelligence Dashboards](https://github.com/cyclonite69/shadowcheck-web/blob/main/deploy/monitoring/INTELLIGENCE.md) - Forensic visualization guide

### Operations

- [Troubleshooting](Troubleshooting) - Common issues and solutions
- [Deployment](https://github.com/cyclonite69/shadowcheck-web/blob/main/docs/DEPLOYMENT.md) - Production deployment guide
- [Monitoring](https://github.com/cyclonite69/shadowcheck-web/blob/main/deploy/monitoring/README.md) - Monitoring stack and Grafana dashboards

---

## Project Statistics

- **566,400+** Location records
- **173,326+** Unique networks tracked
- **20+** Filter types
- **Multi-algorithm** ML threat detection
- **TypeScript** codebase with full type safety

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/cyclonite69/shadowcheck-web/blob/main/CONTRIBUTING.md) for details.

---

_Last Updated: 2026-03-28_  
_Version: 1.2.0_
