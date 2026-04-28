# ShadowCheck Feature Catalog

**Wiki version (diagrams):** [Features](../.github/wiki/Features.md)

This catalog summarizes the features implemented in the current ShadowCheck codebase (UI routes, API modules, services, and data pipelines). It complements the deeper feature docs under `docs/features/`.

## Core UI & Exploration

- **Dashboard**: Real-time metrics cards, threat indicators, and filter-aware summaries.
- **Geospatial Explorer**: Unified interactive map view with network selection, forensic tooltips, integrated network table, and timeline views.
- **Analytics**: Temporal activity, radio-type trends, and threat score charts with advanced filtering support.
- **WiGLE Page**: Local WiGLE database search (v2/v3) with optional live API lookups and forensic enrichment.
- **Kepler Page**: Kepler.gl-ready GeoJSON feeds with universal filter support and **lazy-loaded tooltips** for high-performance visualization.
- **Monitoring**: Real-time system health and performance monitoring metrics.
- **Admin Panel**: Comprehensive configuration workflows, operational controls, and data management.

## Universal Filter System

- **25+ filter types** spanning time (`FIRST_SEEN`, `LAST_SEEN`, `NETWORK_LIFETIME`), signal, radio, security, distance, geography, tags, and device attributes.
- **BSSID Wildcards**: Support for `*` and `?` in BSSID filters.
- **SSID Exclusion**: Support for `-` and `NOT` prefixes to exclude specific SSIDs. Supports `|` OR syntax (`fbi|surveillance` matches either term) and comma AND syntax (`fbi,surveillance` requires both).
- **WiGLE Persistence Filters**: Universally available filters for WiGLE observation counts and last import dates.
- **Page-scoped filters** with URL sync and debounced application across Geospatial, Analytics, and Kepler views.

## Geospatial & Mapping

- **Mapbox integration**: Token management, style proxying, and request proxy for client egress safety.
- **Google Maps tiles**: Server-side tile proxy with key management.
- **Heatmaps, routes, and timelines**: Geospatial overlays for movement and activity patterns.
- **Location markers & home location**: CRUD for saved markers plus radius-based home zone distance filtering.
- **Unified Forensic Tooltips**: High-fidelity tooltips powered by a unified normalizer, featuring lazy-loading in Kepler for thousands of points.

## Data & Enrichment

- **Geocoded Address Intelligence**: Automated background reverse geocoding via multiple providers (Mapbox, OpenCage, etc.) stored in a persistent cache.
- **Radio Manufacturer Standardization**: High-fidelity cleanup of 74,000+ records with integrated OUI resolution.
- **Network tagging**: Manual classification, forensic note-taking, and media attachments (images/video).
- **Trilateration**: Estimated access point locations derived from weighted observation centroids and signal clustering.
- **Export tooling**: Streamed CSV, JSON, and GeoJSON exports.

## Threat Detection & ML

- **Threat scoring**: Rule-based scoring with ML-assisted boosts and automated behavioral analysis.
- **ML training tab**: Admin-gated logistic regression model training and scoring pipeline.
- **ML iteration script**: Offline model comparison (logistic regression, random forest, gradient boosting).
- **Threat analytics**: Quick and detailed movement-based forensic detection endpoints.

## Admin & Operations

- **Automation (Jobs)**: Scheduled background tasks for geocoding, database maintenance, and WiGLE enrichment.
- **Data Import**: High-performance SQLite, SQL, and KML import pipelines with automated orphan preservation.
- **Orphan Management**: Specialized interface for tracking and backfilling parent-only network rows.
- **Geocoding Daemon**: Continuous background enrichment of the geocoding cache.
- **Infrastructure Monitoring**: Standalone Grafana stack with tactical dashboards.
- **Secrets management**: AWS Secrets Manager-backed runtime loading.

### Threat Score Calculation

| Factor                   | Weight | Condition                                                            |
| ------------------------ | ------ | -------------------------------------------------------------------- |
| **Following Pattern**    | 35%    | Multiple clusters >2km from home; max distance spread.               |
| **Parked Surveillance**  | 20%    | Repeated detections within 100m and 10-minute windows.               |
| **Location Correlation** | 15%    | Percentage of observations near home vs. distinct clusters.          |
| **Equipment Profile**    | 10%    | Manufacturer OUI matching (industrial/vehicular) and SSID patterns.  |
| **Temporal Persistence** | 5%     | Number of distinct days observed.                                    |
| **Fleet Bonus**          | 15%    | Correlation with other high-score networks (same manufacturer/SSID). |

## Admin, Auth, & Security

- **Authentication**: Session-based login, logout, and user info endpoints.
- **Role-based gating**: Admin-only routes for sensitive actions.
- **Settings management**: AWS Secrets Manager-backed Mapbox tokens, WiGLE credentials, and Google Maps keys.
- **Security headers**: CSP and hardened response headers for production.
- **Secrets handling**: AWS Secrets Manager with runtime loading (no secrets on disk).
- **Security policy note**: AWS Secrets Manager is the canonical store; see `docs/SECURITY_POLICY.md` and `docs/SECRETS.md` for the operational workflow and no-disk rule.

## Platform & Operations

- **Monitoring & Observability**: Standalone Grafana stack with pre-configured "Tactical Overview" dashboards.
- **Automated Provisioning**: Pre-wired PostgreSQL datasources and automated dashboard discovery.
- **Least-Privilege Access**: Dedicated `grafana_reader` database role for secure, read-only dashboard access.
- **API versioning**: v1 and v2 endpoints with filtered network support.
- **Modular backend**: Services and repositories with validation middleware.
- **ETL pipeline**: Load/transform/promote steps feeding materialized views.
- **Static server**: Production-ready static hosting with security headers.
