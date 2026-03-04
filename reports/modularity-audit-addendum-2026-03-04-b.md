# ShadowCheck Modularity Audit Addendum (Pass B)

**Date:** 2026-03-04  
**Purpose:** Continue drift audit after full-pass report and recent threat/filter fixes.

---

## Findings (Ordered by Severity)

1. **High — Static analytics payloads in API routes create data drift risk**

- `server/src/api/routes/v2/filtered.ts` (`GET /api/v2/networks/filtered/analytics`) currently returns hardcoded arrays and counts with `fastPath: true`.
- `server/src/api/routes/v1/analytics-public.ts` (`GET /api/analytics-public/filtered`) also returns hardcoded arrays and counts.
- Impact: UI can display stale/inaccurate analytics that do not match active DB/filter state.

2. **Medium — Route-layer DB config imports remain but mostly as constants, not SQL execution**

- 8 route files import `config/database`; only health route performs direct DB query (`pool.query('SELECT 1')`).
- This is much improved from old audits, but still indicates partial coupling footprint.

3. **Medium — Filter semantics were split correctly in controls, but summary labels lagged**

- Threat-level vs manual-tag semantics were corrected in filter sections.
- Active filter summary previously surfaced raw keys (`threatCategories`, `tag_type`), reintroducing ambiguity.
- Fixed in this pass by label overrides.

4. **Low — Historical audits can still be misinterpreted as current architecture state**

- Older reports still contain now-outdated violation inventories.
- Recommendation: add explicit “historical snapshot” banner/index.

---

## Improvements Applied in This Pass

1. **UI semantic consistency hardening**

- `client/src/components/ActiveFiltersSummary.tsx`
  - Added explicit label overrides:
    - `threatCategories` -> `Threat Level`
    - `tag_type` -> `Manual Tag`

2. **Verification of route coupling state**

- Confirmed only health route still does direct query in route layer.
- Confirmed dominant route pattern now delegates to services.

---

## Recommended Next Actions

### P1

1. Replace hardcoded analytics responses in:
   - `v2/filtered.ts` `/analytics`
   - `v1/analytics-public.ts` `/filtered`
2. Wire both to service/query-builder backed results and preserve response shape.

### P2

1. Introduce a shared route-level `ConfigAccess` wrapper to avoid direct `config/database` imports where constants are needed.
2. Add tests asserting analytics endpoint data is dynamic and filter-aware.

### P3

1. Add `reports/README.md` index with `current` vs `historical` audit status metadata.

---

## Notes

This addendum continues the direction established in:

- `reports/modularity-audit-full-pass-2026-03-04.md`

The architecture trend is positive, but static analytics fast paths are currently the largest remaining drift hazard.
