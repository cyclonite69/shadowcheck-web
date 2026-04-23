# Comprehensive Modularity & Cruft Audit - 2026-04-23

This report provides a full-codebase assessment of modularity and identifies dead code across all source directories (`client/src`, `server/src`, `etl/`, `scripts/`).

## 1. Modularity Assessment: High-Risk Monoliths

The following files exceed 500 lines and are primary candidates for refactoring into smaller, more focused modules or hooks.

| File Path                                                         | Lines | Primary Concern                                                                            |
| :---------------------------------------------------------------- | :---- | :----------------------------------------------------------------------------------------- |
| `etl/load/sqlite-import.ts`                                       | 978   | Monolithic ETL logic; should be split into extraction, transformation, and loading phases. |
| `client/src/components/WiglePage.tsx`                             | 928   | Giant UI component with mixed concerns (state, fetching, rendering).                       |
| `etl/load/fbi-locations.ts`                                       | 858   | Large data-loading script; needs extraction of schema and validation logic.                |
| `client/src/components/admin/tabs/WigleSearchTab.tsx`             | 702   | UI monolith; needs sub-components for results and filter sections.                         |
| `client/src/components/admin/tabs/ConfigurationTab.tsx`           | 691   | Exceeds project threshold (220); needs split into domain-specific config cards.            |
| `client/src/components/admin/tabs/WigleDetailTab.tsx`             | 661   | Large detail view; candidates for extraction of metric tables and maps.                    |
| `etl/transform/process-agencies.ts`                               | 648   | Heavy transformation logic; should delegate to smaller utility functions.                  |
| `client/src/components/geospatial/networkTable/cellRenderers.tsx` | 639   | Contains too many distinct renderers; should be split by data type.                        |
| `server/src/api/routes/v1/admin/import.ts`                        | 636   | Too much logic in route handler; should move more logic to `wigleImportService`.           |
| `client/src/stores/filterStore.ts`                                | 585   | Monolithic Zustand store; could be split into slices (location, threat, etc.).             |

## 2. Structural Modularity Debt (Opt-in Failures)

These files failed the existing `policy:modularity` check based on their specific thresholds in `modularity-rules.json`:

| File Path                                               | Metric | Current | Threshold |
| :------------------------------------------------------ | :----- | :------ | :-------- |
| `client/src/components/admin/tabs/ConfigurationTab.tsx` | lines  | 691     | 220       |
| `server/src/services/geocoding/cacheStore.ts`           | lines  | 496     | 320       |

## 3. Cruft Assessment

### Dead Files (Confirmed Unused)

The following files have no imports in the application and should be safely removed:

- `client/src/components/FilterButton.tsx`
- `client/src/components/HamburgerButton.tsx`
- `client/src/components/NetworkContextMenu.tsx`
- `client/src/components/analytics/components/AnalyticsFilters.tsx`
- `client/src/components/geospatial/hooks/useNetworkInfiniteScroll.ts`
- `server/src/api/routes/v1/admin-threat-scoring.ts`
- `server/src/logging/middleware.ts`

### Redundant Proxy Routes (Admin API)

These routes primarily proxy calls to services without adding value:

- `server/src/api/routes/v1/admin/adminHelpers.ts`
- `server/src/api/routes/v1/admin/importHelpers.ts`
- `server/src/api/routes/v1/admin/kmlImportUtils.ts`

### Unused Exported Symbols

The following symbols are exported but not consumed externally:

- `useFilterPayload` (`client/src/hooks/useAdaptedFilters.ts`)
- `useCurrentPageState` (`client/src/stores/filterStore.ts`)
- `createFullCapabilities` (`client/src/utils/filterCapabilities.ts`)
- `formatExportDate` (`client/src/utils/formatDate.ts`)
- `isRandomizedMAC` (`client/src/utils/macUtils.ts`)

## 4. Pending Modularity Tasks (TODOs)

- **Centralize `misc.ts`:** `server/src/api/routes/v1/misc.ts` must be split into `geocoding.ts`, `wigle/import.ts`, and `dataQuality.ts` as per the source-level TODO.

---

**Audit Summary:** The codebase has drifted significantly from the "responsibility-based modularity" goal. While a baseline exists, core components like ETL and major UI pages have become monolithic. A focused cleanup and refactoring phase is required to restore modular integrity.
