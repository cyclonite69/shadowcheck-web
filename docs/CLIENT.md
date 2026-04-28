# Client Documentation

This document covers the ShadowCheckStatic React frontend application structure, components, hooks, and utilities.

**Wiki reference (diagrams):** [Architecture](../.github/wiki/Architecture.md)

## Project Overview

The client is a React application built with Vite, TypeScript, and Tailwind CSS. It provides a geospatial surveillance detection dashboard with network exploration, analytics, and administrative features.

## Tech Stack

- **Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand + React Hooks
- **Mapping**: Mapbox GL JS / Kepler.gl
- **Charts**: Custom analytics charts

## Directory Structure

```
client/
├── index.html              # Entry HTML
├── postcss.config.js       # PostCSS configuration
├── tailwind.config.js      # Tailwind theme configuration
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
└── src/
    ├── main.tsx            # Application entry point
    ├── App.tsx             # Root component with routing
    ├── index.css           # Global styles
    ├── components/         # React components
    ├── hooks/              # Custom React hooks
    ├── stores/             # State stores
    ├── types/              # TypeScript type definitions
    ├── constants/          # Constants
    ├── utils/              # Utility functions
    └── logging/            # Client-side logging
```

## Components

### Core Components

| Component                                                     | Path                               | Description               |
| ------------------------------------------------------------- | ---------------------------------- | ------------------------- |
| [`Navigation`](../client/src/components/Navigation.tsx)       | `src/components/Navigation.tsx`    | Main navigation component |
| [`DashboardPage`](../client/src/components/DashboardPage.tsx) | `src/components/DashboardPage.tsx` | Main dashboard view       |
| [`AdminPage`](../client/src/components/AdminPage.tsx)         | `src/components/AdminPage.tsx`     | Admin settings page       |

### Geospatial Components

| Component                                                                    | Path                                            | Description                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| [`GeospatialExplorer`](../client/src/components/GeospatialExplorer.tsx)      | `src/components/GeospatialExplorer.tsx`         | Main geospatial exploration interface    |
| [`GeospatialShell`](../client/src/components/geospatial/GeospatialShell.tsx) | `src/components/geospatial/GeospatialShell.tsx` | Geospatial shell and state composition   |
| [`KeplerPage`](../client/src/components/KeplerPage.tsx)                      | `src/components/KeplerPage.tsx`                 | Kepler.gl visualization page (207 lines) |
| [`WigleMap`](../client/src/components/WigleMap.tsx)                          | `src/components/WigleMap.tsx`                   | Wigle.net integration map                |
| [`LazyMapComponent`](../client/src/components/LazyMapComponent.tsx)          | `src/components/LazyMapComponent.tsx`           | Lazy-loaded map component                |

### Network Exploration Components

| Component                                                                                  | Path                                                   | Description                 |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------- |
| [`NetworkExplorerSection`](../client/src/components/geospatial/NetworkExplorerSection.tsx) | `src/components/geospatial/NetworkExplorerSection.tsx` | Network exploration section |
| [`NetworkExplorerCard`](../client/src/components/geospatial/NetworkExplorerCard.tsx)       | `src/components/geospatial/NetworkExplorerCard.tsx`    | Network detail card         |
| [`WiglePage`](../client/src/components/WiglePage.tsx)                                      | `src/components/WiglePage.tsx`                         | Wigle.net data page         |

### Analytics Components

| Component                                                                                | Path                                                       | Description               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------- |
| [`AnalyticsPage`](../client/src/components/AnalyticsPage.tsx)                            | `src/components/AnalyticsPage.tsx`                         | Analytics dashboard       |
| [`AnalyticsCharts`](../client/src/components/analytics/components/AnalyticsCharts.tsx)   | `src/components/analytics/components/AnalyticsCharts.tsx`  | Chart components          |
| [`AnalyticsFilters`](../client/src/components/analytics/components/AnalyticsFilters.tsx) | `src/components/analytics/components/AnalyticsFilters.tsx` | Analytics filter controls |
| [`AnalyticsLayout`](../client/src/components/analytics/components/AnalyticsLayout.tsx)   | `src/components/analytics/components/AnalyticsLayout.tsx`  | Analytics page layout     |

### Filter Components

| Component                                                                   | Path                                      | Description            |
| --------------------------------------------------------------------------- | ----------------------------------------- | ---------------------- |
| [`FilterPanel`](../client/src/components/FilterPanel.tsx)                   | `src/components/FilterPanel.tsx`          | Main filter panel      |
| [`FilterPanelContainer`](../client/src/components/FilterPanelContainer.tsx) | `src/components/FilterPanelContainer.tsx` | Filter panel container |
| [`FilterButton`](../client/src/components/FilterButton.tsx)                 | `src/components/FilterButton.tsx`         | Filter toggle button   |
| [`ActiveFiltersSummary`](../client/src/components/ActiveFiltersSummary.tsx) | `src/components/ActiveFiltersSummary.tsx` | Active filters display |

### Admin Components

| Component                                                              | Path                                            | Description          |
| ---------------------------------------------------------------------- | ----------------------------------------------- | -------------------- |
| [`AdminPage`](../client/src/components/AdminPage.tsx)                  | `src/components/AdminPage.tsx`                  | Admin dashboard      |
| [`AdminCard`](../client/src/components/admin/components/AdminCard.tsx) | `src/components/admin/components/AdminCard.tsx` | Admin card component |

#### Admin Tabs

| Component                                                                      | Path                                             | Description                |
| ------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------- |
| [`ApiTestingTab`](../client/src/components/admin/tabs/ApiTestingTab.tsx)       | `src/components/admin/tabs/ApiTestingTab.tsx`    | API testing interface      |
| [`AwsTab`](../client/src/components/admin/tabs/AwsTab.tsx)                     | `src/components/admin/tabs/AwsTab.tsx`           | AWS management             |
| [`BackupsTab`](../client/src/components/admin/tabs/BackupsTab.tsx)             | `src/components/admin/tabs/BackupsTab.tsx`       | Backup management          |
| [`ConfigurationTab`](../client/src/components/admin/tabs/ConfigurationTab.tsx) | `src/components/admin/tabs/ConfigurationTab.tsx` | System configuration       |
| [`DataExportTab`](../client/src/components/admin/tabs/DataExportTab.tsx)       | `src/components/admin/tabs/DataExportTab.tsx`    | Data export tools          |
| [`DataImportTab`](../client/src/components/admin/tabs/DataImportTab.tsx)       | `src/components/admin/tabs/DataImportTab.tsx`    | Data import tools          |
| [`DbStatsTab`](../client/src/components/admin/tabs/DbStatsTab.tsx)             | `src/components/admin/tabs/DbStatsTab.tsx`       | Database statistics        |
| [`GeocodingTab`](../client/src/components/admin/tabs/GeocodingTab.tsx)         | `src/components/admin/tabs/GeocodingTab.tsx`     | Geocoding cache management |
| [`JobsTab`](../client/src/components/admin/tabs/JobsTab.tsx)                   | `src/components/admin/tabs/JobsTab.tsx`          | Job management             |
| [`MLTrainingTab`](../client/src/components/admin/tabs/MLTrainingTab.tsx)       | `src/components/admin/tabs/MLTrainingTab.tsx`    | ML model training          |
| [`PgAdminTab`](../client/src/components/admin/tabs/PgAdminTab.tsx)             | `src/components/admin/tabs/PgAdminTab.tsx`       | pgAdmin integration        |
| [`UsersTab`](../client/src/components/admin/tabs/UsersTab.tsx)                 | `src/components/admin/tabs/UsersTab.tsx`         | User management            |
| [`WigleDetailTab`](../client/src/components/admin/tabs/WigleDetailTab.tsx)     | `src/components/admin/tabs/WigleDetailTab.tsx`   | Wigle detail view          |
| [`WigleSearchTab`](../client/src/components/admin/tabs/WigleSearchTab.tsx)     | `src/components/admin/tabs/WigleSearchTab.tsx`   | Wigle search interface     |
| [`WigleStatsTab`](../client/src/components/admin/tabs/WigleStatsTab.tsx)       | `src/components/admin/tabs/WigleStatsTab.tsx`    | WiGLE statistics           |

### Geospatial Sub-Components

| Component                                                                                  | Path                                                   | Description               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------- |
| [`ColumnSelector`](../client/src/components/geospatial/ColumnSelector.tsx)                 | `src/components/geospatial/ColumnSelector.tsx`         | Table column selector     |
| [`FiltersSidebar`](../client/src/components/geospatial/FiltersSidebar.tsx)                 | `src/components/geospatial/FiltersSidebar.tsx`         | Filters sidebar           |
| [`GeospatialContent`](../client/src/components/geospatial/GeospatialContent.tsx)           | `src/components/geospatial/GeospatialContent.tsx`      | Main geospatial content   |
| [`GeospatialFiltersPanel`](../client/src/components/geospatial/GeospatialFiltersPanel.tsx) | `src/components/geospatial/GeospatialFiltersPanel.tsx` | Geospatial filters panel  |
| [`GeospatialLayout`](../client/src/components/geospatial/GeospatialLayout.tsx)             | `src/components/geospatial/GeospatialLayout.tsx`       | Geospatial page layout    |
| [`GeospatialOverlays`](../client/src/components/geospatial/GeospatialOverlays.tsx)         | `src/components/geospatial/GeospatialOverlays.tsx`     | Map overlays              |
| [`GeospatialShell`](../client/src/components/geospatial/GeospatialShell.tsx)               | `src/components/geospatial/GeospatialShell.tsx`        | Geospatial shell wrapper  |
| [`MapHeader`](../client/src/components/geospatial/MapHeader.tsx)                           | `src/components/geospatial/MapHeader.tsx`              | Map header                |
| [`useMapLayersToggle`](../client/src/components/geospatial/useMapLayersToggle.ts)          | `src/components/geospatial/useMapLayersToggle.ts`      | Map layer toggle state    |
| [`MapPanel`](../client/src/components/geospatial/MapPanel.tsx)                             | `src/components/geospatial/MapPanel.tsx`               | Map panel                 |
| [`MapSection`](../client/src/components/geospatial/MapSection.tsx)                         | `src/components/geospatial/MapSection.tsx`             | Map section               |
| [`MapStatusBar`](../client/src/components/geospatial/MapStatusBar.tsx)                     | `src/components/geospatial/MapStatusBar.tsx`           | Map status bar            |
| [`MapToolbar`](../client/src/components/geospatial/MapToolbar.tsx)                         | `src/components/geospatial/MapToolbar.tsx`             | Map toolbar               |
| [`MapToolbarActions`](../client/src/components/geospatial/MapToolbarActions.tsx)           | `src/components/geospatial/MapToolbarActions.tsx`      | Toolbar actions           |
| [`MapViewport`](../client/src/components/geospatial/MapViewport.tsx)                       | `src/components/geospatial/MapViewport.tsx`            | Map viewport              |
| [`NetworkExplorerCard`](../client/src/components/geospatial/NetworkExplorerCard.tsx)       | `src/components/geospatial/NetworkExplorerCard.tsx`    | Network card              |
| [`NetworkExplorerHeader`](../client/src/components/geospatial/NetworkExplorerHeader.tsx)   | `src/components/geospatial/NetworkExplorerHeader.tsx`  | Network explorer header   |
| [`NetworkExplorerSection`](../client/src/components/geospatial/NetworkExplorerSection.tsx) | `src/components/geospatial/NetworkExplorerSection.tsx` | Network explorer section  |
| [`NetworkNoteModal`](../client/src/components/geospatial/NetworkNoteModal.tsx)             | `src/components/geospatial/NetworkNoteModal.tsx`       | Network note modal        |
| [`NetworkTableBodyGrid`](../client/src/components/geospatial/NetworkTableBodyGrid.tsx)     | `src/components/geospatial/NetworkTableBodyGrid.tsx`   | Network table body grid   |
| [`NetworkTableHeaderGrid`](../client/src/components/geospatial/NetworkTableHeaderGrid.tsx) | `src/components/geospatial/NetworkTableHeaderGrid.tsx` | Network table header grid |
| [`GeospatialTableContent`](../client/src/components/geospatial/GeospatialTableContent.tsx) | `src/components/geospatial/GeospatialTableContent.tsx` | Table content wrapper     |
| [`NetworkTableRow`](../client/src/components/geospatial/NetworkTableRow.tsx)               | `src/components/geospatial/NetworkTableRow.tsx`        | Network table row         |
| [`NetworkTagMenu`](../client/src/components/geospatial/NetworkTagMenu.tsx)                 | `src/components/geospatial/NetworkTagMenu.tsx`         | Network tag menu          |
| [`ResizeHandle`](../client/src/components/geospatial/ResizeHandle.tsx)                     | `src/components/geospatial/ResizeHandle.tsx`           | Panel resize handle       |
| [`WigleLookupDialog`](../client/src/components/geospatial/WigleLookupDialog.tsx)           | `src/components/geospatial/WigleLookupDialog.tsx`      | Wigle lookup dialog       |
| [`WigleObservationsPanel`](../client/src/components/geospatial/WigleObservationsPanel.tsx) | `src/components/geospatial/WigleObservationsPanel.tsx` | Wigle observations panel  |

### Modal Components

| Component                                                                                    | Path                                                  | Description          |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------- |
| [`NetworkTimeFrequencyModal`](../client/src/components/modals/NetworkTimeFrequencyModal.tsx) | `src/components/modals/NetworkTimeFrequencyModal.tsx` | Time frequency modal |

### Badge Components

| Component                                                        | Path                                    | Description        |
| ---------------------------------------------------------------- | --------------------------------------- | ------------------ |
| [`ThreatBadge`](../client/src/components/badges/ThreatBadge.tsx) | `src/components/badges/ThreatBadge.tsx` | Threat level badge |
| [`TypeBadge`](../client/src/components/badges/TypeBadge.tsx)     | `src/components/badges/TypeBadge.tsx`   | Network type badge |

## Custom Hooks

### Core Hooks

| Hook                                                            | Path                             | Description                     |
| --------------------------------------------------------------- | -------------------------------- | ------------------------------- |
| [`useAuth`](../client/src/hooks/useAuth.tsx)                    | `src/hooks/useAuth.tsx`          | Authentication state management |
| [`useNetworkData`](../client/src/hooks/useNetworkData.ts)       | `src/hooks/useNetworkData.ts`    | Network data fetching           |
| [`useObservations`](../client/src/hooks/useObservations.ts)     | `src/hooks/useObservations.ts`   | Observations data management    |
| [`useAdaptedFilters`](../client/src/hooks/useAdaptedFilters.ts) | `src/hooks/useAdaptedFilters.ts` | Filter adaptation               |
| [`useFilteredData`](../client/src/hooks/useFilteredData.ts)     | `src/hooks/useFilteredData.ts`   | Filtered data management        |
| [`usePageFilters`](../client/src/hooks/usePageFilters.ts)       | `src/hooks/usePageFilters.ts`    | Page-level filter management    |

### Admin Hooks

| Hook                                                                             | Path                                              | Description                |
| -------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------- |
| [`useApiTesting`](../client/src/components/admin/hooks/useApiTesting.ts)         | `src/components/admin/hooks/useApiTesting.ts`     | API testing functionality  |
| [`useAwsOverview`](../client/src/components/admin/hooks/useAwsOverview.ts)       | `src/components/admin/hooks/useAwsOverview.ts`    | AWS resource overview      |
| [`useBackups`](../client/src/components/admin/hooks/useBackups.ts)               | `src/components/admin/hooks/useBackups.ts`        | Backup management          |
| [`useConfiguration`](../client/src/components/admin/hooks/useConfiguration.ts)   | `src/components/admin/hooks/useConfiguration.ts`  | Configuration management   |
| [`useDataImport`](../client/src/components/admin/hooks/useDataImport.ts)         | `src/components/admin/hooks/useDataImport.ts`     | Data import functionality  |
| [`useGeocodingCache`](../client/src/components/admin/hooks/useGeocodingCache.ts) | `src/components/admin/hooks/useGeocodingCache.ts` | Geocoding cache management |
| [`useMLTraining`](../client/src/components/admin/hooks/useMLTraining.ts)         | `src/components/admin/hooks/useMLTraining.ts`     | ML training functionality  |
| [`usePgAdmin`](../client/src/components/admin/hooks/usePgAdmin.ts)               | `src/components/admin/hooks/usePgAdmin.ts`        | pgAdmin integration        |
| [`useWigleDetail`](../client/src/components/admin/hooks/useWigleDetail.ts)       | `src/components/admin/hooks/useWigleDetail.ts`    | Wigle detail view          |
| [`useWigleSearch`](../client/src/components/admin/hooks/useWigleSearch.ts)       | `src/components/admin/hooks/useWigleSearch.ts`    | Wigle search               |

### Analytics Hooks

| Hook                                                                                     | Path                                                    | Description                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------- |
| [`useAnalyticsData`](../client/src/components/analytics/hooks/useAnalyticsData.ts)       | `src/components/analytics/hooks/useAnalyticsData.ts`    | Analytics data fetching     |
| [`useAnalyticsFilters`](../client/src/components/analytics/hooks/useAnalyticsFilters.ts) | `src/components/analytics/hooks/useAnalyticsFilters.ts` | Analytics filter management |
| [`useCardLayout`](../client/src/components/analytics/hooks/useCardLayout.ts)             | `src/components/analytics/hooks/useCardLayout.ts`       | Card layout management      |

### Geospatial Hooks

| Hook                                                                                                | Path                                                       | Description                       |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| [`useApplyMapLayerDefaults`](../client/src/components/geospatial/useApplyMapLayerDefaults.ts)       | `src/components/geospatial/useApplyMapLayerDefaults.ts`    | Apply default map layers          |
| [`useBoundingBoxFilter`](../client/src/components/geospatial/useBoundingBoxFilter.ts)               | `src/components/geospatial/useBoundingBoxFilter.ts`        | Bounding box filtering            |
| [`useColumnVisibility`](../client/src/components/geospatial/useColumnVisibility.ts)                 | `src/components/geospatial/useColumnVisibility.ts`         | Column visibility state           |
| [`useDebouncedFilterState`](../client/src/components/geospatial/useDebouncedFilterState.ts)         | `src/components/geospatial/useDebouncedFilterState.ts`     | Debounced filter state            |
| [`useExplorerPanels`](../client/src/components/geospatial/useExplorerPanels.ts)                     | `src/components/geospatial/useExplorerPanels.ts`           | Explorer panel management         |
| [`useGeospatialMap`](../client/src/components/geospatial/useGeospatialMap.ts)                       | `src/components/geospatial/useGeospatialMap.ts`            | Geospatial map state              |
| [`useHomeLocation`](../client/src/components/geospatial/useHomeLocation.ts)                         | `src/components/geospatial/useHomeLocation.ts`             | Home location management          |
| [`useHomeLocationLayer`](../client/src/components/geospatial/useHomeLocationLayer.ts)               | `src/components/geospatial/useHomeLocationLayer.ts`        | Home location layer               |
| [`useLocationSearch`](../client/src/components/geospatial/useLocationSearch.ts)                     | `src/components/geospatial/useLocationSearch.ts`           | Location search functionality     |
| [`useMapDimensions`](../client/src/components/geospatial/useMapDimensions.ts)                       | `src/components/geospatial/useMapDimensions.ts`            | Map dimensions state              |
| [`useMapPreferences`](../client/src/components/geospatial/useMapPreferences.ts)                     | `src/components/geospatial/useMapPreferences.ts`           | Map preferences                   |
| [`useMapResizeHandle`](../client/src/components/geospatial/useMapResizeHandle.ts)                   | `src/components/geospatial/useMapResizeHandle.ts`          | Map resize handling               |
| [`useMapStyleControls`](../client/src/components/geospatial/useMapStyleControls.ts)                 | `src/components/geospatial/useMapStyleControls.ts`         | Map style controls                |
| [`useNetworkContextMenu`](../client/src/components/geospatial/useNetworkContextMenu.ts)             | `src/components/geospatial/useNetworkContextMenu.ts`       | Network context menu              |
| [`useNetworkInfiniteScroll`](../client/src/components/geospatial/useNetworkInfiniteScroll.ts)       | `src/components/geospatial/useNetworkInfiniteScroll.ts`    | Infinite scroll pagination        |
| [`useNetworkNotes`](../client/src/components/geospatial/useNetworkNotes.ts)                         | `src/components/geospatial/useNetworkNotes.ts`             | Network notes management          |
| [`useNetworkSelection`](../client/src/components/geospatial/useNetworkSelection.ts)                 | `src/components/geospatial/useNetworkSelection.ts`         | Network selection state           |
| [`useNetworkSort`](../client/src/components/geospatial/useNetworkSort.ts)                           | `src/components/geospatial/useNetworkSort.ts`              | Network sorting                   |
| [`useObservationLayers`](../client/src/components/geospatial/useObservationLayers.ts)               | `src/components/geospatial/useObservationLayers.ts`        | Observation layers                |
| [`useObservationSummary`](../client/src/components/geospatial/useObservationSummary.ts)             | `src/components/geospatial/useObservationSummary.ts`       | Observation summary               |
| [`useResetPaginationOnFilters`](../client/src/components/geospatial/useResetPaginationOnFilters.ts) | `src/components/geospatial/useResetPaginationOnFilters.ts` | Reset pagination on filter change |
| [`useTimeFrequencyModal`](../client/src/components/geospatial/useTimeFrequencyModal.ts)             | `src/components/geospatial/useTimeFrequencyModal.ts`       | Time frequency modal              |

## Stores

| Store                                                | Path                        | Description                    |
| ---------------------------------------------------- | --------------------------- | ------------------------------ |
| [`filterStore`](../client/src/stores/filterStore.ts) | `src/stores/filterStore.ts` | Global filter state management |

## Types

| File                                           | Path                   | Description           |
| ---------------------------------------------- | ---------------------- | --------------------- |
| [`network.ts`](../client/src/types/network.ts) | `src/types/network.ts` | Network-related types |
| [`filters.ts`](../client/src/types/filters.ts) | `src/types/filters.ts` | Filter-related types  |

## Constants

| File                                               | Path                       | Description               |
| -------------------------------------------------- | -------------------------- | ------------------------- |
| [`network.ts`](../client/src/constants/network.ts) | `src/constants/network.ts` | Network-related constants |

## Utilities

### Data Layer Utilities

| File                                                                                       | Path                                         | Description                          |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------ |
| [`networkDataTransformation.ts`](../client/src/utils/networkDataTransformation.ts)         | `src/utils/networkDataTransformation.ts`     | Core data mapping and transformation |
| [`networkFilterParams.ts`](../client/src/utils/networkFilterParams.ts)                     | `src/utils/networkFilterParams.ts`           | Filter parameter assembly            |
| [`filteredRequestParams.ts`](../client/src/utils/filteredRequestParams.ts)                 | `src/utils/filteredRequestParams.ts`         | API request parameter construction   |
| [`filterUrlState.ts`](../client/src/utils/filterUrlState.ts)                               | `src/utils/filterUrlState.ts`                | URL synchronization for filters      |
| [`keplerDataTransformation.ts`](../client/src/utils/keplerDataTransformation.ts)           | `src/utils/keplerDataTransformation.ts`      | Kepler.gl data format mapping        |
| [`observationDataTransformation.ts`](../client/src/utils/observationDataTransformation.ts) | `src/utils/observationDataTransformation.ts` | Observation data mapping             |
| [`filteredPagination.ts`](../client/src/utils/filteredPagination.ts)                       | `src/utils/filteredPagination.ts`            | Pagination logic for filtered views  |
| [`networkFormatting.ts`](../client/src/utils/networkFormatting.ts)                         | `src/utils/networkFormatting.ts`             | UI display formatting helpers        |

### Mapping & UI Utilities

| File                                                                         | Path                                  | Description              |
| ---------------------------------------------------------------------------- | ------------------------------------- | ------------------------ |
| [`filterCapabilities.ts`](../client/src/utils/filterCapabilities.ts)         | `src/utils/filterCapabilities.ts`     | Filter capabilities      |
| [`mapboxLoader.ts`](../client/src/utils/mapboxLoader.ts)                     | `src/utils/mapboxLoader.ts`           | Mapbox GL JS loader      |
| [`mapHelpers.ts`](../client/src/utils/mapHelpers.ts)                         | `src/utils/mapHelpers.ts`             | Map helper functions     |
| [`mapOrientationControls.ts`](../client/src/utils/mapOrientationControls.ts) | `src/utils/mapOrientationControls.ts` | Map orientation controls |

## Logging

| File                                                       | Path                          | Description         |
| ---------------------------------------------------------- | ----------------------------- | ------------------- |
| [`clientLogger.ts`](../client/src/logging/clientLogger.ts) | `src/logging/clientLogger.ts` | Client-side logging |

## Components Scheduled for Refactoring (Completed)

The following components have been modularized to reduce complexity and improve maintainability:

### GeospatialExplorer.tsx (~290 lines) → Sub-component extraction

- **Status:** Completed (March 2026)
- **Outcome:** Orchestration logic moved to `useGeospatialExplorerState.ts` and `useSiblingLinks.ts`.

### KeplerPage.tsx (~207 lines) → 4 modules

- **Status:** Completed (March 2026)
- **Extracted:**
  - `useKepler.ts` hook
  - `KeplerVisualization.tsx` - Visualization rendering
  - `KeplerControls.tsx` - User interaction controls
  - `KeplerFilters.tsx` - Data filtering interface

### ConfigurationTab.tsx (~178 lines) → Domain-specific modules

- **Status:** Completed (March 2026)
- **Extracted:** `useConfiguration.ts` hook and split into domain components (`MapboxConfig`, `AWSConfig`, `WigleConfig`, `SmartyConfig`, `GeocodingConfig`, etc.).

### MLTrainingTab.tsx (~28 lines) → Domain-specific sub-cards

- **Status:** Completed (March 2026)
- **Extracted:** Split three inline admin cards into `ModelOperationsCard`, `TrainingDataCard`, and `ModelStatusCard` inside `client/src/components/admin/tabs/ml/`.

### KeplerPage.tsx DeckGL Initialization (~207 lines) → Hook abstraction

- **Status:** Completed (March 2026)
- **Extracted:** `useKeplerDeck.ts` (219 lines) to manage Deck.gl mapping initialization, state (zoom, point sizing), and fly-to-bounds behavior.

**Refactoring Timeline:** To be completed based on priority and team capacity.

**Refactoring Benefits:**

- Each module has a single, clear responsibility
- Easier to test configuration independently
- Simpler to add new configuration types
- Better code organization for new developers

## Theme & Styling

The application uses a dark dashboard theme with Tailwind CSS. Key color tokens include:

- Background: `bg-slate-*`
- Gradients for cards and headers
- Dark mode by default

See [`tailwind.config.js`](../client/tailwind.config.js) for complete theme configuration.

## Entry Points

- **Main Entry**: [`client/src/main.tsx`](../client/src/main.tsx)
- **Routing**: [`client/src/App.tsx`](../client/src/App.tsx)
- **Styles**: [`client/src/index.css`](../client/src/index.css)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev:frontend

# Build for production
npm run build

# Preview production build
npm run preview
```

## Related Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [Database Schema](DATABASE_RADIO_ARCHITECTURE.md)
- [Development Guide](DEVELOPMENT.md)
