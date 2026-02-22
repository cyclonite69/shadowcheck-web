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

## Weather FX & Atmospheric Visualization

A comprehensive system for visualizing current and historical weather conditions directly on the geospatial map.

### Real-Time Visualization

- **Dynamic Overlay**: Updates automatically based on the map center location.
- **Fog Effects**: Adjustable atmospheric fog density and color that shifts based on weather conditions (clear, cloudy, rainy, snowy).
- **Backend Proxy**: Uses `/api/weather` to fetch data from Open-Meteo, preventing CSP issues and hiding API interactions.
- **Toggle Modes**: `Off` | `Auto` (Real-time) | `Always Rain` | `Always Snow` for analysis or demonstration.

### Particle System

- **Canvas-based Rendering**: High-performance overlay (`WeatherParticleOverlay.ts`) capable of rendering thousands of particles without map lag.
- **Rain Animation**: Vertical streaks with varying opacity and speed to simulate depth.
- **Snow Animation**: Circular particles with sinusoidal drift to simulate wind effects.

### Historical Context

- **Observation Lookup**: Click on any historical WiFi observation point to trigger a weather lookup for that specific timestamp and location.
- **Data Points**: Displays Temperature (C/F), Humidity (%), Pressure (mb), Wind Speed (km/h), Precipitation, and Visibility.
- **Forensic Utility**: Correlate signal propagation anomalies with weather conditions (e.g., rain fade, ducting).

## Agency Offices Dataset

A comprehensive dataset of FBI field offices and resident agencies for geospatial correlation and proximity analysis.

### Dataset Composition

- **Field Offices**: 56 total primary offices. 100% coverage with ZIP+4 postal codes and precise coordinates.
- **Resident Agencies**: 334 total satellite offices. 93.4% (312/334) coverage with ZIP+4 postal codes.
- **Coordinates**: 100% (390/390) records have PostGIS POINT locations (Latitude/Longitude).
- **Contact Info**: 100% coverage for phone numbers (normalized to 10 digits) and primary websites.

### Data Engineering

- **Normalization**: Addresses normalized via Smarty; phones normalized to 10-digit E.164-lite format (no +1).
- **Inheritance**: Resident agencies inherit websites from their parent field offices or nearest regional offices.
- **PostGIS Integration**: Locations stored as `geometry(Point, 4326)` for high-performance spatial queries and distance calculations.
- **Metadata Strategy**: Original source values preserved in metadata (JSONB) to ensure auditability while using normalized fields for application logic.

## Data & Enrichment

- **Multi-API address enrichment**: OpenCage, LocationIQ, Abstract, and Overpass support.
- **Manufacturer/OUI resolution**: Populate vendor data from radio manufacturers.
- **Network tagging**: Manual classification and tag lookups.
- **Trilateration**: Estimate access point location from multiple observations.
- **Export tooling**: CSV, JSON, and GeoJSON exports for observations and networks.
- **Backup & restore**: JSON snapshot export with admin-protected restore workflow.

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

- **API versioning**: v1 and v2 endpoints with filtered network support.
- **Modular backend**: Services and repositories with validation middleware.
- **ETL pipeline**: Load/transform/promote steps feeding materialized views.
- **Static server**: Production-ready static hosting with security headers.
