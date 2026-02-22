# ShadowCheck — Modularity Audit Phase 2

**Date:** 2026-02-22
**Auditor:** Claude Sonnet 4.6
**Scope:** Full codebase re-audit post security/threat filter fixes
**Prior baseline:** `reports/modularity-audit.md` (2026-02-21, score: 6/10)

---

## Overall Score: 8 / 10 (+2 since baseline)

| Layer                | Baseline | Phase 2 | Notes                                          |
| -------------------- | -------- | ------- | ---------------------------------------------- |
| Frontend components  | 9/10     | 9/10    | Unchanged — already excellent                  |
| Frontend data layer  | 7/10     | 8/10    | `useAsyncData` adopted by 5 hooks (+1 this PR) |
| Backend services     | 5/10     | 7/10    | Shared SQL expression module added             |
| Backend routes       | 3/10     | 6/10    | v2 clean; v1 list.ts significantly improved    |
| Dependency injection | 3/10     | 8/10    | All 28+ services now in container              |

---

## 1. Changes Since Baseline (2026-02-21 → 2026-02-22)

### 1.1 DI Container — Fully Populated

`container.ts` now registers all 28+ services as a flat module.exports object.

**Before:** Only 2 services registered via `registerFactory`.
**After:** All 28+ services registered. Route handlers import from `container` rather than direct
`require('../services/...')` paths.

Score impact: **+5 → 8/10** for DI layer.

### 1.2 v2 Routes — All Inline SQL Eliminated

| Route            | Before                            | After                               |
| ---------------- | --------------------------------- | ----------------------------------- |
| `v2/networks.ts` | 12+ inline SQL queries in handler | Delegates entirely to v2Service     |
| `v2/threats.ts`  | Direct DB import + inline SELECT  | Delegates to v2Service              |
| `v2/filtered.ts` | Direct DB calls + response SQL    | Uses filterQueryBuilder + v2Service |

### 1.3 v1 location-markers.ts — Extracted to Service

5 inline SQL operations (SELECT, DELETE, INSERT with PostGIS) were extracted to
`homeLocationService`. Route is now request-parse + service call only.

### 1.4 New Shared SQL Expression Module

**`server/src/utils/networkSqlExpressions.ts`** (created this session):

| Export                                | Purpose                                               |
| ------------------------------------- | ----------------------------------------------------- |
| `OPEN_PREDICATE`                      | Canonical SQL clause for open/unencrypted networks    |
| `encryptionTypePredicate(enc)`        | Maps one canonical label → SQL WHERE clause           |
| `buildEncryptionTypeCondition(types)` | Builds combined OR clause for encryptionTypes filter  |
| `buildThreatScoreExpr(simpleScoring)` | Threat score CASE expression (feature-flag aware)     |
| `buildThreatLevelExpr(scoreExpr)`     | Threat level CASE expression (80/60/40/20 thresholds) |

**`list.ts` update:**

- Replaced ~40 lines of inline `threatScoreExpr` / `threatLevelExpr` definitions with:
  ```javascript
  const threatScoreExpr = buildThreatScoreExpr(CONFIG.SIMPLE_RULE_SCORING_ENABLED);
  const threatLevelExpr = buildThreatLevelExpr(threatScoreExpr);
  ```
- Replaced ~25 lines of inline `encryptionTypes` predicate builder with:
  ```javascript
  const encCondition = buildEncryptionTypeCondition(encryptionTypes);
  if (encCondition) conditions.push(encCondition);
  ```

### 1.5 Canonical Security Taxonomy (this session)

`client/src/utils/wigle/security.ts` was fully rewritten to:

- Export `CANONICAL_SECURITY_LABELS` (12 labels, ordered most→least secure)
- Export `CanonicalSecurity` type
- Export `normalizeSecurityLabel(raw)` — single source of truth for label normalization
- Fix `formatSecurity` to use canonical labels only

`client/src/components/analytics/utils/chartColors.ts` was extracted from `chartConstants.tsx`
to allow import in Node (Jest) test environments.

### 1.6 `useAsyncData` — Created and Adopted

**`useAsyncData.ts`** (created in prior refactoring cycle):

```typescript
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: any[]
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void };
```

Hooks migrated to `useAsyncData` (now 5 total):

| Hook                        | Status                       |
| --------------------------- | ---------------------------- |
| `useNetworkObservations.ts` | ✅ migrated                  |
| `useAnalyticsData.ts`       | ✅ migrated                  |
| `useAgencyOffices.ts`       | ✅ migrated                  |
| `useAwsOverview.ts`         | ✅ migrated                  |
| `useKepler.ts`              | ✅ **migrated this session** |

---

## 2. Current Route Purity Status

### Routes Now Clean

| Route                     | Method            | Notes                                                    |
| ------------------------- | ----------------- | -------------------------------------------------------- |
| `v2/networks.ts`          | Service call      | v2Service.listNetworks etc.                              |
| `v2/threats.ts`           | Service call      | v2Service.getThreatSeverityCounts                        |
| `v2/filtered.ts`          | Builder + service | filterQueryBuilder + v2Service.executeV2Query            |
| `v1/location-markers.ts`  | Service call      | homeLocationService                                      |
| `v1/explorer/networks.ts` | Service call      | explorerService                                          |
| `v1/analytics.ts`         | Service call      | analyticsService                                         |
| `v1/networks/list.ts`     | Mixed ✅ improved | Queries via networkService; expressions via shared utils |

### Routes Still Violating (v1 only)

| File                      | Violation               | Priority                               |
| ------------------------- | ----------------------- | -------------------------------------- |
| `v1/health.ts`            | `SELECT 1` inline       | Low — health check is acceptable       |
| `v1/threats.ts`           | Direct DB import        | Medium                                 |
| `v1/admin.ts`             | Direct DB import        | Medium                                 |
| `v1/admin/maintenance.ts` | Direct pool import      | Medium                                 |
| `v1/admin/import.ts`      | 8 SQL operations inline | High — most complex remaining violator |

Violation rate: 5 of 24 routes (**21%**, down from 50% at baseline).

---

## 3. `useAsyncData` Migration Assessment

### Migrated (5 hooks)

All simple single-fetch hooks are now using `useAsyncData`.

### Intentional Non-Migrations (3 hooks)

These hooks have state machines that go beyond a simple fetch and cannot be
cleanly expressed as `useAsyncData(fetcher, deps)`:

| Hook                 | Why Not Migrated                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `useNetworkData.ts`  | Infinite-scroll pagination (accumulate on offset > 0), complex multi-filter param building, debounced filter state |
| `useObservations.ts` | Paginated loop with server-side accumulation (`while(true)`), per-page offset tracking                             |
| `useDashboard.ts`    | `Promise.all` for parallel endpoint calls + complex card state mapping; `useAsyncData` is single-fetch only        |

Forcing these into `useAsyncData` would require restructuring the state machine in ways
that reduce clarity. They are intentional exceptions documented here.

---

## 4. Remaining Risks

### 4.1 `universalFilterQueryBuilder` — Non-Canonical Security Labels

`server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts` contains embedded SQL
CASE expressions for security normalization that use different labels from the canonical set:

| `universalFilterQueryBuilder` | Canonical (`CANONICAL_SECURITY_LABELS`) |
| ----------------------------- | --------------------------------------- |
| `WPA3-OWE`                    | Not in canonical set                    |
| `WPA3-SAE`                    | `WPA3-P`                                |
| `WPA2-E`                      | `WPA2-E` ✅                             |
| `WPA2` (no WPA2-P variant)    | `WPA2-P`, `WPA2`                        |
| `Unknown` (capital U)         | `UNKNOWN`                               |

This drift means the v2 filtered endpoint and the v1 networks endpoint may classify the same
network differently. A Phase-3 task should align `universalFilterQueryBuilder` with
`CANONICAL_SECURITY_LABELS` and share `buildEncryptionTypeCondition` from
`networkSqlExpressions.ts`.

### 4.2 `v1/admin/import.ts` — Highest Remaining Inline SQL Complexity

8 inline SQL operations including INSERT/UPDATE during WiGLE import flow. Should be extracted
to a dedicated `importService` (or `wigleImportService`). Scope: ~200 lines.

### 4.3 Analytics Service — Server-Side Security Normalization

`GET /api/analytics/security` returns raw DB security strings grouped by `ne.security`.
If the DB stores raw capability strings like `[WPA2-PSK-CCMP][ESS]`, the analytics chart
shows many unique values instead of the 12 canonical labels.

Recommendation: normalize security labels in `analyticsService` using the same CASE logic
as `networkSqlExpressions.ts` before grouping.

### 4.4 `useDashboard` — Parallel Fetch Not Handled by `useAsyncData`

`useDashboard` fetches two endpoints in parallel with `Promise.all`. This cannot be migrated
to the current `useAsyncData` signature (single-fetcher). A `useParallelAsyncData` or
wrapper could be added if needed, but the value is low — `useDashboard` is not duplicated.

---

## 5. Follow-up Recommendations

1. **Phase 3 — Align `universalFilterQueryBuilder` with canonical security labels**
   Use `buildEncryptionTypeCondition` from `networkSqlExpressions.ts` for the v2 filtered path.
   Remove the duplicate security CASE expressions.

2. **Extract `admin/import.ts` SQL to `wigleImportService`**
   The 8 inline SQL operations belong in the existing `wigleImportService`, not in the route handler.

3. **Server-side security normalization in analytics**
   Update `analyticsService.getSecurityDistribution()` to normalize raw capability strings to
   canonical labels before GROUP BY.

4. **Close remaining v1 violations (threats, admin)**
   `v1/threats.ts` and `v1/admin.ts` both import the DB directly. These should delegate to
   `threatScoringService` and an admin service respectively.

---

## 6. Score Calculation

| Layer                | Previous | Now   | Rationale                                                         |
| -------------------- | -------- | ----- | ----------------------------------------------------------------- |
| Frontend components  | 9        | 9     | No change                                                         |
| Frontend data layer  | 7        | 8     | 5 hooks on useAsyncData; 3 complex hooks documented as exceptions |
| Backend services     | 5        | 7     | `networkSqlExpressions.ts` SSoT; encryptionType predicates shared |
| Backend routes       | 3        | 6     | v2 clean (0%), v1 21% violation rate (down from 50%)              |
| Dependency injection | 3        | 8     | All 28+ services in container                                     |
| **Composite**        | **6**    | **8** | Weighted average                                                  |

_Report generated: 2026-02-22. Next re-audit milestone: after admin/import extraction and analytics normalization._
