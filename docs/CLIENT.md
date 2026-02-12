# Client Documentation

This document covers the ShadowCheckStatic React frontend application structure, components, hooks, and utilities.

## Project Overview

The client is a React application built with Vite, TypeScript, and Tailwind CSS. It provides a geospatial surveillance detection dashboard with network exploration, analytics, and administrative features.

## Tech Stack

- **Framework**: React 18+
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context + custom stores
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

| Component                                           | Path                               | Description               |
| --------------------------------------------------- | ---------------------------------- | ------------------------- |
| [`Navigation`](src/components/Navigation.tsx)       | `src/components/Navigation.tsx`    | Main navigation component |
| [`DashboardPage`](src/components/DashboardPage.tsx) | `src/components/DashboardPage.tsx` | Main dashboard view       |
| [`AdminPage`](src/components/AdminPage.tsx)         | `src/components/AdminPage.tsx`     | Admin settings page       |

### Geospatial Components

| Component                                                                     | Path                                            | Description                           |
| ----------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| [`GeospatialExplorer`](src/components/GeospatialExplorer.tsx)                 | `src/components/GeospatialExplorer.tsx`         | Main geospatial exploration interface |
| [`GeospatialIntelligencePage`](src/components/GeospatialIntelligencePage.tsx) | `src/components/GeospatialIntelligencePage.tsx` | Intelligence analysis page            |
| [`KeplerPage`](src/components/KeplerPage.tsx)                                 | `src/components/KeplerPage.tsx`                 | Kepler.gl visualization page          |
| [`WigleMap`](src/components/WigleMap.tsx)                                     | `src/components/WigleMap.tsx`                   | Wigle.net integration map             |
| [`LazyMapComponent`](src/components/LazyMapComponent.tsx)                     | `src/components/LazyMapComponent.tsx`           | Lazy-loaded map component             |

### Network Exploration Components

| Component                                                 | Path                                  | Description                   |
| --------------------------------------------------------- | ------------------------------------- | ----------------------------- |
| [`NetworksExplorer`](src/components/NetworksExplorer.tsx) | `src/components/NetworksExplorer.tsx` | Network exploration interface |
| [`ThreatsExplorer`](src/components/ThreatsExplorer.tsx)   | `src/components/ThreatsExplorer.tsx`  | Threat analysis interface     |
| [`WiglePage`](src/components/WiglePage.tsx)               | `src/components/WiglePage.tsx`        | Wigle.net data page           |

### Analytics Components

| Component                                                                      | Path                                                       | Description               |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------- |
| [`AnalyticsPage`](src/components/AnalyticsPage.tsx)                            | `src/components/AnalyticsPage.tsx`                         | Analytics dashboard       |
| [`AnalyticsCharts`](src/components/analytics/components/AnalyticsCharts.tsx)   | `src/components/analytics/components/AnalyticsCharts.tsx`  | Chart components          |
| [`AnalyticsFilters`](src/components/analytics/components/AnalyticsFilters.tsx) | `src/components/analytics/components/AnalyticsFilters.tsx` | Analytics filter controls |
| [`AnalyticsLayout`](src/components/analytics/components/AnalyticsLayout.tsx)   | `src/components/analytics/components/AnalyticsLayout.tsx`  | Analytics page layout     |

### Filter Components

| Component                                                         | Path                                      | Description            |
| ----------------------------------------------------------------- | ----------------------------------------- | ---------------------- |
| [`FilterPanel`](src/components/FilterPanel.tsx)                   | `src/components/FilterPanel.tsx`          | Main filter panel      |
| [`FilterPanelContainer`](src/components/FilterPanelContainer.tsx) | `src/components/FilterPanelContainer.tsx` | Filter panel container |
| [`FilterButton`](src/components/FilterButton.tsx)                 | `src/components/FilterButton.tsx`         | Filter toggle button   |
| [`ActiveFiltersSummary`](src/components/ActiveFiltersSummary.tsx) | `src/components/ActiveFiltersSummary.tsx` | Active filters display |

### Admin Components

| Component                                                    | Path                                            | Description          |
| ------------------------------------------------------------ | ----------------------------------------------- | -------------------- |
| [`AdminPage`](src/components/AdminPage.tsx)                  | `src/components/AdminPage.tsx`                  | Admin dashboard      |
| [`AdminCard`](src/components/admin/components/AdminCard.tsx) | `src/components/admin/components/AdminCard.tsx` | Admin card component |

#### Admin Tabs

| Component                                                            | Path                                             | Description                |
| -------------------------------------------------------------------- | ------------------------------------------------ | -------------------------- |
| [`ApiTestingTab`](src/components/admin/tabs/ApiTestingTab.tsx)       | `src/components/admin/tabs/ApiTestingTab.tsx`    | API testing interface      |
| [`AwsTab`](src/components/admin/tabs/AwsTab.tsx)                     | `src/components/admin/tabs/AwsTab.tsx`           | AWS management             |
| [`BackupsTab`](src/components/admin/tabs/BackupsTab.tsx)             | `src/components/admin/tabs/BackupsTab.tsx`       | Backup management          |
| [`ConfigurationTab`](src/components/admin/tabs/ConfigurationTab.tsx) | `src/components/admin/tabs/ConfigurationTab.tsx` | System configuration       |
| [`DataExportTab`](src/components/admin/tabs/DataExportTab.tsx)       | `src/components/admin/tabs/DataExportTab.tsx`    | Data export tools          |
| [`DataImportTab`](src/components/admin/tabs/DataImportTab.tsx)       | `src/components/admin/tabs/DataImportTab.tsx`    | Data import tools          |
| [`GeocodingTab`](src/components/admin/tabs/GeocodingTab.tsx)         | `src/components/admin/tabs/GeocodingTab.tsx`     | Geocoding cache management |
| [`MLTrainingTab`](src/components/admin/tabs/MLTrainingTab.tsx)       | `src/components/admin/tabs/MLTrainingTab.tsx`    | ML model training          |
| [`PgAdminTab`](src/components/admin/tabs/PgAdminTab.tsx)             | `src/components/admin/tabs/PgAdminTab.tsx`       | pgAdmin integration        |
| [`WigleDetailTab`](src/components/admin/tabs/WigleDetailTab.tsx)     | `src/components/admin/tabs/WigleDetailTab.tsx`   | Wigle detail view          |
| [`WigleSearchTab`](src/components/admin/tabs/WigleSearchTab.tsx)     | `src/components/admin/tabs/WigleSearchTab.tsx`   | Wigle search interface     |

### Geospatial Sub-Components

| Component                                                                        | Path                                                   | Description              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------ |
| [`ColumnSelector`](src/components/geospatial/ColumnSelector.tsx)                 | `src/components/geospatial/ColumnSelector.tsx`         | Table column selector    |
| [`FiltersSidebar`](src/components/geospatial/FiltersSidebar.tsx)                 | `src/components/geospatial/FiltersSidebar.tsx`         | Filters sidebar          |
| [`GeospatialContent`](src/components/geospatial/GeospatialContent.tsx)           | `src/components/geospatial/GeospatialContent.tsx`      | Main geospatial content  |
| [`GeospatialFiltersPanel`](src/components/geospatial/GeospatialFiltersPanel.tsx) | `src/components/geospatial/GeospatialFiltersPanel.tsx` | Geospatial filters panel |
| [`GeospatialLayout`](src/components/geospatial/GeospatialLayout.tsx)             | `src/components/geospatial/GeospatialLayout.tsx`       | Geospatial page layout   |
| [`GeospatialOverlays`](src/components/geospatial/GeospatialOverlays.tsx)         | `src/components/geospatial/GeospatialOverlays.tsx`     | Map overlays             |
| [`GeospatialShell`](src/components/geospatial/GeospatialShell.tsx)               | `src/components/geospatial/GeospatialShell.tsx`        | Geospatial shell wrapper |
| [`MapHeader`](src/components/geospatial/MapHeader.tsx)                           | `src/components/geospatial/MapHeader.tsx`              | Map header               |
| [`MapLayersToggle`](src/components/geospatial/MapLayersToggle.tsx)               | `src/components/geospatial/MapLayersToggle.tsx`        | Map layer toggles        |
| [`MapPanel`](src/components/geospatial/MapPanel.tsx)                             | `src/components/geospatial/MapPanel.tsx`               | Map panel                |
| [`MapSection`](src/components/geospatial/MapSection.tsx)                         | `src/components/geospatial/MapSection.tsx`             | Map section              |
| [`MapStatusBar`](src/components/geospatial/MapStatusBar.tsx)                     | `src/components/geospatial/MapStatusBar.tsx`           | Map status bar           |
| [`MapToolbar`](src/components/geospatial/MapToolbar.tsx)                         | `src/components/geospatial/MapToolbar.tsx`             | Map toolbar              |
| [`MapToolbarActions`](src/components/geospatial/MapToolbarActions.tsx)           | `src/components/geospatial/MapToolbarActions.tsx`      | Toolbar actions          |
| [`MapViewport`](src/components/geospatial/MapViewport.tsx)                       | `src/components/geospatial/MapViewport.tsx`            | Map viewport             |
| [`NetworkExplorerCard`](src/components/geospatial/NetworkExplorerCard.tsx)       | `src/components/geospatial/NetworkExplorerCard.tsx`    | Network card             |
| [`NetworkExplorerHeader`](src/components/geospatial/NetworkExplorerHeader.tsx)   | `src/components/geospatial/NetworkExplorerHeader.tsx`  | Network explorer header  |
| [`NetworkExplorerSection`](src/components/geospatial/NetworkExplorerSection.tsx) | `src/components/geospatial/NetworkExplorerSection.tsx` | Network explorer section |
| [`NetworkNoteModal`](src/components/geospatial/NetworkNoteModal.tsx)             | `src/components/geospatial/NetworkNoteModal.tsx`       | Network note modal       |
| [`NetworkTableBody`](src/components/geospatial/NetworkTableBody.tsx)             | `src/components/geospatial/NetworkTableBody.tsx`       | Network table body       |
| [`NetworkTableEmptyState`](src/components/geospatial/NetworkTableEmptyState.tsx) | `src/components/geospatial/NetworkTableEmptyState.tsx` | Empty state              |
| [`NetworkTableFooter`](src/components/geospatial/NetworkTableFooter.tsx)         | `src/components/geospatial/NetworkTableFooter.tsx`     | Network table footer     |
| [`NetworkTableHeader`](src/components/geospatial/NetworkTableHeader.tsx)         | `src/components/geospatial/NetworkTableHeader.tsx`     | Network table header     |
| [`NetworkTableRow`](src/components/geospatial/NetworkTableRow.tsx)               | `src/components/geospatial/NetworkTableRow.tsx`        | Network table row        |
| [`NetworkTagMenu`](src/components/geospatial/NetworkTagMenu.tsx)                 | `src/components/geospatial/NetworkTagMenu.tsx`         | Network tag menu         |
| [`ResizeHandle`](src/components/geospatial/ResizeHandle.tsx)                     | `src/components/geospatial/ResizeHandle.tsx`           | Panel resize handle      |
| [`WigleLookupDialog`](src/components/geospatial/WigleLookupDialog.tsx)           | `src/components/geospatial/WigleLookupDialog.tsx`      | Wigle lookup dialog      |
| [`WigleObservationsPanel`](src/components/geospatial/WigleObservationsPanel.tsx) | `src/components/geospatial/WigleObservationsPanel.tsx` | Wigle observations panel |

### Modal Components

| Component                                                                          | Path                                                  | Description          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------- |
| [`NetworkTimeFrequencyModal`](src/components/modals/NetworkTimeFrequencyModal.tsx) | `src/components/modals/NetworkTimeFrequencyModal.tsx` | Time frequency modal |

### Badge Components

| Component                                              | Path                                    | Description        |
| ------------------------------------------------------ | --------------------------------------- | ------------------ |
| [`ThreatBadge`](src/components/badges/ThreatBadge.tsx) | `src/components/badges/ThreatBadge.tsx` | Threat level badge |
| [`TypeBadge`](src/components/badges/TypeBadge.tsx)     | `src/components/badges/TypeBadge.tsx`   | Network type badge |

## Custom Hooks

### Core Hooks

| Hook                                                  | Path                             | Description                     |
| ----------------------------------------------------- | -------------------------------- | ------------------------------- |
| [`useAuth`](src/hooks/useAuth.tsx)                    | `src/hooks/useAuth.tsx`          | Authentication state management |
| [`useNetworkData`](src/hooks/useNetworkData.ts)       | `src/hooks/useNetworkData.ts`    | Network data fetching           |
| [`useObservations`](src/hooks/useObservations.ts)     | `src/hooks/useObservations.ts`   | Observations data management    |
| [`useAdaptedFilters`](src/hooks/useAdaptedFilters.ts) | `src/hooks/useAdaptedFilters.ts` | Filter adaptation               |
| [`useFilteredData`](src/hooks/useFilteredData.ts)     | `src/hooks/useFilteredData.ts`   | Filtered data management        |
| [`usePageFilters`](src/hooks/usePageFilters.ts)       | `src/hooks/usePageFilters.ts`    | Page-level filter management    |

### Admin Hooks

| Hook                                                                   | Path                                              | Description                |
| ---------------------------------------------------------------------- | ------------------------------------------------- | -------------------------- |
| [`useApiTesting`](src/components/admin/hooks/useApiTesting.ts)         | `src/components/admin/hooks/useApiTesting.ts`     | API testing functionality  |
| [`useAwsOverview`](src/components/admin/hooks/useAwsOverview.ts)       | `src/components/admin/hooks/useAwsOverview.ts`    | AWS resource overview      |
| [`useBackups`](src/components/admin/hooks/useBackups.ts)               | `src/components/admin/hooks/useBackups.ts`        | Backup management          |
| [`useConfiguration`](src/components/admin/hooks/useConfiguration.ts)   | `src/components/admin/hooks/useConfiguration.ts`  | Configuration management   |
| [`useDataImport`](src/components/admin/hooks/useDataImport.ts)         | `src/components/admin/hooks/useDataImport.ts`     | Data import functionality  |
| [`useGeocodingCache`](src/components/admin/hooks/useGeocodingCache.ts) | `src/components/admin/hooks/useGeocodingCache.ts` | Geocoding cache management |
| [`useMLTraining`](src/components/admin/hooks/useMLTraining.ts)         | `src/components/admin/hooks/useMLTraining.ts`     | ML training functionality  |
| [`usePgAdmin`](src/components/admin/hooks/usePgAdmin.ts)               | `src/components/admin/hooks/usePgAdmin.ts`        | pgAdmin integration        |
| [`useWigleDetail`](src/components/admin/hooks/useWigleDetail.ts)       | `src/components/admin/hooks/useWigleDetail.ts`    | Wigle detail view          |
| [`useWigleSearch`](src/components/admin/hooks/useWigleSearch.ts)       | `src/components/admin/hooks/useWigleSearch.ts`    | Wigle search               |

### Analytics Hooks

| Hook                                                                           | Path                                                    | Description                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------- |
| [`useAnalyticsData`](src/components/analytics/hooks/useAnalyticsData.ts)       | `src/components/analytics/hooks/useAnalyticsData.ts`    | Analytics data fetching     |
| [`useAnalyticsFilters`](src/components/analytics/hooks/useAnalyticsFilters.ts) | `src/components/analytics/hooks/useAnalyticsFilters.ts` | Analytics filter management |
| [`useCardLayout`](src/components/analytics/hooks/useCardLayout.ts)             | `src/components/analytics/hooks/useCardLayout.ts`       | Card layout management      |

### Geospatial Hooks

| Hook                                                                                      | Path                                                       | Description                       |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| [`useApplyMapLayerDefaults`](src/components/geospatial/useApplyMapLayerDefaults.ts)       | `src/components/geospatial/useApplyMapLayerDefaults.ts`    | Apply default map layers          |
| [`useBoundingBoxFilter`](src/components/geospatial/useBoundingBoxFilter.ts)               | `src/components/geospatial/useBoundingBoxFilter.ts`        | Bounding box filtering            |
| [`useColumnVisibility`](src/components/geospatial/useColumnVisibility.ts)                 | `src/components/geospatial/useColumnVisibility.ts`         | Column visibility state           |
| [`useDebouncedFilterState`](src/components/geospatial/useDebouncedFilterState.ts)         | `src/components/geospatial/useDebouncedFilterState.ts`     | Debounced filter state            |
| [`useExplorerPanels`](src/components/geospatial/useExplorerPanels.ts)                     | `src/components/geospatial/useExplorerPanels.ts`           | Explorer panel management         |
| [`useGeospatialMap`](src/components/geospatial/useGeospatialMap.ts)                       | `src/components/geospatial/useGeospatialMap.ts`            | Geospatial map state              |
| [`useHomeLocation`](src/components/geospatial/useHomeLocation.ts)                         | `src/components/geospatial/useHomeLocation.ts`             | Home location management          |
| [`useHomeLocationLayer`](src/components/geospatial/useHomeLocationLayer.ts)               | `src/components/geospatial/useHomeLocationLayer.ts`        | Home location layer               |
| [`useLocationSearch`](src/components/geospatial/useLocationSearch.ts)                     | `src/components/geospatial/useLocationSearch.ts`           | Location search functionality     |
| [`useMapDimensions`](src/components/geospatial/useMapDimensions.ts)                       | `src/components/geospatial/useMapDimensions.ts`            | Map dimensions state              |
| [`useMapPreferences`](src/components/geospatial/useMapPreferences.ts)                     | `src/components/geospatial/useMapPreferences.ts`           | Map preferences                   |
| [`useMapResizeHandle`](src/components/geospatial/useMapResizeHandle.ts)                   | `src/components/geospatial/useMapResizeHandle.ts`          | Map resize handling               |
| [`useMapStyleControls`](src/components/geospatial/useMapStyleControls.ts)                 | `src/components/geospatial/useMapStyleControls.ts`         | Map style controls                |
| [`useNetworkContextMenu`](src/components/geospatial/useNetworkContextMenu.ts)             | `src/components/geospatial/useNetworkContextMenu.ts`       | Network context menu              |
| [`useNetworkInfiniteScroll`](src/components/geospatial/useNetworkInfiniteScroll.ts)       | `src/components/geospatial/useNetworkInfiniteScroll.ts`    | Infinite scroll pagination        |
| [`useNetworkNotes`](src/components/geospatial/useNetworkNotes.ts)                         | `src/components/geospatial/useNetworkNotes.ts`             | Network notes management          |
| [`useNetworkSelection`](src/components/geospatial/useNetworkSelection.ts)                 | `src/components/geospatial/useNetworkSelection.ts`         | Network selection state           |
| [`useNetworkSort`](src/components/geospatial/useNetworkSort.ts)                           | `src/components/geospatial/useNetworkSort.ts`              | Network sorting                   |
| [`useObservationLayers`](src/components/geospatial/useObservationLayers.ts)               | `src/components/geospatial/useObservationLayers.ts`        | Observation layers                |
| [`useObservationSummary`](src/components/geospatial/useObservationSummary.ts)             | `src/components/geospatial/useObservationSummary.ts`       | Observation summary               |
| [`useResetPaginationOnFilters`](src/components/geospatial/useResetPaginationOnFilters.ts) | `src/components/geospatial/useResetPaginationOnFilters.ts` | Reset pagination on filter change |
| [`useTimeFrequencyModal`](src/components/geospatial/useTimeFrequencyModal.ts)             | `src/components/geospatial/useTimeFrequencyModal.ts`       | Time frequency modal              |

## Stores

| Store                                      | Path                        | Description                    |
| ------------------------------------------ | --------------------------- | ------------------------------ |
| [`filterStore`](src/stores/filterStore.ts) | `src/stores/filterStore.ts` | Global filter state management |

## Types

| File                                 | Path                   | Description           |
| ------------------------------------ | ---------------------- | --------------------- |
| [`network.ts`](src/types/network.ts) | `src/types/network.ts` | Network-related types |
| [`filters.ts`](src/types/filters.ts) | `src/types/filters.ts` | Filter-related types  |

## Constants

| File                                     | Path                       | Description               |
| ---------------------------------------- | -------------------------- | ------------------------- |
| [`network.ts`](src/constants/network.ts) | `src/constants/network.ts` | Network-related constants |

## Utilities

| File                                                               | Path                                  | Description              |
| ------------------------------------------------------------------ | ------------------------------------- | ------------------------ |
| [`filterCapabilities.ts`](src/utils/filterCapabilities.ts)         | `src/utils/filterCapabilities.ts`     | Filter capabilities      |
| [`mapboxLoader.ts`](src/utils/mapboxLoader.ts)                     | `src/utils/mapboxLoader.ts`           | Mapbox GL JS loader      |
| [`mapHelpers.ts`](src/utils/mapHelpers.ts)                         | `src/utils/mapHelpers.ts`             | Map helper functions     |
| [`mapOrientationControls.ts`](src/utils/mapOrientationControls.ts) | `src/utils/mapOrientationControls.ts` | Map orientation controls |

## Logging

| File                                             | Path                          | Description         |
| ------------------------------------------------ | ----------------------------- | ------------------- |
| [`clientLogger.ts`](src/logging/clientLogger.ts) | `src/logging/clientLogger.ts` | Client-side logging |

## Components Scheduled for Refactoring

The following components have been identified as having multiple responsibilities and are scheduled for modularization:

### GeospatialExplorer.tsx (622 lines) → 4 modules

- **Currently:** Map rendering + controls + layout handling mixed
- **Refactoring into:**
  - `MapContainer.tsx` - Pure map viewport & rendering
  - `LocationControls.tsx` - Map interaction controls
  - `ResizeHandler.tsx` - Container sizing logic
  - `GeospatialExplorer.tsx` - Feature container (~200 lines)

### KeplerPage.tsx (626 lines) → 4 modules

- **Currently:** Kepler.gl init + controls + filtering mixed
- **Refactoring into:**
  - `KeplerVisualization.tsx` - Visualization rendering
  - `KeplerControls.tsx` - User interaction controls
  - `KeplerFilters.tsx` - Data filtering interface
  - `KeplerPage.tsx` - Feature container (~150 lines)

### ConfigurationTab.tsx (501 lines) → 7 modules

- **Currently:** Six configuration domains mixed in one file
- **Refactoring into:**
  - `MapboxConfig.tsx` - Mapbox API config
  - `GoogleMapsConfig.tsx` - Google Maps config
  - `AWSConfig.tsx` - AWS settings
  - `GeocodingConfig.tsx` - Geocoding provider config
  - `SmartyConfig.tsx` - Smarty Streets config
  - `WiGLEConfig.tsx` - WiGLE API config
  - `ConfigurationTab.tsx` - Container (~100 lines)

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

See [`tailwind.config.js`](tailwind.config.js) for complete theme configuration.

## Entry Points

- **Main Entry**: [`client/src/main.tsx`](client/src/main.tsx)
- **Routing**: [`client/src/App.tsx`](client/src/App.tsx)
- **Styles**: [`client/src/index.css`](client/src/index.css)

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
- [Database Schema](DATABASE_SCHEMA_ENTITIES.md)
- [Development Guide](../DEVELOPMENT.md)
