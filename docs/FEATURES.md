# ShadowCheck Feature Catalog

**Wiki version (diagrams):** [Features](../.github/wiki/Features.md)

This catalog summarizes the capabilities implemented across the ShadowCheck codebase (UI pages, administrative console tabs, REST API modules, backend services, and forensic data pipelines). It complements the deeper architectural documents under `docs/features/`.

---

## 1. Core UI Navigation & Pages

- **Dashboard (`/dashboard` or `/`)**: Real-time signals intelligence overview, high-threat detections, radio distribution breakdowns, and activity telemetry.
- **Geospatial Explorer (`/geospatial-explorer`)**: Mapbox GL JS + Deck.gl interactive map with synchronized data table, radius/pin-drop spatial filtering, sibling topology links, and nearest law enforcement/courthouse overlays.
- **Analytics (`/analytics`)**: Temporal RF activity heatmaps, radio type trends, signal strength distributions, and network lifetime statistics.
- **WiGLE Interface (`/wigle`)**: WiGLE V2 search coordinator, V3 forensic detail inspection, enrichment queue monitoring, and Kepler GeoJSON export.
- **Kepler Visualizer (`/kepler`)**: High-performance GeoJSON spatial visualizer powered by Kepler.gl with lazy-loaded tooltips.
- **System Monitoring (`/monitoring`)**: Background daemon runtime status, job execution history, and ingestion queue statistics.
- **Administrative Console (`/admin`)**: 18 specialized management and forensic tooling tabs.

---

## 2. Administrative Console (18 Tabs)

1. **Configuration (`config`)**: Runtime feature flag controls, API rate limits, environment diagnostics.
2. **Automation (`jobs`)**: Background job scheduling (Materialized view refresh, ML behavioral scoring, surveillance scoring).
3. **DB Stats (`db-stats`)**: PostgreSQL table sizes, index utilization metrics, materialized view health, sibling pair counts.
4. **WiGLE Stats (`wigle-stats`)**: Daily WiGLE API quota metrics, ledger request history, and bounding box coverage stats.
5. **API Testing (`api`)**: Interactive client-side test suite executing queries against registered backend REST endpoints.
6. **ML Training (`ml`)**: _(Feature-gated)_ Dataset preparation, training, and evaluation of logistic regression threat models.
7. **WiGLE Search (v2) (`wigle`)**: Multi-filter V2 search interface with geographic bounding boxes and import run management.
8. **WiGLE Detail (v3) (`wigle-detail`)**: Deep forensic network lookup (Wi-Fi & Bluetooth), trilaterated centroids, and batch v3 enrichment.
9. **Data Import (`imports`)**: Ingest pipelines for KML, CSV, JSON, and WiGLE archive files with row-level transaction savepoints.
10. **VisINT Uploader (`visint`)**: Field image upload, EXIF extraction, and spatial-temporal observation correlation with explicit commit gating.
11. **Backups (`backups`)**: PostgreSQL database backup creation, S3 archiving, and restoration tooling.
12. **Data Export (`exports`)**: Filter-aware export engine streaming GeoJSON, KML, CSV, and SQLite datasets.
13. **Geocoding (`geocoding`)**: Geocoding daemon controls, cache hit statistics, and address enrichment backlog processing.
14. **AWS (`aws`)**: AWS Secrets Manager, Bedrock AI integration, and S3 connectivity verification.
15. **PgAdmin (`pgadmin`)**: _(Feature-gated)_ Embedded Dockerized pgAdmin management interface.
16. **Users (`users`)**: User account provisioning, role-based access control (`admin`/`user`), and active session revocation.
17. **SIGINT Library (`sigint-library`)**: Surveillance device signature catalog, OUI database, bodycam (BWC) signatures, and manufacturer reference guides.
18. **Badge Studio (`badge-studio`)**: _(Feature-gated)_ Visual customizer for network badge styling in the Explorer table.

---

## 3. Universal Filter Engine

- **30+ Filter Parameters**: Temporal scopes (`FIRST_SEEN`, `LAST_SEEN`, `NETWORK_LIFETIME`), signal thresholds (RSSI), radio types (`W`, `E`, `B`, `L`, `N`, `G`), encryption standards, and geofences.
- **SSID Query Syntax**: Full support for pipe-OR syntax (`fbi|surveillance` matches either term) and comma-AND syntax (`fbi,surveillance` requires both).
- **BSSID Wildcards**: Pattern matching supporting `*` and `?` in BSSID filters.
- **WiGLE Persistence Filters**: Universally available filters for observation counts, QoS quality scores, and import dates.

---

## 4. Geospatial & Forensic Analysis

- **Materialized View Caching**: Core spatial queries accelerated via `app.api_network_explorer_mv` and PostGIS geography indexing.
- **VISINT Correlation**: Spatio-temporal correlation linking field photographs to wireless observations via EXIF coordinates, time windows, and signature levels (0–4).
- **Sibling Detection Engine**: Undirected graph inference linking multi-radio access points based on MAC octet arithmetic (`MAX_OCTET_DELTA: 6`, `MAX_DISTANCE_M: 1500`) and 148 fleet SSID exclusion rules.
- **Reference Surveillance Layers**: Automated matching against DeFlock ALPR camera datasets, ShotSpotter acoustic gunshot sensors, and Federal facility overlays.

---

## 5. Security & Authentication

- **Role-Based Access Control**: Strict role separation (`admin` vs `user`) enforced by API middleware (`requireAuth`, `requireAdmin`).
- **Session Management**: Secure HttpOnly cookie sessions backed by Redis 7 and SHA-256 session token hashing.
- **Password Security**: Bcrypt password hashing (12 rounds) with forced first-login password rotation.
- **Runtime Secret Injection**: Zero credentials on disk; production secrets dynamically retrieved from AWS Secrets Manager (`shadowcheck/config`).
