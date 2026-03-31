# ShadowCheck Feature Catalog

**Wiki version (diagrams):** [Features](../.github/wiki/Features.md)

This catalog summarizes the features implemented in the current ShadowCheck codebase (UI routes, API modules, services, and data pipelines). It complements the deeper feature docs under `docs/features/`.

## Core UI & Exploration

- **Dashboard**: Real-time metrics cards, threat indicators, and filter-aware summaries.
- **Geospatial Intelligence**: Map-based analysis with heatmaps, routes, and timeline overlays driven by the unified filter system.
- **Geospatial Explorer**: Interactive map view with network selection, tooltips, and map controls.
- **Networks Explorer**: Filtered network table with sorting, selection, and manufacturer/band cues.
- **Threats Explorer**: Strong-signal candidate list with quick triage.
- **Analytics**: Temporal activity, radio-type trends, and threat score charts.
- **WiGLE Page**: Local WiGLE data search with optional live API lookups.
- **Kepler Page**: Kepler.gl-ready GeoJSON feeds with filter support.
- **Kepler Data Policy**: Kepler endpoints do not apply default limits; use filters/bbox instead.
- **API Test Page**: Endpoint smoke tests and response inspection.
- **Admin Page**: Configuration workflows and operational controls.

## Universal Filter System

- **20+ filter types** spanning time, signal, radio, security, distance, geography, tags, and device attributes.
- **Page-scoped filters** with URL sync and debounced application.
- **Distance-from-home filters** backed by stored home location markers.

## Geospatial & Mapping

- **Mapbox integration**: Token management, style proxying, and request proxy for client egress safety.
- **Google Maps tiles**: Server-side tile proxy with key management.
- **Heatmaps, routes, and timelines**: Geospatial overlays for movement and activity patterns.
- **Location markers & home location**: CRUD for saved markers plus radius-based home zone.
- **Unified tooltips**: Consistent, rich hover tooltips across map views.

## Agency & Judicial Infrastructure

Comprehensive datasets of federal law enforcement and judicial locations for geospatial correlation and proximity analysis.

### Dataset Composition

- **FBI Field Offices**: 56 primary offices with 100% precise coordinate and ZIP+4 coverage.
- **FBI Resident Agencies**: 334 satellite offices with 93.4% ZIP+4 coverage and inferred parent-office relationships.
- **Federal Courthouses**: 357 records covering all 94 US District Courts and all 13 Circuits.
- **Spatial Accuracy**: 100% PostGIS POINT coverage for all 747 infrastructure locations.
- **Contact Info**: Normalized 10-digit phone numbers and verified website URLs.

### Data Engineering

- **Judicial Alignment**: Courthouses are categorized by type (District, Appeals, Bankruptcy, Specialty) and mapped to their respective Circuits.
- **Normalization**: Addresses standardized via Smarty; judicial naming cleaned for professional display.
- **PostGIS Integration**: high-performance spatial queries using `ST_Distance` (spheroid) for accurate forensic proximity analysis.

## Data & Enrichment

- **Multi-API address enrichment**: OpenCage, LocationIQ, and Overpass support.
- **Radio Manufacturer Standardization**: High-fidelity cleanup of 74,000+ records applying professional Title Casing and acronym preservation (IBM, NEC, TRW, LLC, Inc., etc.).
- **Network tagging**: Manual classification and forensic note-taking.
- **Trilateration**: Estimated access point locations derived from weighted observation centroids.
- **Export tooling**: Streamed CSV, JSON, and GeoJSON exports.

## Threat Detection & ML

- **Threat scoring**: Rule-based scoring with ML-assisted boosts.
- **ML training endpoint**: Logistic regression model training and scoring pipeline.
- **ML iteration script**: Offline model comparison (logistic regression, random forest, gradient boosting).
- **Threat analytics**: Quick and detailed threat detection endpoints.

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
