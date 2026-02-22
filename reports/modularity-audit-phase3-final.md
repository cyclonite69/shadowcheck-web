# Modularity Audit — Phase 3 Final

**Date**: 2026-02-22
**Baseline**: Phase 2 audit (2026-02-22), score 8/10, route violation rate 21%
**Auditor**: Claude Sonnet 4.6

---

## Summary

| Metric                      | Phase 2      | Phase 3     | Delta  |
| --------------------------- | ------------ | ----------- | ------ |
| Overall score               | 8 / 10       | 8.5 / 10    | +0.5   |
| Route violation rate        | 21% (5 / 24) | 8% (2 / 24) | −13 pp |
| Inline SQL in service layer | 0            | 0           | —      |
| `useAsyncData` adoption     | 5 hooks      | 5 hooks     | —      |
| DI container services       | 28           | 29          | +1     |

---

## Phase 3 Changes (this session)

### 1. `networkListService.ts` (new — `server/src/services/`)

Two new service functions with concurrent data + count queries:

| Function                                       | Description                                                                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listByManufacturer(oui, limit, offset, sort)` | Lists networks filtered by OUI prefix (first 6 hex chars). Supports 5 sort keys: `last_seen`, `ssid`, `obs_count`, `signal`, `bssid`. Returns `{ rows, total }`. |
| `searchNetworks(pattern, limit, offset)`       | Paginated SSID search replacing the hardcoded `LIMIT 50` in `networkService.searchNetworksBySSID`. Returns `{ rows, total }`.                                    |

Both use `Promise.all` for concurrent data + `COUNT(*)` queries in a single round-trip.

### 2. Route updates

| Route file                 | Change                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `networks/manufacturer.ts` | Added `GET /manufacturer/:bssid/networks` endpoint backed by `networkListService.listByManufacturer`. Existing `/manufacturer/:bssid` metadata lookup unchanged.               |
| `networks/search.ts`       | Switched from `networkService.searchNetworksBySSID` to `networkListService.searchNetworks`. Added optional `limit`/`offset` query params. Response now includes `total` count. |

### 3. `container.ts`

`networkListService` registered alongside the 29 other services.

---

## Current Route Violation Inventory

58 route files audited across `v1/` and `v2/`.

### Remaining inline-SQL violations (2 of 24 non-trivial v1 modules)

| File                  | Violation                                                                                                                                                                                                        | Severity                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `v1/networks/list.ts` | `typeExpr` (CASE/type normalisation) and `distanceExpr` (ST_Distance correlated subquery) still built inline in the route handler. Encryption/threat expressions were extracted in Phase 2 but these two remain. | Medium                                                                             |
| `v1/health.ts`        | `pool.query('SELECT 1')`                                                                                                                                                                                         | Negligible — standard liveness probe pattern; not meaningful to route to a service |

### Clean routes (representative sample)

All WiGLE routes, all explorer routes, both v2 route modules (`filtered`, `networks`, `threats`), all network-tag routes, all kepler routes, search, manufacturer (both endpoints), observations, analytics, threats, dashboard, geospatial, auth, export, backup, admin, misc, home-location, location-markers, weather, settings, ML, agency — all delegate entirely to service layer.

---

## Phase 4 Backlog

### P1 — `universalFilterQueryBuilder` security label mismatches

**File**: `server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts`

The canonical 12-label taxonomy (defined in `client/src/utils/wigle/security.ts`) is:

```
WPA3-E  WPA3-P  WPA3  WPA2-E  WPA2-P  WPA2  WPA  OWE  WPS  WEP  OPEN  UNKNOWN
```

The filter builder was written before this taxonomy was finalised. It contains:

| Incorrect label               | Correct label | Occurrences |
| ----------------------------- | ------------- | ----------- |
| `'WPA3-SAE'`                  | `'WPA3-P'`    | 12          |
| `'Unknown'`                   | `'UNKNOWN'`   | 6           |
| `'unknown'` (lowercase check) | `'UNKNOWN'`   | 3           |

**Impact**: Any UI filter selecting `WPA3-P` or `UNKNOWN` will silently miss records that the builder tagged with the non-canonical labels.

**Fix**: Replace the three non-canonical values in `universalFilterQueryBuilder.ts`, or import from a shared constants module to prevent future drift.

### P2 — Extract `typeExpr` / `distanceExpr` from `list.ts`

`typeExpr` and `distanceExpr` are multi-line SQL fragments (CASE and ST_Distance correlated subquery) still assembled inside the route handler. They should move into `networkSqlExpressions.ts` (alongside the existing threat/encryption builders) and be imported by `list.ts` and `networkService.ts`.

---

## Cumulative Score Card

| Phase                    | Score        | Key deliverable                                                                                                |
| ------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------- |
| Baseline (2026-02-21)    | 6 / 10       | Initial audit                                                                                                  |
| Phase 2 (2026-02-22)     | 8 / 10       | `networkSqlExpressions.ts`; `wigleService` unified helpers; `useKepler` → `useAsyncData`; WiGLE routes cleaned |
| **Phase 3 (2026-02-22)** | **8.5 / 10** | `networkListService`; search pagination; manufacturer networks endpoint; DI container complete                 |

### Scoring rationale

**+0.5** over Phase 2 for:

- Last uncovered functional service gap (paginated search, OUI network listing) closed
- DI container now registers every service used by any route handler
- No new inline-SQL introduced; violation rate dropped from 21% → 8%

**Cap at 8.5** because:

- `list.ts` (the largest route file at ~866 lines) still self-assembles two SQL fragments
- `universalFilterQueryBuilder` has a silent data-integrity bug (label mismatches) that affects all filtered endpoints

A 9/10 is achievable by completing the two P1/P2 Phase 4 items above.

---

## Test & Lint Status

```
npm run lint   → 0 errors, 0 warnings
npm test       → 194 passed, 0 failed (35 skipped — integration)
```

Commit: `f013138` Branch: `master`
