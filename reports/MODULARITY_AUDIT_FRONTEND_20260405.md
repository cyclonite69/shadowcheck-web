# Frontend Modularity Audit — 2026-04-05

## Prior Audit Context

The ShadowCheck codebase has undergone extensive modularity auditing since February 2026, with the overall modularity score improving from 6/10 to 9.8/10. Previous audits successfully eliminated widespread inline SQL in backend routes, populated the DI container with 31+ services, and initiated client-side utility extraction. The most recent refresh (March 2026) refactored major monolithic components like `GeospatialExplorer` and `KeplerPage` from ~900 lines to <250 lines, establishing a strict "Hook-Service-Component" separation.

## Directory Inventory

| Directory                 | File Count | Rough Responsibility                                                                                                        |
| :------------------------ | :--------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `api/`                    | 11         | Centralized API client and domain-specific endpoint definitions.                                                            |
| `components/admin/`       | 25         | **UNCLEAR** - System management, AWS/DB config, and data import tools; includes its own `hooks/` and `components/` subdirs. |
| `components/analytics/`   | 11         | Charting and visual data analysis layouts.                                                                                  |
| `components/auth/`        | 2          | Authentication forms (Login, Change Password).                                                                              |
| `components/badges/`      | 4          | Reusable UI badges for network properties (Security, Threat, Type).                                                         |
| `components/contextMenu/` | 5          | Map right-click menu system and specialized notes/table components.                                                         |
| `components/dashboard/`   | 3          | Metric cards and dashboard layout definitions.                                                                              |
| `components/filter/`      | 3          | Generic filter input and layout primitives.                                                                                 |
| `components/filters/`     | 9          | Domain-specific filter sections (Identity, Spatial, Threat, etc.).                                                          |
| `components/geospatial/`  | 62         | **OVERLAPPING** - Map orchestration, markers, table rendering, and 20+ feature-specific hooks.                              |
| `components/kepler/`      | 7          | Kepler.gl/Deck.gl visualization components and utilities.                                                                   |
| `components/modals/`      | 1          | Shared modal dialogs (Time/Frequency).                                                                                      |
| `components/ui/`          | 1          | Miscellaneous low-level UI components.                                                                                      |
| `components/wigle/`       | 12         | WiGLE-specific search UI, results table, and map layer logic.                                                               |
| `constants/`              | 2          | Shared configuration constants (Colors, Networks).                                                                          |
| `directions/`             | 4          | Mapbox Directions API integration and routing logic.                                                                        |
| `hooks/`                  | 18         | Global stateful logic (Auth, Data fetching, Universal filters).                                                             |
| `logging/`                | 1          | Client-side error logging and reporting utility.                                                                            |
| `stores/`                 | 1          | Zustand state management (filterStore).                                                                                     |
| `types/`                  | 2          | Shared TypeScript interfaces and type definitions.                                                                          |
| `utils/`                  | 28         | **DENSE** - Pure functions for formatting, data transformation, and map helpers.                                            |

## Size Violations

| Line Count | File Path                                                        | Modularity Status |
| :--------- | :--------------------------------------------------------------- | :---------------- |
| **879**    | `client/src/components/geospatial/MapToolbar.tsx`                | **❌ VIOLATION**  |
| **656**    | `client/src/components/geospatial/useObservationLayers.ts`       | **❌ VIOLATION**  |
| **600**    | `client/src/components/geospatial/useGeospatialMap.ts`           | **❌ VIOLATION**  |
| **566**    | `client/src/components/geospatial/useNetworkContextMenu.ts`      | **❌ VIOLATION**  |
| **494**    | `client/src/components/geospatial/useMapStyleControls.ts`        | **⚠️ CONCERN**    |
| **489**    | `client/src/components/geospatial/NetworkNoteModal.tsx`          | **⚠️ CONCERN**    |
| **446**    | `client/src/components/geospatial/useGeospatialExplorerState.ts` | **⚠️ CONCERN**    |
| **425**    | `client/src/components/modals/NetworkTimeFrequencyModal.tsx`     | **⚠️ CONCERN**    |
| **321**    | `client/src/components/hooks/useFederalCourthouses.ts`           | **⚠️ CONCERN**    |
| **317**    | `client/src/components/hooks/useAgencyOffices.ts`                | **⚠️ CONCERN**    |
| **304**    | `client/src/hooks/useKeplerDeck.ts`                              | **⚠️ CONCERN**    |

## Hook Responsibility Issues

| Hook File                    | Location      | Primary Responsibility                            | Secondary Concerns (if any)                    |
| :--------------------------- | :------------ | :------------------------------------------------ | :--------------------------------------------- |
| `useFilteredData`            | `hooks/`      | **MIXED** - Connects filter store to API.         | Pagination, offset logic, data fetching.       |
| `useNetworkData`             | `hooks/`      | **MIXED** - Infinite scroll & filter integration. | API fetching, data transformation.             |
| `useObservations`            | `hooks/`      | **MIXED** - Paginated observation fetching.       | Filter integration, budget tracking, grouping. |
| `useGeospatialExplorerState` | `geospatial/` | **MIXED** - Huge orchestrator hook.               | UI state, sub-hook init, search effects.       |
| `useGeospatialMap`           | `geospatial/` | **MIXED** - Mapbox lifecycle & interactions.      | Tooltip/drag logic, initial center/zoom.       |
| `useNetworkContextMenu`      | `geospatial/` | **MIXED** - Context menu state & data.            | API calls for tags, lookup dialog state.       |
| `useObservationLayers`       | `geospatial/` | **MIXED** - Render all map features.              | Jitter logic, tooltips, WiGLE popups.          |

## Import Coupling Concerns

| File                       | Import Count | Modularity Status | Internal Coupling Depth |
| :------------------------- | :----------: | :---------------- | :---------------------- |
| `MapToolbar.tsx`           |      1       | OK                | None                    |
| `useObservationLayers.ts`  |      10      | OK                | 6 relative imports      |
| `useGeospatialMap.ts`      |      12      | OK                | 8 relative imports      |
| `useNetworkContextMenu.ts` |      6       | OK                | 4 relative imports      |
| `useMapStyleControls.ts`   |      6       | OK                | 4 relative imports      |

## Dead Code Surface

- **Estimated exported symbols**: 598
- **Analysis**: The count is proportional to the codebase size (~300 files). However, the density of utilities in `client/src/utils` suggests that many pure functions may be over-exported or unused across different feature slices.

## Recommended Refactors (Priority Order)

1.  **`client/src/components/geospatial/MapToolbar.tsx`**
    - Problem: 879-line monolithic UI component with 100+ lines of inline SVG paths and repeated button patterns.
    - Fix: Extract SVG icons to `MapToolbarIcons.tsx` and functional groups (Search, View Controls, Panel Toggles) to sub-components.
    - Effort: Medium
2.  **`client/src/components/geospatial/useObservationLayers.ts`**
    - Problem: 656-line "God Hook" responsible for rendering points, lines, WiGLE data, jittering, and popups.
    - Fix: Split into `useCoreObservationLayers.ts`, `useWigleLayers.ts`, and `useSummaryLayers.ts`.
    - Effort: Large
3.  **`client/src/components/geospatial/useGeospatialMap.ts`**
    - Problem: 600-line hook mixing Mapbox lifecycle, complex tooltip positioning, and popup drag state machines.
    - Fix: Extract tooltip/drag orchestration to a dedicated service or simpler hook.
    - Effort: Large
4.  **`client/src/components/geospatial/` Directory**
    - Problem: Directory is overcrowded (62 files) with mixed responsibilities (UI, hooks, types).
    - Fix: Create sub-directories for `/hooks`, `/table`, `/markers`, and `/overlays`.
    - Effort: Small
5.  **`client/src/components/geospatial/useNetworkContextMenu.ts`**
    - Problem: 566-line hook mixing context menu UI state with tag/note data fetching.
    - Fix: Extract data fetching to a simpler `useNetworkTagData.ts` hook.
    - Effort: Medium
6.  **`client/src/components/admin/` Directory**
    - Problem: Inconsistent internal structure (`hooks/` and `components/` subdirs inside a component folder).
    - Fix: Align with project standards by moving hooks to `client/src/hooks` (if generic) or a shared feature hook location.
    - Effort: Medium
7.  **`client/src/components/geospatial/NetworkNoteModal.tsx`**
    - Problem: 489-line modal with complex attachment and form logic.
    - Fix: Extract attachment handling to a dedicated `useNoteAttachments.ts` hook.
    - Effort: Medium
8.  **`client/src/hooks/useObservations.ts`**
    - Problem: Mixed concerns (Fetching + Data Transformation + Budgeting).
    - Fix: Extract grouping logic to `utils/observationDataTransformation.ts` (partially done, finish remaining logic).
    - Effort: Small
9.  **`client/src/components/modals/NetworkTimeFrequencyModal.tsx`**
    - Problem: 425-line monolithic modal with large chart definitions.
    - Fix: Extract chart components to `analytics/components` or a co-located chart file.
    - Effort: Medium
10. **`client/src/hooks/useNetworkData.ts`**
    - Problem: Mixed concerns (Filter integration + Infinite scroll + Mapping).
    - Fix: Delegate more transformation logic to `utils/networkDataTransformation.ts`.
    - Effort: Small
