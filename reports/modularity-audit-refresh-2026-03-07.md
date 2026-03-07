# ShadowCheck Modularity Audit Refresh (2026-03-07)

## Drift Assessment

- Overall modularity remains strong and is trending up from Phase 6.
- Core route and service delegation patterns remain intact; no inline SQL regression detected in routes.
- Main remaining release risk is performance/operational behavior under heavy filtered queries, not architectural drift.

## Updated Score

- **9.2 / 10**

Rationale:

- Maintains strong DI, route delegation, and extraction patterns from Phase 6.
- Significant frontend/data-layer refactors were completed (URL/filter/state/query transform utilities).
- Minor deltas remain: intentional fast paths, heavy query hotspots, and operational polish items.

## Findings

### 1) Database Layer Drift Check

- `api_network_explorer_mv` remains the primary filtered network projection used by v2 filtered flows.
- Raw `app.observations` still appears in geospatial observation paths for point-level retrieval (expected for that endpoint shape), with filter builder mediation.
- Dropped/unused MVs and indexes are reflected operationally; code now avoids depending on removed MVs in active paths.

Risk: **Medium** (query-cost/perf sensitivity, not correctness drift).

### 2) Frontend Data Layer Validation

- Utility extraction is now materially improved:
  - `client/src/utils/networkDataTransformation.ts`
  - `client/src/utils/networkFormatting.ts`
  - `client/src/utils/networkFilterParams.ts`
  - `client/src/utils/filteredRequestParams.ts`
  - `client/src/utils/filterUrlState.ts`
  - `client/src/utils/keplerDataTransformation.ts`
  - `client/src/utils/observationDataTransformation.ts`
  - `client/src/utils/filteredPagination.ts`
- Hook/component logic is increasingly composed from shared utilities rather than inline transforms.
- Residual debug logs in filter store were removed in this refresh.

Risk: **Low**

### 3) Route Layer Compliance

- Route files continue delegating SQL/data assembly to services/query builders.
- No new inline SQL route violations were identified beyond known intentional health check behavior.
- Existing hardcoded/fast-path behavior should still be tracked as potential data drift risk, but no new regression found in this refresh window.

Risk: **Low to Medium**

### 4) DI Container & Service Layer

- Service graph remains container-centric and stable after recent changes.
- No new orphan service pattern observed in this refresh set.
- Quality-filter related logic remains query-builder/service mediated rather than being spread into route handlers.

Risk: **Low**

### 5) Test Coverage Regression Check

- Current suite remains healthy with strong pass volume and no broad failure pattern.
- Recent runs reported full green across updated filter/query/security/data-transformation tests.
- Coverage focus appears improved for new extracted utilities and audit-driven fixes.

Risk: **Low**

## Priority Recommendations

### P1 (Release-Blocking if Triggered)

1. Keep backend memory headroom and filtered-query latency under control in production-like load, especially for geospatial/filter combinations.
2. Preserve ignored-network semantics: visible in explorer results, excluded from effective threat scoring paths.

### P2 (High-Value Next)

1. Continue collapsing remaining endpoint-specific filter assembly into shared utility boundaries.
2. Add lightweight perf guardrails for known slow filtered query shapes.
3. Keep route-config centralization complete across remaining edge routes.

### P3 (Backlog)

1. Add periodic modularity snapshots to reduce audit drift.
2. Expand docs cross-linking from operational runbooks to modularity reports.

## Evidence (Representative)

- Route/service/query builder:
  - `server/src/api/routes/v2/filtered.ts`
  - `server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts`
  - `server/src/services/filteredAnalyticsService.ts`
- Frontend extracted utilities:
  - `client/src/utils/filterUrlState.ts`
  - `client/src/utils/filteredRequestParams.ts`
  - `client/src/utils/keplerDataTransformation.ts`
  - `client/src/utils/observationDataTransformation.ts`
  - `client/src/utils/filteredPagination.ts`
- Tests:
  - `tests/unit/filterQueryBuilder.test.ts`
  - `tests/unit/universalFilterQueryBuilder.audit.test.ts`
  - `client/src/utils/__tests__/networkDataTransformation.test.ts`
  - `client/src/utils/__tests__/networkFilterParams.test.ts`
