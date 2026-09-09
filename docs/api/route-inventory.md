# Express Route Inventory

This file provides an exhaustive inventory of all active Express routes defined in the ShadowCheck backend.

---

## 1. Route Mounting Assumptions & Architecture

The API router is mounted and gated in the server startup lifecycle via:

1. **Route Registry Loader**: `server/src/utils/serverDependencies.ts` imports the route files.
2. **Mount Coordinator**: `server/src/core/initialization/routesInit.ts` passes the route files to the mount helper.
3. **Mounting Controller**: `server/src/utils/routeMounts.ts` defines the express path prefixes and sets up the middleware gates.

### Middleware Gate Logic

- **Public**: No authentication required.
- **`userGate`**: Requires a valid session token (cookie) or a Bearer token (`requireAuth`). Enabled unless `API_GATE_ENABLED` env var is explicitly `false`.
- **`adminGate`**: Requires a valid session token and the `admin` role (`requireAdmin`).

### Double `/api` Path Correction

Previously, due to a prefix mismatch in child router nesting, the tag removal endpoint resolved as `DELETE /api/api/admin/network-tags/remove`. This has been corrected to the canonical `DELETE /api/admin/network-tags/remove` route.

---

## 2. Complete Route Inventory

### A. Health & Core

- Mounted at `/` and `/api` (Public).
- Source: `server/src/api/routes/v1/health.ts`

| Method | Full Path     | Source Line | Classification | Documented | Notes               |
| ------ | ------------- | ----------- | -------------- | ---------- | ------------------- |
| GET    | `/health`     | L8          | Stable Public  | Yes        | Simple health check |
| GET    | `/api/health` | L8          | Stable Public  | Yes        | Simple health check |

---

### B. Authentication

- Mounted at `/api` (Public endpoints; inner route files define specific gates).
- Source: `server/src/api/routes/v1/auth.ts`

| Method | Full Path                   | Source Line | Classification | Documented | Notes        |
| ------ | --------------------------- | ----------- | -------------- | ---------- | ------------ |
| POST   | `/api/auth/login`           | L29         | Stable Public  | Yes        | Rate limited |
| POST   | `/api/auth/logout`          | L72         | Stable Public  | Yes        |              |
| GET    | `/api/auth/me`              | L101        | Stable Public  | Yes        |              |
| POST   | `/api/auth/change-password` | L136        | Stable Public  | No         | Rate limited |

---

### C. Mobile Ingest

- Mounted at `/v1/ingest` and `/api/v1/ingest` (API key authentication).
- Source: `server/src/api/routes/v1/mobileIngest.ts`

| Method | Full Path                       | Source Line | Classification | Documented | Notes               |
| ------ | ------------------------------- | ----------- | -------------- | ---------- | ------------------- |
| POST   | `/v1/ingest/request-upload`     | L70         | Stable Public  | Yes        | Presigned S3 upload |
| POST   | `/v1/ingest/complete`           | L117        | Stable Public  | Yes        | Records ETL job     |
| POST   | `/api/v1/ingest/request-upload` | L70         | Stable Public  | No         | Presigned S3 upload |
| POST   | `/api/v1/ingest/complete`       | L117        | Stable Public  | No         | Records ETL job     |

---

### D. Geospatial & Utilities

- Mounted at `/` (Public endpoints).
- Source: `server/src/api/routes/v1/geospatial.ts` & `v1/geocoding.ts`

| Method | Full Path                              | Source Line | Classification | Documented | Notes                         |
| ------ | -------------------------------------- | ----------- | -------------- | ---------- | ----------------------------- |
| GET    | `/api/mapbox-token`                    | L97         | Stable Public  | Yes        |                               |
| GET    | `/api/mapbox-style`                    | L128        | Stable Public  | Yes        |                               |
| GET    | `/api/mapbox-proxy`                    | L172        | Stable Public  | Yes        |                               |
| GET    | `/api/google-maps-token`               | L224        | Stable Public  | Yes        |                               |
| GET    | `/api/google-maps-tile/:type/:z/:x/:y` | L246        | Stable Public  | Yes        |                               |
| POST   | `/api/geocode`                         | L11         | Stable Public  | Yes        | Mounted via `v1/geocoding.ts` |
| POST   | `/api/import/wigle`                    | L13         | Stable Public  | Yes        | Imports local WiGLE files     |
| GET    | `/api/data-quality`                    | L13         | Stable Public  | Yes        | Observation quality metrics   |
| GET    | `/data-quality`                        | L13         | Stable Public  | Yes        | Legacy root-mounted alias     |

---

### E. Public Reference

- Mounted at `/` (Public endpoints).
- Source: `server/src/api/routes/v1/agencyOffices.ts`, `federalCourthouses.ts`, `deflockCameras.ts`, `shotspotterZones.ts`, `shotspotterSensors.ts`

| Method | Full Path                                  | Source Line | Classification | Documented | Notes                       |
| ------ | ------------------------------------------ | ----------- | -------------- | ---------- | --------------------------- |
| GET    | `/agency-offices`                          | L10         | Stable Public  | Yes        | FBI Field/Resident agencies |
| GET    | `/agency-offices/count`                    | L27         | Stable Public  | Yes        | FBI offices metadata counts |
| GET    | `/federal-courthouses`                     | L10         | Stable Public  | Yes        | Federal courthouse markers  |
| GET    | `/api/v1/surveillance/deflock-cameras`     | L10         | Stable Public  | No         | DeFlock ALPR layers         |
| GET    | `/api/v1/surveillance/shotspotter-zones`   | L10         | Stable Public  | No         | Gunshot detection coverages |
| GET    | `/api/v1/surveillance/shotspotter-sensors` | L10         | Stable Public  | No         | Acoustic sensor points      |

---

### F. Settings

- Mounted at `/api` (Gated by `adminGate`).
- Source: `server/src/api/routes/v1/settings.ts`, `settingsSecretRoutes.ts`, and `settingsMultiSecretRoutes.ts`

| Method | Full Path                        | Source Line | Classification              | Documented | Notes                       |
| ------ | -------------------------------- | ----------- | --------------------------- | ---------- | --------------------------- |
| GET    | `/api/settings/aws`              | L24         | Stable Public               | Yes        |                             |
| POST   | `/api/settings/aws`              | L40         | Stable Public               | Yes        |                             |
| POST   | `/api/settings/reload-secrets`   | L61         | Stable Public               | Yes        | Reloads AWS cache           |
| GET    | `/api/settings/mapbox-unlimited` | L57         | Admin / Operator / Manual   | Yes        | Provider setting status     |
| POST   | `/api/settings/mapbox-unlimited` | L57         | Admin / Operator / Manual   | Yes        | Updates provider setting    |
| GET    | `/api/settings/google-maps`      | L66         | Admin / Operator / Manual   | Yes        | Provider credential status  |
| POST   | `/api/settings/google-maps`      | L66         | Admin / Operator / Manual   | Yes        | Updates provider credential |
| GET    | `/api/settings/opencage`         | L76         | Admin / Operator / Manual   | Yes        | Provider credential status  |
| POST   | `/api/settings/opencage`         | L76         | Admin / Operator / Manual   | Yes        | Updates provider credential |
| GET    | `/api/settings/geocodio`         | L85         | Admin / Operator / Manual   | Yes        | Provider credential status  |
| POST   | `/api/settings/geocodio`         | L85         | Admin / Operator / Manual   | Yes        | Updates provider credential |
| GET    | `/api/settings/locationiq`       | L94         | Admin / Operator / Manual   | Yes        | Provider credential status  |
| POST   | `/api/settings/locationiq`       | L94         | Admin / Operator / Manual   | Yes        | Updates provider credential |
| GET    | `/api/settings/list`             | L172        | Stable Public               | No         | Settings registry           |
| GET    | `/api/settings/wigle`            | L17         | Stable Public               | No         |                             |
| POST   | `/api/settings/wigle`            | L31         | Stable Public               | No         |                             |
| GET    | `/api/settings/wigle/test`       | L95         | Stable Public               | No         | Tests WiGLE API connection  |
| GET    | `/api/settings/mapbox`           | L126        | Admin / Operator / Manual   | Yes        | Provider credential status  |
| POST   | `/api/settings/mapbox`           | L139        | Admin / Operator / Manual   | Yes        | Updates provider credential |
| DELETE | `/api/settings/mapbox/:label`    | L163        | Stable Public / Destructive | No         |                             |
| GET    | `/api/settings/smarty`           | L183        | Stable Public               | No         | Address normalization keys  |
| POST   | `/api/settings/smarty`           | L197        | Stable Public               | No         |                             |

---

### G. Networks v1

- Mounted at `/api` (Gated by `userGate`).
- Source: `server/src/api/routes/v1/networks/` (index mounts sub-files) & `threats.ts`

| Method | Full Path                                 | Source File                    | Classification              | Documented | Notes                      |
| ------ | ----------------------------------------- | ------------------------------ | --------------------------- | ---------- | -------------------------- |
| GET    | `/api/networks`                           | `list/index.ts` (L12)          | Stable Public               | Yes        | Paginated list             |
| GET    | `/api/networks/observations/:bssid`       | `observations.ts` (L147)       | Stable Public               | Yes        |                            |
| GET    | `/api/networks/:bssid/wigle-observations` | `observations.ts` (L182)       | Stable Public               | Yes        |                            |
| POST   | `/api/networks/wigle-observations/batch`  | `observations.ts` (L260)       | Stable Public               | Yes        |                            |
| POST   | `/api/observations/correlate-visint`      | `observations.ts` (L369)       | Manual-Only / Dangerous     | Yes        | Defaults to preview        |
| POST   | `/api/observations/attach-visint`         | `observations.ts` (L431)       | Manual-Only / Dangerous     | Yes        | Persistence                |
| GET    | `/api/networks/search/:ssid`              | `search.ts` (L28)              | Stable Public               | Yes        |                            |
| GET    | `/api/networks/tagged`                    | `tags.ts` (L42)                | Stable Public               | Yes        |                            |
| POST   | `/api/tag-network`                        | `tags.ts` (L106)               | Stable Public               | No         |                            |
| DELETE | `/api/tag-network/:bssid`                 | `tags.ts` (L157)               | Stable Public / Destructive | No         |                            |
| POST   | `/api/networks/tag-threats`               | `tags.ts` (L180)               | Stable Public               | Yes        |                            |
| GET    | `/api/networks/:bssid/notes`              | `notes.ts` (L27)               | Stable Public               | No         |                            |
| POST   | `/api/networks/:bssid/notes`              | `notes.ts` (L43)               | Stable Public               | No         |                            |
| PATCH  | `/api/networks/:bssid/notes/:noteId`      | `notes.ts` (L71)               | Stable Public               | No         |                            |
| DELETE | `/api/networks/:bssid/notes/:noteId`      | `notes.ts` (L99)               | Stable Public / Destructive | No         |                            |
| GET    | `/api/manufacturer/:bssid`                | `manufacturer.ts` (L40)        | Stable Public               | Yes        |                            |
| GET    | `/api/manufacturer/:bssid/networks`       | `manufacturer.ts` (L79)        | Stable Public               | No         |                            |
| GET    | `/api/networks/nearest-agencies/:bssid`   | `v1/network-agencies.ts` (L12) | Stable Public               | No         | Powers tooltip layers      |
| POST   | `/api/networks/nearest-agencies/batch`    | `v1/network-agencies.ts` (L34) | Stable Public               | No         |                            |
| POST   | `/api/networks/nearest-courthouses/batch` | `v1/network-agencies.ts` (L64) | Stable Public               | No         |                            |
| GET    | `/api/threats/quick`                      | `threats.ts` (L33)             | Authenticated User          | Yes        | Paginated threat detection |
| GET    | `/api/threats/detect`                     | `threats.ts` (L76)             | Authenticated User          | Yes        | Detailed threat analysis   |

---

### H. Network Tags v1

- Mounted at `/api` (Gated by `userGate`).
- Source: `server/src/api/routes/v1/network-tags/` (index mounts sub-files)

| Method | Full Path                              | Source File            | Classification              | Documented | Notes |
| ------ | -------------------------------------- | ---------------------- | --------------------------- | ---------- | ----- |
| GET    | `/api/network-tags`                    | `listTags.ts` (L72)    | Stable Public               | Yes        |       |
| GET    | `/api/network-tags/:bssid`             | `listTags.ts` (L39)    | Stable Public               | Yes        |       |
| POST   | `/api/network-tags/:bssid`             | `manageTags.ts` (L37)  | Stable Public               | Yes        |       |
| PATCH  | `/api/network-tags/:bssid/ignore`      | `manageTags.ts` (L98)  | Stable Public               | Yes        |       |
| PATCH  | `/api/network-tags/:bssid/threat`      | `manageTags.ts` (L138) | Stable Public               | Yes        |       |
| PATCH  | `/api/network-tags/:bssid/notes`       | `manageTags.ts` (L187) | Stable Public               | Yes        |       |
| PATCH  | `/api/network-tags/:bssid/investigate` | `manageTags.ts` (L215) | Stable Public               | Yes        |       |
| DELETE | `/api/network-tags/:bssid`             | `manageTags.ts` (L237) | Stable Public / Destructive | Yes        |       |
| GET    | `/api/network-tags/export/ml`          | `manageTags.ts` (L261) | Stable Public               | Yes        |       |

---

### I. Networks v2 & Threats v2

- Mounted at `/api` & `/api/v2` (Gated by `userGate`).
- Source: `server/src/api/routes/v2/`

| Method | Full Path                                   | Source File           | Classification  | Documented | Notes                                |
| ------ | ------------------------------------------- | --------------------- | --------------- | ---------- | ------------------------------------ |
| GET    | `/api/v2/networks`                          | `networks.ts` (L12)   | Stable Public   | Yes        |                                      |
| GET    | `/api/v2/networks/:bssid`                   | `networks.ts` (L26)   | Stable Public   | Yes        | Details + timeline + ML              |
| GET    | `/api/dashboard/metrics`                    | `dashboard.ts` (L124) | Stable Public   | Yes        | Canonical v1 metrics                 |
| GET    | `/api/v2/dashboard/metrics`                 | `networks.ts` (L35)   | Stable Public   | Yes        |                                      |
| GET    | `/api/v2/threats/map`                       | `networks.ts` (L43)   | Stable Public   | Yes        |                                      |
| POST   | `/api/v2/networks/batch`                    | `networks.ts` (L53)   | Stable Public   | No         | Batch lookup                         |
| GET    | `/api/v2/networks/filtered`                 | `filtered.ts` (L32)   | Stable Public   | Yes        | Universal filters list               |
| GET    | `/api/v2/networks/filtered/geospatial`      | `filtered.ts` (L33)   | Stable Public   | Yes        |                                      |
| GET    | `/api/v2/networks/filtered/unmatched-media` | `filtered.ts` (L34)   | Stable Public   | Yes        | Networks with unmatched VISINT media |
| GET    | `/api/v2/networks/filtered/matched-media`   | `filtered.ts` (L35)   | Stable Public   | Yes        | Networks with matched VISINT media   |
| GET    | `/api/v2/networks/filtered/observations`    | `filtered.ts` (L36)   | Stable Public   | Yes        |                                      |
| POST   | `/api/v2/networks/filtered/observations`    | `filtered.ts` (L37)   | Stable Public   | Yes        | POST-body filter                     |
| GET    | `/api/v2/networks/filtered/analytics`       | `filtered.ts` (L38)   | Stable Public   | Yes        |                                      |
| GET    | `/api/v2/networks/filtered/debug`           | `filtered.ts` (L39)   | Internal Detail | No         | SQL debugging output                 |
| GET    | `/api/v2/threats/severity-counts`           | `threats.ts` (L19)    | Stable Public   | Yes        |                                      |

---

### J. Explorer

- Mounted at `/api` (Gated by `userGate`).
- Source: `server/src/api/routes/v1/explorer/networks.ts`

| Method | Full Path                      | Source Line | Classification | Documented | Notes                  |
| ------ | ------------------------------ | ----------- | -------------- | ---------- | ---------------------- |
| GET    | `/api/explorer/networks`       | L74         | Stable Public  | Yes        | Legacy paginated list  |
| GET    | `/api/explorer/networks-v2`    | L163        | Stable Public  | Yes        | Materialized view list |
| GET    | `/api/explorer/network/:bssid` | L239        | Stable Public  | Yes        | Single network details |

---

### K. Analytics

- Mounted at `/api` & `/analytics-public` (Gated by `userGate` / Public).
- Source: `server/src/api/routes/v1/analytics.ts` & `analytics-public.ts`

| Method | Full Path                             | Source File                 | Classification | Documented | Notes                 |
| ------ | ------------------------------------- | --------------------------- | -------------- | ---------- | --------------------- |
| GET    | `/api/analytics/network-types`        | `analytics.ts` (L22)        | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/signal-strength`      | `analytics.ts` (L44)        | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/temporal-activity`    | `analytics.ts` (L66)        | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/radio-type-over-time` | `analytics.ts` (L91)        | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/security`             | `analytics.ts` (L128)       | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/top-networks`         | `analytics.ts` (L153)       | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/dashboard`            | `analytics.ts` (L179)       | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/bulk`                 | `analytics.ts` (L199)       | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/threat-distribution`  | `analytics.ts` (L221)       | Stable Public  | Yes        |                       |
| GET    | `/api/analytics/threat-trends`        | `analytics.ts` (L246)       | Stable Public  | Yes        |                       |
| GET    | `/analytics-public/filtered`          | `analytics-public.ts` (L15) | Stable Public  | Yes        | Public map view proxy |

---

### L. Machine Learning

- Mounted at `/api` (Gated by `adminGate`).
- Source: `server/src/api/routes/v1/ml.ts`

| Method | Full Path                     | Source Line | Classification               | Documented | Notes               |
| ------ | ----------------------------- | ----------- | ---------------------------- | ---------- | ------------------- |
| GET    | `/api/ml/status`              | L63         | Admin / Operator             | Yes        |                     |
| POST   | `/api/ml/train`               | L88         | Admin / Operator / Dangerous | Yes        | Trains threat model |
| POST   | `/api/ml/score-all`           | L174        | Admin / Operator / Dangerous | Yes        | Scores database     |
| GET    | `/api/ml/scores/:bssid`       | L205        | Admin / Operator             | Yes        |                     |
| GET    | `/api/ml/scores/level/:level` | L234        | Admin / Operator             | Yes        |                     |

---

### M. Location Markers

- Mounted at `/api` (Gated by `userGate`).
- Source: `server/src/api/routes/v1/location-markers.ts` & `home-location.ts`

| Method | Full Path                    | Source File                 | Classification              | Documented | Notes                            |
| ------ | ---------------------------- | --------------------------- | --------------------------- | ---------- | -------------------------------- |
| GET    | `/api/location-markers`      | `location-markers.ts` (L9)  | Stable Public               | Yes        |                                  |
| GET    | `/api/location-markers/home` | `location-markers.ts` (L18) | Stable Public               | Yes        |                                  |
| POST   | `/api/location-markers/home` | `location-markers.ts` (L27) | Stable Public               | Yes        |                                  |
| DELETE | `/api/location-markers/home` | `location-markers.ts` (L65) | Stable Public / Destructive | Yes        |                                  |
| GET    | `/api/home-location`         | `home-location.ts` (L23)    | Stable Public               | Yes        |                                  |
| GET    | `/api/admin/home-location`   | `home-location.ts` (L40)    | Admin / Operator            | Yes        |                                  |
| POST   | `/api/admin/home-location`   | `home-location.ts` (L58)    | Admin / Operator / Manual   | Yes        | Sets home coordinates and radius |

---

### N. Claude AI

- Mounted at `/api` (Gated by `userGate`).
- Source: `server/src/api/routes/v1/claude.ts` & `threat-report.ts`

| Method | Full Path                         | Source File              | Classification            | Documented | Notes                 |
| ------ | --------------------------------- | ------------------------ | ------------------------- | ---------- | --------------------- |
| POST   | `/api/claude/analyze-networks`    | `claude.ts` (L20)        | Stable Public             | Yes        | AWS Bedrock caller    |
| GET    | `/api/claude/insights`            | `claude.ts` (L91)        | Stable Public             | Yes        |                       |
| PATCH  | `/api/claude/insights/:id/useful` | `claude.ts` (L107)       | Stable Public             | Yes        |                       |
| GET    | `/api/claude/test`                | `claude.ts` (L129)       | Stable Public / Test-only | Yes        | Connection ping check |
| GET    | `/api/reports/threat/:bssid`      | `threat-report.ts` (L17) | Stable Public             | Yes        |                       |

---

### O. WiGLE Subdirectory Endpoints

- Mounted at `/api/wigle` (Gated by `userGate` / `adminGate`).
- Source: `server/src/api/routes/v1/wigle/`

| Method | Full Path                                                | Source File             | Classification                 | Documented | Notes                            |
| ------ | -------------------------------------------------------- | ----------------------- | ------------------------------ | ---------- | -------------------------------- |
| GET    | `/api/wigle/api-status`                                  | `status.ts` (L15)       | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/quota-status`                                | `status.ts` (L26)       | Admin / Operator               | Yes        |                                  |
| POST   | `/api/wigle/quota-reset`                                 | `status.ts` (L36)       | Admin / Operator / Dangerous   | Yes        |                                  |
| GET    | `/api/wigle/live/:bssid`                                 | `live.ts` (L19)         | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/network/:bssid`                              | `database.ts` (L90)     | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/search`                                      | `database.ts` (L106)    | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/networks-v2`                                 | `database.ts` (L126)    | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/networks-v3`                                 | `database.ts` (L179)    | Stable Public                  | Yes        | enriched with local metrics      |
| GET    | `/api/wigle/kml-bssid-summary`                           | `database.ts` (L244)    | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/kml-points`                                  | `database.ts` (L259)    | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/page/network/:netid`                         | `database.ts` (L72)     | Stable Public                  | Yes        | Full detail panel loader         |
| GET    | `/api/wigle/observations/:netid`                         | `observations.ts` (L22) | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/user-stats`                                  | `stats.ts` (L20)        | Stable Public                  | Yes        |                                  |
| GET    | `/api/wigle/ledger`                                      | `ledger.ts` (L27)       | Admin / Operator               | No         | Request ledger history           |
| PATCH  | `/api/wigle/soft-limits`                                 | `ledger.ts` (L217)      | Admin / Operator / Dangerous   | No         |                                  |
| POST   | `/api/wigle/detail/batch`                                | `detail.ts` (L23)       | Admin / Operator               | No         |                                  |
| POST   | `/api/wigle/detail/:netid`                               | `detail.ts` (L99)       | Admin / Operator               | Yes        |                                  |
| POST   | `/api/wigle/detail/bt/:netid`                            | `detail.ts` (L115)      | Admin / Operator               | Yes        |                                  |
| POST   | `/api/wigle/import/v3`                                   | `detail.ts` (L131)      | Admin / Operator               | Yes        |                                  |
| GET    | `/api/wigle/search-api`                                  | `search.ts` (L28)       | Admin / Operator / Manual      | Yes        | Remote API search                |
| POST   | `/api/wigle/search-api`                                  | `search.ts` (L28)       | Admin / Operator / Manual      | Yes        | Remote API search with import    |
| POST   | `/api/wigle/search-api/import-all`                       | `search.ts` (L61)       | Admin / Operator / Dangerous   | No         |                                  |
| GET    | `/api/wigle/search-api/import-runs`                      | `search.ts` (L101)      | Admin / Operator               | Yes        | Docs had stale `/api/v1/` prefix |
| GET    | `/api/wigle/search-api/import-runs/completeness/summary` | `search.ts` (L134)      | Admin / Operator               | No         |                                  |
| GET    | `/api/wigle/search-api/import-runs/:id`                  | `search.ts` (L151)      | Admin / Operator               | Yes        | Docs had stale `/api/v1/` prefix |
| DELETE | `/api/wigle/search-api/import-runs/:id`                  | `search.ts` (L172)      | Admin / Operator / Destructive | Yes        | Docs had stale `/api/v1/` prefix |
| POST   | `/api/wigle/search-api/import-runs/resume-latest`        | `search.ts` (L193)      | Admin / Operator / Dangerous   | No         |                                  |
| GET    | `/api/wigle/search-api/import-runs/resumable/latest`     | `search.ts` (L212)      | Admin / Operator               | No         |                                  |
| POST   | `/api/wigle/search-api/import-runs/:id/resume`           | `search.ts` (L229)      | Admin / Operator / Dangerous   | Yes        | Docs had stale `/api/v1/` prefix |
| POST   | `/api/wigle/search-api/import-runs/:id/pause`            | `search.ts` (L248)      | Admin / Operator / Dangerous   | Yes        | Docs had stale `/api/v1/` prefix |
| POST   | `/api/wigle/search-api/import-runs/:id/cancel`           | `search.ts` (L265)      | Admin / Operator / Dangerous   | Yes        | Docs had stale `/api/v1/` prefix |
| GET    | `/api/wigle/search-api/saved-ssid-terms`                 | `search.ts` (L285)      | Admin / Operator               | No         |                                  |
| POST   | `/api/wigle/search-api/saved-ssid-terms`                 | `search.ts` (L302)      | Admin / Operator               | No         |                                  |
| DELETE | `/api/wigle/search-api/saved-ssid-terms/:id`             | `search.ts` (L328)      | Admin / Operator / Destructive | No         |                                  |
| POST   | `/api/wigle/search-api/bt-import-start`                  | `search.ts` (L363)      | Admin / Operator / Dangerous   | No         |                                  |
| DELETE | `/api/wigle/search-api/import-runs/cluster-cleanup`      | `search.ts` (L395)      | Admin / Operator / Destructive | No         |                                  |
| GET    | `/api/wigle/enrichment/stats`                            | `enrichment.ts` (L19)   | Admin / Operator               | No         |                                  |
| GET    | `/api/wigle/enrichment/catalog`                          | `enrichment.ts` (L35)   | Admin / Operator               | No         |                                  |
| POST   | `/api/wigle/enrichment/start`                            | `enrichment.ts` (L58)   | Admin / Operator / Dangerous   | No         |                                  |
| POST   | `/api/wigle/enrichment/resume/:runId`                    | `enrichment.ts` (L85)   | Admin / Operator / Dangerous   | No         |                                  |
| POST   | `/api/wigle/enrichment/force-clear/:runId`               | `enrichment.ts` (L98)   | Admin / Operator / Dangerous   | No         |                                  |

---

### P. Admin / System Endpoints (gated by `adminGate`)

- Mounted at `/api` (Gated by `adminGate` / `requireAdmin`).
- Source: `server/src/api/routes/v1/admin/` & `admin.ts`

| Method | Full Path                                        | Source File / Line                 | Classification                 | Documented | Notes                              |
| ------ | ------------------------------------------------ | ---------------------------------- | ------------------------------ | ---------- | ---------------------------------- |
| GET    | `/api/observations/check-duplicates/:bssid`      | `admin.ts` (L83)                   | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/test`                                | `admin.ts` (L118)                  | Internal / Test-only           | Yes        |                                    |
| POST   | `/api/admin/add-note`                            | `admin.ts` (L133)                  | Deprecated / Legacy            | Yes        | Replaced by network-notes          |
| GET    | `/api/admin/network-summary/:bssid`              | `admin.ts` (L145)                  | Admin / Operator               | Yes        |                                    |
| GET    | `/api/demo/context-menu`                         | `admin.ts` (L169)                  | Internal Detail                | Yes        | Context menu html page             |
| POST   | `/api/admin/cleanup-duplicates`                  | `admin/maintenance.ts` (L14)       | Admin / Destructive            | Yes        |                                    |
| POST   | `/api/admin/refresh-colocation`                  | `admin/maintenance.ts` (L37)       | Admin / Dangerous              | Yes        |                                    |
| POST   | `/api/admin/import-sqlite`                       | `admin/import/sqlite.js` (L19)     | Manual-Only / Dangerous        | Yes        | SQLite wardrive upload             |
| POST   | `/api/admin/import-sql`                          | `admin/import/sql.js` (L14)        | Manual-Only / Dangerous        | No         | SQL dump upload                    |
| POST   | `/api/admin/import-kml`                          | `admin/import/kml.js` (L48)        | Manual-Only / Dangerous        | No         | KML file list upload               |
| GET    | `/api/admin/kml-imports`                         | `admin/import/kml.js` (L38)        | Admin / Operator               | No         |                                    |
| GET    | `/api/admin/wigle-kml-sync/status`               | `admin/import/kml.js` (L238)       | Admin / Operator               | No         |                                    |
| GET    | `/api/admin/wigle-kml-sync/transactions`         | `admin/import/kml.js` (L280)       | Admin / Operator               | No         |                                    |
| POST   | `/api/admin/wigle-kml-sync/sync`                 | `admin/import/kml.js` (L296)       | Admin / Operator / Dangerous   | No         |                                    |
| GET    | `/api/admin/orphan-networks`                     | `admin/import/orphans.js` (L14)    | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/orphan-networks/:bssid/check-wigle`  | `admin/import/orphans.js` (L40)    | Admin / Operator / Dangerous   | Yes        |                                    |
| GET    | `/api/admin/import-history`                      | `admin/import/history.js` (L9)     | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/device-sources`                      | `admin/import/history.js` (L41)    | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/import/mobile/:uploadId/start`       | `admin/import/history.js` (L19)    | Admin / Operator / Dangerous   | No         |                                    |
| POST   | `/api/admin/network-media/upload`                | `admin/media.ts` (L14)             | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/network-media/:bssid`                | `admin/media.ts` (L57)             | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/network-media/download/:id`          | `admin/media.ts` (L75)             | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/network-media/:id/inline`            | `admin/media.ts` (L105)            | Admin / Operator               | Yes        | Inline full/thumbnail media        |
| POST   | `/api/admin/network-notations/add`               | `admin/notes.ts` (L15)             | Deprecated / Legacy            | Yes        |                                    |
| GET    | `/api/admin/network-notations/:bssid`            | `admin/notes.ts` (L47)             | Deprecated / Legacy            | Yes        |                                    |
| POST   | `/api/admin/network-notes/add`                   | `admin/notes.ts` (L65)             | Admin / Operator               | Yes        | Right-click context note           |
| GET    | `/api/admin/network-notes/:bssid`                | `admin/notes.ts` (L100)            | Admin / Operator               | Yes        |                                    |
| DELETE | `/api/admin/network-notes/:noteId`               | `admin/notes.ts` (L123)            | Admin / Destructive            | Yes        |                                    |
| POST   | `/api/admin/network-notes/:noteId/media`         | `admin/notes.ts` (L138)            | Admin / Operator               | No         |                                    |
| GET    | `/api/admin/network-notes/:noteId/media`         | `admin/notes.ts` (L145)            | Admin / Operator               | No         |                                    |
| DELETE | `/api/admin/network-notes/media/:mediaId`        | `admin/notes.ts` (L166)            | Admin / Destructive            | No         |                                    |
| GET    | `/api/media/:filename`                           | `admin/notes.ts` (L191)            | Stable Public                  | Yes        | Serves general media files         |
| POST   | `/api/admin/network-tags/toggle`                 | `admin/tags.ts` (L14)              | Admin / Operator / Dangerous   | Yes        | Toggle tag on/off                  |
| DELETE | `/api/admin/network-tags/remove`                 | `admin/tags.ts` (L76)              | Admin / Operator / Destructive | Yes        | Corrected from double-prefix       |
| GET    | `/api/admin/network-tags/search`                 | `admin/tags.ts` (L104)             | Admin / Operator               | Yes        | Search networks by tags            |
| GET    | `/api/admin/network-tags/:bssid`                 | `admin/tags.ts` (L148)             | Admin / Operator               | Yes        | Get all tags for network           |
| GET    | `/api/admin/oui/groups`                          | `admin/oui.ts` (L21)               | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/oui/:oui/details`                    | `admin/oui.ts` (L40)               | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/oui/randomization/suspects`          | `admin/oui.ts` (L63)               | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/oui/analyze`                         | `admin/oui.ts` (L82)               | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/demo/oui-grouping`                   | `admin/oui.ts` (L102)              | Internal Detail                | No         |                                    |
| GET    | `/api/admin/pgadmin/status`                      | `admin/pgadmin.ts` (L10)           | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/pgadmin/start`                       | `admin/pgadmin.ts` (L28)           | Admin / Operator / Dangerous   | Yes        |                                    |
| POST   | `/api/admin/pgadmin/stop`                        | `admin/pgadmin.ts` (L55)           | Admin / Operator / Dangerous   | Yes        |                                    |
| POST   | `/api/admin/pgadmin/destroy`                     | `admin/pgadmin.ts` (L79)           | Admin / Operator / Destructive | No         | Removes pgadmin container          |
| GET    | `/api/admin/secrets`                             | `admin/secrets.ts` (L16)           | Admin / Operator               | No         |                                    |
| POST   | `/api/admin/secrets/:key`                        | `admin/secrets.ts` (L29)           | Admin / Operator / Dangerous   | No         |                                    |
| DELETE | `/api/admin/secrets/:key`                        | `admin/secrets.ts` (L44)           | Admin / Operator / Destructive | No         |                                    |
| GET    | `/api/admin/settings`                            | `admin/settings.ts` (L60)          | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/settings/jobs/status`                | `admin/settings.ts` (L82)          | Admin / Operator               | No         |                                    |
| POST   | `/api/admin/settings/jobs/:jobName/run`          | `admin/settings.ts` (L92)          | Admin / Operator / Dangerous   | Yes        |                                    |
| GET    | `/api/admin/settings/runtime`                    | `admin/settings.ts` (L134)         | Admin / Operator               | No         |                                    |
| POST   | `/api/admin/settings/local-stack/:action`        | `admin/settings.ts` (L171)         | Admin / Operator / Dangerous   | No         | Rebuilds local containers          |
| GET    | `/api/admin/settings/:key`                       | `admin/settings.ts` (L242)         | Admin / Operator               | Yes        |                                    |
| PUT    | `/api/admin/settings/:key`                       | `admin/settings.ts` (L260)         | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/settings/ml-blending/toggle`         | `admin/settings.ts` (L329)         | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/users`                               | `admin/users.ts` (L17)             | Admin / Operator               | No         |                                    |
| POST   | `/api/admin/users`                               | `admin/users.ts` (L27)             | Admin / Operator               | No         |                                    |
| PUT    | `/api/admin/users/:id/active`                    | `admin/users.ts` (L60)             | Admin / Operator               | No         |                                    |
| PUT    | `/api/admin/users/:id/password`                  | `admin/users.ts` (L89)             | Admin / Operator               | No         |                                    |
| GET    | `/api/admin/geocoding/stats`                     | `admin/geocoding.ts` (L25)         | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/geocoding/run`                       | `admin/geocoding.ts` (L39)         | Admin / Operator / Dangerous   | Yes        |                                    |
| GET    | `/api/admin/geocoding/daemon`                    | `admin/geocoding.ts` (L74)         | Admin / Operator / Dangerous   | Yes        |                                    |
| POST   | `/api/admin/geocoding/daemon`                    | `admin/geocoding.ts` (L93)         | Admin / Operator / Dangerous   | Yes        |                                    |
| DELETE | `/api/admin/geocoding/daemon`                    | `admin/geocoding.ts` (L116)        | Admin / Operator / Dangerous   | Yes        |                                    |
| POST   | `/api/admin/geocoding/test`                      | `admin/geocoding.ts` (L129)        | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/geocoding/requeue`                   | `admin/geocoding.ts` (L146)        | Admin / Operator / Dangerous   | No         |                                    |
| GET    | `/api/admin/aws/overview`                        | `admin/aws.ts` (L21)               | Admin / Operator / Manual      | Yes        | AWS identity and instance overview |
| POST   | `/api/admin/aws/instances/:instanceId/start`     | `admin/awsInstances.ts` (L22)      | Admin / Operator / Dangerous   | No         |                                    |
| POST   | `/api/admin/aws/instances/:instanceId/stop`      | `admin/awsInstances.ts` (L40)      | Admin / Operator / Dangerous   | No         |                                    |
| POST   | `/api/admin/aws/instances/:instanceId/reboot`    | `admin/awsInstances.ts` (L58)      | Admin / Operator / Dangerous   | No         |                                    |
| POST   | `/api/admin/aws/instances/:instanceId/terminate` | `admin/awsInstances.ts` (L76)      | Admin / Operator / Destructive | No         |                                    |
| GET    | `/api/backup`                                    | `backup.ts` (L9)                   | Admin / Operator               | Yes        | Legacy JSON backup export          |
| POST   | `/api/restore`                                   | `backup.ts` (L42)                  | Admin / Operator / Destructive | Yes        | Legacy JSON restore upload         |
| POST   | `/api/admin/backup`                              | `admin/backup.ts` (L11)            | Admin / Operator / Dangerous   | Yes        |                                    |
| GET    | `/api/admin/backup/s3`                           | `admin/backup.ts` (L24)            | Admin / Operator               | Yes        |                                    |
| DELETE | `/api/admin/backup/s3/:key`                      | `admin/backup.ts` (L52)            | Admin / Operator / Destructive | Yes        |                                    |
| GET    | `/api/admin/db-stats`                            | `admin/dbStats.ts` (L14)           | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/siblings/override`                   | `admin/siblings.ts` (L12)          | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/siblings/linked/:bssid`              | `admin/siblings.ts` (L66)          | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/siblings/component/:bssid`           | `admin/siblings.ts` (L98)          | Admin / Operator               | No         | Sibling graph traversal            |
| POST   | `/api/admin/siblings/linked-batch`               | `admin/siblings.ts` (L127)         | Admin / Operator               | Yes        |                                    |
| POST   | `/api/admin/siblings/refresh`                    | `admin/siblings.ts` (L163)         | Admin / Operator / Dangerous   | Yes        | Sibling pair detection             |
| POST   | `/api/admin/siblings/cancel`                     | `admin/siblings.ts` (L193)         | Admin / Operator / Dangerous   | No         |                                    |
| GET    | `/api/admin/siblings/refresh/status`             | `admin/siblings.ts` (L203)         | Admin / Operator               | Yes        |                                    |
| GET    | `/api/admin/siblings/stats`                      | `admin/siblings.ts` (L216)         | Admin / Operator               | Yes        |                                    |
| DELETE | `/api/admin/siblings/pairs`                      | `admin/siblings.ts` (L232)         | Admin / Operator / Destructive | No         | Purges the sibling pair graph      |
| GET    | `/api/admin/networks/:bssid/detection-evidence`  | `admin/detectionEvidence.ts` (L25) | Admin / Operator               | No         |                                    |
| POST   | `/api/admin/surveillance-detections/dry-run`     | `admin/detectionEvidence.ts` (L71) | Admin / Operator / Dangerous   | No         |                                    |

---

### Q. Dashboard & Exports

- Mounted at `/api` (Gated by `userGate`; full JSON export also requires admin).
- Source: `server/src/api/routes/v1/dashboard.ts`, `export.ts`, and `kepler.ts`

| Method | Full Path                  | Source File           | Classification     | Documented | Notes                       |
| ------ | -------------------------- | --------------------- | ------------------ | ---------- | --------------------------- |
| GET    | `/api/dashboard/summary`   | `dashboard.ts` (L144) | Authenticated User | Yes        | Dashboard summary metrics   |
| GET    | `/api/dashboard/threats`   | `dashboard.ts` (L126) | Authenticated User | Yes        | Dashboard threat list       |
| GET    | `/api/csv`                 | `export.ts` (L25)     | Authenticated User | Yes        | CSV observation export      |
| GET    | `/api/json`                | `export.ts` (L69)     | Authenticated User | Yes        | JSON data export            |
| GET    | `/api/json/full`           | `export.ts` (L96)     | Admin / Operator   | Yes        | Full JSON snapshot          |
| GET    | `/api/geojson`             | `export.ts` (L115)    | Authenticated User | Yes        | GeoJSON observation export  |
| GET    | `/api/kml`                 | `export.ts` (L161)    | Authenticated User | Yes        | KML export                  |
| GET    | `/api/kepler/data`         | `kepler.ts` (L18)     | Authenticated User | Yes        | Latest network observations |
| GET    | `/api/kepler/observations` | `kepler.ts` (L45)     | Authenticated User | Yes        | Kepler observation dataset  |
| GET    | `/api/kepler/networks`     | `kepler.ts` (L69)     | Authenticated User | Yes        | Kepler network summaries    |

---

## 3. Mount Refactoring & Cleanup Backlog

The following helper, duplicate, and legacy route mounts are flagged for potential removal or refactoring to keep the Express router clean and avoid exposure of unauthenticated testing interfaces:

1. **`GET /api/dashboard-metrics` (in `dashboard.ts`)** — **REMOVED**
   - _Status_: Legacy duplicate alias removed. Canonical route is `/api/dashboard/metrics` (v1) and `/api/v2/dashboard/metrics` (v2).
   - _Client callers migrated_: `client/src/api/dashboardApi.ts` → `/dashboard/metrics`.
   - _Integration tests migrated_: `tests/integration/dashboard-threat-parity.test.ts`.
   - _Scripts migrated_: `scripts/test-dashboard-filters.sh`.

2. **`GET /api/demo/oui-grouping` (in `dataQuality.ts`)**
   - _Status_: Duplicate public demo HTML page route.
   - _Reasoning_: Safe to omit from test endpoints registry. The secure version is already fully registered as `/api/admin/demo/oui-grouping` under Admin controls. The public route should be removed to prevent exposing developer demo tools.

3. **`GET /api/test-location` (in `location-markers.ts`)**
   - _Status_: Developer debug endpoint.
   - _Reasoning_: Simple JSON debug response `{ message: "Location routes working!" }`. Offers no production value.

4. **`GET /api/admin/notes-test` and `GET /api/admin/simple-test` (in `admin.ts`)**
   - _Status_: Early-development test controllers.
   - _Reasoning_: Return dummy string messages. Safe to prune from the admin router.
