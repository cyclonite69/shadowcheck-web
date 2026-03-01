# Universal Filter Testing Modality

## Problem Statement

Universal filters currently have correctness gaps where filtered results and aggregate counts diverge. One visible example is selecting Wi-Fi networks while the corresponding Wi-Fi count does not render or does not match filtered rows.

This plan defines a **systematic, automated test modality** that validates every filter and every filter combination against a shared contract.

---

## Testing Goals

1. **Parity:** counts, totals, and row sets must agree for the same filter payload.
2. **Coverage:** every supported universal filter key is tested at least once.
3. **Composability:** pairwise filter combinations are validated (not just single-filter happy paths).
4. **Regression safety:** every discovered bug adds a permanent fixture + assertion.
5. **Debuggability:** failures explain which filter, endpoint, and invariant failed.

---

## Core Invariants (Must Always Hold)

For a fixed `{ filters, enabled }` payload:

1. **List-vs-count parity**
   - `dashboard.networks.wifi` equals the number of list rows where `type = 'W'`.
   - Same for all type buckets exposed in the UI (Wi-Fi/BLE/Cell/etc).
2. **Total consistency**
   - Sum of per-type counts equals overall network total from summary endpoint.
3. **Monotonic narrowing**
   - Applying an additional enabled filter must not increase list size unexpectedly (unless explicitly documented for OR semantics).
4. **Pagination stability**
   - Count endpoints are independent of pagination params (`limit`, `offset`) used by list endpoints.
5. **Disabled filter neutrality**
   - A filter value present but disabled must not affect SQL predicates or results.
6. **Cross-endpoint contract**
   - The same payload sent to explorer/dashboard/analytics routes yields logically consistent totals.
7. **Threat-scope correctness**
   - Threat severity counts must be computed from the same filtered universe.
   - Example: if `radioTypes = ['W']` is enabled, critical/high/medium/low threat counts must represent **Wi-Fi-only** networks.

---

## Automated Test Stack

## 1) Unit: Query Builder Contract (fast)

Use and expand existing query-builder tests to assert:

- filter enable/disable behavior,
- generated SQL predicate inclusion/exclusion,
- parameter ordering and stability,
- applied-filter metadata correctness.

**Implementation pattern:** table-driven `test.each` over all filter keys from `NetworkFilters`.

## 2) Integration: API Count Parity Matrix (authoritative)

Create a new integration suite (gated by `RUN_INTEGRATION_TESTS=true`) that:

1. boots API routes,
2. seeds a deterministic mini dataset (or runs against a known seeded DB),
3. iterates through a filter matrix,
4. compares list rows vs count summaries.

### Required matrix dimensions

- **Single-filter sweep**: one test per filter key.
- **Radio type sweep**: at minimum `W`, `B`, `L`, `N`, `?` where data exists.
- **Pairwise combinations**: pair each filter with at least one from a different category (identity + radio, radio + threat, time + quality, etc).
- **Boundary values**: min/max and invalid payload checks.

## 3) UI Contract: Rendering + Data Binding (React tests)

For filter-count chips/cards and dashboard counters:

- mock API payloads where counts are non-zero and zero,
- assert the Wi-Fi count element renders when present,
- assert formatted value matches API data and updates after filter change.

This catches "API is right but UI failed to render/bind" bugs.

## 4) Threat Contract: Severity Counts Must Respect Active Filters

Add targeted tests for `/v2/threats/severity-counts` that verify threat buckets are always scoped by active universal filters.

Minimum required scenarios:

- `radioTypes = ['W']` → severity counts include Wi-Fi-only threats.
- `radioTypes = ['B']` (or other supported type) → severity counts shift to that radio scope.
- `radioTypes + timeframe` pairwise case → severity counts respect both constraints.
- `radioTypes` disabled with value present → no impact on threat counts.

This directly addresses the user-facing expectation that selecting Wi-Fi filters all threat-level cards/chips to Wi-Fi only.

---

## How This Differs from Current Mock-Heavy Tests

Current test coverage already provides value, but most suites are strongest at:

- SQL-generation correctness,
- endpoint shape and validation,
- mocked dependency behavior.

What is still under-covered is **real-data parity across endpoints** for the same filter payload (the failure mode seen on geospatial pages).

### Existing strengths (keep)

- Unit contract tests around `UniversalFilterQueryBuilder` and filter predicates.
- Service tests with mocked DB responses to validate logic branches quickly.
- Integration-style route tests that validate status codes and response shape.

### Existing gap (close)

- The system can still pass when list data and aggregate counts drift apart on real datasets.
- Mocked data often encodes expected answers too optimistically and can hide query-path divergence.

### Modality adjustment (hybrid, not replacement)

Use a layered model:

1. **Mock/unit tests** for speed and branch coverage.
2. **Deterministic fixture integration tests** for repeatable count parity checks.
3. **Real-data smoke tests** against representative database state to catch production-like drift.

This keeps the fast signal from current tests while adding the real-data safety net that surfaced geospatial issues.

---

## Why Geospatial Can Look Correct While Dashboard Is Wrong (Even If SQL Is Fine)

This is usually a **query-path consistency** problem, not a single SQL syntax problem.

In this codebase, geospatial/list views and dashboard cards are fetched through different endpoint flows and can take different query branches:

- Geospatial/list uses `/api/v2/networks/filtered` and computes rows + total from `UniversalFilterQueryBuilder` in the same request path.
- Dashboard cards use `/dashboard-metrics` and may execute a different repository branch for counts.
- Threat chips on dashboard are fetched from a separate endpoint (`/v2/threats/severity-counts`) in parallel.

So one surface can be right while another is stale or inconsistent if:

1. a filter is applied in one branch but ignored in another,
2. one endpoint counts from `app.networks` while another derives from `filtered_obs`,
3. one request uses a page capability subset and another assumes full support,
4. one card silently falls back to 0 on partial API failure.

### What the modality does about that

- Adds **cross-endpoint parity assertions** under identical payloads (`filters`, `enabled`).
- Verifies dashboard Wi-Fi card value equals filtered list Wi-Fi population for the same request context.
- Separately validates dashboard metrics endpoint and threat-count endpoint so parallel fetch mismatches are visible.
- Keeps a real-data smoke step to detect branch drift that mocks often miss.

---

## Test Data Strategy

Use a **golden fixture dataset** with explicit coverage rows:

- at least 2 records per radio type,
- mixed security modes,
- known threat-score strata,
- edge-case values (hidden SSID, null coords, low/high RSSI),
- time spread across multiple windows.

Store fixture metadata in a readable manifest (e.g. `tests/fixtures/universalFilterGolden.json`) so expected counts are explainable without reading SQL.

---

## Suggested Suite Layout

- `tests/unit/universal-filter-contract.test.ts`
  - SQL generation and enabled/disabled semantics.
- `tests/integration/universal-filter-count-parity.test.ts`
  - List/count parity by filter matrix.
- `client/src/**/__tests__/universalFilterCountRendering.test.tsx`
  - UI rendering + state update assertions for filter counters.

---

## Failure Output Requirements

Each failing assertion should print:

- filter payload,
- endpoint(s) compared,
- expected vs actual totals,
- sample BSSIDs/ids that are mismatched.

This reduces time-to-fix for count mismatches.

---

## CI Gating

1. **PR required checks**
   - unit filter contract suite,
   - UI count rendering suite.
2. **Nightly / pre-release**
   - full integration matrix with pairwise combinations.
3. **Bugfix policy**
   - no filter bug closes without an added matrix case and invariant assertion.

### Recommended pipeline split

- **Per PR (fast):** unit + UI + targeted deterministic integration parity cases.
- **Nightly:** expanded matrix + real-data smoke sweep on geospatial/dashboard endpoints.
- **Pre-release:** full page-capability sweep (dashboard, analytics, kepler, wigle) with parity assertions.

---

## Rollout Plan

### Phase 1 (Immediate)

- Add integration parity test for radio type counts (Wi-Fi first).
- Add UI rendering test for Wi-Fi counter.
- Add real-data smoke assertion that geospatial Wi-Fi list length matches dashboard Wi-Fi count under identical filters.

### Phase 2

- Expand to all filter keys with single-filter sweep.
- Add pairwise category combinations.
- Add cross-page parity checks for dashboard + analytics count surfaces.

### Phase 3

- Add property-based fuzzing for random valid filter payloads and invariant checking.
- Expand capability-aware parity checks to kepler and wigle routes for supported filter subsets.

---

## Page-by-Page Expected Outcome

### Dashboard

- Guarantees that card counts (e.g., Wi-Fi networks) match filtered list/query outputs.
- Prevents "count missing or inconsistent" regressions by asserting render + API parity together.
- Ensures threat severity cards/chips are also filter-scoped (e.g., Wi-Fi filter yields Wi-Fi-only threat totals).

### Analytics

- Ensures chart aggregates are computed from the same filtered universe as network list/count APIs.
- Adds confidence that severity and type distributions are not detached from active filters.
- Confirms threat-severity analytics are constrained by active radio/time/quality filters (not global totals).

### Kepler

- Validates that map layer totals and feature counts are consistent with universal filter payloads.
- Catches capability-adapter mistakes where supported filters are accidentally ignored or mis-mapped.

### WiGLE

- Enforces capability-aware subset behavior (`adaptFiltersToPage`) so unsupported filters are ignored transparently.
- Verifies supported filters still maintain list/count parity and stable dashboard-like totals where exposed.

---

## Definition of Done

A filter is considered "certified" when:

1. It has unit SQL-contract coverage.
2. It appears in integration parity matrix cases.
3. UI tests validate visible count rendering/binding where applicable.
4. It passes CI with deterministic fixtures.
