# Server Routes Modularization Inventory

## Overview

This document provides a comprehensive inventory of the server codebase's route modularization status, cross-referencing against `server/src/utils/serverDependencies.ts`.

---

## Route Directory Structure

```
server/src/api/routes/
├── v1/
│   ├── admin.ts                    # Admin main router (MODULAR)
│   ├── admin/
│   │   ├── aws.ts
│   │   ├── awsInstances.ts
│   │   ├── backup.ts
│   │   ├── geocoding.ts
│   │   ├── import.ts
│   │   ├── maintenance.ts
│   │   ├── media.ts
│   │   ├── ml.ts                   # RE-EXPORT of ../ml.ts
│   │   ├── notes.ts
│   │   ├── oui.ts
│   │   ├── pgadmin.ts
│   │   ├── secrets.ts
│   │   ├── settings.ts
│   │   └── tags.ts
│   ├── admin-threat-scoring.ts
│   ├── agencyOffices.ts
│   ├── analytics-public.ts
│   ├── analytics.ts
│   ├── auth.ts
│   ├── backup.ts
│   ├── dashboard.ts
│   ├── explorer.ts                 # RE-EXPORT of ./explorer/index
│   ├── explorer/
│   │   ├── index.ts                # Explorer main router
│   │   ├── networks.ts
│   │   └── shared.js
│   ├── export.ts
│   ├── geospatial.ts               # MONOLITHIC
│   ├── health.ts
│   ├── home-location.ts
│   ├── kepler.ts                   # MONOLITHIC
│   ├── location-markers.ts
│   ├── misc.ts
│   ├── ml.ts
│   ├── network-agencies.ts
│   ├── network-tags.ts             # RE-EXPORT of ./network-tags/index
│   ├── network-tags/
│   │   ├── index.js                # Network-tags main router
│   │   ├── listTags.js
│   │   └── manageTags.js
│   ├── networks.ts
│   ├── networks/
│   │   ├── index.ts                # Networks main router
│   │   ├── home-location.ts
│   │   ├── manufacturer.ts
│   │   ├── observations.ts
│   │   ├── search.ts
│   │   ├── tags.ts
│   │   └── list.ts
│   ├── settings.ts
│   ├── threats.ts
│   ├── weather.ts
│   └── wigle/
│       ├── index.ts                # WiGLE main router
│       ├── database.ts
│       ├── detail.ts
│       ├── index.ts
│       ├── live.ts
│       ├── observations.ts
│       ├── search.ts
│       ├── status.ts
│       └── utils.ts
├── v2/
│   ├── filtered.ts                 # MONOLITHIC (single endpoint)
│   ├── filteredHelpers.ts
│   ├── networks.ts
│   └── threats.ts
```

---

## Summary Table

| Route Module        | Modularization Status | Entry Point File                                                          | Sub-modules | Endpoint Count | Issues Flagged                            |
| ------------------- | --------------------- | ------------------------------------------------------------------------- | ----------- | -------------- | ----------------------------------------- |
| **health**          | NONE                  | [`health.ts`](server/src/api/routes/v1/health.ts)                         | 0           | 1              | None                                      |
| **networks**        | COMPLETE              | [`networks/index.ts`](server/src/api/routes/v1/networks/index.ts)         | 6           | ~8             | None                                      |
| **explorer**        | COMPLETE              | [`explorer/index.ts`](server/src/api/routes/v1/explorer/index.ts)         | 1           | ~2             | Partial - only 1 sub-route                |
| **threats**         | NONE                  | [`threats.ts`](server/src/api/routes/v1/threats.ts)                       | 0           | ~5             | None                                      |
| **wigle**           | COMPLETE              | [`wigle/index.ts`](server/src/api/routes/v1/wigle/index.ts)               | 6           | ~6             | None                                      |
| **admin**           | COMPLETE              | [`admin.ts`](server/src/api/routes/v1/admin.ts)                           | 14          | ~20            | Duplicate `/admin/simple-test` routes     |
| **ml**              | NONE                  | [`ml.ts`](server/src/api/routes/v1/ml.ts)                                 | 0           | ~5             | Has proxy file at `admin/ml.ts`           |
| **geospatial**      | NONE                  | [`geospatial.ts`](server/src/api/routes/v1/geospatial.ts)                 | 0           | ~15            | MONOLITHIC - needs modularization         |
| **analytics**       | NONE                  | [`analytics.ts`](server/src/api/routes/v1/analytics.ts)                   | 0           | ~5             | None                                      |
| **networksV2**      | NONE                  | [`v2/networks.ts`](server/src/api/routes/v2/networks.ts)                  | 0           | ~3             | None                                      |
| **threatsV2**       | NONE                  | [`v2/threats.ts`](server/src/api/routes/v2/threats.ts)                    | 0           | ~3             | None                                      |
| **filtered**        | NONE                  | [`v2/filtered.ts`](server/src/api/routes/v2/filtered.ts)                  | 0           | 1              | Single endpoint - intentional             |
| **dashboard**       | NONE                  | [`dashboard.ts`](server/src/api/routes/v1/dashboard.ts)                   | 0           | ~8             | None                                      |
| **locationMarkers** | NONE                  | [`location-markers.ts`](server/src/api/routes/v1/location-markers.ts)     | 0           | ~4             | None                                      |
| **homeLocation**    | NONE                  | [`home-location.ts`](server/src/api/routes/v1/home-location.ts)           | 0           | ~2             | Duplicated at `networks/home-location.ts` |
| **kepler**          | NONE                  | [`kepler.ts`](server/src/api/routes/v1/kepler.ts)                         | 0           | ~6             | MONOLITHIC - needs modularization         |
| **backup**          | NONE                  | [`backup.ts`](server/src/api/routes/v1/backup.ts)                         | 0           | ~3             | None                                      |
| **export**          | NONE                  | [`export.ts`](server/src/api/routes/v1/export.ts)                         | 0           | ~3             | None                                      |
| **analyticsPublic** | NONE                  | [`analytics-public.ts`](server/src/api/routes/v1/analytics-public.ts)     | 0           | ~2             | None                                      |
| **settings**        | NONE                  | [`settings.ts`](server/src/api/routes/v1/settings.ts)                     | 0           | ~8             | None                                      |
| **networkTags**     | COMPLETE              | [`network-tags/index.js`](server/src/api/routes/v1/network-tags/index.js) | 2           | ~6             | None                                      |
| **auth**            | NONE                  | [`auth.ts`](server/src/api/routes/v1/auth.ts)                             | 0           | ~4             | None                                      |
| **weather**         | NONE                  | [`weather.ts`](server/src/api/routes/v1/weather.ts)                       | 0           | ~2             | None                                      |
| **misc**            | NONE                  | [`misc.ts`](server/src/api/routes/v1/misc.ts)                             | 0           | ~3             | None                                      |
| **agencyOffices**   | NONE                  | [`agencyOffices.ts`](server/src/api/routes/v1/agencyOffices.ts)           | 0           | ~3             | None                                      |
| **networkAgencies** | NONE                  | [`network-agencies.ts`](server/src/api/routes/v1/network-agencies.ts)     | 0           | ~2             | None                                      |

---

## serverDependencies.ts Cross-Reference

The [`serverDependencies.ts`](server/src/utils/serverDependencies.ts) file defines the following route modules (lines 21-46):

```typescript
interface RouteModules {
  healthRoutes: Router;
  networksRoutes: Router;
  explorerRoutes: Router;
  threatsRoutes: Router;
  wigleRoutes: Router;
  adminRoutes: Router;
  mlRoutes: Router;
  geospatialRoutes: Router;
  analyticsRoutes: Router;
  networksV2Routes: Router;
  threatsV2Routes: Router;
  filteredRoutes: Router;
  dashboardRoutes: Router;
  locationMarkersRoutes: Router;
  homeLocationRoutes: Router;
  keplerRoutes: Router;
  backupRoutes: Router;
  exportRoutes: Router;
  analyticsPublicRoutes: Router;
  settingsRoutes: Router;
  networkTagsRoutes: Router;
  authRoutes: Router;
  weatherRoutes: Router;
  miscRoutes: Router;
}
```

### Actual Route Loading (lines 66-92)

| Dependency Name         | Actual File Path                    | Export Type    |
| ----------------------- | ----------------------------------- | -------------- |
| `healthRoutes`          | `../api/routes/v1/health`           | `.default`     |
| `networksRoutes`        | `../api/routes/v1/networks/index`   | `.default`     |
| `explorerRoutes`        | `../api/routes/v1/explorer`         | default export |
| `threatsRoutes`         | `../api/routes/v1/threats`          | default export |
| `wigleRoutes`           | `../api/routes/v1/wigle`            | `.default`     |
| `adminRoutes`           | `../api/routes/v1/admin`            | default export |
| `mlRoutes`              | `../api/routes/v1/ml`               | default export |
| `geospatialRoutes`      | `../api/routes/v1/geospatial`       | default export |
| `analyticsRoutes`       | `../api/routes/v1/analytics`        | default export |
| `networksV2Routes`      | `../api/routes/v2/networks`         | default export |
| `threatsV2Routes`       | `../api/routes/v2/threats`          | default export |
| `filteredRoutes`        | `../api/routes/v2/filtered`         | default export |
| `dashboardRoutes`       | `../api/routes/v1/dashboard`        | default export |
| `locationMarkersRoutes` | `../api/routes/v1/location-markers` | default export |
| `homeLocationRoutes`    | `../api/routes/v1/home-location`    | default export |
| `keplerRoutes`          | `../api/routes/v1/kepler`           | default export |
| `backupRoutes`          | `../api/routes/v1/backup`           | default export |
| `exportRoutes`          | `../api/routes/v1/export`           | default export |
| `analyticsPublicRoutes` | `../api/routes/v1/analytics-public` | default export |
| `settingsRoutes`        | `../api/routes/v1/settings`         | default export |
| `networkTagsRoutes`     | `../api/routes/v1/network-tags`     | default export |
| `authRoutes`            | `../api/routes/v1/auth`             | default export |
| `weatherRoutes`         | `../api/routes/v1/weather`          | `.default`     |
| `miscRoutes`            | `../api/routes/v1/misc`             | default export |

---

## Orphaned/Duplicate Code Analysis

### 1. Duplicate Route Definitions

| Issue                                | Location                                                        | Description                                                     |
| ------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- |
| **Duplicate `/admin/simple-test`**   | [`admin.ts`](server/src/api/routes/v1/admin.ts:171)             | Route appears twice in the same file                            |
| **Duplicate `/admin/home-location`** | [`admin.ts`](server/src/api/routes/v1/admin.ts:177)             | Duplicated in admin routes, also exists as standalone           |
| **ML Routes Proxy**                  | [`admin/ml.ts`](server/src/api/routes/v1/admin/ml.ts)           | Just re-exports `../ml.ts` - potential circular dependency risk |
| **Home Location Duplication**        | [`home-location.ts`](server/src/api/routes/v1/home-location.ts) | Exists as both standalone and in `networks/home-location.ts`    |

### 2. Monolithic Files Requiring Modularization

| File                                                      | Size  | Issues                                             |
| --------------------------------------------------------- | ----- | -------------------------------------------------- |
| [`geospatial.ts`](server/src/api/routes/v1/geospatial.ts) | ~9KB  | Single file with 15+ endpoints, needs splitting    |
| [`kepler.ts`](server/src/api/routes/v1/kepler.ts)         | ~14KB | Single file with multiple concerns                 |
| [`admin.ts`](server/src/api/routes/v1/admin.ts)           | ~16KB | Large file with inline routes alongside sub-routes |

### 3. Potential Circular Dependencies

| Path                                       | Risk Level | Notes                                          |
| ------------------------------------------ | ---------- | ---------------------------------------------- |
| `admin/ml.ts` → `../ml.ts` → `admin/ml.ts` | MEDIUM     | Proxy file creates indirect circular reference |
| `admin.ts` imports multiple sub-routes     | LOW        | Normal pattern but worth monitoring            |

---

## Modularization Patterns Detected

### Pattern 1: Complete Modularization

Used by: `wigle`, `networks`, `admin`, `network-tags`

**Structure:**

```
module/
├── index.ts           # Router coordination
├── subroute1.ts
├── subroute2.ts
└── subroute3.ts
```

### Pattern 2: Partial Modularization

Used by: `explorer`

**Structure:**

```
explorer/
├── index.ts           # Only coordinates 1 sub-route
├── networks.ts
└── shared.js          # Utility file, not a route
```

### Pattern 3: Proxy/Wrapper

Used by: `explorer.ts`, `network-tags.ts`, `admin/ml.ts`

**Structure:**

```typescript
// Wrapper file
module.exports = require('./subdirectory/index');
```

### Pattern 4: Monolithic

Used by: `geospatial`, `kepler`, `threats`, `dashboard`

**Structure:** Single file with all routes defined inline.

---

## Recommendations

### High Priority

1. **Modularize [`geospatial.ts`](server/src/api/routes/v1/geospatial.ts)** - Largest monolithic file
2. **Modularize [`kepler.ts`](server/src/api/routes/v1/kepler.ts)** - Large file with multiple concerns
3. **Remove duplicate routes in [`admin.ts`](server/src/api/routes/v1/admin.ts)** - Fix `/admin/simple-test` duplication

### Medium Priority

4. **Consolidate home-location routes** - Resolve duplication between `home-location.ts` and `networks/home-location.ts`
5. **Remove [`admin/ml.ts`](server/src/api/routes/v1/admin/ml.ts) proxy** - Directly import `ml.ts` in admin routes

### Low Priority

6. **Expand [`explorer/index.ts`](server/src/api/routes/v1/explorer/index.ts)** - Currently only mounts 1 sub-route
7. **Standardize export syntax** - Mix of `.default` and CommonJS exports in dependencies

---

## Statistics

- **Total Route Modules**: 26
- **Fully Modularized**: 4 (15%)
- **Partially Modularized**: 1 (4%)
- **Monolithic**: 21 (81%)
- **Files Requiring Immediate Attention**: 2 (geospatial, kepler)
- **Duplicate Code Instances**: 4
- **Potential Circular Dependencies**: 1
