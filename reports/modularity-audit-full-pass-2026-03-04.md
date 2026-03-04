# ShadowCheck Modularity Audit — Full Pass

**Date:** 2026-03-04  
**Scope:** `server/src`, `client/src`, and report generation path  
**Goal:** Validate drift against prior audits and capture immediate improvements.

---

## Executive Summary

- Prior modularity audits in `/reports` are directionally useful but partially stale for current backend route structure.
- Report generation was functionally correct but structurally monolithic.
- A real production bug was identified in filtered observations (`/api/v2/networks/filtered/observations`) under threat-category filtering.

### Work completed in this pass

1. **Modularized threat report service path**
   - Split shared utilities into `server/src/services/reports/threatReportUtils.ts`
   - Split output renderers into `server/src/services/reports/threatReportRenderers.ts`
   - Reduced `server/src/services/threatReportService.ts` to data assembly + orchestration

2. **Fixed 500 error in filtered observations**
   - Root cause: `THREAT_SCORE_EXPR` uses `nt.threat_confidence`, but lateral `network_tags` join did not project `threat_confidence`.
   - Fix: added `threat_confidence` projection in `SqlFragmentLibrary.joinNetworkTagsLateral()`.

---

## Current-State Metrics (Observed)

- Route modules under `server/src/api/routes`: **65**
- Route files importing `config/database`: **8**
- Route files with direct `pool.query/query(` use: **1** (`v1/health.ts`)

Interpretation:

- The old “many route inline SQL” narrative no longer reflects current state for most routes.
- Service delegation is substantially improved vs older audit snapshots.

---

## Audit Validation vs Prior Reports

### Accurate / still valid

- Need to keep improving service boundaries and reduce drift over time.
- Query-builder security/level mapping remains a sensitive area where subtle schema mismatches can cause runtime failures.

### Stale / no longer accurate as written

- Older claims that `v2/networks.ts` is a major inline-SQL offender are out of date.
- Several v1/v2 routes now delegate through services/container and no longer match historical violation inventory.

---

## Report Generation Modularity (Before vs After)

### Before

`server/src/services/threatReportService.ts` mixed:

- DB read/query orchestration
- data normalization and bucketing
- markdown rendering
- html rendering
- pdf rendering
- utility formatting functions

### After

- `threatReportService.ts`:
  - `getThreatReportData()` only
  - delegates rendering utilities
- `reports/threatReportUtils.ts`:
  - `toNumber`, `escapeHtml`, `formatTimestamp`, map/street-view URL helpers
- `reports/threatReportRenderers.ts`:
  - `renderMarkdown`, `renderHtml`, `renderPdfBuffer`

Net effect:

- Cleaner separation of concerns
- Lower churn risk in data assembly when changing output formats
- Better path for adding report tests by renderer type

---

## Incident Fix Detail: `/v2/networks/filtered/observations` 500

### Symptom

500 on requests with `enabled.threatCategories=true` and category filters (e.g., `critical`, `high`).

### Root cause

- `THREAT_LEVEL_EXPR` -> `THREAT_SCORE_EXPR` references `nt.threat_confidence`.
- Lateral tag join aliased as `nt` only selected `threat_tag`, `is_ignored`, `all_tags`.
- Query failed at runtime due to missing `nt.threat_confidence` in the lateral projection.

### Fix applied

In `server/src/services/filterQueryBuilder/SqlFragmentLibrary.ts`:

- Added
  `MAX(COALESCE((to_jsonb(nt_source)->>'threat_confidence')::numeric, 0)) AS threat_confidence`
  to `joinNetworkTagsLateral()`.

---

## Residual Risks

1. **Report path tests are still missing**
   - No dedicated automated tests found for report renderers and route format outputs.
2. **Mixed CJS/TS style remains**
   - Works today but raises maintenance friction.
3. **Old audits can be misread as current truth**
   - Should be marked historical snapshots.

---

## Recommended Next Improvements (Priority Order)

1. Add focused tests for report generation:
   - renderer snapshots (md/html)
   - pdf smoke test for dependency available/unavailable paths
   - route-level format/status behavior
2. Add query-builder integration test that exercises `threatCategories` in geospatial/observations query path.
3. Add a small `reports/README.md` index with “historical vs current” audit status to avoid drift confusion.

---

## Change Log (this pass)

- Modified: `server/src/services/threatReportService.ts`
- Added: `server/src/services/reports/threatReportUtils.ts`
- Added: `server/src/services/reports/threatReportRenderers.ts`
- Modified: `server/src/services/filterQueryBuilder/SqlFragmentLibrary.ts`
- Added: `reports/modularity-audit-full-pass-2026-03-04.md`

---

## Validation Added After Initial Pass

### New unit tests

- `tests/unit/threatReportUtils.test.ts`
- `tests/unit/threatReportRenderers.test.ts`

### What they verify

- Utility behavior: numeric parsing, HTML escaping, UTC timestamp formatting, map URL generation.
- Renderer behavior: markdown and HTML section integrity, escaping, and map/street-view links.
- PDF renderer behavior: either valid PDF bytes when `pdfkit` is available, or explicit `PDFKIT_NOT_INSTALLED` error path.

### Result

- `npx jest tests/unit/threatReportUtils.test.ts tests/unit/threatReportRenderers.test.ts --runInBand`
- **2 suites passed, 7 tests passed.**
