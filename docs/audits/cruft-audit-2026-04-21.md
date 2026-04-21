# Cruft Audit - 2026-04-21

Static audit only. No runtime code was modified.

Configs read first: `package.json`, `tsconfig.json`, `tsconfig.server.json`, `client/tsconfig.json`, `tsconfig.test.json`.

## Inventory

### package.json

```text
{
  "name": "shadowcheck-web",
  "version": "1.0.0",
  "type": "commonjs",
  "description": "ShadowCheck SIGINT Forensics Platform - Static Frontend & Server",
  "main": "dist/server/server/server.js",
  "scripts": {
    "start": "node dist/server/server/server.js",
    "dev": "npm run build:server && nodemon dist/server/server/server.js",
    "dev:frontend": "vite --config client/vite.config.ts",
    "prebuild": "node scripts/write-robots.js && node scripts/generate-sitemap.js",
    "build": "npm run build:frontend && npm run build:server",
    "build:frontend": "vite build --config client/vite.config.ts --outDir ../dist",
    "build:server": "tsc --project tsconfig.server.json",
    "build:public": "ALLOW_INDEXING=true npm run build",
    "build:prod": "NODE_ENV=production ALLOW_INDEXING=true npm run build",
    "preview": "vite preview --config client/vite.config.ts",
    "serve:dist": "node server/static-server.js",
    "debug": "node --inspect server/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:certification": "jest tests/certification/radioPhysicalCertification.test.ts",
    "test:integration": "RUN_INTEGRATION_TESTS=true npm test",
    "test:bedrock": "curl -s http://localhost:3001/api/claude/test | jq . && echo '---' && curl -s -X POST http://localhost:3001/api/claude/analyze-networks -H 'Content-Type: application/json' -d '{\"networks\":[{\"bssid\":\"AA:BB:CC:DD:EE:FF\",\"ssid\":\"TestNet\",\"type\":\"W\",\"threat_score\":75,\"observation_count\":42,\"unique_days\":7,\"seen_at_home\":true,\"seen_away\":true}],\"question\":\"Is this network a surveillance threat?\"}' | jq .",
    "lint": "eslint .",
    "policy:secrets": "npm run policy:secret-disk && npm run policy:secret-scan",
    "policy:modularity": "bash scripts/check-doc-line-counts.sh && node scripts/check-modularity.js",
    "lint:fix": "eslint . --fix",
    "lint:boundaries": "tsx scripts/check-client-imports.ts",
    "type-check": "npm run type-check:server && npm run type-check:client && npm run type-check:test",
    "type-check:client": "tsc -p client/tsconfig.json --noEmit",
    "type-check:server": "tsc --noEmit",
    "type-check:test": "tsc -p tsconfig.test.json --noEmit",
    "format": "prettier --write \"**/*.{js,json,md,yml}\"",
    "format:check": "prettier --check \"**/*.{js,json,md,yml}\"",
    "docker:build": "docker build -t shadowcheck-web:latest .",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f api",
    "db:migrate": "bash sql/run-migrations.sh",
    "prepare": "husky install",
    "policy:secret-disk": "bash scripts/security/check-no-secret-disk-writes.sh",
    "policy:secret-scan": "bash scripts/security/scan-secrets.sh --repo"
  },
  "keywords": [
    "sigint",
    "forensics",
    "wireless",
    "network"
  ],
  "author": "ShadowCheck",
  "license": "MIT",
  "dependencies": {
    "@aws-sdk/client-bedrock-runtime": "3.1029.0",
    "@aws-sdk/client-ec2": "3.1029.0",
    "@aws-sdk/client-s3": "3.1025.0",
    "@aws-sdk/client-secrets-manager": "3.1032.0",
    "@aws-sdk/client-sts": "3.1029.0",
    "@aws-sdk/s3-request-presigner": "3.1032.0",
    "@deck.gl/core": "9.3.1",
    "@deck.gl/layers": "9.3.1",
    "@deck.gl/react": "9.3.1",
    "@deck.gl/widgets": "9.3.1",
    "@tanstack/react-virtual": "3.13.24",
    "@xterm/addon-fit": "0.11.0",
    "@xterm/xterm": "6.0.0",
    "axios": "^1.15.1",
    "bcrypt": "6.0.0",
    "compression": "1.8.1",
    "cookie-parser": "1.4.7",
    "cors": "2.8.5",
    "dotenv": "17.4.2",
    "express": "4.22.1",
    "express-fileupload": "1.5.2",
    "express-rate-limit": "8.3.2",
    "helmet": "8.1.0",
    "keytar": "7.9.0",
    "mapbox-gl": "3.21.0",
    "ml-logistic-regression": "2.0.0",
    "ml-matrix": "6.12.2",
    "multer": "2.1.1",
    "node-cron": "4.2.1",
    "node-fetch": "3.3.2",
    "node-schedule": "2.1.1",
    "pdfkit": "0.18.0",
    "pg": "8.20.0",
    "preact": "10.29.1",
    "react": "19.2.5",
    "react-dom": "19.2.5",
    "react-is": "19.2.5",
    "react-router-dom": "7.14.0",
    "react-window": "2.2.6",
    "recharts": "3.8.1",
    "redis": "5.11.0",
    "sqlite3": "6.0.1",
    "ts-node": "10.9.2",
    "winston": "3.19.0",
    "ws": "8.20.0",
    "zod": "3.24.2",
    "zustand": "5.0.12"
  },
  "devDependencies": {
    "@eslint/eslintrc": "3.3.5",
    "@eslint/js": "10.0.1",
    "@tailwindcss/postcss": "4.2.2",
    "@types/express": "5.0.6",
    "@types/jest": "30.0.0",
    "@types/mapbox-gl": "3.5.0",
    "@types/node": "25.6.0",
    "@types/pg": "8.20.0",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3",
    "@types/supertest": "7.2.0",
    "@types/ws": "8.18.1",
    "@typescript-eslint/eslint-plugin": "8.58.2",
    "@typescript-eslint/parser": "8.58.2",
    "@vitejs/plugin-react": "6.0.1",
    "autoprefixer": "10.5.0",
    "better-sqlite3": "^12.9.0",
    "cssnano": "7.1.5",
    "eslint": "10.2.1",
    "fast-check": "4.7.0",
    "husky": "9.1.7",
    "jest": "30.3.0",
    "lint-staged": "16.4.0",
    "lodash": "4.18.1",
    "nodemon": "3.1.14",
    "postcss": "8.5.10",
    "prettier": "3.8.3",
    "supertest": "7.2.2",
    "tailwindcss": "4.2.2",
    "terser": "5.46.1",
    "ts-jest": "29.4.9",
    "tsx": "4.21.0",
    "typescript": "6.0.3",
    "vite": "8.0.9"
  },
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=11.0.0"
  },
  "overrides": {
    "tar": ">=7.5.11",
    "flatted": ">=3.4.0",
    "fast-xml-parser": "^5.5.6",
    "serialize-javascript": ">=7.0.5",
    "brace-expansion": ">=1.1.13",
    "svgo": "4.0.1",
    "@tootallnate/once": "3.0.1"
  },
  "lint-staged": {
    "*.{js,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  }
}

```

### tsconfig.json

```text
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "allowJs": true,
    "checkJs": false,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": false,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["server/**/*", "scripts/**/*", "etl/**/*"],
  "exclude": ["node_modules", "dist", "client", ".claude"]
}

```

### tsconfig.server.json

```text
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/server",
    "noEmit": false,
    "declaration": false,
    "sourceMap": false,
    "types": ["node"]
  },
  "include": ["server/**/*", "etl/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "client",
    "tests",
    "**/*.test.ts",
    "**/*.test.js",
    "scripts/enrichment/enrichment-system.ts"
  ]
}

```

### client/tsconfig.json

```text
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["jest", "node"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}

```

### tsconfig.test.json

```text
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "types": ["jest", "node", "geojson"]
  },
  "include": ["tests/**/*", "server/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "client",
    ".claude",
    "tests/unit/middleware/**/*",
    "tests/unit/errors/**/*",
    "tests/unit/repositories/**/*",
    "tests/unit/services/authService.test.ts"
  ]
}

```

### client/src File List

```text
client/src/App.tsx
client/src/api/adminApi.ts
client/src/api/agencyApi.ts
client/src/api/analyticsApi.ts
client/src/api/authApi.ts
client/src/api/client.ts
client/src/api/dashboardApi.ts
client/src/api/keplerApi.ts
client/src/api/locationApi.ts
client/src/api/mapboxApi.ts
client/src/api/networkApi.ts
client/src/api/wigleApi.ts
client/src/components/ActiveFiltersSummary.tsx
client/src/components/AdminPage.tsx
client/src/components/AnalyticsPage.tsx
client/src/components/AppHeader.tsx
client/src/components/ControlPanel.tsx
client/src/components/DashboardPage.tsx
client/src/components/FilterButton.tsx
client/src/components/FilterPanel.tsx
client/src/components/FilterPanelContainer.tsx
client/src/components/GeospatialExplorer.tsx
client/src/components/HamburgerButton.tsx
client/src/components/KeplerPage.tsx
client/src/components/LazyMapComponent.tsx
client/src/components/MonitoringPage.tsx
client/src/components/Navigation.tsx
client/src/components/NetworkContextMenu.tsx
client/src/components/StartPage.tsx
client/src/components/WigleControlPanel.tsx
client/src/components/WigleMap.tsx
client/src/components/WiglePage.tsx
client/src/components/__tests__/universalFilterCountRendering.test.ts
client/src/components/admin/components/AdminCard.tsx
client/src/components/admin/components/ObservationsCard.tsx
client/src/components/admin/components/SourceTagInput.tsx
client/src/components/admin/components/SsmTerminal.tsx
client/src/components/admin/components/WigleRunsCard.tsx
client/src/components/admin/hooks/__tests__/useMLTraining.test.ts
client/src/components/admin/hooks/apiTestingPresets.ts
client/src/components/admin/hooks/useApiTesting.ts
client/src/components/admin/hooks/useAwsOverview.ts
client/src/components/admin/hooks/useBackups.ts
client/src/components/admin/hooks/useConfiguration.ts
client/src/components/admin/hooks/useDataImport.ts
client/src/components/admin/hooks/useGeocodingCache.ts
client/src/components/admin/hooks/useMLTraining.ts
client/src/components/admin/hooks/usePgAdmin.ts
client/src/components/admin/hooks/useWigleDetail.ts
client/src/components/admin/hooks/useWigleRuns.ts
client/src/components/admin/hooks/useWigleSearch.ts
client/src/components/admin/tabs/ApiTestingTab.tsx
client/src/components/admin/tabs/AwsTab.tsx
client/src/components/admin/tabs/BackupsTab.tsx
client/src/components/admin/tabs/ConfigurationTab.tsx
client/src/components/admin/tabs/DataExportTab.tsx
client/src/components/admin/tabs/DataImportTab.tsx
client/src/components/admin/tabs/DbStatsTab.tsx
client/src/components/admin/tabs/GeocodingTab.tsx
client/src/components/admin/tabs/JobCard.tsx
client/src/components/admin/tabs/JobIcons.tsx
client/src/components/admin/tabs/JobOptionsEditor.tsx
client/src/components/admin/tabs/JobRunHistory.tsx
client/src/components/admin/tabs/JobScheduleEditor.tsx
client/src/components/admin/tabs/JobsTab.tsx
client/src/components/admin/tabs/MLTrainingTab.tsx
client/src/components/admin/tabs/PgAdminTab.tsx
client/src/components/admin/tabs/UsersTab.tsx
client/src/components/admin/tabs/WigleDetailTab.tsx
client/src/components/admin/tabs/WigleSearchTab.tsx
client/src/components/admin/tabs/WigleStatsTab.tsx
client/src/components/admin/tabs/config/AWSConfig.tsx
client/src/components/admin/tabs/config/GeocodingConfig.tsx
client/src/components/admin/tabs/config/GoogleMapsConfig.tsx
client/src/components/admin/tabs/config/HomeLocationConfig.tsx
client/src/components/admin/tabs/config/MapboxConfig.tsx
client/src/components/admin/tabs/config/SavedValueInput.tsx
client/src/components/admin/tabs/config/SmartyConfig.tsx
client/src/components/admin/tabs/config/WigleConfig.tsx
client/src/components/admin/tabs/data-import/BackupCheckbox.tsx
client/src/components/admin/tabs/data-import/FileImportButton.tsx
client/src/components/admin/tabs/data-import/ImportHistory.tsx
client/src/components/admin/tabs/data-import/ImportStatusMessage.tsx
client/src/components/admin/tabs/data-import/KmlImportCard.tsx
client/src/components/admin/tabs/data-import/LastImportAudit.tsx
client/src/components/admin/tabs/data-import/ObservationsPanel.tsx
client/src/components/admin/tabs/data-import/OrphanNetworksPanel.tsx
client/src/components/admin/tabs/data-import/SQLiteImportCard.tsx
client/src/components/admin/tabs/data-import/SqlImportCard.tsx
client/src/components/admin/tabs/data-import/UploadIcon.tsx
client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx
client/src/components/admin/tabs/data-import/__tests__/OrphanNetworksPanel.test.tsx
client/src/components/admin/tabs/data-import/importHistoryStatusMeta.ts
client/src/components/admin/tabs/data-import/types.ts
client/src/components/admin/tabs/geocoding/GeocodingDaemonCard.tsx
client/src/components/admin/tabs/geocoding/GeocodingIcons.tsx
client/src/components/admin/tabs/geocoding/GeocodingRunsCard.tsx
client/src/components/admin/tabs/geocoding/GeocodingStatsCard.tsx
client/src/components/admin/tabs/jobTypes.ts
client/src/components/admin/tabs/jobUtils.ts
client/src/components/admin/tabs/ml/ModelOperationsCard.tsx
client/src/components/admin/tabs/ml/ModelStatusCard.tsx
client/src/components/admin/tabs/ml/TrainingDataCard.tsx
client/src/components/admin/tabs/wigleCoverageStatusMeta.ts
client/src/components/admin/types/admin.types.ts
client/src/components/analytics/AnalyticsPage.tsx
client/src/components/analytics/components/AnalyticsCharts.tsx
client/src/components/analytics/components/AnalyticsFilters.tsx
client/src/components/analytics/components/AnalyticsLayout.tsx
client/src/components/analytics/hooks/useAnalyticsData.ts
client/src/components/analytics/hooks/useAnalyticsFilters.ts
client/src/components/analytics/hooks/useCardLayout.ts
client/src/components/analytics/utils/chartColors.ts
client/src/components/analytics/utils/chartConfig.tsx
client/src/components/analytics/utils/chartConstants.tsx
client/src/components/analytics/utils/chartHelpers.ts
client/src/components/analytics/utils/dataTransformers.ts
client/src/components/auth/ChangePasswordForm.tsx
client/src/components/auth/LoginForm.tsx
client/src/components/badges/SecurityBadge.tsx
client/src/components/badges/ThreatBadge.tsx
client/src/components/badges/TypeBadge.tsx
client/src/components/badges/index.ts
client/src/components/contextMenu/NetworkContextMenuMenu.tsx
client/src/components/contextMenu/NetworkContextMenuTable.tsx
client/src/components/contextMenu/NetworkContextNoteModal.tsx
client/src/components/contextMenu/NetworkContextNotes.tsx
client/src/components/contextMenu/icons.tsx
client/src/components/contextMenu/types.ts
client/src/components/dashboard/MetricCard.tsx
client/src/components/dashboard/cardDefinitions.ts
client/src/components/dashboard/icons/index.tsx
client/src/components/filter/FilterInput.tsx
client/src/components/filter/FilterSection.tsx
client/src/components/filter/index.ts
client/src/components/filters/FilterPanelHeader.tsx
client/src/components/filters/sections/ActivityFilters.tsx
client/src/components/filters/sections/EngagementFilters.tsx
client/src/components/filters/sections/GeocodingFilters.tsx
client/src/components/filters/sections/IdentityFilters.tsx
client/src/components/filters/sections/QualityFilters.tsx
client/src/components/filters/sections/RadioFilters.tsx
client/src/components/filters/sections/SecurityFilters.tsx
client/src/components/filters/sections/SpatialFilters.tsx
client/src/components/filters/sections/ThreatFilters.tsx
client/src/components/filters/sections/TimeFilters.tsx
client/src/components/filters/sections/index.ts
client/src/components/geospatial/GeospatialContent.tsx
client/src/components/geospatial/GeospatialLayout.tsx
client/src/components/geospatial/GeospatialMapContent.tsx
client/src/components/geospatial/GeospatialShell.tsx
client/src/components/geospatial/GeospatialTableContent.tsx
client/src/components/geospatial/MapHeader.tsx
client/src/components/geospatial/MapPanel.tsx
client/src/components/geospatial/MapSection.tsx
client/src/components/geospatial/MapStatusBar.tsx
client/src/components/geospatial/MapViewport.tsx
client/src/components/geospatial/ResizeHandle.tsx
client/src/components/geospatial/contextMenuUtils.ts
client/src/components/geospatial/hooks/useApplyMapLayerDefaults.ts
client/src/components/geospatial/hooks/useBoundingBoxFilter.ts
client/src/components/geospatial/hooks/useColumnSelectorPosition.ts
client/src/components/geospatial/hooks/useColumnVisibility.ts
client/src/components/geospatial/hooks/useCoreObservationLayers.ts
client/src/components/geospatial/hooks/useDebouncedFilterState.ts
client/src/components/geospatial/hooks/useExplorerPanels.ts
client/src/components/geospatial/hooks/useGeospatialExplorerState.ts
client/src/components/geospatial/hooks/useGeospatialMap.ts
client/src/components/geospatial/hooks/useHomeLocation.ts
client/src/components/geospatial/hooks/useHomeLocationLayer.ts
client/src/components/geospatial/hooks/useLocationSearch.ts
client/src/components/geospatial/hooks/useMapDimensions.ts
client/src/components/geospatial/hooks/useMapInitialization.ts
client/src/components/geospatial/hooks/useMapInteractionLock.ts
client/src/components/geospatial/hooks/useMapLayers.ts
client/src/components/geospatial/hooks/useMapLayersToggle.ts
client/src/components/geospatial/hooks/useMapPopups.ts
client/src/components/geospatial/hooks/useMapPreferences.ts
client/src/components/geospatial/hooks/useMapResizeHandle.ts
client/src/components/geospatial/hooks/useMapStyleControls.ts
client/src/components/geospatial/hooks/useNearestAgencies.ts
client/src/components/geospatial/hooks/useNetworkContextMenu.ts
client/src/components/geospatial/hooks/useNetworkInfiniteScroll.ts
client/src/components/geospatial/hooks/useNetworkNotes.ts
client/src/components/geospatial/hooks/useNetworkSelection.ts
client/src/components/geospatial/hooks/useNetworkSort.ts
client/src/components/geospatial/hooks/useObservationLayers.ts
client/src/components/geospatial/hooks/useObservationSummary.ts
client/src/components/geospatial/hooks/useResetPaginationOnFilters.ts
client/src/components/geospatial/hooks/useSiblingLinks.ts
client/src/components/geospatial/hooks/useSummaryLayers.ts
client/src/components/geospatial/hooks/useTimeFrequencyModal.ts
client/src/components/geospatial/hooks/useWigleLayers.ts
client/src/components/geospatial/markers/CentroidMarker.tsx
client/src/components/geospatial/markers/GeospatialMarkerLegend.tsx
client/src/components/geospatial/markers/WeightedMarker.tsx
client/src/components/geospatial/markers/index.ts
client/src/components/geospatial/markers/markerComponents.ts
client/src/components/geospatial/markers/types.ts
client/src/components/geospatial/modals/NetworkNoteModal.tsx
client/src/components/geospatial/modals/WigleLookupDialog.tsx
client/src/components/geospatial/networkTable/cellRenderers.tsx
client/src/components/geospatial/networkTagMenu/NetworkTagMenu.tsx
client/src/components/geospatial/networkTagMenu/NetworkTagMenuActionButton.tsx
client/src/components/geospatial/networkTagMenu/NetworkTagMenuAdminActions.tsx
client/src/components/geospatial/networkTagMenu/NetworkTagMenuHeader.tsx
client/src/components/geospatial/networkTagMenu/NetworkTagMenuLoading.tsx
client/src/components/geospatial/networkTagMenu/NetworkTagMenuStatus.tsx
client/src/components/geospatial/networkTagMenu/NetworkTagMenuViewActions.tsx
client/src/components/geospatial/networkTagMenu/types.ts
client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx
client/src/components/geospatial/overlays/GeospatialOverlays.tsx
client/src/components/geospatial/panels/FiltersSidebar.tsx
client/src/components/geospatial/panels/GeospatialFiltersPanel.tsx
client/src/components/geospatial/panels/NearestAgenciesPanel.tsx
client/src/components/geospatial/panels/NetworkExplorerCard.tsx
client/src/components/geospatial/panels/NetworkExplorerHeader.tsx
client/src/components/geospatial/panels/NetworkExplorerSection.tsx
client/src/components/geospatial/panels/WigleObservationsPanel.tsx
client/src/components/geospatial/table/ColumnItem.tsx
client/src/components/geospatial/table/ColumnSelector.tsx
client/src/components/geospatial/table/NetworkTableBodyGrid.tsx
client/src/components/geospatial/table/NetworkTableHeaderGrid.tsx
client/src/components/geospatial/table/NetworkTableRow.tsx
client/src/components/geospatial/table/networkTableGridConfig.ts
client/src/components/geospatial/toolbar/MapToolbar.tsx
client/src/components/geospatial/toolbar/MapToolbarActions.tsx
client/src/components/geospatial/toolbar/MapToolbarControls.tsx
client/src/components/geospatial/toolbar/MapToolbarDropdowns.tsx
client/src/components/geospatial/toolbar/MapToolbarIcons.tsx
client/src/components/geospatial/toolbar/MapToolbarNav.tsx
client/src/components/geospatial/toolbar/MapToolbarSearch.tsx
client/src/components/hooks/useAgencyOffices.ts
client/src/components/hooks/useFederalCourthouses.ts
client/src/components/kepler/KeplerControls.tsx
client/src/components/kepler/KeplerFilters.tsx
client/src/components/kepler/KeplerVisualization.tsx
client/src/components/kepler/index.ts
client/src/components/kepler/types.ts
client/src/components/kepler/utils.ts
client/src/components/modals/NetworkTimeFrequencyModal.tsx
client/src/components/ui/LayerToggle.tsx
client/src/components/wigle/clusterColors.ts
client/src/components/wigle/eventHandlers.ts
client/src/components/wigle/index.ts
client/src/components/wigle/kmlLayers.ts
client/src/components/wigle/layerManagement.ts
client/src/components/wigle/mapHandlers.ts
client/src/components/wigle/mapLayers.ts
client/src/components/wigle/useWigleData.ts
client/src/components/wigle/useWigleKmlData.ts
client/src/components/wigle/useWigleLayers.ts
client/src/components/wigle/useWigleMapInit.ts
client/src/components/wigle/useWigleMapPreferences.ts
client/src/constants/colors.ts
client/src/constants/network.ts
client/src/data/federal-courthouses.json
client/src/directions/__tests__/directionsClient.test.ts
client/src/directions/directionsClient.ts
client/src/directions/directionsLayer.ts
client/src/directions/useDirectionsMode.ts
client/src/hooks/useAdaptedFilters.ts
client/src/hooks/useAgencyLayer.ts
client/src/hooks/useAsyncData.ts
client/src/hooks/useAuth.tsx
client/src/hooks/useAwsInstanceAction.ts
client/src/hooks/useChangePassword.ts
client/src/hooks/useDashboard.ts
client/src/hooks/useFilterURLSync.ts
client/src/hooks/useFilteredData.ts
client/src/hooks/useKepler.ts
client/src/hooks/useKeplerDeck.ts
client/src/hooks/useLogin.ts
client/src/hooks/useNetworkData.ts
client/src/hooks/useNetworkNotes.ts
client/src/hooks/useNetworkObservations.ts
client/src/hooks/useObservations.ts
client/src/hooks/usePageFilters.ts
client/src/hooks/useWigleFileUpload.ts
client/src/index.css
client/src/logging/clientLogger.ts
client/src/main.tsx
client/src/stores/filterStore.ts
client/src/types/filters.ts
client/src/types/network.ts
client/src/utils/Tooltip.tsx
client/src/utils/__tests__/filterUrlState.test.ts
client/src/utils/__tests__/filteredPagination.test.ts
client/src/utils/__tests__/filteredRequestParams.test.ts
client/src/utils/__tests__/keplerDataTransformation.test.ts
client/src/utils/__tests__/networkDataTransformation.test.ts
client/src/utils/__tests__/networkFilterParams.test.ts
client/src/utils/__tests__/networkFormatting.test.ts
client/src/utils/__tests__/observationDataTransformation.test.ts
client/src/utils/__tests__/tooltipDataNormalizer.test.ts
client/src/utils/filterCapabilities.ts
client/src/utils/filterUrlState.ts
client/src/utils/filteredPagination.ts
client/src/utils/filteredRequestParams.ts
client/src/utils/formatDate.ts
client/src/utils/geospatial/fieldFormatting.ts
client/src/utils/geospatial/mapViewUtils.ts
client/src/utils/geospatial/observationTooltipProps.ts
client/src/utils/geospatial/popupAnchor.ts
client/src/utils/geospatial/popupStateManager.ts
client/src/utils/geospatial/renderMapPopupCards.ts
client/src/utils/geospatial/renderNetworkTooltip.ts
client/src/utils/geospatial/setupPopupDrag.ts
client/src/utils/geospatial/setupPopupPin.ts
client/src/utils/geospatial/setupPopupTether.ts
client/src/utils/geospatial/tooltipDataNormalizer.ts
client/src/utils/icons/radioTypeIcons.ts
client/src/utils/keplerDataTransformation.ts
client/src/utils/macUtils.ts
client/src/utils/mapHelpers.ts
client/src/utils/mapOrientationControls.ts
client/src/utils/mapboxLoader.ts
client/src/utils/networkDataTransformation.ts
client/src/utils/networkFilterParams.ts
client/src/utils/networkFormatting.ts
client/src/utils/observationDataTransformation.ts
client/src/utils/wigle/colors.ts
client/src/utils/wigle/constants.ts
client/src/utils/wigle/geojson.ts
client/src/utils/wigle/index.ts
client/src/utils/wigle/security.ts
client/src/utils/wigle/wigleTooltipNormalizer.ts
client/src/utils/wigle/wigleTooltipRenderer.ts
client/src/vite-env.d.ts
```

### server/src File List

```text
server/src/api/routes/v1/admin-threat-scoring.ts
server/src/api/routes/v1/admin.ts
server/src/api/routes/v1/admin/adminAwsHelpers.ts
server/src/api/routes/v1/admin/adminGeocodingHelpers.ts
server/src/api/routes/v1/admin/adminHelpers.ts
server/src/api/routes/v1/admin/adminNotesHelpers.ts
server/src/api/routes/v1/admin/adminSecretsHelpers.ts
server/src/api/routes/v1/admin/aws.ts
server/src/api/routes/v1/admin/awsInstances.ts
server/src/api/routes/v1/admin/backup.ts
server/src/api/routes/v1/admin/dbStats.ts
server/src/api/routes/v1/admin/geocoding.ts
server/src/api/routes/v1/admin/import.ts
server/src/api/routes/v1/admin/importHelpers.ts
server/src/api/routes/v1/admin/kmlImportUtils.ts
server/src/api/routes/v1/admin/maintenance.ts
server/src/api/routes/v1/admin/media.ts
server/src/api/routes/v1/admin/notes.ts
server/src/api/routes/v1/admin/oui.ts
server/src/api/routes/v1/admin/pgadmin.ts
server/src/api/routes/v1/admin/secrets.ts
server/src/api/routes/v1/admin/settings.ts
server/src/api/routes/v1/admin/siblings.ts
server/src/api/routes/v1/admin/tags.ts
server/src/api/routes/v1/admin/users.ts
server/src/api/routes/v1/agencyOffices.ts
server/src/api/routes/v1/analytics-public.ts
server/src/api/routes/v1/analytics.ts
server/src/api/routes/v1/auth.ts
server/src/api/routes/v1/backup.ts
server/src/api/routes/v1/claude.ts
server/src/api/routes/v1/dashboard.ts
server/src/api/routes/v1/dataQuality.ts
server/src/api/routes/v1/explorer.ts
server/src/api/routes/v1/explorer/index.ts
server/src/api/routes/v1/explorer/networks.ts
server/src/api/routes/v1/explorer/shared.ts
server/src/api/routes/v1/export.ts
server/src/api/routes/v1/federalCourthouses.ts
server/src/api/routes/v1/geospatial.ts
server/src/api/routes/v1/health.ts
server/src/api/routes/v1/home-location.ts
server/src/api/routes/v1/kepler.ts
server/src/api/routes/v1/keplerHelpers.ts
server/src/api/routes/v1/location-markers.ts
server/src/api/routes/v1/misc.ts
server/src/api/routes/v1/ml.ts
server/src/api/routes/v1/mobileIngest.ts
server/src/api/routes/v1/network-agencies.ts
server/src/api/routes/v1/network-tags.ts
server/src/api/routes/v1/network-tags/index.ts
server/src/api/routes/v1/network-tags/listTags.ts
server/src/api/routes/v1/network-tags/manageTags.ts
server/src/api/routes/v1/networks.ts
server/src/api/routes/v1/networks/index.ts
server/src/api/routes/v1/networks/list.ts
server/src/api/routes/v1/networks/manufacturer.ts
server/src/api/routes/v1/networks/notes.ts
server/src/api/routes/v1/networks/observations.ts
server/src/api/routes/v1/networks/search.ts
server/src/api/routes/v1/networks/tags.ts
server/src/api/routes/v1/settings.ts
server/src/api/routes/v1/settingsHelpers.ts
server/src/api/routes/v1/settingsMultiSecretRoutes.ts
server/src/api/routes/v1/settingsSecretRoutes.ts
server/src/api/routes/v1/threat-report.ts
server/src/api/routes/v1/threats.ts
server/src/api/routes/v1/wigle/database.ts
server/src/api/routes/v1/wigle/detail.ts
server/src/api/routes/v1/wigle/index.ts
server/src/api/routes/v1/wigle/live.ts
server/src/api/routes/v1/wigle/observations.ts
server/src/api/routes/v1/wigle/search.ts
server/src/api/routes/v1/wigle/stats.ts
server/src/api/routes/v1/wigle/status.ts
server/src/api/routes/v1/wigle/utils.ts
server/src/api/routes/v1/wigle/validation.ts
server/src/api/routes/v2/filtered.ts
server/src/api/routes/v2/filteredHandlers.ts
server/src/api/routes/v2/filteredHelpers.ts
server/src/api/routes/v2/networks.ts
server/src/api/routes/v2/threats.ts
server/src/config/container.ts
server/src/config/database.ts
server/src/config/loadEnv.ts
server/src/config/routeConfig.ts
server/src/core/initialization/appInit.ts
server/src/core/initialization/backgroundJobsInit.ts
server/src/core/initialization/credentialsInit.ts
server/src/core/initialization/dashboardInit.ts
server/src/core/initialization/databaseInit.ts
server/src/core/initialization/errorHandlingInit.ts
server/src/core/initialization/middlewareInit.ts
server/src/core/initialization/routesInit.ts
server/src/db/migrations/create_federal_courthouses.sql
server/src/errors/AppError.ts
server/src/errors/errorHandler.ts
server/src/logging/logger.ts
server/src/logging/middleware.ts
server/src/middleware/authMiddleware.ts
server/src/middleware/cacheMiddleware.ts
server/src/middleware/commonMiddleware.ts
server/src/middleware/httpsRedirect.ts
server/src/middleware/requestId.ts
server/src/middleware/securityHeaders.ts
server/src/middleware/spaFallback.ts
server/src/middleware/staticAssets.ts
server/src/repositories/adminNetworkMediaRepository.ts
server/src/repositories/adminNetworkTagOuiRepository.ts
server/src/repositories/adminNetworkTagRepository.ts
server/src/repositories/agencyRepository.ts
server/src/repositories/baseRepository.ts
server/src/repositories/courthouseRepository.ts
server/src/repositories/jobRunRepository.ts
server/src/repositories/networkRepository.ts
server/src/repositories/threatRepository.ts
server/src/repositories/wiglePersistenceRepository.ts
server/src/repositories/wigleQueriesRepository.ts
server/src/services/admin/adminHelpers.ts
server/src/services/admin/dataQualityAdminService.ts
server/src/services/admin/importExportAdminService.ts
server/src/services/admin/networkNotesAdminService.ts
server/src/services/admin/networkTagCore.ts
server/src/services/admin/networkTagOui.ts
server/src/services/admin/networkTagsAdminService.ts
server/src/services/admin/settingsAdminService.ts
server/src/services/admin/siblingDetectionAdminService.ts
server/src/services/admin/siblingDetectionQueries.ts
server/src/services/admin/siblingDetectionState.ts
server/src/services/adminDbService.ts
server/src/services/adminDbStatsService.ts
server/src/services/adminImportHistoryService.ts
server/src/services/adminMaintenanceService.ts
server/src/services/adminNetworkMediaService.ts
server/src/services/adminNetworkTagsService.ts
server/src/services/adminOrphanNetworksService.ts
server/src/services/adminSettingsService.ts
server/src/services/adminSiblingService.ts
server/src/services/adminUsersService.ts
server/src/services/agencyService.ts
server/src/services/aiInsightsService.ts
server/src/services/analytics/coreAnalytics.ts
server/src/services/analytics/helpers.ts
server/src/services/analytics/index.ts
server/src/services/analytics/networkAnalytics.ts
server/src/services/analytics/threatAnalytics.ts
server/src/services/analyticsService.ts
server/src/services/authQueries.ts
server/src/services/authService.ts
server/src/services/authWrites.ts
server/src/services/awsService.ts
server/src/services/backgroundJobs/config.ts
server/src/services/backgroundJobs/mlBehavioralScoring.ts
server/src/services/backgroundJobs/mvRefresh.ts
server/src/services/backgroundJobs/runners.ts
server/src/services/backgroundJobs/settings.ts
server/src/services/backgroundJobsService.ts
server/src/services/backup/awsCli.ts
server/src/services/backup/backupUtils.ts
server/src/services/backupService.ts
server/src/services/bedrockService.ts
server/src/services/cacheService.ts
server/src/services/courthouseService.ts
server/src/services/dashboardService.ts
server/src/services/dataQualityFilters.ts
server/src/services/explorerQueries.ts
server/src/services/explorerService.ts
server/src/services/explorerSorting.ts
server/src/services/exportService.ts
server/src/services/externalServiceHandler.ts
server/src/services/featureFlagService.ts
server/src/services/filterQueryBuilder/FilterBuildContext.ts
server/src/services/filterQueryBuilder/FilterPredicateBuilder.ts
server/src/services/filterQueryBuilder/NetworkWhereBuildContext.ts
server/src/services/filterQueryBuilder/QueryState.ts
server/src/services/filterQueryBuilder/SchemaCompat.ts
server/src/services/filterQueryBuilder/SqlFragmentLibrary.ts
server/src/services/filterQueryBuilder/builders/GeospatialQueryBuilder.ts
server/src/services/filterQueryBuilder/builders/NetworkListQueryBuilder.ts
server/src/services/filterQueryBuilder/builders/NetworkOnlyQueryBuilder.ts
server/src/services/filterQueryBuilder/constants.ts
server/src/services/filterQueryBuilder/engagementPredicates.ts
server/src/services/filterQueryBuilder/index.ts
server/src/services/filterQueryBuilder/modules/AnalyticsModule.ts
server/src/services/filterQueryBuilder/modules/GeospatialModule.ts
server/src/services/filterQueryBuilder/modules/NetworkModule.ts
server/src/services/filterQueryBuilder/modules/ObservationModule.ts
server/src/services/filterQueryBuilder/modules/analyticsQueryBuilders.ts
server/src/services/filterQueryBuilder/modules/analyticsQueryContext.ts
server/src/services/filterQueryBuilder/modules/geospatialQueryBuilders.ts
server/src/services/filterQueryBuilder/modules/geospatialQueryContext.ts
server/src/services/filterQueryBuilder/modules/networkFastPathBuilder.ts
server/src/services/filterQueryBuilder/modules/networkFastPathCountBuilder.ts
server/src/services/filterQueryBuilder/modules/networkFastPathIdentityPredicates.ts
server/src/services/filterQueryBuilder/modules/networkFastPathListBuilder.ts
server/src/services/filterQueryBuilder/modules/networkFastPathPredicateTypes.ts
server/src/services/filterQueryBuilder/modules/networkFastPathPredicates.ts
server/src/services/filterQueryBuilder/modules/networkFastPathSecurityPredicates.ts
server/src/services/filterQueryBuilder/modules/networkFastPathSupplementalPredicates.ts
server/src/services/filterQueryBuilder/modules/networkMetricsBuilder.ts
server/src/services/filterQueryBuilder/modules/networkNoFilterBuilder.ts
server/src/services/filterQueryBuilder/modules/networkPredicateAdapters.ts
server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts
server/src/services/filterQueryBuilder/modules/observationFilterBuilder.ts
server/src/services/filterQueryBuilder/modules/observationIdentityPredicates.ts
server/src/services/filterQueryBuilder/modules/observationSecurityTemporalPredicates.ts
server/src/services/filterQueryBuilder/modules/observationSpatialQualityPredicates.ts
server/src/services/filterQueryBuilder/networkWhereBuilder.ts
server/src/services/filterQueryBuilder/normalizers.ts
server/src/services/filterQueryBuilder/radioPredicates.ts
server/src/services/filterQueryBuilder/spatialHelpers.ts
server/src/services/filterQueryBuilder/sqlExpressions.ts
server/src/services/filterQueryBuilder/threatCategoryLevels.ts
server/src/services/filterQueryBuilder/types.ts
server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts
server/src/services/filterQueryBuilder/validators.ts
server/src/services/filteredAnalyticsService.ts
server/src/services/geocoding/cacheStore.ts
server/src/services/geocoding/daemonRuntime.ts
server/src/services/geocoding/daemonState.ts
server/src/services/geocoding/jobState.ts
server/src/services/geocoding/mapbox.ts
server/src/services/geocoding/providerRuntime.ts
server/src/services/geocoding/providers.ts
server/src/services/geocoding/types.ts
server/src/services/geocodingCacheService.ts
server/src/services/homeLocationService.ts
server/src/services/keplerService.ts
server/src/services/miscService.ts
server/src/services/ml/modelScoring.ts
server/src/services/ml/repository.ts
server/src/services/ml/scoringService.ts
server/src/services/ml/trainer.ts
server/src/services/mlTrainingLock.ts
server/src/services/mobileIngestService.ts
server/src/services/networkListService.ts
server/src/services/networkService.ts
server/src/services/networkTagService.ts
server/src/services/networking/filterBuilders.ts
server/src/services/networking/filterBuilders/locationFilters.ts
server/src/services/networking/filterBuilders/securityRadioFilters.ts
server/src/services/networking/filterBuilders/textRangeFilters.ts
server/src/services/networking/homeLocation.ts
server/src/services/networking/queryParts.ts
server/src/services/networking/querySchema.ts
server/src/services/networking/queryState.ts
server/src/services/networking/repository.ts
server/src/services/networking/sorting.ts
server/src/services/networking/sql.ts
server/src/services/networking/types.ts
server/src/services/observationService.ts
server/src/services/ouiGroupingService.ts
server/src/services/pgadmin/control.ts
server/src/services/pgadmin/runtime.ts
server/src/services/pgadminService.ts
server/src/services/reports/threatReportRenderers.ts
server/src/services/reports/threatReportUtils.ts
server/src/services/secretsManager.ts
server/src/services/threatReportService.ts
server/src/services/threatScoring.types.ts
server/src/services/threatScoringService.ts
server/src/services/v2Queries.ts
server/src/services/v2Service.ts
server/src/services/wigleAuditLogger.ts
server/src/services/wigleBulkPolicy.ts
server/src/services/wigleClient.ts
server/src/services/wigleEnrichmentService.ts
server/src/services/wigleImport/pageProcessor.ts
server/src/services/wigleImport/params.ts
server/src/services/wigleImport/runRepository.ts
server/src/services/wigleImport/serialization.ts
server/src/services/wigleImportRunService.ts
server/src/services/wigleImportService.ts
server/src/services/wigleRequestLedger.ts
server/src/services/wigleRequestUtils.ts
server/src/services/wigleSearchApiService.ts
server/src/services/wigleSearchCache.ts
server/src/services/wigleService.ts
server/src/types/express.d.ts
server/src/types/ml-logistic-regression.d.ts
server/src/utils/asyncHandler.ts
server/src/utils/databaseSetup.ts
server/src/utils/envFlag.ts
server/src/utils/envSanitizer.ts
server/src/utils/escapeSQL.ts
server/src/utils/frequencyUtils.ts
server/src/utils/networkSqlExpressions.ts
server/src/utils/queryPerformanceTracker.ts
server/src/utils/routeMounts.ts
server/src/utils/safeJsonParse.ts
server/src/utils/securityLabelValidator.ts
server/src/utils/serverConfig.ts
server/src/utils/serverDependencies.ts
server/src/utils/serverLifecycle.ts
server/src/utils/serverStartup.ts
server/src/utils/shutdownHandlers.ts
server/src/utils/staticSetup.ts
server/src/utils/validateSecrets.ts
server/src/utils/validators.ts
server/src/validation/middleware.ts
server/src/validation/parameterParsers.ts
server/src/validation/schemas.ts
server/src/validation/schemas/commonSchemas.ts
server/src/validation/schemas/complexValidators.ts
server/src/validation/schemas/geospatialSchemas.ts
server/src/validation/schemas/networkSchemas.ts
server/src/validation/schemas/temporalSchemas.ts
server/src/websocket/ssmTerminal.ts
```

### tests File List

```text
tests/api/dashboard.test.ts
tests/api/mobileIngest.test.ts
tests/certification/radioPhysicalCertification.test.ts
tests/fixtures/factories.ts
tests/fixtures/invalid-sample.db
tests/fixtures/valid-sample.db
tests/helpers/integrationEnv.ts
tests/integration/README.md
tests/integration/api/v1/admin.test.ts
tests/integration/api/v1/adminManagement.test.ts
tests/integration/api/v1/agencyOffices.test.ts
tests/integration/api/v1/analytics.test.ts
tests/integration/api/v1/analyticsPublic.test.ts
tests/integration/api/v1/auth.test.ts
tests/integration/api/v1/dashboard.test.ts
tests/integration/api/v1/dataQuality.test.ts
tests/integration/api/v1/explorer.test.ts
tests/integration/api/v1/export.test.ts
tests/integration/api/v1/geospatial.test.ts
tests/integration/api/v1/health.test.ts
tests/integration/api/v1/ml.test.ts
tests/integration/api/v1/networks.test.ts
tests/integration/api/v1/observations.test.ts
tests/integration/api/v1/threats.test.ts
tests/integration/api/v1/wigleDetail.test.ts
tests/integration/api/v1/wigleSearch.test.ts
tests/integration/api/v1/wigleStatus.test.ts
tests/integration/dashboard-threat-parity.test.ts
tests/integration/etl/pipeline-integrity.test.ts
tests/integration/etl/test.env
tests/integration/explorer-v2.test.ts
tests/integration/filterAuditMatrix.test.ts
tests/integration/like-escaping.test.ts
tests/integration/ml/mlScoring.test.ts
tests/integration/networks-data-integrity.test.ts
tests/integration/observability.test.ts
tests/integration/route-refactoring-verification.test.ts
tests/integration/sql-injection-fixes.test.ts
tests/integration/universal-filter-count-parity.test.ts
tests/performance/filterAudit.perf.test.ts
tests/property/filterQueryBuilder/FilterBuildContext.test.ts
tests/property/filterQueryBuilder/GeospatialModule.test.ts
tests/property/filterQueryBuilder/universalFilterQueryBuilder.test.ts
tests/property/networking/repository.test.ts
tests/setup.ts
tests/sql-injection-fixes.test.ts
tests/unit/GeospatialModule.test.ts
tests/unit/QueryState.test.ts
tests/unit/SchemaCompat.test.ts
tests/unit/admin/networkTagCore.test.ts
tests/unit/admin/networkTagOui.test.ts
tests/unit/adminGeocodingHelpers.test.ts
tests/unit/adminImport.test.ts
tests/unit/adminNotesHelpers.test.ts
tests/unit/adminOrphanNetworksRoute.test.ts
tests/unit/adminSQLiteImportRoute.test.ts
tests/unit/adminSettings.test.ts
tests/unit/analyticsQueryBuilders.test.ts
tests/unit/authQueries.test.ts
tests/unit/authService.test.ts
tests/unit/authWrites.test.ts
tests/unit/backgroundJobMlBehavioralScoring.test.ts
tests/unit/backgroundJobSettings.test.ts
tests/unit/backup.test.ts
tests/unit/backupSecretsToBitwarden.test.ts
tests/unit/backupUtils.test.ts
tests/unit/builders/GeospatialQueryBuilder.test.ts
tests/unit/builders/NetworkListQueryBuilder.test.ts
tests/unit/builders/NetworkOnlyQueryBuilder.test.ts
tests/unit/calculateThreatScoreV5Sql.test.ts
tests/unit/claude.test.ts
tests/unit/contextMenuUtils.test.ts
tests/unit/coverage_expansion_v2.test.ts
tests/unit/engagementPredicates.test.ts
tests/unit/errors/AppError.test.ts
tests/unit/errors/errorHandler.test.ts
tests/unit/escapeSQL.test.ts
tests/unit/explorerNetworksRoute.test.ts
tests/unit/explorerQueries.test.ts
tests/unit/explorerService.test.ts
tests/unit/explorerSorting.test.ts
tests/unit/exportService.test.ts
tests/unit/filterAlignmentAudit.test.ts
tests/unit/filterQueryBuilder.newFilters.test.ts
tests/unit/filterQueryBuilder.predicates.test.ts
tests/unit/filterQueryBuilder.test.ts
tests/unit/filterQueryBuilder.userRequests.test.ts
tests/unit/filterQueryBuilder_coverage_expansion.test.ts
tests/unit/filterQueryBuilder_index.test.ts
tests/unit/filteredAnalyticsRoutes.test.ts
tests/unit/filteredHandlers.test.ts
tests/unit/filteredHelpers.test.ts
tests/unit/filters-systematic-v2.test.ts
tests/unit/filters-systematic.test.ts
tests/unit/geocodingCacheService.test.ts
tests/unit/geocodingCacheStore.test.ts
tests/unit/geocodingCacheStore_expanded.test.ts
tests/unit/geocodingDaemon.test.ts
tests/unit/geocodingDaemonState.test.ts
tests/unit/geocodingMapbox.test.ts
tests/unit/geocodingProviders.test.ts
tests/unit/geospatialQueryBuilders.test.ts
tests/unit/health.test.ts
tests/unit/homeLocation.test.ts
tests/unit/homeLocationService.test.ts
tests/unit/importHistoryStatusMeta.test.ts
tests/unit/isLinearTravelPair.test.ts
tests/unit/keplerHelpers.test.ts
tests/unit/kmlImportUtils.test.ts
tests/unit/manageTags.test.ts
tests/unit/middleware/authMiddleware.test.ts
tests/unit/middleware/cacheMiddleware.test.ts
tests/unit/middleware/commonMiddleware.test.ts
tests/unit/middleware/securityHeaders.test.ts
tests/unit/middleware/spaFallback.test.ts
tests/unit/misc.test.ts
tests/unit/mlModelScoring.test.ts
tests/unit/mlRepository.test.ts
tests/unit/mlTrainer.test.ts
tests/unit/mobileIngestService.test.ts
tests/unit/mobileIngestVisibility.test.ts
tests/unit/networkFastPathCountBuilder.test.ts
tests/unit/networkFastPathListBuilder.test.ts
tests/unit/networkFastPathPredicates.test.ts
tests/unit/networkFilterBuilders.coverage.test.ts
tests/unit/networkFilterBuilders.test.ts
tests/unit/networkListService.test.ts
tests/unit/networkMetricsBuilder.test.ts
tests/unit/networkNotesRoutes.test.ts
tests/unit/networkQuerySchema.test.ts
tests/unit/networkQueryState.test.ts
tests/unit/networkSqlExpressions.test.ts
tests/unit/networkTableCellRenderers.test.ts
tests/unit/networkTagService.test.ts
tests/unit/networkWhereBuilder.test.ts
tests/unit/normalizers.test.ts
tests/unit/observationCountMin-investigation.test.ts
tests/unit/observationFilterBuilder.test.ts
tests/unit/observationService.test.ts
tests/unit/observationTooltipProps.test.ts
tests/unit/ouiGroupingService.test.ts
tests/unit/property/sqlBuilder.fuzz.test.ts
tests/unit/radioFilterParity.test.ts
tests/unit/radioPredicates.test.ts
tests/unit/renderMapPopupCards.test.ts
tests/unit/repositories/agencyRepository.test.ts
tests/unit/repositories/baseRepository.test.ts
tests/unit/repositories/courthouseRepository.test.ts
tests/unit/repositories/jobRunRepository.test.ts
tests/unit/repositories/networkRepository.test.ts
tests/unit/requestId.test.ts
tests/unit/routeConfigCaps.test.ts
tests/unit/routeMounts.authz.test.ts
tests/unit/secretsManager.test.ts
tests/unit/securityFilter.test.ts
tests/unit/securityFromCapsExpression.test.ts
tests/unit/securityLabelValidator.test.ts
tests/unit/services/admin/adminHelpers.test.ts
tests/unit/services/admin/dataQualityAdminService.test.ts
tests/unit/services/admin/importExportAdminService.test.ts
tests/unit/services/admin/networkNotesAdminService.test.ts
tests/unit/services/admin/networkTagsAdminService.test.ts
tests/unit/services/admin/settingsAdminService.test.ts
tests/unit/services/adminDbService.test.ts
tests/unit/services/adminDbStatsService.test.ts
tests/unit/services/adminImportHistoryService.test.ts
tests/unit/services/adminMaintenanceService.test.ts
tests/unit/services/adminNetworkMediaService.test.js
tests/unit/services/adminNetworkTagsService.test.ts
tests/unit/services/adminOrphanNetworksService.test.ts
tests/unit/services/adminSettingsService.test.ts
tests/unit/services/adminUsersService.test.ts
tests/unit/services/agencyService.test.ts
tests/unit/services/aiInsightsService.test.js
tests/unit/services/analytics/coreAnalytics.test.ts
tests/unit/services/analytics/helpers.test.ts
tests/unit/services/analytics/index.test.ts
tests/unit/services/analytics/networkAnalytics.test.ts
tests/unit/services/analytics/threatAnalytics.test.ts
tests/unit/services/analyticsService.test.ts
tests/unit/services/authQueries.test.ts
tests/unit/services/authService.test.ts
tests/unit/services/authWrites.test.ts
tests/unit/services/awsService.test.js
tests/unit/services/awsService.test.ts
tests/unit/services/backgroundJobs/backgroundJobsService.test.ts
tests/unit/services/backgroundJobs/mlBehavioralScoring.test.ts
tests/unit/services/backgroundJobs/mvRefresh.test.ts
tests/unit/services/backgroundJobs/runners.test.ts
tests/unit/services/backgroundJobs/settings.test.ts
tests/unit/services/backup/awsCli.test.ts
tests/unit/services/backup/backupUtils.test.ts
tests/unit/services/backupService.test.ts
tests/unit/services/bcrypt.d.ts
tests/unit/services/cacheService.test.ts
tests/unit/services/courthouseService.test.ts
tests/unit/services/dashboardService.test.ts
tests/unit/services/dataQualityFilters.test.ts
tests/unit/services/externalServiceHandler.test.ts
tests/unit/services/featureFlagService.test.ts
tests/unit/services/filterQueryBuilder/FilterPredicateBuilder.test.ts
tests/unit/services/filterQueryBuilder/SchemaCompat.test.ts
tests/unit/services/filterQueryBuilder/normalizers.test.ts
tests/unit/services/filterQueryBuilder/radioPredicates.test.ts
tests/unit/services/filterQueryBuilder/sqlExpressions.test.ts
tests/unit/services/filterQueryBuilder/validators.test.ts
tests/unit/services/geocoding/cacheStore.test.ts
tests/unit/services/geocoding/jobState.test.ts
tests/unit/services/geocoding/providerRuntime.test.ts
tests/unit/services/keplerService.test.ts
tests/unit/services/miscService.test.ts
tests/unit/services/mlScoringService.test.ts
tests/unit/services/mlTrainingLock.test.ts
tests/unit/services/networkService.test.ts
tests/unit/services/networking/homeLocation.test.ts
tests/unit/services/networking/queryParts.test.ts
tests/unit/services/networking/repository.test.ts
tests/unit/services/networking/sorting.test.ts
tests/unit/services/networking/sql.test.ts
tests/unit/services/pgadmin/control.test.ts
tests/unit/services/pgadmin/runtime.test.ts
tests/unit/services/pgadminService.test.ts
tests/unit/services/v2Queries.test.ts
tests/unit/services/v2Service.test.ts
tests/unit/services/wigleAuditLogger.test.ts
tests/unit/services/wigleClient.test.ts
tests/unit/services/wigleEnrichmentService.test.ts
tests/unit/services/wigleImport/pageProcessor.test.ts
tests/unit/services/wigleImport/params.test.ts
tests/unit/services/wigleImport/runRepository.test.ts
tests/unit/services/wigleImport/serialization.test.ts
tests/unit/services/wigleImportService.extended.test.ts
tests/unit/services/wigleImportService.test.ts
tests/unit/services/wigleRequestLedger.test.ts
tests/unit/services/wigleRequestUtils.test.ts
tests/unit/services/wigleSearchCache.test.ts
tests/unit/services/wigleService.test.ts
tests/unit/settings.test.ts
tests/unit/settingsMultiSecretRoutes.test.ts
tests/unit/siblingDetectionAdminService.test.ts
tests/unit/sqlFragmentLibrary.test.ts
tests/unit/threatCategoryFilter.test.ts
tests/unit/threatCategoryLevels.test.ts
tests/unit/threatLevelExpression.test.ts
tests/unit/threatReportRenderers.test.ts
tests/unit/threatReportService.test.ts
tests/unit/threatReportUtils.test.ts
tests/unit/threatRepository.test.ts
tests/unit/threatScoringService.test.ts
tests/unit/tooltipDataNormalizer.test.ts
tests/unit/universalFilterQueryBuilder.audit.test.ts
tests/unit/useColumnVisibility.test.ts
tests/unit/utils/appInit.test.ts
tests/unit/utils/backgroundJobsInit.test.ts
tests/unit/utils/credentialsInit.test.ts
tests/unit/utils/dashboardInit.test.ts
tests/unit/utils/databaseInit.test.ts
tests/unit/utils/databaseSetup.test.ts
tests/unit/utils/envFlag.test.ts
tests/unit/utils/envSanitizer.test.ts
tests/unit/utils/errorHandlingInit.test.ts
tests/unit/utils/escapeSQL.test.ts
tests/unit/utils/frequencyUtils.test.ts
tests/unit/utils/middlewareInit.test.ts
tests/unit/utils/queryPerformanceTracker.test.ts
tests/unit/utils/routeMounts.test.ts
tests/unit/utils/routesInit.test.ts
tests/unit/utils/safeJsonParse.test.ts
tests/unit/utils/serverConfig.test.ts
tests/unit/utils/serverDependencies.test.ts
tests/unit/utils/serverLifecycle.test.ts
tests/unit/utils/serverStartup.test.ts
tests/unit/utils/shutdownHandlers.test.ts
tests/unit/utils/staticSetup.test.ts
tests/unit/utils/validateSecrets.test.ts
tests/unit/utils/validators.test.ts
tests/unit/validation/commonSchemas.test.ts
tests/unit/validation/complexValidators.test.ts
tests/unit/validation/geospatialSchemas.test.ts
tests/unit/validation/middleware.test.ts
tests/unit/validation/networkSchemas.test.ts
tests/unit/validation/parameterParsers.test.ts
tests/unit/validation/schemas.test.ts
tests/unit/validation/temporalSchemas.test.ts
tests/unit/websocket/ssmTerminal.test.ts
tests/unit/wigleCoverageStatusMeta.test.ts
tests/unit/wigleDatabase.test.ts
tests/unit/wigleImportCompleteness.test.ts
tests/unit/wigleImportParams.test.ts
tests/unit/wigleImportRunRepository.test.ts
tests/unit/wigleImportRunService.extended.test.ts
tests/unit/wigleImportRunService.test.ts
tests/unit/wigleImportSerialization.test.ts
tests/unit/wiglePersistenceRepository.test.ts
tests/unit/wigleQueries.test.ts
tests/unit/wigleService.test.ts
tests/unit/wigleUtils.test.ts
tests/unit/wigleValidation.test.ts
tests/wigle-import-auth.test.ts
```

## Phase 1 — Dead Code

### Exported Functions / Classes Never Imported Anywhere

| File                                                               | Line | Detail                                                                                  |
| ------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------------- |
| client/src/components/FilterButton.tsx                             | 8    | Exported function-variable `FilterButton` has no detected consumer import.              |
| client/src/components/HamburgerButton.tsx                          | 8    | Exported function-variable `HamburgerButton` has no detected consumer import.           |
| client/src/components/NetworkContextMenu.tsx                       | 11   | Exported function `NetworkContextMenu` has no detected consumer import.                 |
| client/src/components/admin/tabs/ConfigurationTab.tsx              | 165  | Exported function-variable `ConfigurationTab` has no detected consumer import.          |
| client/src/components/admin/tabs/MLTrainingTab.tsx                 | 7    | Exported function-variable `MLTrainingTab` has no detected consumer import.             |
| client/src/components/analytics/components/AnalyticsFilters.tsx    | 14   | Exported function-variable `AnalyticsFilters` has no detected consumer import.          |
| client/src/components/analytics/utils/chartConfig.tsx              | 107  | Exported function-variable `getResponsiveContainerKey` has no detected consumer import. |
| client/src/components/analytics/utils/chartHelpers.ts              | 6    | Exported function-variable `calculatePercentage` has no detected consumer import.       |
| client/src/components/analytics/utils/chartHelpers.ts              | 32   | Exported function-variable `formatNumber` has no detected consumer import.              |
| client/src/components/analytics/utils/chartHelpers.ts              | 37   | Exported function-variable `getChartKey` has no detected consumer import.               |
| client/src/components/dashboard/MetricCard.tsx                     | 28   | Exported function-variable `MetricCard` has no detected consumer import.                |
| client/src/components/geospatial/hooks/useNetworkInfiniteScroll.ts | 11   | Exported function-variable `useNetworkInfiniteScroll` has no detected consumer import.  |
| client/src/components/geospatial/toolbar/MapToolbar.tsx            | 59   | Exported function-variable `Separator` has no detected consumer import.                 |
| client/src/hooks/useAdaptedFilters.ts                              | 67   | Exported function `useFilterPayload` has no detected consumer import.                   |
| client/src/hooks/useFilteredData.ts                                | 45   | Exported function `useFilteredData` has no detected consumer import.                    |
| client/src/hooks/useFilteredData.ts                                | 171  | Exported function-variable `useFilteredNetworks` has no detected consumer import.       |
| client/src/hooks/useFilteredData.ts                                | 174  | Exported function-variable `useFilteredGeospatial` has no detected consumer import.     |
| client/src/hooks/useFilteredData.ts                                | 177  | Exported function-variable `useFilteredAnalytics` has no detected consumer import.      |
| client/src/hooks/useNetworkData.ts                                 | 244  | Exported default-assignment `default` has no detected consumer import.                  |
| client/src/hooks/useObservations.ts                                | 174  | Exported default-assignment `default` has no detected consumer import.                  |
| client/src/logging/clientLogger.ts                                 | 41   | Exported function `logInfo` has no detected consumer import.                            |
| client/src/stores/filterStore.ts                                   | 580  | Exported function-variable `useCurrentPageState` has no detected consumer import.       |
| client/src/utils/filterCapabilities.ts                             | 79   | Exported function `createFullCapabilities` has no detected consumer import.             |
| client/src/utils/filterCapabilities.ts                             | 118  | Exported function `createBasicCapabilities` has no detected consumer import.            |
| client/src/utils/formatDate.ts                                     | 100  | Exported function `formatExportDate` has no detected consumer import.                   |
| client/src/utils/geospatial/fieldFormatting.ts                     | 17   | Exported function-variable `formatCoordinates` has no detected consumer import.         |
| client/src/utils/geospatial/fieldFormatting.ts                     | 44   | Exported function-variable `formatHeading` has no detected consumer import.             |
| client/src/utils/geospatial/fieldFormatting.ts                     | 57   | Exported function-variable `formatTimestamp` has no detected consumer import.           |
| client/src/utils/geospatial/setupPopupPin.ts                       | 131  | Exported function `isPopupPinned` has no detected consumer import.                      |
| client/src/utils/geospatial/setupPopupPin.ts                       | 139  | Exported function `cleanupAllPinStates` has no detected consumer import.                |
| client/src/utils/geospatial/setupPopupTether.ts                    | 151  | Exported function `setupPopupTether` has no detected consumer import.                   |
| client/src/utils/geospatial/setupPopupTether.ts                    | 227  | Exported function `updateTetherDuringDrag` has no detected consumer import.             |
| client/src/utils/geospatial/setupPopupTether.ts                    | 248  | Exported function `cleanupPopupTether` has no detected consumer import.                 |
| client/src/utils/macUtils.ts                                       | 10   | Exported function `isRandomizedMAC` has no detected consumer import.                    |
| client/src/utils/macUtils.ts                                       | 28   | Exported function `getMACType` has no detected consumer import.                         |
| client/src/utils/mapOrientationControls.ts                         | 48   | Exported function `attachMapOrientationControls` has no detected consumer import.       |
| client/src/utils/mapOrientationControls.ts                         | 120  | Exported function `useMapOrientationControls` has no detected consumer import.          |
| client/src/utils/mapboxLoader.ts                                   | 28   | Exported function `waitForMapbox` has no detected consumer import.                      |
| client/src/utils/mapboxLoader.ts                                   | 65   | Exported function `loadMapbox` has no detected consumer import.                         |
| client/src/utils/mapboxLoader.ts                                   | 72   | Exported function `isMapboxReady` has no detected consumer import.                      |
| client/src/utils/mapboxLoader.ts                                   | 76   | Exported default-assignment `default` has no detected consumer import.                  |
| server/src/api/routes/v1/keplerHelpers.ts                          | 101  | Exported function `inferRadioType` has no detected consumer import.                     |

### Files Never Imported Or Required

| File                                                               | Line | Detail                                                                  |
| ------------------------------------------------------------------ | ---- | ----------------------------------------------------------------------- |
| client/src/components/FilterButton.tsx                             | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/HamburgerButton.tsx                          | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/NetworkContextMenu.tsx                       | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/analytics/components/AnalyticsFilters.tsx    | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/geospatial/hooks/useNetworkInfiniteScroll.ts | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/geospatial/markers/index.ts                  | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/geospatial/markers/markerComponents.ts       | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/kepler/index.ts                              | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/components/wigle/index.ts                               | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/hooks/useFilteredData.ts                                | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/utils/geospatial/setupPopupTether.ts                    | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/utils/macUtils.ts                                       | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| client/src/utils/mapboxLoader.ts                                   | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| server/src/api/routes/v1/admin-threat-scoring.ts                   | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| server/src/api/routes/v1/admin/adminHelpers.ts                     | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| server/src/api/routes/v1/admin/importHelpers.ts                    | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| server/src/api/routes/v1/admin/kmlImportUtils.ts                   | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |
| server/src/logging/middleware.ts                                   | 1    | No inbound import/require/dynamic import detected anywhere in the repo. |

### React Components Defined But Never Rendered

| File                                                            | Line | Detail                                                                        |
| --------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------- |
| client/src/components/FilterButton.tsx                          | 8    | Component `FilterButton` is exported but never rendered in JSX.               |
| client/src/components/HamburgerButton.tsx                       | 8    | Component `HamburgerButton` is exported but never rendered in JSX.            |
| client/src/components/NetworkContextMenu.tsx                    | 11   | Component `NetworkContextMenu` is exported but never rendered in JSX.         |
| client/src/components/analytics/components/AnalyticsFilters.tsx | 14   | Component `AnalyticsFilters` is exported but never rendered in JSX.           |
| client/src/components/dashboard/MetricCard.tsx                  | 28   | Component `MetricCard` is only imported for types; no JSX render sites found. |

### Defined But Uncalled Utility Functions (`client/src/utils`)

| File                                            | Line | Detail                                                                                   |
| ----------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| client/src/utils/filterCapabilities.ts          | 79   | Utility `createFullCapabilities` is defined/exported but never called or imported.       |
| client/src/utils/filterCapabilities.ts          | 118  | Utility `createBasicCapabilities` is defined/exported but never called or imported.      |
| client/src/utils/formatDate.ts                  | 100  | Utility `formatExportDate` is defined/exported but never called or imported.             |
| client/src/utils/geospatial/fieldFormatting.ts  | 17   | Utility `formatCoordinates` is defined/exported but never called or imported.            |
| client/src/utils/geospatial/fieldFormatting.ts  | 44   | Utility `formatHeading` is defined/exported but never called or imported.                |
| client/src/utils/geospatial/fieldFormatting.ts  | 57   | Utility `formatTimestamp` is defined/exported but never called or imported.              |
| client/src/utils/geospatial/setupPopupPin.ts    | 131  | Utility `isPopupPinned` is defined/exported but never called or imported.                |
| client/src/utils/geospatial/setupPopupPin.ts    | 139  | Utility `cleanupAllPinStates` is defined/exported but never called or imported.          |
| client/src/utils/geospatial/setupPopupTether.ts | 151  | Utility `setupPopupTether` is defined/exported but never called or imported.             |
| client/src/utils/geospatial/setupPopupTether.ts | 227  | Utility `updateTetherDuringDrag` is defined/exported but never called or imported.       |
| client/src/utils/geospatial/setupPopupTether.ts | 248  | Utility `cleanupPopupTether` is defined/exported but never called or imported.           |
| client/src/utils/macUtils.ts                    | 10   | Utility `isRandomizedMAC` is defined/exported but never called or imported.              |
| client/src/utils/macUtils.ts                    | 28   | Utility `getMACType` is defined/exported but never called or imported.                   |
| client/src/utils/mapOrientationControls.ts      | 48   | Utility `attachMapOrientationControls` is defined/exported but never called or imported. |
| client/src/utils/mapOrientationControls.ts      | 120  | Utility `useMapOrientationControls` is defined/exported but never called or imported.    |
| client/src/utils/mapboxLoader.ts                | 28   | Utility `waitForMapbox` is defined/exported but never called or imported.                |
| client/src/utils/mapboxLoader.ts                | 65   | Utility `loadMapbox` is defined/exported but never called or imported.                   |
| client/src/utils/mapboxLoader.ts                | 72   | Utility `isMapboxReady` is defined/exported but never called or imported.                |

### Commented-Out Code Blocks Longer Than 5 Lines

| File | Line | Detail     |
| ---- | ---- | ---------- |
| -    | -    | None found |

## Phase 2 — Stale / Orphaned Artifacts

### TODO / FIXME / HACK / TEMP Comments

| File                             | Line | Detail                                                                        |
| -------------------------------- | ---- | ----------------------------------------------------------------------------- |
| client/src/types/filters.ts      | 107  | // TODO: future split — add a separate ThreatTag type for semantic categories |
| server/src/api/routes/v1/misc.ts | 2    | // TODO: split into geocoding.ts, wigle/import.ts, dataQuality.ts             |
| docs/README.md                   | 29   | - [TODO](TODO.md) - Shared active backlog and deferred follow-up work.        |
| docs/TODO.md                     | 1    | # ShadowCheck TODO                                                            |

### Console Logging In Production Paths

| File                                                                      | Line | Detail                                                                                         |
| ------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| client/src/components/NetworkContextMenu.tsx                              | 55   | console.error('Error saving note:', err);                                                      |
| client/src/components/NetworkContextMenu.tsx                              | 79   | console.error('Error tagging network:', err);                                                  |
| client/src/components/NetworkContextMenu.tsx                              | 89   | console.error('Error deleting note:', err);                                                    |
| client/src/components/admin/hooks/useBackups.ts                           | 55   | console.error('Failed to load S3 backups:', err);                                              |
| client/src/components/admin/hooks/useBackups.ts                           | 72   | console.error('Failed to delete S3 backup:', err);                                             |
| client/src/components/admin/hooks/useWigleDetail.ts                       | 63   | console.error('Failed to fetch observations:', err);                                           |
| client/src/components/admin/tabs/DataExportTab.tsx                        | 52   | console.error('Download error:', error);                                                       |
| client/src/components/admin/tabs/JobsTab.tsx                              | 63   | console.error('Failed to fetch job status', err);                                              |
| client/src/components/admin/tabs/JobsTab.tsx                              | 93   | console.error('Failed to fetch job configs', err);                                             |
| client/src/components/admin/tabs/WigleDetailTab.tsx                       | 147  | console.error('Failed to load enrichment stats', e);                                           |
| client/src/components/admin/tabs/data-import/OrphanNetworksPanel.tsx      | 168  | console.error('Failed to check WiGLE for orphan:', err);                                       |
| client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx | 165  | console.error('Failed to fetch enrichment catalog', e);                                        |
| client/src/components/badges/ThreatBadge.tsx                              | 17   | console.error(                                                                                 |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts              | 208  | console.error('Failed to set standard style 3D buildings:', e2);                               |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts              | 266  | console.error('Failed to set standard style terrain:', e2);                                    |
| client/src/components/geospatial/hooks/useSummaryLayers.ts                | 192  | console.error('[useSummaryLayers] Error managing network summary markers:', err);              |
| client/src/hooks/useNetworkNotes.ts                                       | 38   | console.error('Error fetching notes:', err);                                                   |
| client/src/hooks/useNetworkNotes.ts                                       | 97   | console.error('Error deleting note:', err);                                                    |
| server/src/api/routes/v1/agencyOffices.ts                                 | 15   | console.error('Error fetching agency offices:', error);                                        |
| server/src/api/routes/v1/agencyOffices.ts                                 | 36   | console.error('Error counting agency offices:', error);                                        |
| server/src/api/routes/v1/federalCourthouses.ts                            | 15   | console.error('Error fetching federal courthouses:', error);                                   |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                     | 54   | console.error('[WiGLE Settings] Failed to save to Secrets Manager:', smError);                 |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                     | 81   | console.error('[WiGLE Settings] Unexpected error:', error);                                    |
| server/src/core/initialization/backgroundJobsInit.ts                      | 11   | console.log('[Background Jobs] Skipped (manual-only mode)');                                   |
| server/src/errors/AppError.ts                                             | 390  | console.error('[Production Error]:', err);                                                     |
| server/src/services/authService.ts                                        | 93   | console.error('[AUTH SERVICE ERROR]', error);                                                  |
| server/src/services/cacheService.ts                                       | 23   | console.warn('Redis error:', err.message);                                                     |
| server/src/services/cacheService.ts                                       | 29   | console.log(`✓ Redis connected: ${redisHost}:${redisPort}`);                                   |
| server/src/services/cacheService.ts                                       | 31   | console.warn('Redis unavailable, caching disabled:', (error as Error).message);                |
| server/src/services/secretsManager.ts                                     | 77   | console.log(                                                                                   |
| server/src/services/secretsManager.ts                                     | 88   | console.log(`[SecretsManager] AWS Secrets Manager unavailable: ${err.name \|\| err.message}`); |
| server/src/services/secretsManager.ts                                     | 157  | console.log(`[SecretsManager] Auto-generated '${secret}' (will persist to AWS SM)`);           |
| server/src/services/secretsManager.ts                                     | 173  | console.log(                                                                                   |
| server/src/services/secretsManager.ts                                     | 177  | console.warn(                                                                                  |
| server/src/services/secretsManager.ts                                     | 180  | console.warn('[SecretsManager] Secrets are in-memory only — they will be lost on restart!');   |
| server/src/services/secretsManager.ts                                     | 186  | console.warn('[SecretsManager] MAPBOX_TOKEN should start with "pk."');                         |
| server/src/services/secretsManager.ts                                     | 229  | console.log(`[SecretsManager] Deferred AWS retry: refreshed ${updated} secret(s)`);            |
| server/src/services/secretsManager.ts                                     | 233  | console.log(`[SecretsManager] Deferred AWS retry failed: ${err.message}`);                     |
| server/src/services/secretsManager.ts                                     | 285  | console.log(`[SecretsManager] Persisted '${normalized}' to AWS Secrets Manager`);              |
| server/src/services/secretsManager.ts                                     | 287  | console.warn(`[SecretsManager] Failed to write '${normalized}' to AWS SM: ${err.message}`);    |
| server/src/services/secretsManager.ts                                     | 316  | console.log(                                                                                   |
| server/src/services/secretsManager.ts                                     | 321  | console.error(`[SecretsManager] ${errorMsg}`);                                                 |
| server/src/services/secretsManager.ts                                     | 344  | console.log(`[SecretsManager] Deleted '${normalized}' from AWS Secrets Manager`);              |
| server/src/services/secretsManager.ts                                     | 346  | console.warn(`[SecretsManager] Failed to delete '${normalized}' from AWS SM: ${err.message}`); |
| server/src/utils/routeMounts.ts                                           | 133  | console.error(`[ROUTE ERROR] ${name} is undefined!`);                                          |
| server/src/utils/routeMounts.ts                                           | 139  | console.error('[ROUTE ERROR] Health routes are missing; critical service failure.');           |
| server/src/utils/safeJsonParse.ts                                         | 29   | console.warn(`Unicode escape error in JSON: ${error.message}`);                                |
| server/src/utils/safeJsonParse.ts                                         | 30   | console.warn(`Problematic JSON string: ${trimmed.substring(0, 100)}...`);                      |
| server/src/utils/safeJsonParse.ts                                         | 40   | console.error(`Failed to fix JSON: ${secondError.message}`);                                   |
| server/src/utils/safeJsonParse.ts                                         | 45   | console.error(`JSON parse error: ${error.message}`);                                           |

### Hardcoded Values That Should Be Config / Env

| File                                   | Line | Detail                                                                                                |
| -------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- |
| client/src/components/KeplerPage.tsx   | 87   | Runtime loads hardcoded external CDN URL `https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css`. |
| client/src/components/KeplerPage.tsx   | 88   | Runtime loads hardcoded external CDN URL `https://cdn.jsdelivr.net/npm/deck.gl@latest/dist.min.js`.   |
| client/src/components/KeplerPage.tsx   | 89   | Runtime loads hardcoded external CDN URL `https://api.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js`.  |
| client/src/components/StartPage.tsx    | 237  | Hardcoded S3 asset URL binds homepage media to one bucket/location.                                   |
| client/src/components/StartPage.tsx    | 245  | Hardcoded S3 asset URL binds homepage audio to one bucket/location.                                   |
| client/src/components/StartPage.tsx    | 253  | Hardcoded S3 asset URL binds homepage deck download to one bucket/location.                           |
| etl/promote/process-promotion.ts       | 237  | Fallback API base URL hardcoded to `http://localhost:3001`.                                           |
| scripts/test-all-filters.sh            | 6    | Default target hardcodes public IP `34.204.161.164:3001`.                                             |
| server/src/config/database.ts          | 17   | Fallback DB port hardcoded to `5432`.                                                                 |
| server/src/services/cacheService.ts    | 11   | Fallback Redis port hardcoded to `6379`.                                                              |
| server/src/services/pgadmin/runtime.ts | 32   | Fallback PgAdmin port hardcoded to `5050`.                                                            |
| server/src/utils/serverConfig.ts       | 16   | Fallback application port hardcoded to `3001` instead of being centralized in config.                 |
| server/src/utils/serverConfig.ts       | 22   | Fallback CORS origins hardcode `http://localhost:3001` and `http://127.0.0.1:3001`.                   |

### `.env` Entries With No Matching `process.env` Reference

| File | Line | Detail     |
| ---- | ---- | ---------- |
| -    | -    | None found |

### `process.env` References With No Root `.env*` Entry

| File                                                           | Line | Detail                                                                                                                          |
| -------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| etl/load/fbi-locations.ts                                      | 70   | `process.env.FBI_USE_JINA` has code references but no uncommented entry in root `.env*` files.                                  |
| etl/load/fbi-locations.ts                                      | 71   | `process.env.FBI_REQUEST_DELAY_MS` has code references but no uncommented entry in root `.env*` files.                          |
| etl/load/fbi-locations.ts                                      | 72   | `process.env.FBI_MAX_RETRIES` has code references but no uncommented entry in root `.env*` files.                               |
| etl/load/kismet-import.ts                                      | 22   | `process.env.DB_ADMIN_PASSWORD` has code references but no uncommented entry in root `.env*` files.                             |
| etl/load/kismet-import.ts                                      | 22   | `process.env.DB_PASSWORD` has code references but no uncommented entry in root `.env*` files.                                   |
| etl/load/kml-import.ts                                         | 58   | `process.env.IMPORT_BATCH_SIZE` has code references but no uncommented entry in root `.env*` files.                             |
| etl/load/sqlite-import.ts                                      | 110  | `process.env.DEBUG` has code references but no uncommented entry in root `.env*` files.                                         |
| etl/load/sqlite-import.ts                                      | 961  | `process.env.IMPORT_SOURCE_TAG` has code references but no uncommented entry in root `.env*` files.                             |
| etl/load/sqlite-import.ts                                      | 962  | `process.env.SOURCE_TAG` has code references but no uncommented entry in root `.env*` files.                                    |
| etl/promote/process-promotion.ts                               | 237  | `process.env.API_URL` has code references but no uncommented entry in root `.env*` files.                                       |
| etl/transform/enrich-agency-offices-coords-mapbox-forward.ts   | 185  | `process.env.MAPBOX_UNLIMITED_API_KEY` has code references but no uncommented entry in root `.env*` files.                      |
| etl/transform/enrich-agency-offices-coords-mapbox-forward.ts   | 186  | `process.env.MAPBOX_TOKEN` has code references but no uncommented entry in root `.env*` files.                                  |
| etl/transform/enrich-agency-offices-coords-opencage-forward.ts | 179  | `process.env.OPENCAGE_API_KEY` has code references but no uncommented entry in root `.env*` files.                              |
| etl/transform/process-agencies.ts                              | 287  | `process.env.SMARTY_AUTH_ID` has code references but no uncommented entry in root `.env*` files.                                |
| etl/transform/process-agencies.ts                              | 289  | `process.env.SMARTY_AUTH_TOKEN` has code references but no uncommented entry in root `.env*` files.                             |
| scripts/backup-sm-to-bitwarden.js                              | 9    | `process.env.SHADOWCHECK_AWS_SECRET` has code references but no uncommented entry in root `.env*` files.                        |
| scripts/backup-sm-to-bitwarden.js                              | 10   | `process.env.AWS_REGION` has code references but no uncommented entry in root `.env*` files.                                    |
| scripts/backup-sm-to-bitwarden.js                              | 10   | `process.env.AWS_DEFAULT_REGION` has code references but no uncommented entry in root `.env*` files.                            |
| scripts/backup-sm-to-bitwarden.js                              | 49   | `process.env.BITWARDENCLI_APPDATA_DIR` has code references but no uncommented entry in root `.env*` files.                      |
| scripts/backup-sm-to-bitwarden.js                              | 97   | `process.env.AWS_ACCESS_KEY_ID` has code references but no uncommented entry in root `.env*` files.                             |
| scripts/backup-sm-to-bitwarden.js                              | 98   | `process.env.AWS_SESSION_TOKEN` has code references but no uncommented entry in root `.env*` files.                             |
| scripts/backup-sm-to-bitwarden.js                              | 99   | `process.env.AWS_WEB_IDENTITY_TOKEN_FILE` has code references but no uncommented entry in root `.env*` files.                   |
| scripts/backup-sm-to-bitwarden.js                              | 100  | `process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` has code references but no uncommented entry in root `.env*` files.        |
| scripts/backup-sm-to-bitwarden.js                              | 101  | `process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI` has code references but no uncommented entry in root `.env*` files.            |
| scripts/backup-sm-to-bitwarden.js                              | 102  | `process.env.AWS_PROFILE` has code references but no uncommented entry in root `.env*` files.                                   |
| scripts/enrichment/enrich-addresses-fast.ts                    | 100  | `process.env.LOCATIONIQ_API_KEY` has code references but no uncommented entry in root `.env*` files.                            |
| scripts/enrichment/enrichment-system.ts                        | 443  | `process.env.HERE_API_KEY` has code references but no uncommented entry in root `.env*` files.                                  |
| scripts/generate-sitemap.js                                    | 4    | `process.env.SITE_URL` has code references but no uncommented entry in root `.env*` files.                                      |
| scripts/geocoding/import-missing-geocodes.ts                   | 6    | `process.env.DATABASE_URL` has code references but no uncommented entry in root `.env*` files.                                  |
| scripts/geocoding/reverse-geocode-observations-sample.ts       | 44   | `process.env.MAPBOX_PER_MINUTE` has code references but no uncommented entry in root `.env*` files.                             |
| scripts/wigle-daemon.ts                                        | 127  | `process.env.WIGLE_UNSAFE_BULK_DAEMON` has code references but no uncommented entry in root `.env*` files.                      |
| scripts/write-robots.js                                        | 7    | `process.env.ALLOW_INDEXING` has code references but no uncommented entry in root `.env*` files.                                |
| server/server.ts                                               | 76   | `process.env.FRONTEND_DIST` has code references but no uncommented entry in root `.env*` files.                                 |
| server/src/api/routes/v1/admin/import.ts                       | 449  | `process.env.S3_BACKUP_BUCKET` has code references but no uncommented entry in root `.env*` files.                              |
| server/src/api/routes/v1/admin/import.ts                       | 450  | `process.env.KML_IMPORT_PREFIX` has code references but no uncommented entry in root `.env*` files.                             |
| server/src/api/routes/v1/admin/settings.ts                     | 126  | `process.env.COOKIE_SECURE` has code references but no uncommented entry in root `.env*` files.                                 |
| server/src/api/routes/v1/admin/settings.ts                     | 131  | `process.env.TRACK_QUERY_PERFORMANCE` has code references but no uncommented entry in root `.env*` files.                       |
| server/src/api/routes/v1/admin/settings.ts                     | 132  | `process.env.DEBUG_QUERY_PERFORMANCE` has code references but no uncommented entry in root `.env*` files.                       |
| server/src/api/routes/v1/admin/settings.ts                     | 133  | `process.env.DEBUG_GEOSPATIAL` has code references but no uncommented entry in root `.env*` files.                              |
| server/src/api/routes/v1/admin/settings.ts                     | 137  | `process.env.LOG_LEVEL` has code references but no uncommented entry in root `.env*` files.                                     |
| server/src/api/routes/v1/admin/settings.ts                     | 138  | `process.env.ML_MODEL_VERSION` has code references but no uncommented entry in root `.env*` files.                              |
| server/src/api/routes/v1/admin/settings.ts                     | 139  | `process.env.ML_SCORE_LIMIT` has code references but no uncommented entry in root `.env*` files.                                |
| server/src/api/routes/v1/admin/settings.ts                     | 140  | `process.env.ML_AUTO_SCORE_LIMIT` has code references but no uncommented entry in root `.env*` files.                           |
| server/src/api/routes/v1/wigle/detail.ts                       | 175  | `process.env.WIGLE_DETAIL_IMPORT_DEDUPE_HOURS` has code references but no uncommented entry in root `.env*` files.              |
| server/src/config/database.ts                                  | 18   | `process.env.DB_APP_NAME` has code references but no uncommented entry in root `.env*` files.                                   |
| server/src/config/database.ts                                  | 19   | `process.env.DB_SEARCH_PATH` has code references but no uncommented entry in root `.env*` files.                                |
| server/src/config/database.ts                                  | 38   | `process.env.SIMPLE_RULE_SCORING_ENABLED` has code references but no uncommented entry in root `.env*` files.                   |
| server/src/config/database.ts                                  | 58   | `process.env.DB_SSL_REJECT_UNAUTHORIZED` has code references but no uncommented entry in root `.env*` files.                    |
| server/src/config/database.ts                                  | 59   | `process.env.DB_SSL_CA` has code references but no uncommented entry in root `.env*` files.                                     |
| server/src/config/routeConfig.ts                               | 15   | `process.env.SLOW_FILTERED_TOTAL_MS` has code references but no uncommented entry in root `.env*` files.                        |
| server/src/config/routeConfig.ts                               | 16   | `process.env.SLOW_FILTERED_QUERY_MS` has code references but no uncommented entry in root `.env*` files.                        |
| server/src/config/routeConfig.ts                               | 17   | `process.env.SLOW_GEOSPATIAL_QUERY_MS` has code references but no uncommented entry in root `.env*` files.                      |
| server/src/services/backgroundJobs/config.ts                   | 4    | `process.env.BACKUP_CRON` has code references but no uncommented entry in root `.env*` files.                                   |
| server/src/services/backgroundJobs/config.ts                   | 5    | `process.env.MV_REFRESH_CRON` has code references but no uncommented entry in root `.env*` files.                               |
| server/src/services/backgroundJobs/config.ts                   | 17   | `process.env.ENABLE_BACKGROUND_JOBS` has code references but no uncommented entry in root `.env*` files.                        |
| server/src/services/backup/awsCli.ts                           | 13   | `process.env.PATH` has code references but no uncommented entry in root `.env*` files.                                          |
| server/src/services/backupService.ts                           | 23   | `process.env.BACKUP_SOURCE_ENV` has code references but no uncommented entry in root `.env*` files.                             |
| server/src/services/backupService.ts                           | 24   | `process.env.EC2_INSTANCE_ID` has code references but no uncommented entry in root `.env*` files.                               |
| server/src/services/backupService.ts                           | 55   | `process.env.BACKUP_DIR` has code references but no uncommented entry in root `.env*` files.                                    |
| server/src/services/backupService.ts                           | 166  | `process.env.POSTGRES_CONTAINER` has code references but no uncommented entry in root `.env*` files.                            |
| server/src/services/backupService.ts                           | 262  | `process.env.PGDATABASE` has code references but no uncommented entry in root `.env*` files.                                    |
| server/src/services/backupService.ts                           | 271  | `process.env.BACKUP_RETENTION_DAYS` has code references but no uncommented entry in root `.env*` files.                         |
| server/src/services/exportService.ts                           | 112  | `process.env.FULL_EXPORT_MAX_ROWS_PER_TABLE` has code references but no uncommented entry in root `.env*` files.                |
| server/src/services/exportService.ts                           | 115  | `process.env.FULL_EXPORT_MAX_ROWS_TOTAL` has code references but no uncommented entry in root `.env*` files.                    |
| server/src/services/featureFlagService.ts                      | 16   | `process.env.ADMIN_ALLOW_DOCKER` has code references but no uncommented entry in root `.env*` files.                            |
| server/src/services/featureFlagService.ts                      | 18   | `process.env.ADMIN_ALLOW_ML_TRAINING` has code references but no uncommented entry in root `.env*` files.                       |
| server/src/services/featureFlagService.ts                      | 20   | `process.env.ADMIN_ALLOW_ML_SCORING` has code references but no uncommented entry in root `.env*` files.                        |
| server/src/services/featureFlagService.ts                      | 23   | `process.env.ALLOW_MOBILE_INGEST_AUTO_PROCESS` has code references but no uncommented entry in root `.env*` files.              |
| server/src/services/mobileIngestService.ts                     | 51   | `process.env.MOBILE_INGEST_STUCK_THRESHOLD_MINUTES` has code references but no uncommented entry in root `.env*` files.         |
| server/src/services/mobileIngestService.ts                     | 52   | `process.env.MOBILE_INGEST_STUCK_THRESHOLD_MINUTES_DEFAULT` has code references but no uncommented entry in root `.env*` files. |
| server/src/services/pgadmin/runtime.ts                         | 22   | `process.env.PGADMIN_COMPOSE_FILE` has code references but no uncommented entry in root `.env*` files.                          |
| server/src/services/pgadmin/runtime.ts                         | 25   | `process.env.PGADMIN_SERVICE_NAME` has code references but no uncommented entry in root `.env*` files.                          |
| server/src/services/pgadmin/runtime.ts                         | 27   | `process.env.PGADMIN_CONTAINER_NAME` has code references but no uncommented entry in root `.env*` files.                        |
| server/src/services/pgadmin/runtime.ts                         | 30   | `process.env.PGADMIN_VOLUME_NAME` has code references but no uncommented entry in root `.env*` files.                           |
| server/src/services/pgadmin/runtime.ts                         | 32   | `process.env.PGADMIN_PORT` has code references but no uncommented entry in root `.env*` files.                                  |
| server/src/services/pgadmin/runtime.ts                         | 33   | `process.env.PGADMIN_URL` has code references but no uncommented entry in root `.env*` files.                                   |
| server/src/services/pgadmin/runtime.ts                         | 34   | `process.env.PGADMIN_DOCKER_HOST_LABEL` has code references but no uncommented entry in root `.env*` files.                     |
| server/src/services/pgadmin/runtime.ts                         | 35   | `process.env.PGADMIN_EMAIL` has code references but no uncommented entry in root `.env*` files.                                 |
| server/src/services/pgadmin/runtime.ts                         | 36   | `process.env.PGADMIN_PASSWORD` has code references but no uncommented entry in root `.env*` files.                              |
| server/src/services/pgadmin/runtime.ts                         | 151  | `process.env.PGADMIN_STATUS_PROBE_URL` has code references but no uncommented entry in root `.env*` files.                      |
| server/src/services/secretsManager.ts                          | 65   | `process.env.FORCE_AWS_SM` has code references but no uncommented entry in root `.env*` files.                                  |
| server/src/services/v2Service.ts                               | 15   | `process.env.SLOW_QUERY_THRESHOLD_MS` has code references but no uncommented entry in root `.env*` files.                       |
| server/src/services/wigleBulkPolicy.ts                         | 4    | `process.env.WIGLE_ALLOW_BULK` has code references but no uncommented entry in root `.env*` files.                              |
| server/src/services/wigleSearchCache.ts                        | 11   | `process.env.WIGLE_SEARCH_CACHE_TTL_MS` has code references but no uncommented entry in root `.env*` files.                     |
| server/src/services/wigleSearchCache.ts                        | 16   | `process.env.WIGLE_SEARCH_NEGATIVE_CACHE_TTL_MS` has code references but no uncommented entry in root `.env*` files.            |
| server/src/utils/envSanitizer.ts                               | 5    | `process.env.PGHOST` has code references but no uncommented entry in root `.env*` files.                                        |
| server/src/utils/envSanitizer.ts                               | 6    | `process.env.PGPORT` has code references but no uncommented entry in root `.env*` files.                                        |
| server/src/utils/envSanitizer.ts                               | 8    | `process.env.PGUSER` has code references but no uncommented entry in root `.env*` files.                                        |
| server/src/utils/serverConfig.ts                               | 17   | `process.env.HOST` has code references but no uncommented entry in root `.env*` files.                                          |
| tests/helpers/integrationEnv.ts                                | 1    | `process.env.RUN_INTEGRATION_TESTS` has code references but no uncommented entry in root `.env*` files.                         |
| tests/integration/route-refactoring-verification.test.ts       | 108  | `process.env.API_KEY` has code references but no uncommented entry in root `.env*` files.                                       |
| tests/setup.ts                                                 | 30   | `process.env.SILENT_TESTS` has code references but no uncommented entry in root `.env*` files.                                  |
| tests/unit/secretsManager.test.ts                              | 203  | `process.env.ENV_KEY` has code references but no uncommented entry in root `.env*` files.                                       |
| tests/unit/secretsManager.test.ts                              | 301  | `process.env.WIGLE_API_NAME` has code references but no uncommented entry in root `.env*` files.                                |
| tests/unit/services/backupService.test.ts                      | 277  | `process.env.PG_DUMP_PATH` has code references but no uncommented entry in root `.env*` files.                                  |
| tests/unit/services/wigleRequestLedger.test.ts                 | 11   | `process.env.WIGLE_SOFT_LIMIT_SEARCH` has code references but no uncommented entry in root `.env*` files.                       |

### Orphaned Test Files With No Corresponding Source File

| File | Line | Detail     |
| ---- | ---- | ---------- |
| -    | -    | None found |

## Phase 3 — Dependency Cruft

### Packages In `package.json` With Zero Import References

| File         | Line | Detail                                                                                                          |
| ------------ | ---- | --------------------------------------------------------------------------------------------------------------- |
| package.json | 61   | `@deck.gl/core` is declared in package.json but has no import/require usage in the codebase.                    |
| package.json | 62   | `@deck.gl/layers` is declared in package.json but has no import/require usage in the codebase.                  |
| package.json | 63   | `@deck.gl/react` is declared in package.json but has no import/require usage in the codebase.                   |
| package.json | 64   | `@deck.gl/widgets` is declared in package.json but has no import/require usage in the codebase.                 |
| package.json | 104  | `@eslint/eslintrc` is declared in package.json but has no import/require usage in the codebase.                 |
| package.json | 105  | `@eslint/js` is declared in package.json but has no import/require usage in the codebase.                       |
| package.json | 106  | `@tailwindcss/postcss` is declared in package.json but has no import/require usage in the codebase.             |
| package.json | 107  | `@types/express` is declared in package.json but has no import/require usage in the codebase.                   |
| package.json | 108  | `@types/jest` is declared in package.json but has no import/require usage in the codebase.                      |
| package.json | 109  | `@types/mapbox-gl` is declared in package.json but has no import/require usage in the codebase.                 |
| package.json | 110  | `@types/node` is declared in package.json but has no import/require usage in the codebase.                      |
| package.json | 111  | `@types/pg` is declared in package.json but has no import/require usage in the codebase.                        |
| package.json | 112  | `@types/react` is declared in package.json but has no import/require usage in the codebase.                     |
| package.json | 113  | `@types/react-dom` is declared in package.json but has no import/require usage in the codebase.                 |
| package.json | 114  | `@types/supertest` is declared in package.json but has no import/require usage in the codebase.                 |
| package.json | 115  | `@types/ws` is declared in package.json but has no import/require usage in the codebase.                        |
| package.json | 116  | `@typescript-eslint/eslint-plugin` is declared in package.json but has no import/require usage in the codebase. |
| package.json | 117  | `@typescript-eslint/parser` is declared in package.json but has no import/require usage in the codebase.        |
| package.json | 118  | `@vitejs/plugin-react` is declared in package.json but has no import/require usage in the codebase.             |
| package.json | 119  | `autoprefixer` is declared in package.json but has no import/require usage in the codebase.                     |
| package.json | 120  | `better-sqlite3` is declared in package.json but has no import/require usage in the codebase.                   |
| package.json | 121  | `cssnano` is declared in package.json but has no import/require usage in the codebase.                          |
| package.json | 122  | `eslint` is declared in package.json but has no import/require usage in the codebase.                           |
| package.json | 75   | `express-fileupload` is declared in package.json but has no import/require usage in the codebase.               |
| package.json | 124  | `husky` is declared in package.json but has no import/require usage in the codebase.                            |
| package.json | 20   | `jest` is declared in package.json but has no import/require usage in the codebase.                             |
| package.json | 78   | `keytar` is declared in package.json but has no import/require usage in the codebase.                           |
| package.json | 126  | `lint-staged` is declared in package.json but has no import/require usage in the codebase.                      |
| package.json | 127  | `lodash` is declared in package.json but has no import/require usage in the codebase.                           |
| package.json | 83   | `node-cron` is declared in package.json but has no import/require usage in the codebase.                        |
| package.json | 84   | `node-fetch` is declared in package.json but has no import/require usage in the codebase.                       |
| package.json | 128  | `nodemon` is declared in package.json but has no import/require usage in the codebase.                          |
| package.json | 129  | `postcss` is declared in package.json but has no import/require usage in the codebase.                          |
| package.json | 88   | `preact` is declared in package.json but has no import/require usage in the codebase.                           |
| package.json | 130  | `prettier` is declared in package.json but has no import/require usage in the codebase.                         |
| package.json | 91   | `react-is` is declared in package.json but has no import/require usage in the codebase.                         |
| package.json | 93   | `react-window` is declared in package.json but has no import/require usage in the codebase.                     |
| package.json | 132  | `tailwindcss` is declared in package.json but has no import/require usage in the codebase.                      |
| package.json | 133  | `terser` is declared in package.json but has no import/require usage in the codebase.                           |
| package.json | 134  | `ts-jest` is declared in package.json but has no import/require usage in the codebase.                          |
| package.json | 135  | `tsx` is declared in package.json but has no import/require usage in the codebase.                              |
| package.json | 137  | `vite` is declared in package.json but has no import/require usage in the codebase.                             |

### Packages Imported In Code But Missing From `package.json`

| File                                                                                | Line | Detail                                                                                               |
| ----------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| client/src/components/**tests**/universalFilterCountRendering.test.ts               | 4    | Imports `@testing-library/react` via `@testing-library/react`, but package.json does not declare it. |
| client/src/components/admin/hooks/**tests**/useMLTraining.test.ts                   | 5    | Imports `@testing-library/react` via `@testing-library/react`, but package.json does not declare it. |
| client/src/components/admin/tabs/data-import/**tests**/OrphanNetworksPanel.test.tsx | 4    | Imports `@testing-library/react` via `@testing-library/react`, but package.json does not declare it. |
| server/src/logging/middleware.ts                                                    | 9    | Imports `uuid` via `uuid`, but package.json does not declare it.                                     |
| tests/unit/property/sqlBuilder.fuzz.test.ts                                         | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |
| tests/unit/services/analytics/index.test.ts                                         | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |
| tests/unit/services/filterQueryBuilder/normalizers.test.ts                          | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |
| tests/unit/services/filterQueryBuilder/radioPredicates.test.ts                      | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |
| tests/unit/services/filterQueryBuilder/SchemaCompat.test.ts                         | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |
| tests/unit/services/filterQueryBuilder/validators.test.ts                           | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |
| tests/unit/services/wigleImport/params.test.ts                                      | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |
| tests/unit/services/wigleImport/serialization.test.ts                               | 1    | Imports `@jest/globals` via `@jest/globals`, but package.json does not declare it.                   |

### Duplicate / Overlapping Package Functionality

| File         | Line | Detail                                                                                                                  |
| ------------ | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| package.json | 83   | `node-cron` is declared but unused while `node-schedule` is the active scheduler package.                               |
| package.json | 120  | `better-sqlite3` is declared but unused while `sqlite3` is the active SQLite client in ETL/import code.                 |
| package.json | 93   | `react-window` is declared but unused while `@tanstack/react-virtual` handles table virtualization.                     |
| package.json | 84   | `node-fetch` is declared but unused while runtime code already relies on global/native `fetch` plus `axios` in scripts. |

## Phase 4 — Type Hygiene

### `any` Usage

| File                                                                                | Line | Detail               |
| ----------------------------------------------------------------------------------- | ---- | -------------------- |
| client/src/App.tsx                                                                  | 48   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 47   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 58   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 62   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 84   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 88   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 93   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 97   | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 101  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 106  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 110  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 114  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 118  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 122  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 126  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 130  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 134  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 138  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 142  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 146  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 150  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 154  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 158  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 162  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 166  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 170  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 174  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 178  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 182  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 194  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 198  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 202  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 206  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 216  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 220  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 224  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 322  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 326  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 330  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 334  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 339  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 343  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 355  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 360  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 364  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 369  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 373  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 383  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 393  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 402  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 406  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 411  | `any` keyword usage. |
| client/src/api/adminApi.ts                                                          | 416  | `any` keyword usage. |
| client/src/api/agencyApi.ts                                                         | 54   | `any` keyword usage. |
| client/src/api/agencyApi.ts                                                         | 60   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 8    | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 12   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 16   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 20   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 24   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 28   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 32   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 36   | `any` keyword usage. |
| client/src/api/analyticsApi.ts                                                      | 40   | `any` keyword usage. |
| client/src/api/client.ts                                                            | 5    | `any` keyword usage. |
| client/src/api/client.ts                                                            | 54   | `any` keyword usage. |
| client/src/api/client.ts                                                            | 75   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 48   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 56   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 63   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 67   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 71   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 75   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 79   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 88   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 97   | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 101  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 115  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 121  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 125  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 130  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 136  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 159  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 165  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 169  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 184  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 224  | `any` keyword usage. |
| client/src/api/networkApi.ts                                                        | 226  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 140  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 155  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 160  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 164  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 168  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 173  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 177  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 184  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 188  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 192  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 196  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 201  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 205  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 209  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 213  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 218  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 232  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 250  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 255  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 259  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 264  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 270  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 274  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 278  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 283  | `any` keyword usage. |
| client/src/api/wigleApi.ts                                                          | 287  | `any` keyword usage. |
| client/src/components/ActiveFiltersSummary.tsx                                      | 15   | `any` keyword usage. |
| client/src/components/DashboardPage.tsx                                             | 107  | `any` keyword usage. |
| client/src/components/DashboardPage.tsx                                             | 284  | `any` keyword usage. |
| client/src/components/FilterPanelContainer.tsx                                      | 9    | `any` keyword usage. |
| client/src/components/KeplerPage.tsx                                                | 18   | `any` keyword usage. |
| client/src/components/KeplerPage.tsx                                                | 19   | `any` keyword usage. |
| client/src/components/LazyMapComponent.tsx                                          | 5    | `any` keyword usage. |
| client/src/components/StartPage.tsx                                                 | 125  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 35   | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 36   | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 37   | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 224  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 236  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 253  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 265  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 298  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 298  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 298  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 299  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 299  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 403  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 405  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 407  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 465  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 487  | `any` keyword usage. |
| client/src/components/WiglePage.tsx                                                 | 559  | `any` keyword usage. |
| client/src/components/**tests**/universalFilterCountRendering.test.ts               | 77   | `any` keyword usage. |
| client/src/components/**tests**/universalFilterCountRendering.test.ts               | 90   | `any` keyword usage. |
| client/src/components/**tests**/universalFilterCountRendering.test.ts               | 95   | `any` keyword usage. |
| client/src/components/**tests**/universalFilterCountRendering.test.ts               | 135  | `any` keyword usage. |
| client/src/components/**tests**/universalFilterCountRendering.test.ts               | 160  | `any` keyword usage. |
| client/src/components/admin/components/ObservationsCard.tsx                         | 24   | `any` keyword usage. |
| client/src/components/admin/components/ObservationsCard.tsx                         | 28   | `any` keyword usage. |
| client/src/components/admin/components/ObservationsCard.tsx                         | 29   | `any` keyword usage. |
| client/src/components/admin/components/ObservationsCard.tsx                         | 146  | `any` keyword usage. |
| client/src/components/admin/components/SourceTagInput.tsx                           | 25   | `any` keyword usage. |
| client/src/components/admin/hooks/useApiTesting.ts                                  | 15   | `any` keyword usage. |
| client/src/components/admin/hooks/useApiTesting.ts                                  | 26   | `any` keyword usage. |
| client/src/components/admin/hooks/useApiTesting.ts                                  | 134  | `any` keyword usage. |
| client/src/components/admin/hooks/useBackups.ts                                     | 9    | `any` keyword usage. |
| client/src/components/admin/hooks/useBackups.ts                                     | 22   | `any` keyword usage. |
| client/src/components/admin/hooks/useBackups.ts                                     | 31   | `any` keyword usage. |
| client/src/components/admin/hooks/useBackups.ts                                     | 40   | `any` keyword usage. |
| client/src/components/admin/hooks/useBackups.ts                                     | 71   | `any` keyword usage. |
| client/src/components/admin/hooks/useMLTraining.ts                                  | 38   | `any` keyword usage. |
| client/src/components/admin/hooks/useMLTraining.ts                                  | 62   | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleDetail.ts                                 | 51   | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleDetail.ts                                 | 109  | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleRuns.ts                                   | 45   | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleRuns.ts                                   | 57   | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleRuns.ts                                   | 69   | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleRuns.ts                                   | 81   | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleSearch.ts                                 | 115  | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleSearch.ts                                 | 186  | `any` keyword usage. |
| client/src/components/admin/hooks/useWigleSearch.ts                                 | 215  | `any` keyword usage. |
| client/src/components/admin/tabs/ApiTestingTab.tsx                                  | 152  | `any` keyword usage. |
| client/src/components/admin/tabs/BackupsTab.tsx                                     | 73   | `any` keyword usage. |
| client/src/components/admin/tabs/DataExportTab.tsx                                  | 51   | `any` keyword usage. |
| client/src/components/admin/tabs/DbStatsTab.tsx                                     | 100  | `any` keyword usage. |
| client/src/components/admin/tabs/JobCard.tsx                                        | 71   | `any` keyword usage. |
| client/src/components/admin/tabs/JobOptionsEditor.tsx                               | 12   | `any` keyword usage. |
| client/src/components/admin/tabs/JobScheduleEditor.tsx                              | 22   | `any` keyword usage. |
| client/src/components/admin/tabs/JobsTab.tsx                                        | 113  | `any` keyword usage. |
| client/src/components/admin/tabs/JobsTab.tsx                                        | 130  | `any` keyword usage. |
| client/src/components/admin/tabs/JobsTab.tsx                                        | 137  | `any` keyword usage. |
| client/src/components/admin/tabs/UsersTab.tsx                                       | 48   | `any` keyword usage. |
| client/src/components/admin/tabs/UsersTab.tsx                                       | 80   | `any` keyword usage. |
| client/src/components/admin/tabs/UsersTab.tsx                                       | 100  | `any` keyword usage. |
| client/src/components/admin/tabs/UsersTab.tsx                                       | 121  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleDetailTab.tsx                                 | 135  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleDetailTab.tsx                                 | 170  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleSearchTab.tsx                                 | 105  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleSearchTab.tsx                                 | 136  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleSearchTab.tsx                                 | 138  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleSearchTab.tsx                                 | 148  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleSearchTab.tsx                                 | 603  | `any` keyword usage. |
| client/src/components/admin/tabs/WigleStatsTab.tsx                                  | 84   | `any` keyword usage. |
| client/src/components/admin/tabs/WigleStatsTab.tsx                                  | 98   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ImportHistory.tsx                      | 144  | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                  | 8    | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                  | 16   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                  | 17   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                  | 36   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                  | 44   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                  | 52   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                  | 89   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/OrphanNetworksPanel.tsx                | 45   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/OrphanNetworksPanel.tsx                | 167  | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx           | 58   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx           | 110  | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx           | 226  | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx           | 238  | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/**tests**/OrphanNetworksPanel.test.tsx | 57   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/**tests**/OrphanNetworksPanel.test.tsx | 63   | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/**tests**/OrphanNetworksPanel.test.tsx | 102  | `any` keyword usage. |
| client/src/components/admin/tabs/data-import/**tests**/OrphanNetworksPanel.test.tsx | 108  | `any` keyword usage. |
| client/src/components/admin/tabs/jobTypes.ts                                        | 4    | `any` keyword usage. |
| client/src/components/admin/tabs/ml/ModelOperationsCard.tsx                         | 21   | `any` keyword usage. |
| client/src/components/admin/tabs/ml/ModelOperationsCard.tsx                         | 22   | `any` keyword usage. |
| client/src/components/admin/tabs/ml/ModelStatusCard.tsx                             | 22   | `any` keyword usage. |
| client/src/components/admin/tabs/ml/TrainingDataCard.tsx                            | 22   | `any` keyword usage. |
| client/src/components/admin/tabs/ml/TrainingDataCard.tsx                            | 30   | `any` keyword usage. |
| client/src/components/admin/tabs/ml/TrainingDataCard.tsx                            | 45   | `any` keyword usage. |
| client/src/components/analytics/components/AnalyticsCharts.tsx                      | 46   | `any` keyword usage. |
| client/src/components/analytics/components/AnalyticsCharts.tsx                      | 369  | `any` keyword usage. |
| client/src/components/analytics/components/AnalyticsLayout.tsx                      | 22   | `any` keyword usage. |
| client/src/components/analytics/components/AnalyticsLayout.tsx                      | 23   | `any` keyword usage. |
| client/src/components/analytics/hooks/useAnalyticsData.ts                           | 60   | `any` keyword usage. |
| client/src/components/analytics/hooks/useAnalyticsFilters.ts                        | 21   | `any` keyword usage. |
| client/src/components/analytics/utils/chartHelpers.ts                               | 22   | `any` keyword usage. |
| client/src/components/analytics/utils/chartHelpers.ts                               | 27   | `any` keyword usage. |
| client/src/components/analytics/utils/chartHelpers.ts                               | 37   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 11   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 24   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 34   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 47   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 66   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 76   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 91   | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 105  | `any` keyword usage. |
| client/src/components/analytics/utils/dataTransformers.ts                           | 116  | `any` keyword usage. |
| client/src/components/auth/LoginForm.tsx                                            | 5    | `any` keyword usage. |
| client/src/components/dashboard/MetricCard.tsx                                      | 12   | `any` keyword usage. |
| client/src/components/filters/sections/QualityFilters.tsx                           | 103  | `any` keyword usage. |
| client/src/components/filters/sections/TimeFilters.tsx                              | 101  | `any` keyword usage. |
| client/src/components/geospatial/GeospatialMapContent.tsx                           | 8    | `any` keyword usage. |
| client/src/components/geospatial/GeospatialMapContent.tsx                           | 11   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialMapContent.tsx                           | 12   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialMapContent.tsx                           | 37   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialMapContent.tsx                           | 42   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialTableContent.tsx                         | 6    | `any` keyword usage. |
| client/src/components/geospatial/GeospatialTableContent.tsx                         | 7    | `any` keyword usage. |
| client/src/components/geospatial/GeospatialTableContent.tsx                         | 10   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialTableContent.tsx                         | 14   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialTableContent.tsx                         | 15   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialTableContent.tsx                         | 23   | `any` keyword usage. |
| client/src/components/geospatial/GeospatialTableContent.tsx                         | 26   | `any` keyword usage. |
| client/src/components/geospatial/MapPanel.tsx                                       | 15   | `any` keyword usage. |
| client/src/components/geospatial/MapSection.tsx                                     | 16   | `any` keyword usage. |
| client/src/components/geospatial/MapViewport.tsx                                    | 7    | `any` keyword usage. |
| client/src/components/geospatial/MapViewport.tsx                                    | 40   | `any` keyword usage. |
| client/src/components/geospatial/MapViewport.tsx                                    | 40   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useApplyMapLayerDefaults.ts                  | 5    | `any` keyword usage. |
| client/src/components/geospatial/hooks/useCoreObservationLayers.ts                  | 103  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useCoreObservationLayers.ts                  | 205  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useCoreObservationLayers.ts                  | 210  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useCoreObservationLayers.ts                  | 215  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                | 39   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                | 41   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                | 42   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                | 43   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                | 53   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                | 53   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                | 204  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useGeospatialMap.ts                          | 83   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useLocationSearch.ts                         | 15   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useLocationSearch.ts                         | 92   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useLocationSearch.ts                         | 95   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapInitialization.ts                      | 46   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapInitialization.ts                      | 47   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapInitialization.ts                      | 48   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapInitialization.ts                      | 91   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapInitialization.ts                      | 93   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayers.ts                              | 100  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayers.ts                              | 113  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayers.ts                              | 127  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayers.ts                              | 150  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayers.ts                              | 317  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayers.ts                              | 318  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                        | 4    | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                        | 35   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                        | 67   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                        | 91   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                        | 154  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                        | 188  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapPopups.ts                              | 32   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapPopups.ts                              | 48   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapResizeHandle.ts                        | 7    | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                       | 159  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                       | 163  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                       | 249  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                       | 262  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                       | 282  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                       | 464  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                       | 486  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useNearestAgencies.ts                        | 52   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                     | 166  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                     | 177  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                     | 185  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                     | 274  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                     | 287  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useObservationLayers.ts                      | 23   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useObservationLayers.ts                      | 23   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useSiblingLinks.ts                           | 36   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useSummaryLayers.ts                          | 118  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 52   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 52   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 96   | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 102  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 133  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 164  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 172  | `any` keyword usage. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                            | 287  | `any` keyword usage. |
| client/src/components/geospatial/networkTable/cellRenderers.tsx                     | 87   | `any` keyword usage. |
| client/src/components/geospatial/networkTable/cellRenderers.tsx                     | 88   | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 8    | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 9    | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 20   | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 22   | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 30   | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 31   | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 43   | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 47   | `any` keyword usage. |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx              | 49   | `any` keyword usage. |
| client/src/components/geospatial/table/NetworkTableBodyGrid.tsx                     | 79   | `any` keyword usage. |
| client/src/components/geospatial/table/NetworkTableBodyGrid.tsx                     | 103  | `any` keyword usage. |
| client/src/components/geospatial/table/NetworkTableHeaderGrid.tsx                   | 46   | `any` keyword usage. |
| client/src/components/geospatial/toolbar/MapToolbar.tsx                             | 22   | `any` keyword usage. |
| client/src/components/geospatial/toolbar/MapToolbar.tsx                             | 23   | `any` keyword usage. |
| client/src/components/geospatial/toolbar/MapToolbarActions.tsx                      | 133  | `any` keyword usage. |
| client/src/components/geospatial/toolbar/MapToolbarSearch.tsx                       | 10   | `any` keyword usage. |
| client/src/components/geospatial/toolbar/MapToolbarSearch.tsx                       | 11   | `any` keyword usage. |
| client/src/components/hooks/useAgencyOffices.ts                                     | 234  | `any` keyword usage. |
| client/src/components/hooks/useFederalCourthouses.ts                                | 265  | `any` keyword usage. |
| client/src/components/wigle/eventHandlers.ts                                        | 19   | `any` keyword usage. |
| client/src/components/wigle/eventHandlers.ts                                        | 81   | `any` keyword usage. |
| client/src/components/wigle/eventHandlers.ts                                        | 89   | `any` keyword usage. |
| client/src/components/wigle/kmlLayers.ts                                            | 32   | `any` keyword usage. |
| client/src/components/wigle/kmlLayers.ts                                            | 97   | `any` keyword usage. |
| client/src/components/wigle/kmlLayers.ts                                            | 105  | `any` keyword usage. |
| client/src/components/wigle/layerManagement.ts                                      | 16   | `any` keyword usage. |
| client/src/components/wigle/layerManagement.ts                                      | 17   | `any` keyword usage. |
| client/src/components/wigle/mapHandlers.ts                                          | 24   | `any` keyword usage. |
| client/src/components/wigle/mapHandlers.ts                                          | 137  | `any` keyword usage. |
| client/src/components/wigle/mapHandlers.ts                                          | 144  | `any` keyword usage. |
| client/src/components/wigle/mapHandlers.ts                                          | 148  | `any` keyword usage. |
| client/src/components/wigle/mapLayers.ts                                            | 4    | `any` keyword usage. |
| client/src/components/wigle/mapLayers.ts                                            | 65   | `any` keyword usage. |
| client/src/components/wigle/useWigleData.ts                                         | 11   | `any` keyword usage. |
| client/src/components/wigle/useWigleData.ts                                         | 12   | `any` keyword usage. |
| client/src/components/wigle/useWigleData.ts                                         | 50   | `any` keyword usage. |
| client/src/components/wigle/useWigleKmlData.ts                                      | 25   | `any` keyword usage. |
| client/src/components/wigle/useWigleKmlData.ts                                      | 26   | `any` keyword usage. |
| client/src/components/wigle/useWigleKmlData.ts                                      | 56   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 17   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 18   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 59   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 60   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 62   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 71   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 79   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 87   | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 120  | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 122  | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 134  | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 153  | `any` keyword usage. |
| client/src/components/wigle/useWigleMapInit.ts                                      | 161  | `any` keyword usage. |
| client/src/directions/**tests**/directionsClient.test.ts                            | 5    | `any` keyword usage. |
| client/src/hooks/useAgencyLayer.ts                                                  | 71   | `any` keyword usage. |
| client/src/hooks/useAsyncData.ts                                                    | 22   | `any` keyword usage. |
| client/src/hooks/useAuth.tsx                                                        | 66   | `any` keyword usage. |
| client/src/hooks/useChangePassword.ts                                               | 46   | `any` keyword usage. |
| client/src/hooks/useDashboard.ts                                                    | 8    | `any` keyword usage. |
| client/src/hooks/useDashboard.ts                                                    | 8    | `any` keyword usage. |
| client/src/hooks/useDashboard.ts                                                    | 81   | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 49   | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 50   | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 70   | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 70   | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 71   | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 231  | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 238  | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 293  | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 300  | `any` keyword usage. |
| client/src/hooks/useKeplerDeck.ts                                                   | 325  | `any` keyword usage. |
| client/src/hooks/useLogin.ts                                                        | 5    | `any` keyword usage. |
| client/src/hooks/useLogin.ts                                                        | 33   | `any` keyword usage. |
| client/src/hooks/useNetworkData.ts                                                  | 131  | `any` keyword usage. |
| client/src/hooks/useNetworkData.ts                                                  | 175  | `any` keyword usage. |
| client/src/hooks/useNetworkData.ts                                                  | 186  | `any` keyword usage. |
| client/src/hooks/useNetworkData.ts                                                  | 194  | `any` keyword usage. |
| client/src/hooks/useNetworkData.ts                                                  | 208  | `any` keyword usage. |
| client/src/hooks/useObservations.ts                                                 | 73   | `any` keyword usage. |
| client/src/hooks/useObservations.ts                                                 | 78   | `any` keyword usage. |
| client/src/hooks/useObservations.ts                                                 | 83   | `any` keyword usage. |
| client/src/hooks/useObservations.ts                                                 | 87   | `any` keyword usage. |
| client/src/hooks/useObservations.ts                                                 | 100  | `any` keyword usage. |
| client/src/hooks/useObservations.ts                                                 | 150  | `any` keyword usage. |
| client/src/stores/filterStore.ts                                                    | 24   | `any` keyword usage. |
| client/src/stores/filterStore.ts                                                    | 54   | `any` keyword usage. |
| client/src/stores/filterStore.ts                                                    | 521  | `any` keyword usage. |
| client/src/types/filters.ts                                                         | 167  | `any` keyword usage. |
| client/src/types/network.ts                                                         | 13   | `any` keyword usage. |
| client/src/types/network.ts                                                         | 18   | `any` keyword usage. |
| client/src/utils/**tests**/filterUrlState.test.ts                                   | 6    | `any` keyword usage. |
| client/src/utils/**tests**/filteredRequestParams.test.ts                            | 5    | `any` keyword usage. |
| client/src/utils/**tests**/keplerDataTransformation.test.ts                         | 21   | `any` keyword usage. |
| client/src/utils/**tests**/keplerDataTransformation.test.ts                         | 39   | `any` keyword usage. |
| client/src/utils/**tests**/keplerDataTransformation.test.ts                         | 44   | `any` keyword usage. |
| client/src/utils/**tests**/keplerDataTransformation.test.ts                         | 60   | `any` keyword usage. |
| client/src/utils/**tests**/observationDataTransformation.test.ts                    | 57   | `any` keyword usage. |
| client/src/utils/filterCapabilities.ts                                              | 29   | `any` keyword usage. |
| client/src/utils/filterCapabilities.ts                                              | 45   | `any` keyword usage. |
| client/src/utils/filterCapabilities.ts                                              | 56   | `any` keyword usage. |
| client/src/utils/geospatial/observationTooltipProps.ts                              | 57   | `any` keyword usage. |
| client/src/utils/geospatial/popupStateManager.ts                                    | 6    | `any` keyword usage. |
| client/src/utils/geospatial/popupStateManager.ts                                    | 12   | `any` keyword usage. |
| client/src/utils/geospatial/popupStateManager.ts                                    | 26   | `any` keyword usage. |
| client/src/utils/geospatial/popupStateManager.ts                                    | 40   | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 39   | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 156  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 205  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 205  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 315  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 316  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 357  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 358  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 360  | `any` keyword usage. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                 | 361  | `any` keyword usage. |
| client/src/utils/geospatial/setupPopupPin.ts                                        | 9    | `any` keyword usage. |
| client/src/utils/geospatial/tooltipDataNormalizer.ts                                | 3    | `any` keyword usage. |
| client/src/utils/geospatial/tooltipDataNormalizer.ts                                | 12   | `any` keyword usage. |
| client/src/utils/mapHelpers.ts                                                      | 142  | `any` keyword usage. |
| client/src/utils/mapOrientationControls.ts                                          | 61   | `any` keyword usage. |
| client/src/utils/mapOrientationControls.ts                                          | 98   | `any` keyword usage. |
| client/src/utils/mapOrientationControls.ts                                          | 109  | `any` keyword usage. |
| client/src/utils/mapboxLoader.ts                                                    | 11   | `any` keyword usage. |
| client/src/utils/networkDataTransformation.ts                                       | 87   | `any` keyword usage. |
| client/src/utils/networkFilterParams.ts                                             | 34   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 19   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 27   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 27   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 28   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 28   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 28   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 35   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 35   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 36   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 36   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 36   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 45   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 46   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 47   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 50   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 53   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 55   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 56   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 58   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 59   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 59   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 60   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 60   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 61   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 63   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 63   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 64   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 65   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 66   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 67   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 68   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 69   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 70   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 71   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 72   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 74   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 75   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 76   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 77   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 78   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 80   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 81   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 83   | `any` keyword usage. |
| client/src/utils/wigle/geojson.ts                                                   | 86   | `any` keyword usage. |
| client/src/vite-env.d.ts                                                            | 15   | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 55   | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 67   | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 90   | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 122  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 138  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 150  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 162  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 188  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 208  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 208  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 213  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 230  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 253  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 274  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 289  | `any` keyword usage. |
| etl/load/kismet-import.ts                                                           | 295  | `any` keyword usage. |
| etl/repair/repair-missing-networks.ts                                               | 49   | `any` keyword usage. |
| etl/repair/repair-missing-networks.ts                                               | 56   | `any` keyword usage. |
| etl/repair/repair-missing-networks.ts                                               | 103  | `any` keyword usage. |
| etl/repair/repair-missing-networks.ts                                               | 116  | `any` keyword usage. |
| etl/transform/process-agencies.ts                                                   | 412  | `any` keyword usage. |
| etl/utils/deadLetter.ts                                                             | 7    | `any` keyword usage. |
| scripts/ml/ml-logistic-regression.d.ts                                              | 3    | `any` keyword usage. |
| scripts/ml/ml-trainer.ts                                                            | 27   | `any` keyword usage. |
| scripts/wigle-daemon.ts                                                             | 75   | `any` keyword usage. |
| scripts/wigle-daemon.ts                                                             | 101  | `any` keyword usage. |
| scripts/wigle-daemon.ts                                                             | 113  | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 9    | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 9    | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 20   | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 30   | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 30   | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 39   | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 49   | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 49   | `any` keyword usage. |
| server/src/api/routes/v1/admin-threat-scoring.ts                                    | 57   | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 44   | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 44   | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 44   | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 78   | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 78   | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 78   | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 107  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 113  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 113  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 118  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 118  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 123  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 123  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 128  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 128  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 133  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 140  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 140  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 140  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 156  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 164  | `any` keyword usage. |
| server/src/api/routes/v1/admin.ts                                                   | 164  | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 5    | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 34   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 35   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 43   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 44   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 45   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminAwsHelpers.ts                                   | 64   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminGeocodingHelpers.ts                             | 21   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminGeocodingHelpers.ts                             | 24   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 10   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 10   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 10   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 33   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 47   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 47   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 47   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 79   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 95   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 96   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 97   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 98   | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminNotesHelpers.ts                                 | 132  | `any` keyword usage. |
| server/src/api/routes/v1/admin/adminSecretsHelpers.ts                               | 32   | `any` keyword usage. |
| server/src/api/routes/v1/admin/aws.ts                                               | 47   | `any` keyword usage. |
| server/src/api/routes/v1/admin/aws.ts                                               | 51   | `any` keyword usage. |
| server/src/api/routes/v1/admin/aws.ts                                               | 58   | `any` keyword usage. |
| server/src/api/routes/v1/admin/aws.ts                                               | 83   | `any` keyword usage. |
| server/src/api/routes/v1/admin/awsInstances.ts                                      | 33   | `any` keyword usage. |
| server/src/api/routes/v1/admin/awsInstances.ts                                      | 51   | `any` keyword usage. |
| server/src/api/routes/v1/admin/awsInstances.ts                                      | 69   | `any` keyword usage. |
| server/src/api/routes/v1/admin/awsInstances.ts                                      | 95   | `any` keyword usage. |
| server/src/api/routes/v1/admin/dbStats.ts                                           | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/dbStats.ts                                           | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/dbStats.ts                                           | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/dbStats.ts                                           | 18   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 25   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 25   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 30   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 39   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 39   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 56   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 74   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 74   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 78   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 93   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 93   | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 103  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 116  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 116  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 120  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 129  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 129  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 134  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 146  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 146  | `any` keyword usage. |
| server/src/api/routes/v1/admin/geocoding.ts                                         | 152  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 54   | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 54   | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 54   | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 108  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 144  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 244  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 244  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 278  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 373  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 383  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 383  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 383  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 388  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 394  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 394  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 394  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 398  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 404  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 404  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 404  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 421  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 426  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 426  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 426  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 432  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 437  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 437  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 438  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 458  | `any` keyword usage. |
| server/src/api/routes/v1/admin/import.ts                                            | 585  | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 31   | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 37   | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 37   | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 37   | `any` keyword usage. |
| server/src/api/routes/v1/admin/maintenance.ts                                       | 49   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 50   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 57   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 57   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 57   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 69   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 75   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 75   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 75   | `any` keyword usage. |
| server/src/api/routes/v1/admin/media.ts                                             | 93   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 15   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 15   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 15   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 40   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 47   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 47   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 47   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 59   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 65   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 65   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 89   | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 100  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 100  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 112  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 123  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 123  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 131  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 141  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 141  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 145  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 145  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 155  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 166  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 166  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 180  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 191  | `any` keyword usage. |
| server/src/api/routes/v1/admin/notes.ts                                             | 191  | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 20   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 20   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 29   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 39   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 39   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 52   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 62   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 62   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 71   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 81   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 81   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 92   | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 101  | `any` keyword usage. |
| server/src/api/routes/v1/admin/oui.ts                                               | 101  | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 10   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 10   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 18   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 28   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 28   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 46   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 55   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 55   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 70   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 79   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 79   | `any` keyword usage. |
| server/src/api/routes/v1/admin/pgadmin.ts                                           | 99   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 16   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 16   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 19   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 29   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 29   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 34   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 44   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 44   | `any` keyword usage. |
| server/src/api/routes/v1/admin/secrets.ts                                           | 49   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 24   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 28   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 32   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 45   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 60   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 60   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 63   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 64   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 72   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 82   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 82   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 86   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 92   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 92   | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 104  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 113  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 113  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 143  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 149  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 149  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 203  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 220  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 220  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 228  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 238  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 238  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 275  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 285  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 285  | `any` keyword usage. |
| server/src/api/routes/v1/admin/settings.ts                                          | 290  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 12   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 12   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 57   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 66   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 66   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 85   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 94   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 94   | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 100  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 121  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 130  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 130  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 151  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 160  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 160  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 164  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 173  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 173  | `any` keyword usage. |
| server/src/api/routes/v1/admin/siblings.ts                                          | 177  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 14   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 51   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 69   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 76   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 76   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 76   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 97   | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 104  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 104  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 104  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 120  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 126  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 126  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 126  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 139  | `any` keyword usage. |
| server/src/api/routes/v1/admin/tags.ts                                              | 164  | `any` keyword usage. |
| server/src/api/routes/v1/admin/users.ts                                             | 21   | `any` keyword usage. |
| server/src/api/routes/v1/admin/users.ts                                             | 51   | `any` keyword usage. |
| server/src/api/routes/v1/admin/users.ts                                             | 83   | `any` keyword usage. |
| server/src/api/routes/v1/admin/users.ts                                             | 111  | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 29   | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 29   | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 62   | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 72   | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 72   | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 91   | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 101  | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 101  | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 126  | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 136  | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 136  | `any` keyword usage. |
| server/src/api/routes/v1/auth.ts                                                    | 163  | `any` keyword usage. |
| server/src/api/routes/v1/backup.ts                                                  | 44   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 20   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 20   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 20   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 56   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 67   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 82   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 91   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 91   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 91   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 99   | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 107  | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 107  | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 107  | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 121  | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 129  | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 129  | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 129  | `any` keyword usage. |
| server/src/api/routes/v1/claude.ts                                                  | 133  | `any` keyword usage. |
| server/src/api/routes/v1/dashboard.ts                                               | 8    | `any` keyword usage. |
| server/src/api/routes/v1/dashboard.ts                                               | 16   | `any` keyword usage. |
| server/src/api/routes/v1/dashboard.ts                                               | 16   | `any` keyword usage. |
| server/src/api/routes/v1/dashboard.ts                                               | 32   | `any` keyword usage. |
| server/src/api/routes/v1/dashboard.ts                                               | 32   | `any` keyword usage. |
| server/src/api/routes/v1/dashboard.ts                                               | 46   | `any` keyword usage. |
| server/src/api/routes/v1/dashboard.ts                                               | 55   | `any` keyword usage. |
| server/src/api/routes/v1/explorer/index.ts                                          | 13   | `any` keyword usage. |
| server/src/api/routes/v1/explorer/shared.ts                                         | 23   | `any` keyword usage. |
| server/src/api/routes/v1/explorer/shared.ts                                         | 34   | `any` keyword usage. |
| server/src/api/routes/v1/geospatial.ts                                              | 14   | `any` keyword usage. |
| server/src/api/routes/v1/geospatial.ts                                              | 15   | `any` keyword usage. |
| server/src/api/routes/v1/geospatial.ts                                              | 18   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 16   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 18   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 18   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 25   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 33   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 36   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 37   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 51   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 60   | `any` keyword usage. |
| server/src/api/routes/v1/health.ts                                                  | 70   | `any` keyword usage. |
| server/src/api/routes/v1/home-location.ts                                           | 14   | `any` keyword usage. |
| server/src/api/routes/v1/kepler.ts                                                  | 29   | `any` keyword usage. |
| server/src/api/routes/v1/kepler.ts                                                  | 55   | `any` keyword usage. |
| server/src/api/routes/v1/kepler.ts                                                  | 80   | `any` keyword usage. |
| server/src/api/routes/v1/misc.ts                                                    | 54   | `any` keyword usage. |
| server/src/api/routes/v1/misc.ts                                                    | 54   | `any` keyword usage. |
| server/src/api/routes/v1/misc.ts                                                    | 55   | `any` keyword usage. |
| server/src/api/routes/v1/ml.ts                                                      | 25   | `any` keyword usage. |
| server/src/api/routes/v1/mobileIngest.ts                                            | 108  | `any` keyword usage. |
| server/src/api/routes/v1/mobileIngest.ts                                            | 199  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/listTags.ts                                   | 39   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/listTags.ts                                   | 39   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/listTags.ts                                   | 59   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/listTags.ts                                   | 72   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/listTags.ts                                   | 72   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/listTags.ts                                   | 111  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/listTags.ts                                   | 119  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 37   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 37   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 88   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 98   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 98   | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 128  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 138  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 138  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 174  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 187  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 187  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 205  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 215  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 215  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 224  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 237  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 237  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 251  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 261  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 261  | `any` keyword usage. |
| server/src/api/routes/v1/network-tags/manageTags.ts                                 | 270  | `any` keyword usage. |
| server/src/api/routes/v1/networks/index.ts                                          | 13   | `any` keyword usage. |
| server/src/api/routes/v1/networks/manufacturer.ts                                   | 22   | `any` keyword usage. |
| server/src/api/routes/v1/networks/manufacturer.ts                                   | 25   | `any` keyword usage. |
| server/src/api/routes/v1/networks/manufacturer.ts                                   | 28   | `any` keyword usage. |
| server/src/api/routes/v1/networks/manufacturer.ts                                   | 94   | `any` keyword usage. |
| server/src/api/routes/v1/networks/manufacturer.ts                                   | 95   | `any` keyword usage. |
| server/src/api/routes/v1/networks/manufacturer.ts                                   | 96   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 27   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 27   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 32   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 43   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 43   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 60   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 71   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 71   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 89   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 99   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 99   | `any` keyword usage. |
| server/src/api/routes/v1/networks/notes.ts                                          | 109  | `any` keyword usage. |
| server/src/api/routes/v1/networks/search.ts                                         | 17   | `any` keyword usage. |
| server/src/api/routes/v1/networks/search.ts                                         | 20   | `any` keyword usage. |
| server/src/api/routes/v1/networks/search.ts                                         | 45   | `any` keyword usage. |
| server/src/api/routes/v1/networks/search.ts                                         | 46   | `any` keyword usage. |
| server/src/api/routes/v1/networks/tags.ts                                           | 211  | `any` keyword usage. |
| server/src/api/routes/v1/networks/tags.ts                                           | 222  | `any` keyword usage. |
| server/src/api/routes/v1/networks/tags.ts                                           | 227  | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 14   | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 14   | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 53   | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 68   | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 72   | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 80   | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 97   | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 107  | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 107  | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 144  | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 144  | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 164  | `any` keyword usage. |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                               | 164  | `any` keyword usage. |
| server/src/api/routes/v1/settingsSecretRoutes.ts                                    | 22   | `any` keyword usage. |
| server/src/api/routes/v1/settingsSecretRoutes.ts                                    | 23   | `any` keyword usage. |
| server/src/api/routes/v1/settingsSecretRoutes.ts                                    | 24   | `any` keyword usage. |
| server/src/api/routes/v1/settingsSecretRoutes.ts                                    | 56   | `any` keyword usage. |
| server/src/api/routes/v1/settingsSecretRoutes.ts                                    | 56   | `any` keyword usage. |
| server/src/api/routes/v1/threat-report.ts                                           | 67   | `any` keyword usage. |
| server/src/api/routes/v1/threat-report.ts                                           | 83   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 15   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 30   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 37   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 44   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 48   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 49   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 50   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 57   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 110  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 110  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 111  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 111  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 112  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 131  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 132  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 133  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 134  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 153  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 195  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 196  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 197  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 216  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 243  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 244  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/database.ts                                          | 258  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 23   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 29   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 29   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 34   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 34   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 46   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 46   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 56   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 56   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 67   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 67   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 89   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 112  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 169  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 169  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 169  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 235  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 239  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 299  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 334  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 338  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/detail.ts                                            | 454  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/live.ts                                              | 63   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/live.ts                                              | 72   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/observations.ts                                      | 15   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/observations.ts                                      | 16   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/observations.ts                                      | 27   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/observations.ts                                      | 28   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 21   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 32   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 42   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 102  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 112  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 166  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 194  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 213  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 226  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 240  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 255  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 273  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 287  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 304  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 318  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 336  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 367  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 391  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/search.ts                                            | 412  | `any` keyword usage. |
| server/src/api/routes/v1/wigle/stats.ts                                             | 14   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/stats.ts                                             | 14   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/stats.ts                                             | 14   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/stats.ts                                             | 18   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/utils.ts                                             | 10   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/utils.ts                                             | 29   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/utils.ts                                             | 40   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/utils.ts                                             | 40   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/utils.ts                                             | 50   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/utils.ts                                             | 50   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/validation.ts                                        | 12   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/validation.ts                                        | 13   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/validation.ts                                        | 14   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/validation.ts                                        | 21   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/validation.ts                                        | 22   | `any` keyword usage. |
| server/src/api/routes/v1/wigle/validation.ts                                        | 23   | `any` keyword usage. |
| server/src/api/routes/v2/filteredHandlers.ts                                        | 72   | `any` keyword usage. |
| server/src/api/routes/v2/filteredHandlers.ts                                        | 72   | `any` keyword usage. |
| server/src/api/routes/v2/filteredHandlers.ts                                        | 76   | `any` keyword usage. |
| server/src/api/routes/v2/filteredHandlers.ts                                        | 76   | `any` keyword usage. |
| server/src/api/routes/v2/filteredHandlers.ts                                        | 86   | `any` keyword usage. |
| server/src/api/routes/v2/filteredHandlers.ts                                        | 87   | `any` keyword usage. |
| server/src/api/routes/v2/filteredHandlers.ts                                        | 143  | `any` keyword usage. |
| server/src/core/initialization/databaseInit.ts                                      | 41   | `any` keyword usage. |
| server/src/errors/AppError.ts                                                       | 335  | `any` keyword usage. |
| server/src/errors/AppError.ts                                                       | 362  | `any` keyword usage. |
| server/src/logging/logger.ts                                                        | 121  | `any` keyword usage. |
| server/src/middleware/authMiddleware.ts                                             | 19   | `any` keyword usage. |
| server/src/middleware/cacheMiddleware.ts                                            | 42   | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 12   | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 23   | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 32   | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 44   | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 53   | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 98   | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 138  | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 149  | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 169  | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 180  | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 190  | `any` keyword usage. |
| server/src/repositories/adminNetworkMediaRepository.ts                              | 201  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 4    | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 17   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 17   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 17   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 38   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 82   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 87   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 94   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 102  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 113  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagOuiRepository.ts                             | 123  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 4    | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 42   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 57   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 58   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 59   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 81   | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 103  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 116  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 129  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 142  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 151  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 160  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 173  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 182  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 204  | `any` keyword usage. |
| server/src/repositories/adminNetworkTagRepository.ts                                | 214  | `any` keyword usage. |
| server/src/repositories/agencyRepository.ts                                         | 3    | `any` keyword usage. |
| server/src/repositories/agencyRepository.ts                                         | 42   | `any` keyword usage. |
| server/src/repositories/agencyRepository.ts                                         | 56   | `any` keyword usage. |
| server/src/repositories/agencyRepository.ts                                         | 102  | `any` keyword usage. |
| server/src/repositories/agencyRepository.ts                                         | 172  | `any` keyword usage. |
| server/src/repositories/agencyRepository.ts                                         | 172  | `any` keyword usage. |
| server/src/repositories/baseRepository.ts                                           | 94   | `any` keyword usage. |
| server/src/repositories/baseRepository.ts                                           | 148  | `any` keyword usage. |
| server/src/repositories/baseRepository.ts                                           | 168  | `any` keyword usage. |
| server/src/repositories/baseRepository.ts                                           | 168  | `any` keyword usage. |
| server/src/repositories/baseRepository.ts                                           | 190  | `any` keyword usage. |
| server/src/repositories/courthouseRepository.ts                                     | 3    | `any` keyword usage. |
| server/src/repositories/jobRunRepository.ts                                         | 66   | `any` keyword usage. |
| server/src/repositories/jobRunRepository.ts                                         | 89   | `any` keyword usage. |
| server/src/repositories/jobRunRepository.ts                                         | 123  | `any` keyword usage. |
| server/src/repositories/jobRunRepository.ts                                         | 129  | `any` keyword usage. |
| server/src/repositories/jobRunRepository.ts                                         | 158  | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 32   | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 32   | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 32   | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 33   | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 34   | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 35   | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 68   | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 101  | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 133  | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 139  | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 139  | `any` keyword usage. |
| server/src/repositories/networkRepository.ts                                        | 201  | `any` keyword usage. |
| server/src/repositories/wiglePersistenceRepository.ts                               | 4    | `any` keyword usage. |
| server/src/repositories/wiglePersistenceRepository.ts                               | 4    | `any` keyword usage. |
| server/src/repositories/wiglePersistenceRepository.ts                               | 9    | `any` keyword usage. |
| server/src/repositories/wiglePersistenceRepository.ts                               | 67   | `any` keyword usage. |
| server/src/repositories/wiglePersistenceRepository.ts                               | 110  | `any` keyword usage. |
| server/src/repositories/wiglePersistenceRepository.ts                               | 143  | `any` keyword usage. |
| server/src/repositories/wiglePersistenceRepository.ts                               | 169  | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 5    | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 12   | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 15   | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 36   | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 61   | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 76   | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 85   | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 117  | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 128  | `any` keyword usage. |
| server/src/repositories/wigleQueriesRepository.ts                                   | 324  | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 20   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 20   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 20   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 34   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 34   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 34   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 47   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 47   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 47   | `any` keyword usage. |
| server/src/services/admin/adminHelpers.ts                                           | 120  | `any` keyword usage. |
| server/src/services/admin/importExportAdminService.ts                               | 6    | `any` keyword usage. |
| server/src/services/admin/importExportAdminService.ts                               | 12   | `any` keyword usage. |
| server/src/services/admin/importExportAdminService.ts                               | 13   | `any` keyword usage. |
| server/src/services/admin/importExportAdminService.ts                               | 14   | `any` keyword usage. |
| server/src/services/admin/importExportAdminService.ts                               | 27   | `any` keyword usage. |
| server/src/services/admin/networkNotesAdminService.ts                               | 6    | `any` keyword usage. |
| server/src/services/admin/networkNotesAdminService.ts                               | 25   | `any` keyword usage. |
| server/src/services/admin/networkNotesAdminService.ts                               | 48   | `any` keyword usage. |
| server/src/services/admin/networkNotesAdminService.ts                               | 86   | `any` keyword usage. |
| server/src/services/admin/networkNotesAdminService.ts                               | 94   | `any` keyword usage. |
| server/src/services/admin/networkNotesAdminService.ts                               | 102  | `any` keyword usage. |
| server/src/services/admin/networkNotesAdminService.ts                               | 110  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 3    | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 8    | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 46   | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 61   | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 62   | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 63   | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 85   | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 107  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 120  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 133  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 146  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 155  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 164  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 177  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 186  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 209  | `any` keyword usage. |
| server/src/services/admin/networkTagCore.ts                                         | 219  | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 3    | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 8    | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 21   | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 21   | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 21   | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 42   | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 82   | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 87   | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 94   | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 102  | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 113  | `any` keyword usage. |
| server/src/services/admin/networkTagOui.ts                                          | 123  | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 6    | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 14   | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 30   | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 38   | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 46   | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 54   | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 62   | `any` keyword usage. |
| server/src/services/admin/networkTagsAdminService.ts                                | 70   | `any` keyword usage. |
| server/src/services/admin/settingsAdminService.ts                                   | 6    | `any` keyword usage. |
| server/src/services/admin/settingsAdminService.ts                                   | 9    | `any` keyword usage. |
| server/src/services/admin/settingsAdminService.ts                                   | 16   | `any` keyword usage. |
| server/src/services/admin/settingsAdminService.ts                                   | 24   | `any` keyword usage. |
| server/src/services/admin/settingsAdminService.ts                                   | 24   | `any` keyword usage. |
| server/src/services/admin/settingsAdminService.ts                                   | 45   | `any` keyword usage. |
| server/src/services/admin/siblingDetectionAdminService.ts                           | 12   | `any` keyword usage. |
| server/src/services/admin/siblingDetectionAdminService.ts                           | 32   | `any` keyword usage. |
| server/src/services/admin/siblingDetectionAdminService.ts                           | 109  | `any` keyword usage. |
| server/src/services/admin/siblingDetectionAdminService.ts                           | 121  | `any` keyword usage. |
| server/src/services/adminDbService.ts                                               | 78   | `any` keyword usage. |
| server/src/services/adminDbService.ts                                               | 78   | `any` keyword usage. |
| server/src/services/adminDbStatsService.ts                                          | 9    | `any` keyword usage. |
| server/src/services/adminDbStatsService.ts                                          | 105  | `any` keyword usage. |
| server/src/services/adminImportHistoryService.ts                                    | 41   | `any` keyword usage. |
| server/src/services/adminImportHistoryService.ts                                    | 66   | `any` keyword usage. |
| server/src/services/adminImportHistoryService.ts                                    | 137  | `any` keyword usage. |
| server/src/services/adminImportHistoryService.ts                                    | 153  | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 22   | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 76   | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 101  | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 153  | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 157  | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 214  | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 232  | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 261  | `any` keyword usage. |
| server/src/services/adminOrphanNetworksService.ts                                   | 348  | `any` keyword usage. |
| server/src/services/adminSettingsService.ts                                         | 7    | `any` keyword usage. |
| server/src/services/adminSettingsService.ts                                         | 17   | `any` keyword usage. |
| server/src/services/adminSettingsService.ts                                         | 28   | `any` keyword usage. |
| server/src/services/adminSettingsService.ts                                         | 28   | `any` keyword usage. |
| server/src/services/adminSettingsService.ts                                         | 55   | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 11   | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 20   | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 40   | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 50   | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 64   | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 74   | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 116  | `any` keyword usage. |
| server/src/services/adminUsersService.ts                                            | 127  | `any` keyword usage. |
| server/src/services/backgroundJobs/config.ts                                        | 25   | `any` keyword usage. |
| server/src/services/backgroundJobs/mvRefresh.ts                                     | 5    | `any` keyword usage. |
| server/src/services/backgroundJobs/runners.ts                                       | 20   | `any` keyword usage. |
| server/src/services/backgroundJobs/runners.ts                                       | 23   | `any` keyword usage. |
| server/src/services/backgroundJobs/runners.ts                                       | 91   | `any` keyword usage. |
| server/src/services/backgroundJobs/settings.ts                                      | 19   | `any` keyword usage. |
| server/src/services/backgroundJobsService.ts                                        | 35   | `any` keyword usage. |
| server/src/services/backgroundJobsService.ts                                        | 36   | `any` keyword usage. |
| server/src/services/backgroundJobsService.ts                                        | 149  | `any` keyword usage. |
| server/src/services/backgroundJobsService.ts                                        | 241  | `any` keyword usage. |
| server/src/services/backgroundJobsService.ts                                        | 282  | `any` keyword usage. |
| server/src/services/backgroundJobsService.ts                                        | 308  | `any` keyword usage. |
| server/src/services/backgroundJobsService.ts                                        | 328  | `any` keyword usage. |
| server/src/services/backup/awsCli.ts                                                | 92   | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 220  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 259  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 314  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 333  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 342  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 345  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 371  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 437  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 457  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 466  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 469  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 478  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 482  | `any` keyword usage. |
| server/src/services/backupService.ts                                                | 496  | `any` keyword usage. |
| server/src/services/bedrockService.ts                                               | 180  | `any` keyword usage. |
| server/src/services/cacheService.ts                                                 | 47   | `any` keyword usage. |
| server/src/services/explorerQueries.ts                                              | 14   | `any` keyword usage. |
| server/src/services/explorerQueries.ts                                              | 18   | `any` keyword usage. |
| server/src/services/explorerQueries.ts                                              | 116  | `any` keyword usage. |
| server/src/services/explorerQueries.ts                                              | 120  | `any` keyword usage. |
| server/src/services/explorerService.ts                                              | 9    | `any` keyword usage. |
| server/src/services/explorerService.ts                                              | 18   | `any` keyword usage. |
| server/src/services/explorerService.ts                                              | 26   | `any` keyword usage. |
| server/src/services/explorerService.ts                                              | 26   | `any` keyword usage. |
| server/src/services/explorerService.ts                                              | 44   | `any` keyword usage. |
| server/src/services/explorerService.ts                                              | 60   | `any` keyword usage. |
| server/src/services/explorerService.ts                                              | 70   | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 11   | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 32   | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 33   | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 77   | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 108  | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 127  | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 172  | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 207  | `any` keyword usage. |
| server/src/services/exportService.ts                                                | 219  | `any` keyword usage. |
| server/src/services/externalServiceHandler.ts                                       | 28   | `any` keyword usage. |
| server/src/services/externalServiceHandler.ts                                       | 34   | `any` keyword usage. |
| server/src/services/externalServiceHandler.ts                                       | 36   | `any` keyword usage. |
| server/src/services/filterQueryBuilder/FilterBuildContext.ts                        | 34   | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/GeospatialModule.ts                  | 17   | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/NetworkModule.ts                     | 26   | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/NetworkModule.ts                     | 68   | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/ObservationModule.ts                 | 55   | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/networkFastPathCountBuilder.ts       | 29   | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/networkFastPathListBuilder.ts        | 133  | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/networkMetricsBuilder.ts             | 101  | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/networkMetricsBuilder.ts             | 169  | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/networkNoFilterBuilder.ts            | 112  | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts            | 163  | `any` keyword usage. |
| server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts            | 202  | `any` keyword usage. |
| server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts               | 45   | `any` keyword usage. |
| server/src/services/geocoding/jobState.ts                                           | 51   | `any` keyword usage. |
| server/src/services/homeLocationService.ts                                          | 9    | `any` keyword usage. |
| server/src/services/homeLocationService.ts                                          | 49   | `any` keyword usage. |
| server/src/services/homeLocationService.ts                                          | 67   | `any` keyword usage. |
| server/src/services/homeLocationService.ts                                          | 93   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 21   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 29   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 29   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 38   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 51   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 52   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 73   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 73   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 92   | `any` keyword usage. |
| server/src/services/keplerService.ts                                                | 93   | `any` keyword usage. |
| server/src/services/miscService.ts                                                  | 8    | `any` keyword usage. |
| server/src/services/ml/repository.ts                                                | 128  | `any` keyword usage. |
| server/src/services/ml/repository.ts                                                | 152  | `any` keyword usage. |
| server/src/services/ml/repository.ts                                                | 174  | `any` keyword usage. |
| server/src/services/ml/repository.ts                                                | 179  | `any` keyword usage. |
| server/src/services/ml/repository.ts                                                | 198  | `any` keyword usage. |
| server/src/services/ml/repository.ts                                                | 220  | `any` keyword usage. |
| server/src/services/ml/scoringService.ts                                            | 46   | `any` keyword usage. |
| server/src/services/ml/scoringService.ts                                            | 47   | `any` keyword usage. |
| server/src/services/ml/scoringService.ts                                            | 67   | `any` keyword usage. |
| server/src/services/ml/trainer.ts                                                   | 26   | `any` keyword usage. |
| server/src/services/mobileIngestService.ts                                          | 28   | `any` keyword usage. |
| server/src/services/mobileIngestService.ts                                          | 76   | `any` keyword usage. |
| server/src/services/mobileIngestService.ts                                          | 99   | `any` keyword usage. |
| server/src/services/mobileIngestService.ts                                          | 158  | `any` keyword usage. |
| server/src/services/mobileIngestService.ts                                          | 250  | `any` keyword usage. |
| server/src/services/networkListService.ts                                           | 22   | `any` keyword usage. |
| server/src/services/networkListService.ts                                           | 27   | `any` keyword usage. |
| server/src/services/networkListService.ts                                           | 64   | `any` keyword usage. |
| server/src/services/networkListService.ts                                           | 66   | `any` keyword usage. |
| server/src/services/networkService.ts                                               | 22   | `any` keyword usage. |
| server/src/services/networkService.ts                                               | 28   | `any` keyword usage. |
| server/src/services/networkTagService.ts                                            | 7    | `any` keyword usage. |
| server/src/services/networkTagService.ts                                            | 37   | `any` keyword usage. |
| server/src/services/networkTagService.ts                                            | 54   | `any` keyword usage. |
| server/src/services/networkTagService.ts                                            | 66   | `any` keyword usage. |
| server/src/services/networkTagService.ts                                            | 78   | `any` keyword usage. |
| server/src/services/networkTagService.ts                                            | 81   | `any` keyword usage. |
| server/src/services/networkTagService.ts                                            | 100  | `any` keyword usage. |
| server/src/services/networking/homeLocation.ts                                      | 18   | `any` keyword usage. |
| server/src/services/networking/repository.ts                                        | 24   | `any` keyword usage. |
| server/src/services/networking/repository.ts                                        | 35   | `any` keyword usage. |
| server/src/services/networking/repository.ts                                        | 53   | `any` keyword usage. |
| server/src/services/networking/repository.ts                                        | 71   | `any` keyword usage. |
| server/src/services/networking/repository.ts                                        | 71   | `any` keyword usage. |
| server/src/services/networking/repository.ts                                        | 72   | `any` keyword usage. |
| server/src/services/networking/repository.ts                                        | 102  | `any` keyword usage. |
| server/src/services/networking/sorting.ts                                           | 84   | `any` keyword usage. |
| server/src/services/observationService.ts                                           | 28   | `any` keyword usage. |
| server/src/services/observationService.ts                                           | 67   | `any` keyword usage. |
| server/src/services/observationService.ts                                           | 123  | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 34   | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 66   | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 71   | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 99   | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 102  | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 103  | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 161  | `any` keyword usage. |
| server/src/services/ouiGroupingService.ts                                           | 161  | `any` keyword usage. |
| server/src/services/pgadmin/control.ts                                              | 58   | `any` keyword usage. |
| server/src/services/pgadmin/runtime.ts                                              | 53   | `any` keyword usage. |
| server/src/services/pgadmin/runtime.ts                                              | 59   | `any` keyword usage. |
| server/src/services/pgadmin/runtime.ts                                              | 64   | `any` keyword usage. |
| server/src/services/pgadmin/runtime.ts                                              | 68   | `any` keyword usage. |
| server/src/services/reports/threatReportRenderers.ts                                | 13   | `any` keyword usage. |
| server/src/services/reports/threatReportRenderers.ts                                | 20   | `any` keyword usage. |
| server/src/services/reports/threatReportRenderers.ts                                | 77   | `any` keyword usage. |
| server/src/services/reports/threatReportRenderers.ts                                | 83   | `any` keyword usage. |
| server/src/services/reports/threatReportRenderers.ts                                | 176  | `any` keyword usage. |
| server/src/services/reports/threatReportRenderers.ts                                | 182  | `any` keyword usage. |
| server/src/services/secretsManager.ts                                               | 82   | `any` keyword usage. |
| server/src/services/secretsManager.ts                                               | 176  | `any` keyword usage. |
| server/src/services/secretsManager.ts                                               | 232  | `any` keyword usage. |
| server/src/services/secretsManager.ts                                               | 286  | `any` keyword usage. |
| server/src/services/secretsManager.ts                                               | 319  | `any` keyword usage. |
| server/src/services/secretsManager.ts                                               | 345  | `any` keyword usage. |
| server/src/services/threatReportService.ts                                          | 58   | `any` keyword usage. |
| server/src/services/threatReportService.ts                                          | 75   | `any` keyword usage. |
| server/src/services/threatReportService.ts                                          | 95   | `any` keyword usage. |
| server/src/services/threatReportService.ts                                          | 102  | `any` keyword usage. |
| server/src/services/threatReportService.ts                                          | 103  | `any` keyword usage. |
| server/src/services/threatReportService.ts                                          | 103  | `any` keyword usage. |
| server/src/services/threatReportService.ts                                          | 109  | `any` keyword usage. |
| server/src/services/v2Service.ts                                                    | 140  | `any` keyword usage. |
| server/src/services/v2Service.ts                                                    | 140  | `any` keyword usage. |
| server/src/services/v2Service.ts                                                    | 172  | `any` keyword usage. |
| server/src/services/v2Service.ts                                                    | 281  | `any` keyword usage. |
| server/src/services/v2Service.ts                                                    | 282  | `any` keyword usage. |
| server/src/services/v2Service.ts                                                    | 297  | `any` keyword usage. |
| server/src/services/wigleBulkPolicy.ts                                              | 8    | `any` keyword usage. |
| server/src/services/wigleClient.ts                                                  | 166  | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 19   | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 73   | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 180  | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 246  | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 324  | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 346  | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 363  | `any` keyword usage. |
| server/src/services/wigleEnrichmentService.ts                                       | 454  | `any` keyword usage. |
| server/src/services/wigleImport/pageProcessor.ts                                    | 10   | `any` keyword usage. |
| server/src/services/wigleImport/runRepository.ts                                    | 28   | `any` keyword usage. |
| server/src/services/wigleImport/runRepository.ts                                    | 246  | `any` keyword usage. |
| server/src/services/wigleImport/runRepository.ts                                    | 274  | `any` keyword usage. |
| server/src/services/wigleImport/runRepository.ts                                    | 284  | `any` keyword usage. |
| server/src/services/wigleImport/runRepository.ts                                    | 417  | `any` keyword usage. |
| server/src/services/wigleImport/serialization.ts                                    | 3    | `any` keyword usage. |
| server/src/services/wigleImport/serialization.ts                                    | 35   | `any` keyword usage. |
| server/src/services/wigleImport/serialization.ts                                    | 35   | `any` keyword usage. |
| server/src/services/wigleImportRunService.ts                                        | 41   | `any` keyword usage. |
| server/src/services/wigleImportRunService.ts                                        | 183  | `any` keyword usage. |
| server/src/services/wigleImportRunService.ts                                        | 293  | `any` keyword usage. |
| server/src/services/wigleImportService.ts                                           | 63   | `any` keyword usage. |
| server/src/services/wigleImportService.ts                                           | 84   | `any` keyword usage. |
| server/src/services/wigleImportService.ts                                           | 85   | `any` keyword usage. |
| server/src/services/wigleImportService.ts                                           | 96   | `any` keyword usage. |
| server/src/services/wigleRequestLedger.ts                                           | 74   | `any` keyword usage. |
| server/src/services/wigleSearchApiService.ts                                        | 63   | `any` keyword usage. |
| server/src/services/wigleSearchCache.ts                                             | 5    | `any` keyword usage. |
| server/src/services/wigleSearchCache.ts                                             | 34   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 40   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 40   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 45   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 55   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 66   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 67   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 75   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 92   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 93   | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 243  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 253  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 328  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 335  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 341  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 347  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 352  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 383  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 397  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 425  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 462  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 474  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 493  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 510  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 528  | `any` keyword usage. |
| server/src/services/wigleService.ts                                                 | 555  | `any` keyword usage. |
| server/src/utils/networkSqlExpressions.ts                                           | 17   | `any` keyword usage. |
| server/src/utils/networkSqlExpressions.ts                                           | 114  | `any` keyword usage. |
| server/src/utils/networkSqlExpressions.ts                                           | 157  | `any` keyword usage. |
| server/src/utils/safeJsonParse.ts                                                   | 11   | `any` keyword usage. |
| server/src/utils/safeJsonParse.ts                                                   | 23   | `any` keyword usage. |
| server/src/utils/safeJsonParse.ts                                                   | 39   | `any` keyword usage. |
| server/src/utils/shutdownHandlers.ts                                                | 21   | `any` keyword usage. |
| server/src/utils/shutdownHandlers.ts                                                | 28   | `any` keyword usage. |
| server/src/utils/shutdownHandlers.ts                                                | 40   | `any` keyword usage. |
| server/src/utils/validators.ts                                                      | 19   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 16   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 16   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 16   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 17   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 20   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 38   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 40   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 43   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 62   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 63   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 76   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 77   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 77   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 77   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 81   | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 101  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 117  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 118  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 118  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 118  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 122  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 142  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 158  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 158  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 158  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 247  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 247  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 247  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 271  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 272  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 272  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 272  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 310  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 310  | `any` keyword usage. |
| server/src/validation/middleware.ts                                                 | 310  | `any` keyword usage. |
| tests/api/dashboard.test.ts                                                         | 46   | `any` keyword usage. |
| tests/api/dashboard.test.ts                                                         | 47   | `any` keyword usage. |
| tests/api/mobileIngest.test.ts                                                      | 76   | `any` keyword usage. |
| tests/api/mobileIngest.test.ts                                                      | 79   | `any` keyword usage. |
| tests/api/mobileIngest.test.ts                                                      | 86   | `any` keyword usage. |
| tests/api/mobileIngest.test.ts                                                      | 92   | `any` keyword usage. |
| tests/api/mobileIngest.test.ts                                                      | 100  | `any` keyword usage. |
| tests/api/mobileIngest.test.ts                                                      | 109  | `any` keyword usage. |
| tests/api/mobileIngest.test.ts                                                      | 122  | `any` keyword usage. |
| tests/integration/api/v1/admin.test.ts                                              | 35   | `any` keyword usage. |
| tests/integration/api/v1/admin.test.ts                                              | 35   | `any` keyword usage. |
| tests/integration/api/v1/admin.test.ts                                              | 35   | `any` keyword usage. |
| tests/integration/api/v1/admin.test.ts                                              | 36   | `any` keyword usage. |
| tests/integration/api/v1/admin.test.ts                                              | 36   | `any` keyword usage. |
| tests/integration/api/v1/admin.test.ts                                              | 36   | `any` keyword usage. |
| tests/integration/api/v1/adminManagement.test.ts                                    | 34   | `any` keyword usage. |
| tests/integration/api/v1/adminManagement.test.ts                                    | 34   | `any` keyword usage. |
| tests/integration/api/v1/adminManagement.test.ts                                    | 34   | `any` keyword usage. |
| tests/integration/api/v1/adminManagement.test.ts                                    | 38   | `any` keyword usage. |
| tests/integration/api/v1/adminManagement.test.ts                                    | 38   | `any` keyword usage. |
| tests/integration/api/v1/adminManagement.test.ts                                    | 38   | `any` keyword usage. |
| tests/integration/api/v1/auth.test.ts                                               | 16   | `any` keyword usage. |
| tests/integration/api/v1/auth.test.ts                                               | 16   | `any` keyword usage. |
| tests/integration/api/v1/auth.test.ts                                               | 16   | `any` keyword usage. |
| tests/integration/api/v1/auth.test.ts                                               | 17   | `any` keyword usage. |
| tests/integration/api/v1/dataQuality.test.ts                                        | 17   | `any` keyword usage. |
| tests/integration/api/v1/dataQuality.test.ts                                        | 17   | `any` keyword usage. |
| tests/integration/api/v1/dataQuality.test.ts                                        | 17   | `any` keyword usage. |
| tests/integration/api/v1/export.test.ts                                             | 18   | `any` keyword usage. |
| tests/integration/api/v1/export.test.ts                                             | 18   | `any` keyword usage. |
| tests/integration/api/v1/export.test.ts                                             | 18   | `any` keyword usage. |
| tests/integration/api/v1/export.test.ts                                             | 19   | `any` keyword usage. |
| tests/integration/api/v1/export.test.ts                                             | 19   | `any` keyword usage. |
| tests/integration/api/v1/export.test.ts                                             | 19   | `any` keyword usage. |
| tests/integration/api/v1/geospatial.test.ts                                         | 104  | `any` keyword usage. |
| tests/integration/api/v1/health.test.ts                                             | 38   | `any` keyword usage. |
| tests/integration/api/v1/ml.test.ts                                                 | 39   | `any` keyword usage. |
| tests/integration/api/v1/ml.test.ts                                                 | 39   | `any` keyword usage. |
| tests/integration/api/v1/ml.test.ts                                                 | 39   | `any` keyword usage. |
| tests/integration/api/v1/networks.test.ts                                           | 30   | `any` keyword usage. |
| tests/integration/api/v1/networks.test.ts                                           | 30   | `any` keyword usage. |
| tests/integration/api/v1/networks.test.ts                                           | 30   | `any` keyword usage. |
| tests/integration/api/v1/wigleDetail.test.ts                                        | 49   | `any` keyword usage. |
| tests/integration/api/v1/wigleDetail.test.ts                                        | 49   | `any` keyword usage. |
| tests/integration/api/v1/wigleDetail.test.ts                                        | 49   | `any` keyword usage. |
| tests/integration/api/v1/wigleDetail.test.ts                                        | 64   | `any` keyword usage. |
| tests/integration/api/v1/wigleSearch.test.ts                                        | 46   | `any` keyword usage. |
| tests/integration/api/v1/wigleSearch.test.ts                                        | 46   | `any` keyword usage. |
| tests/integration/api/v1/wigleSearch.test.ts                                        | 46   | `any` keyword usage. |
| tests/integration/api/v1/wigleSearch.test.ts                                        | 63   | `any` keyword usage. |
| tests/integration/api/v1/wigleStatus.test.ts                                        | 10   | `any` keyword usage. |
| tests/integration/api/v1/wigleStatus.test.ts                                        | 10   | `any` keyword usage. |
| tests/integration/api/v1/wigleStatus.test.ts                                        | 10   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 15   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 16   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 17   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 18   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 19   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 20   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 21   | `any` keyword usage. |
| tests/integration/dashboard-threat-parity.test.ts                                   | 146  | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 14   | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 14   | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 15   | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 16   | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 33   | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 34   | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 115  | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 115  | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 118  | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 118  | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 123  | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 268  | `any` keyword usage. |
| tests/integration/explorer-v2.test.ts                                               | 282  | `any` keyword usage. |
| tests/integration/like-escaping.test.ts                                             | 46   | `any` keyword usage. |
| tests/integration/networks-data-integrity.test.ts                                   | 13   | `any` keyword usage. |
| tests/integration/networks-data-integrity.test.ts                                   | 14   | `any` keyword usage. |
| tests/integration/observability.test.ts                                             | 32   | `any` keyword usage. |
| tests/integration/observability.test.ts                                             | 33   | `any` keyword usage. |
| tests/integration/observability.test.ts                                             | 34   | `any` keyword usage. |
| tests/integration/observability.test.ts                                             | 58   | `any` keyword usage. |
| tests/integration/observability.test.ts                                             | 58   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 63   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 64   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 64   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 65   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 66   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 69   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 70   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 71   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 72   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 73   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 74   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 89   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 94   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 94   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 94   | `any` keyword usage. |
| tests/integration/route-refactoring-verification.test.ts                            | 94   | `any` keyword usage. |
| tests/integration/sql-injection-fixes.test.ts                                       | 54   | `any` keyword usage. |
| tests/integration/sql-injection-fixes.test.ts                                       | 219  | `any` keyword usage. |
| tests/integration/sql-injection-fixes.test.ts                                       | 428  | `any` keyword usage. |
| tests/integration/sql-injection-fixes.test.ts                                       | 644  | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 14   | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 15   | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 16   | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 17   | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 58   | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 92   | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 93   | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 102  | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 103  | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 131  | `any` keyword usage. |
| tests/integration/universal-filter-count-parity.test.ts                             | 165  | `any` keyword usage. |
| tests/property/networking/repository.test.ts                                        | 16   | `any` keyword usage. |
| tests/sql-injection-fixes.test.ts                                                   | 35   | `any` keyword usage. |
| tests/sql-injection-fixes.test.ts                                                   | 94   | `any` keyword usage. |
| tests/sql-injection-fixes.test.ts                                                   | 144  | `any` keyword usage. |
| tests/sql-injection-fixes.test.ts                                                   | 242  | `any` keyword usage. |
| tests/unit/GeospatialModule.test.ts                                                 | 43   | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 54   | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 54   | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 54   | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 62   | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 62   | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 62   | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 113  | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 113  | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 113  | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 113  | `any` keyword usage. |
| tests/unit/adminImport.test.ts                                                      | 143  | `any` keyword usage. |
| tests/unit/adminNotesHelpers.test.ts                                                | 9    | `any` keyword usage. |
| tests/unit/adminNotesHelpers.test.ts                                                | 11   | `any` keyword usage. |
| tests/unit/adminNotesHelpers.test.ts                                                | 22   | `any` keyword usage. |
| tests/unit/adminNotesHelpers.test.ts                                                | 30   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 35   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 35   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 35   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 38   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 38   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 38   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 41   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 41   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 41   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 42   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 42   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 42   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 48   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 60   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 65   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 72   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 84   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 94   | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 103  | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 113  | `any` keyword usage. |
| tests/unit/adminOrphanNetworksRoute.test.ts                                         | 165  | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 41   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 41   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 41   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 44   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 44   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 44   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 47   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 47   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 47   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 48   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 48   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 48   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 54   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 66   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 71   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 78   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 90   | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 106  | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 125  | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 126  | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 146  | `any` keyword usage. |
| tests/unit/adminSQLiteImportRoute.test.ts                                           | 183  | `any` keyword usage. |
| tests/unit/adminSettings.test.ts                                                    | 34   | `any` keyword usage. |
| tests/unit/adminSettings.test.ts                                                    | 147  | `any` keyword usage. |
| tests/unit/adminSettings.test.ts                                                    | 154  | `any` keyword usage. |
| tests/unit/authQueries.test.ts                                                      | 32   | `any` keyword usage. |
| tests/unit/authQueries.test.ts                                                      | 63   | `any` keyword usage. |
| tests/unit/authQueries.test.ts                                                      | 98   | `any` keyword usage. |
| tests/unit/authWrites.test.ts                                                       | 86   | `any` keyword usage. |
| tests/unit/authWrites.test.ts                                                       | 100  | `any` keyword usage. |
| tests/unit/authWrites.test.ts                                                       | 124  | `any` keyword usage. |
| tests/unit/backup.test.ts                                                           | 12   | `any` keyword usage. |
| tests/unit/backup.test.ts                                                           | 12   | `any` keyword usage. |
| tests/unit/backup.test.ts                                                           | 12   | `any` keyword usage. |
| tests/unit/backup.test.ts                                                           | 21   | `any` keyword usage. |
| tests/unit/backup.test.ts                                                           | 21   | `any` keyword usage. |
| tests/unit/backup.test.ts                                                           | 21   | `any` keyword usage. |
| tests/unit/claude.test.ts                                                           | 33   | `any` keyword usage. |
| tests/unit/claude.test.ts                                                           | 33   | `any` keyword usage. |
| tests/unit/claude.test.ts                                                           | 33   | `any` keyword usage. |
| tests/unit/claude.test.ts                                                           | 39   | `any` keyword usage. |
| tests/unit/claude.test.ts                                                           | 39   | `any` keyword usage. |
| tests/unit/claude.test.ts                                                           | 39   | `any` keyword usage. |
| tests/unit/claude.test.ts                                                           | 39   | `any` keyword usage. |
| tests/unit/contextMenuUtils.test.ts                                                 | 11   | `any` keyword usage. |
| tests/unit/contextMenuUtils.test.ts                                                 | 14   | `any` keyword usage. |
| tests/unit/contextMenuUtils.test.ts                                                 | 21   | `any` keyword usage. |
| tests/unit/contextMenuUtils.test.ts                                                 | 26   | `any` keyword usage. |
| tests/unit/contextMenuUtils.test.ts                                                 | 37   | `any` keyword usage. |
| tests/unit/coverage_expansion_v2.test.ts                                            | 341  | `any` keyword usage. |
| tests/unit/errors/AppError.test.ts                                                  | 218  | `any` keyword usage. |
| tests/unit/errors/AppError.test.ts                                                  | 228  | `any` keyword usage. |
| tests/unit/errors/AppError.test.ts                                                  | 267  | `any` keyword usage. |
| tests/unit/errors/AppError.test.ts                                                  | 276  | `any` keyword usage. |
| tests/unit/errors/AppError.test.ts                                                  | 283  | `any` keyword usage. |
| tests/unit/errors/errorHandler.test.ts                                              | 30   | `any` keyword usage. |
| tests/unit/errors/errorHandler.test.ts                                              | 99   | `any` keyword usage. |
| tests/unit/errors/errorHandler.test.ts                                              | 171  | `any` keyword usage. |
| tests/unit/errors/errorHandler.test.ts                                              | 193  | `any` keyword usage. |
| tests/unit/errors/errorHandler.test.ts                                              | 212  | `any` keyword usage. |
| tests/unit/errors/errorHandler.test.ts                                              | 231  | `any` keyword usage. |
| tests/unit/explorerNetworksRoute.test.ts                                            | 29   | `any` keyword usage. |
| tests/unit/explorerNetworksRoute.test.ts                                            | 34   | `any` keyword usage. |
| tests/unit/explorerNetworksRoute.test.ts                                            | 46   | `any` keyword usage. |
| tests/unit/explorerNetworksRoute.test.ts                                            | 58   | `any` keyword usage. |
| tests/unit/explorerNetworksRoute.test.ts                                            | 66   | `any` keyword usage. |
| tests/unit/explorerNetworksRoute.test.ts                                            | 76   | `any` keyword usage. |
| tests/unit/explorerService.test.ts                                                  | 50   | `any` keyword usage. |
| tests/unit/explorerService.test.ts                                                  | 117  | `any` keyword usage. |
| tests/unit/explorerService.test.ts                                                  | 156  | `any` keyword usage. |
| tests/unit/filterAlignmentAudit.test.ts                                             | 36   | `any` keyword usage. |
| tests/unit/filterAlignmentAudit.test.ts                                             | 37   | `any` keyword usage. |
| tests/unit/filterAlignmentAudit.test.ts                                             | 46   | `any` keyword usage. |
| tests/unit/filterQueryBuilder.newFilters.test.ts                                    | 170  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.newFilters.test.ts                                    | 172  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.test.ts                                               | 202  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.test.ts                                               | 213  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.test.ts                                               | 373  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.test.ts                                               | 374  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.test.ts                                               | 391  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.test.ts                                               | 422  | `any` keyword usage. |
| tests/unit/filterQueryBuilder.test.ts                                               | 423  | `any` keyword usage. |
| tests/unit/filterQueryBuilder_coverage_expansion.test.ts                            | 73   | `any` keyword usage. |
| tests/unit/filterQueryBuilder_coverage_expansion.test.ts                            | 85   | `any` keyword usage. |
| tests/unit/filteredAnalyticsRoutes.test.ts                                          | 3    | `any` keyword usage. |
| tests/unit/filteredAnalyticsRoutes.test.ts                                          | 6    | `any` keyword usage. |
| tests/unit/filteredAnalyticsRoutes.test.ts                                          | 8    | `any` keyword usage. |
| tests/unit/filteredAnalyticsRoutes.test.ts                                          | 16   | `any` keyword usage. |
| tests/unit/filteredAnalyticsRoutes.test.ts                                          | 18   | `any` keyword usage. |
| tests/unit/filteredAnalyticsRoutes.test.ts                                          | 19   | `any` keyword usage. |
| tests/unit/filteredAnalyticsRoutes.test.ts                                          | 24   | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 4    | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 5    | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 6    | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 7    | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 8    | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 9    | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 67   | `any` keyword usage. |
| tests/unit/filteredHandlers.test.ts                                                 | 67   | `any` keyword usage. |
| tests/unit/filteredHelpers.test.ts                                                  | 8    | `any` keyword usage. |
| tests/unit/filteredHelpers.test.ts                                                  | 22   | `any` keyword usage. |
| tests/unit/filteredHelpers.test.ts                                                  | 35   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 4    | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 4    | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 4    | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 13   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 13   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 13   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 13   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 33   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 34   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 36   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 37   | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 102  | `any` keyword usage. |
| tests/unit/filters-systematic.test.ts                                               | 103  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 105  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 144  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 181  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 206  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 225  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 281  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 292  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 293  | `any` keyword usage. |
| tests/unit/geocodingDaemon.test.ts                                                  | 308  | `any` keyword usage. |
| tests/unit/geocodingDaemonState.test.ts                                             | 95   | `any` keyword usage. |
| tests/unit/health.test.ts                                                           | 27   | `any` keyword usage. |
| tests/unit/health.test.ts                                                           | 28   | `any` keyword usage. |
| tests/unit/health.test.ts                                                           | 29   | `any` keyword usage. |
| tests/unit/homeLocation.test.ts                                                     | 12   | `any` keyword usage. |
| tests/unit/homeLocation.test.ts                                                     | 12   | `any` keyword usage. |
| tests/unit/homeLocation.test.ts                                                     | 12   | `any` keyword usage. |
| tests/unit/keplerHelpers.test.ts                                                    | 34   | `any` keyword usage. |
| tests/unit/kmlImportUtils.test.ts                                                   | 75   | `any` keyword usage. |
| tests/unit/manageTags.test.ts                                                       | 30   | `any` keyword usage. |
| tests/unit/manageTags.test.ts                                                       | 30   | `any` keyword usage. |
| tests/unit/manageTags.test.ts                                                       | 30   | `any` keyword usage. |
| tests/unit/manageTags.test.ts                                                       | 34   | `any` keyword usage. |
| tests/unit/manageTags.test.ts                                                       | 34   | `any` keyword usage. |
| tests/unit/manageTags.test.ts                                                       | 34   | `any` keyword usage. |
| tests/unit/middleware/authMiddleware.test.ts                                        | 11   | `any` keyword usage. |
| tests/unit/middleware/authMiddleware.test.ts                                        | 27   | `any` keyword usage. |
| tests/unit/middleware/authMiddleware.test.ts                                        | 222  | `any` keyword usage. |
| tests/unit/middleware/cacheMiddleware.test.ts                                       | 17   | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 4    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 4    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 4    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 5    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 5    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 5    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 6    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 6    | `any` keyword usage. |
| tests/unit/middleware/commonMiddleware.test.ts                                      | 6    | `any` keyword usage. |
| tests/unit/mlTrainer.test.ts                                                        | 36   | `any` keyword usage. |
| tests/unit/mlTrainer.test.ts                                                        | 37   | `any` keyword usage. |
| tests/unit/mlTrainer.test.ts                                                        | 38   | `any` keyword usage. |
| tests/unit/mlTrainer.test.ts                                                        | 60   | `any` keyword usage. |
| tests/unit/mlTrainer.test.ts                                                        | 132  | `any` keyword usage. |
| tests/unit/mobileIngestService.test.ts                                              | 32   | `any` keyword usage. |
| tests/unit/mobileIngestService.test.ts                                              | 311  | `any` keyword usage. |
| tests/unit/mobileIngestService.test.ts                                              | 314  | `any` keyword usage. |
| tests/unit/mobileIngestService.test.ts                                              | 326  | `any` keyword usage. |
| tests/unit/mobileIngestService.test.ts                                              | 327  | `any` keyword usage. |
| tests/unit/mobileIngestVisibility.test.ts                                           | 4    | `any` keyword usage. |
| tests/unit/mobileIngestVisibility.test.ts                                           | 5    | `any` keyword usage. |
| tests/unit/mobileIngestVisibility.test.ts                                           | 6    | `any` keyword usage. |
| tests/unit/networkFastPathListBuilder.test.ts                                       | 49   | `any` keyword usage. |
| tests/unit/networkFastPathPredicates.test.ts                                        | 28   | `any` keyword usage. |
| tests/unit/networkMetricsBuilder.test.ts                                            | 14   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 15   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 15   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 15   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 19   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 19   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 19   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 24   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 26   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 37   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 45   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 49   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 49   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 49   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 49   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 51   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 57   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 62   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 63   | `any` keyword usage. |
| tests/unit/networkNotesRoutes.test.ts                                               | 64   | `any` keyword usage. |
| tests/unit/networkSqlExpressions.test.ts                                            | 119  | `any` keyword usage. |
| tests/unit/networkTableCellRenderers.test.ts                                        | 46   | `any` keyword usage. |
| tests/unit/networkTableCellRenderers.test.ts                                        | 166  | `any` keyword usage. |
| tests/unit/networkTableCellRenderers.test.ts                                        | 197  | `any` keyword usage. |
| tests/unit/networkTableCellRenderers.test.ts                                        | 199  | `any` keyword usage. |
| tests/unit/ouiGroupingService.test.ts                                               | 14   | `any` keyword usage. |
| tests/unit/radioFilterParity.test.ts                                                | 4    | `any` keyword usage. |
| tests/unit/radioFilterParity.test.ts                                                | 4    | `any` keyword usage. |
| tests/unit/radioFilterParity.test.ts                                                | 18   | `any` keyword usage. |
| tests/unit/repositories/baseRepository.test.ts                                      | 18   | `any` keyword usage. |
| tests/unit/repositories/networkRepository.test.ts                                   | 9    | `any` keyword usage. |
| tests/unit/requestId.test.ts                                                        | 13   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 9    | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 9    | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 9    | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 19   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 19   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 19   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 34   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 34   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 34   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 41   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 41   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 41   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 46   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 46   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 46   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 54   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 54   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 93   | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 103  | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 161  | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 220  | `any` keyword usage. |
| tests/unit/routeMounts.authz.test.ts                                                | 240  | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 21   | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 40   | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 253  | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 269  | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 283  | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 291  | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 356  | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 367  | `any` keyword usage. |
| tests/unit/secretsManager.test.ts                                                   | 379  | `any` keyword usage. |
| tests/unit/services/admin/adminHelpers.test.ts                                      | 46   | `any` keyword usage. |
| tests/unit/services/admin/adminHelpers.test.ts                                      | 57   | `any` keyword usage. |
| tests/unit/services/admin/dataQualityAdminService.test.ts                           | 20   | `any` keyword usage. |
| tests/unit/services/adminUsersService.test.ts                                       | 39   | `any` keyword usage. |
| tests/unit/services/adminUsersService.test.ts                                       | 143  | `any` keyword usage. |
| tests/unit/services/adminUsersService.test.ts                                       | 231  | `any` keyword usage. |
| tests/unit/services/adminUsersService.test.ts                                       | 299  | `any` keyword usage. |
| tests/unit/services/agencyService.test.ts                                           | 23   | `any` keyword usage. |
| tests/unit/services/agencyService.test.ts                                           | 31   | `any` keyword usage. |
| tests/unit/services/agencyService.test.ts                                           | 39   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/backgroundJobsService.test.ts                    | 76   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/backgroundJobsService.test.ts                    | 175  | `any` keyword usage. |
| tests/unit/services/backgroundJobs/mlBehavioralScoring.test.ts                      | 10   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/mlBehavioralScoring.test.ts                      | 37   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/mlBehavioralScoring.test.ts                      | 70   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/mlBehavioralScoring.test.ts                      | 76   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/mlBehavioralScoring.test.ts                      | 82   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/mlBehavioralScoring.test.ts                      | 88   | `any` keyword usage. |
| tests/unit/services/backgroundJobs/mvRefresh.test.ts                                | 107  | `any` keyword usage. |
| tests/unit/services/backupService.test.ts                                           | 70   | `any` keyword usage. |
| tests/unit/services/backupService.test.ts                                           | 80   | `any` keyword usage. |
| tests/unit/services/backupService.test.ts                                           | 82   | `any` keyword usage. |
| tests/unit/services/backupService.test.ts                                           | 83   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 20   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 21   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 37   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 38   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 46   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 47   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 53   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 54   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 60   | `any` keyword usage. |
| tests/unit/services/cacheService.test.ts                                            | 61   | `any` keyword usage. |
| tests/unit/services/dashboardService.test.ts                                        | 4    | `any` keyword usage. |
| tests/unit/services/geocoding/cacheStore.test.ts                                    | 50   | `any` keyword usage. |
| tests/unit/services/geocoding/cacheStore.test.ts                                    | 51   | `any` keyword usage. |
| tests/unit/services/geocoding/cacheStore.test.ts                                    | 55   | `any` keyword usage. |
| tests/unit/services/geocoding/cacheStore.test.ts                                    | 62   | `any` keyword usage. |
| tests/unit/services/geocoding/cacheStore.test.ts                                    | 71   | `any` keyword usage. |
| tests/unit/services/geocoding/cacheStore.test.ts                                    | 81   | `any` keyword usage. |
| tests/unit/services/geocoding/cacheStore.test.ts                                    | 88   | `any` keyword usage. |
| tests/unit/services/geocoding/jobState.test.ts                                      | 67   | `any` keyword usage. |
| tests/unit/services/geocoding/jobState.test.ts                                      | 77   | `any` keyword usage. |
| tests/unit/services/geocoding/jobState.test.ts                                      | 195  | `any` keyword usage. |
| tests/unit/services/geocoding/providerRuntime.test.ts                               | 191  | `any` keyword usage. |
| tests/unit/services/keplerService.test.ts                                           | 22   | `any` keyword usage. |
| tests/unit/services/keplerService.test.ts                                           | 30   | `any` keyword usage. |
| tests/unit/services/keplerService.test.ts                                           | 32   | `any` keyword usage. |
| tests/unit/services/keplerService.test.ts                                           | 42   | `any` keyword usage. |
| tests/unit/services/keplerService.test.ts                                           | 77   | `any` keyword usage. |
| tests/unit/services/mlScoringService.test.ts                                        | 24   | `any` keyword usage. |
| tests/unit/services/mlScoringService.test.ts                                        | 29   | `any` keyword usage. |
| tests/unit/services/mlScoringService.test.ts                                        | 122  | `any` keyword usage. |
| tests/unit/services/mlScoringService.test.ts                                        | 127  | `any` keyword usage. |
| tests/unit/services/networking/queryParts.test.ts                                   | 6    | `any` keyword usage. |
| tests/unit/services/networking/queryParts.test.ts                                   | 77   | `any` keyword usage. |
| tests/unit/services/networking/queryParts.test.ts                                   | 105  | `any` keyword usage. |
| tests/unit/services/networking/repository.test.ts                                   | 6    | `any` keyword usage. |
| tests/unit/services/pgadmin/runtime.test.ts                                         | 6    | `any` keyword usage. |
| tests/unit/services/pgadmin/runtime.test.ts                                         | 24   | `any` keyword usage. |
| tests/unit/services/pgadmin/runtime.test.ts                                         | 27   | `any` keyword usage. |
| tests/unit/services/wigleClient.test.ts                                             | 13   | `any` keyword usage. |
| tests/unit/services/wigleImport/pageProcessor.test.ts                               | 23   | `any` keyword usage. |
| tests/unit/services/wigleImport/runRepository.test.ts                               | 12   | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 12   | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 13   | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 46   | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 67   | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 74   | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 87   | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 108  | `any` keyword usage. |
| tests/unit/services/wigleImportService.extended.test.ts                             | 121  | `any` keyword usage. |
| tests/unit/services/wigleImportService.test.ts                                      | 11   | `any` keyword usage. |
| tests/unit/services/wigleImportService.test.ts                                      | 12   | `any` keyword usage. |
| tests/unit/services/wigleRequestLedger.test.ts                                      | 41   | `any` keyword usage. |
| tests/unit/services/wigleRequestLedger.test.ts                                      | 54   | `any` keyword usage. |
| tests/unit/services/wigleRequestUtils.test.ts                                       | 34   | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 7    | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 7    | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 7    | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 8    | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 8    | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 8    | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 13   | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 15   | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 16   | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 17   | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 18   | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 32   | `any` keyword usage. |
| tests/unit/settings.test.ts                                                         | 33   | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 5    | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 5    | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 5    | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 9    | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 10   | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 11   | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 12   | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 13   | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 14   | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 25   | `any` keyword usage. |
| tests/unit/settingsMultiSecretRoutes.test.ts                                        | 26   | `any` keyword usage. |
| tests/unit/siblingDetectionAdminService.test.ts                                     | 11   | `any` keyword usage. |
| tests/unit/siblingDetectionAdminService.test.ts                                     | 18   | `any` keyword usage. |
| tests/unit/siblingDetectionAdminService.test.ts                                     | 19   | `any` keyword usage. |
| tests/unit/threatReportRenderers.test.ts                                            | 86   | `any` keyword usage. |
| tests/unit/threatReportRenderers.test.ts                                            | 135  | `any` keyword usage. |
| tests/unit/threatReportRenderers.test.ts                                            | 170  | `any` keyword usage. |
| tests/unit/threatReportRenderers.test.ts                                            | 265  | `any` keyword usage. |
| tests/unit/threatReportRenderers.test.ts                                            | 282  | `any` keyword usage. |
| tests/unit/threatReportService.test.ts                                              | 3    | `any` keyword usage. |
| tests/unit/threatReportService.test.ts                                              | 4    | `any` keyword usage. |
| tests/unit/threatReportService.test.ts                                              | 5    | `any` keyword usage. |
| tests/unit/threatReportService.test.ts                                              | 12   | `any` keyword usage. |
| tests/unit/threatReportService.test.ts                                              | 12   | `any` keyword usage. |
| tests/unit/utils/appInit.test.ts                                                    | 13   | `any` keyword usage. |
| tests/unit/utils/databaseInit.test.ts                                               | 4    | `any` keyword usage. |
| tests/unit/utils/databaseInit.test.ts                                               | 5    | `any` keyword usage. |
| tests/unit/utils/databaseInit.test.ts                                               | 6    | `any` keyword usage. |
| tests/unit/utils/databaseInit.test.ts                                               | 47   | `any` keyword usage. |
| tests/unit/utils/databaseInit.test.ts                                               | 69   | `any` keyword usage. |
| tests/unit/utils/databaseInit.test.ts                                               | 104  | `any` keyword usage. |
| tests/unit/utils/databaseSetup.test.ts                                              | 16   | `any` keyword usage. |
| tests/unit/utils/errorHandlingInit.test.ts                                          | 5    | `any` keyword usage. |
| tests/unit/utils/errorHandlingInit.test.ts                                          | 8    | `any` keyword usage. |
| tests/unit/utils/middlewareInit.test.ts                                             | 29   | `any` keyword usage. |
| tests/unit/utils/queryPerformanceTracker.test.ts                                    | 123  | `any` keyword usage. |
| tests/unit/utils/queryPerformanceTracker.test.ts                                    | 124  | `any` keyword usage. |
| tests/unit/utils/queryPerformanceTracker.test.ts                                    | 125  | `any` keyword usage. |
| tests/unit/utils/routeMounts.test.ts                                                | 10   | `any` keyword usage. |
| tests/unit/utils/routeMounts.test.ts                                                | 11   | `any` keyword usage. |
| tests/unit/utils/routeMounts.test.ts                                                | 59   | `any` keyword usage. |
| tests/unit/utils/routeMounts.test.ts                                                | 80   | `any` keyword usage. |
| tests/unit/utils/routeMounts.test.ts                                                | 86   | `any` keyword usage. |
| tests/unit/utils/routeMounts.test.ts                                                | 97   | `any` keyword usage. |
| tests/unit/utils/routesInit.test.ts                                                 | 16   | `any` keyword usage. |
| tests/unit/utils/routesInit.test.ts                                                 | 17   | `any` keyword usage. |
| tests/unit/utils/safeJsonParse.test.ts                                              | 4    | `any` keyword usage. |
| tests/unit/utils/safeJsonParse.test.ts                                              | 5    | `any` keyword usage. |
| tests/unit/utils/safeJsonParse.test.ts                                              | 6    | `any` keyword usage. |
| tests/unit/utils/serverDependencies.test.ts                                         | 34   | `any` keyword usage. |
| tests/unit/utils/serverLifecycle.test.ts                                            | 18   | `any` keyword usage. |
| tests/unit/utils/serverLifecycle.test.ts                                            | 19   | `any` keyword usage. |
| tests/unit/utils/serverStartup.test.ts                                              | 11   | `any` keyword usage. |
| tests/unit/utils/serverStartup.test.ts                                              | 17   | `any` keyword usage. |
| tests/unit/utils/serverStartup.test.ts                                              | 18   | `any` keyword usage. |
| tests/unit/utils/serverStartup.test.ts                                              | 35   | `any` keyword usage. |
| tests/unit/utils/serverStartup.test.ts                                              | 41   | `any` keyword usage. |
| tests/unit/utils/serverStartup.test.ts                                              | 42   | `any` keyword usage. |
| tests/unit/utils/shutdownHandlers.test.ts                                           | 13   | `any` keyword usage. |
| tests/unit/utils/shutdownHandlers.test.ts                                           | 14   | `any` keyword usage. |
| tests/unit/utils/shutdownHandlers.test.ts                                           | 46   | `any` keyword usage. |
| tests/unit/utils/shutdownHandlers.test.ts                                           | 59   | `any` keyword usage. |
| tests/unit/utils/staticSetup.test.ts                                                | 9    | `any` keyword usage. |
| tests/unit/utils/staticSetup.test.ts                                                | 9    | `any` keyword usage. |
| tests/unit/utils/staticSetup.test.ts                                                | 13   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 30   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 33   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 35   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 43   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 44   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 47   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 49   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 58   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 59   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 62   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 64   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 75   | `any` keyword usage. |
| tests/unit/utils/validateSecrets.test.ts                                            | 77   | `any` keyword usage. |
| tests/unit/validation/complexValidators.test.ts                                     | 229  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 32   | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 51   | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 77   | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 99   | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 107  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 112  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 117  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 122  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 126  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 155  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 168  | `any` keyword usage. |
| tests/unit/validation/geospatialSchemas.test.ts                                     | 183  | `any` keyword usage. |
| tests/unit/validation/middleware.test.ts                                            | 27   | `any` keyword usage. |
| tests/unit/validation/middleware.test.ts                                            | 28   | `any` keyword usage. |
| tests/unit/validation/networkSchemas.test.ts                                        | 83   | `any` keyword usage. |
| tests/unit/validation/networkSchemas.test.ts                                        | 100  | `any` keyword usage. |
| tests/unit/validation/networkSchemas.test.ts                                        | 174  | `any` keyword usage. |
| tests/unit/validation/networkSchemas.test.ts                                        | 187  | `any` keyword usage. |
| tests/unit/validation/networkSchemas.test.ts                                        | 200  | `any` keyword usage. |
| tests/unit/validation/networkSchemas.test.ts                                        | 214  | `any` keyword usage. |
| tests/unit/validation/schemas.test.ts                                               | 56   | `any` keyword usage. |
| tests/unit/validation/schemas.test.ts                                               | 87   | `any` keyword usage. |
| tests/unit/validation/schemas.test.ts                                               | 102  | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 34   | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 35   | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 39   | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 40   | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 58   | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 59   | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 105  | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 162  | `any` keyword usage. |
| tests/unit/validation/temporalSchemas.test.ts                                       | 182  | `any` keyword usage. |
| tests/unit/websocket/ssmTerminal.test.ts                                            | 24   | `any` keyword usage. |
| tests/unit/websocket/ssmTerminal.test.ts                                            | 25   | `any` keyword usage. |
| tests/unit/websocket/ssmTerminal.test.ts                                            | 26   | `any` keyword usage. |
| tests/unit/websocket/ssmTerminal.test.ts                                            | 27   | `any` keyword usage. |
| tests/unit/websocket/ssmTerminal.test.ts                                            | 28   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 22   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 22   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 22   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 22   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 28   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 28   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 28   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 29   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 29   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 29   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 29   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 33   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 37   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 38   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 47   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 47   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 47   | `any` keyword usage. |
| tests/unit/wigleDatabase.test.ts                                                    | 47   | `any` keyword usage. |
| tests/unit/wigleImportCompleteness.test.ts                                          | 6    | `any` keyword usage. |
| tests/unit/wigleImportParams.test.ts                                                | 47   | `any` keyword usage. |
| tests/unit/wigleImportParams.test.ts                                                | 48   | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 71   | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 73   | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 80   | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 85   | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 103  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 425  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 427  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 429  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 437  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 489  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 511  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 526  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 559  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 604  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 615  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 699  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 709  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 710  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 711  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 737  | `any` keyword usage. |
| tests/unit/wigleImportRunService.extended.test.ts                                   | 752  | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 66   | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 68   | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 75   | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 80   | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 98   | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 348  | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 352  | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 354  | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 362  | `any` keyword usage. |
| tests/unit/wigleImportRunService.test.ts                                            | 666  | `any` keyword usage. |
| tests/unit/wigleService.test.ts                                                     | 16   | `any` keyword usage. |
| tests/wigle-import-auth.test.ts                                                     | 11   | `any` keyword usage. |
| tests/wigle-import-auth.test.ts                                                     | 12   | `any` keyword usage. |

### Suspicious Type Assertions

| File                                                                          | Line | Detail                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client/src/api/client.ts                                                      | 5    | import.meta as any                                                                                                                                                           |
| client/src/api/client.ts                                                      | 69   | new Error(message) as Error & { status?: number; data?: unknown }                                                                                                            |
| client/src/api/client.ts                                                      | 75   | (data ?? (text as any)) as T                                                                                                                                                 |
| client/src/api/client.ts                                                      | 75   | text as any                                                                                                                                                                  |
| client/src/components/DashboardPage.tsx                                       | 284  | e as any                                                                                                                                                                     |
| client/src/components/WiglePage.tsx                                           | 224  | (v2FCRef.current \|\| EMPTY_FEATURE_COLLECTION) as any                                                                                                                       |
| client/src/components/WiglePage.tsx                                           | 236  | v2FeatureCollection as any                                                                                                                                                   |
| client/src/components/WiglePage.tsx                                           | 253  | (v3FCRef.current \|\| EMPTY_FEATURE_COLLECTION) as any                                                                                                                       |
| client/src/components/WiglePage.tsx                                           | 265  | v3FeatureCollection as any                                                                                                                                                   |
| client/src/components/WiglePage.tsx                                           | 298  | row as any                                                                                                                                                                   |
| client/src/components/WiglePage.tsx                                           | 298  | row as any                                                                                                                                                                   |
| client/src/components/WiglePage.tsx                                           | 298  | row as any                                                                                                                                                                   |
| client/src/components/WiglePage.tsx                                           | 299  | row as any                                                                                                                                                                   |
| client/src/components/WiglePage.tsx                                           | 299  | row as any                                                                                                                                                                   |
| client/src/components/WiglePage.tsx                                           | 403  | (v2FCRef.current \|\| EMPTY_FEATURE_COLLECTION) as any                                                                                                                       |
| client/src/components/WiglePage.tsx                                           | 405  | (v3FCRef.current \|\| EMPTY_FEATURE_COLLECTION) as any                                                                                                                       |
| client/src/components/WiglePage.tsx                                           | 407  | (kmlFCRef.current \|\| EMPTY_FEATURE_COLLECTION) as any                                                                                                                      |
| client/src/components/admin/tabs/ApiTestingTab.tsx                            | 152  | e.target.value as any                                                                                                                                                        |
| client/src/components/admin/tabs/data-import/FileImportButton.tsx             | 43   | { webkitdirectory: 'true', directory: 'true' } as DirectoryInputProps                                                                                                        |
| client/src/components/admin/tabs/jobUtils.ts                                  | 18   | parsedValue as Record<string, unknown>                                                                                                                                       |
| client/src/components/filters/sections/QualityFilters.tsx                     | 103  | e.target.value as any                                                                                                                                                        |
| client/src/components/filters/sections/TimeFilters.tsx                        | 101  | e.target.value as any                                                                                                                                                        |
| client/src/components/geospatial/MapViewport.tsx                              | 40   | mapRef.current as any                                                                                                                                                        |
| client/src/components/geospatial/MapViewport.tsx                              | 40   | mapRef.current as any                                                                                                                                                        |
| client/src/components/geospatial/hooks/useCoreObservationLayers.ts            | 205  | features as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useCoreObservationLayers.ts            | 210  | lineFeatures as any                                                                                                                                                          |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts          | 204  | setFilter as any                                                                                                                                                             |
| client/src/components/geospatial/hooks/useLocationSearch.ts                   | 92   | mapboxgl as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useLocationSearch.ts                   | 95   | mapboxgl as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useMapInitialization.ts                | 46   | mapboxgl as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useMapInitialization.ts                | 47   | 'mapbox-gl/dist/mapbox-gl.css' as any                                                                                                                                        |
| client/src/components/geospatial/hooks/useMapInitialization.ts                | 48   | mapboxgl as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useMapInitialization.ts                | 91   | styleConfig.config as any                                                                                                                                                    |
| client/src/components/geospatial/hooks/useMapInitialization.ts                | 93   | styleConfig.config as any                                                                                                                                                    |
| client/src/components/geospatial/hooks/useMapLayers.ts                        | 90   | { id: 'hover-circle-fill', type: 'fill', source: 'hover-circle', filter: ['==', ['geometry-type'], 'Polygon'], slot: 'middle',                                               |
| client/src/components/geospatial/hooks/useMapLayers.ts                        | 102  | { id: 'hover-circle-outline', type: 'line', source: 'hover-circle', filter: ['==', ['geometry-type'], 'Polygon'], slot: 'middle',                                            |
| client/src/components/geospatial/hooks/useMapLayers.ts                        | 115  | { id: 'hover-circle-radius-line', type: 'line', source: 'hover-circle', filter: ['==', ['geometry-type'], 'LineString'], slot: 'mi                                           |
| client/src/components/geospatial/hooks/useMapLayers.ts                        | 129  | { id: 'hover-circle-label', type: 'symbol', source: 'hover-circle', filter: ['==', ['geometry-type'], 'LineString'], slot: 'top',                                            |
| client/src/components/geospatial/hooks/useMapLayers.ts                        | 291  | feature.properties as Record<string, unknown> \| undefined                                                                                                                   |
| client/src/components/geospatial/hooks/useMapLayers.ts                        | 317  | feature.geometry as any                                                                                                                                                      |
| client/src/components/geospatial/hooks/useMapLayers.ts                        | 318  | feature.geometry as any                                                                                                                                                      |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                  | 61   | style.sources as Record<string, unknown> \| undefined                                                                                                                        |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                  | 159  | { id: '3d-buildings', source: sourceId, 'source-layer': 'building', filter: ['==', 'extrude', 'true'], type: 'fill-extrusion',                                               |
| client/src/components/geospatial/hooks/useMapPopups.ts                        | 32   | feature.geometry as any                                                                                                                                                      |
| client/src/components/geospatial/hooks/useMapPopups.ts                        | 48   | mapboxgl as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                 | 159  | styleConfig.config as any                                                                                                                                                    |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                 | 163  | styleConfig.config as any                                                                                                                                                    |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                 | 239  | { id: 'hover-circle-fill', type: 'fill', source: 'hover-circle', filter: ['==', ['geometry-type'], 'Polygon'], slot: 'middle',                                               |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                 | 251  | { id: 'hover-circle-outline', type: 'line', source: 'hover-circle', filter: ['==', ['geometry-type'], 'Polygon'], slot: 'middle',                                            |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                 | 264  | { id: 'hover-circle-label', type: 'symbol', source: 'hover-circle', filter: ['==', ['geometry-type'], 'Point'], slot: 'top',                                                 |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                 | 464  | features as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                 | 486  | lineFeatures as any                                                                                                                                                          |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts               | 166  | notesResult.value as any                                                                                                                                                     |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts               | 177  | tag as any                                                                                                                                                                   |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts               | 185  | network as any                                                                                                                                                               |
| client/src/components/geospatial/hooks/useWigleLayers.ts                      | 89   | { preventDefault: () => {}, stopPropagation: () => {}, clientX: e.originalEvent.clientX, clientY: e.originalEvent.clientY, pageX:                                            |
| client/src/components/geospatial/hooks/useWigleLayers.ts                      | 133  | mapboxgl as any                                                                                                                                                              |
| client/src/components/geospatial/hooks/useWigleLayers.ts                      | 164  | feature.geometry as any                                                                                                                                                      |
| client/src/components/geospatial/hooks/useWigleLayers.ts                      | 172  | feature.geometry as any                                                                                                                                                      |
| client/src/components/geospatial/hooks/useWigleLayers.ts                      | 287  | features as any                                                                                                                                                              |
| client/src/components/geospatial/networkTable/cellRenderers.tsx               | 61   | { display: 'flex', alignItems: 'center', height: '100%', boxSizing: 'border-box' as CSSProperties['boxSizing'], } as CSSProperties                                           |
| client/src/components/geospatial/networkTable/cellRenderers.tsx               | 74   | { display: 'flex', alignItems: 'center', height: '100%', boxSizing: 'border-box', } as CSSProperties                                                                         |
| client/src/components/geospatial/networkTable/cellRenderers.tsx               | 87   | row.threatReasons as any                                                                                                                                                     |
| client/src/components/geospatial/networkTable/cellRenderers.tsx               | 88   | row.threatEvidence as any                                                                                                                                                    |
| client/src/components/geospatial/table/NetworkTableBodyGrid.tsx               | 79   | NETWORK_TABLE_COLUMN_WIDTHS as any                                                                                                                                           |
| client/src/components/geospatial/table/NetworkTableBodyGrid.tsx               | 103  | NETWORK_TABLE_COLUMN_WIDTHS as any                                                                                                                                           |
| client/src/components/geospatial/table/NetworkTableHeaderGrid.tsx             | 46   | NETWORK_TABLE_COLUMN_WIDTHS as any                                                                                                                                           |
| client/src/components/geospatial/toolbar/MapToolbarActions.tsx                | 133  | mapboxgl as any                                                                                                                                                              |
| client/src/components/hooks/useAgencyOffices.ts                               | 234  | window as any                                                                                                                                                                |
| client/src/components/hooks/useFederalCourthouses.ts                          | 64   | { type: 'FeatureCollection', features: [] } as FederalCourthousesGeoJSON                                                                                                     |
| client/src/components/hooks/useFederalCourthouses.ts                          | 265  | window as any                                                                                                                                                                |
| client/src/components/wigle/eventHandlers.ts                                  | 89   | features[0].geometry as any                                                                                                                                                  |
| client/src/components/wigle/kmlLayers.ts                                      | 105  | fc as any                                                                                                                                                                    |
| client/src/components/wigle/mapHandlers.ts                                    | 31   | props as Record<string, unknown>                                                                                                                                             |
| client/src/components/wigle/mapHandlers.ts                                    | 144  | features[0].geometry as any                                                                                                                                                  |
| client/src/components/wigle/useWigleMapInit.ts                                | 59   | mapboxgl as any                                                                                                                                                              |
| client/src/components/wigle/useWigleMapInit.ts                                | 60   | 'mapbox-gl/dist/mapbox-gl.css' as any                                                                                                                                        |
| client/src/components/wigle/useWigleMapInit.ts                                | 62   | mapboxgl as any                                                                                                                                                              |
| client/src/components/wigle/useWigleMapInit.ts                                | 71   | mapboxgl as any                                                                                                                                                              |
| client/src/components/wigle/useWigleMapInit.ts                                | 79   | mapboxgl as any                                                                                                                                                              |
| client/src/components/wigle/useWigleMapInit.ts                                | 87   | mapboxgl as any                                                                                                                                                              |
| client/src/components/wigle/useWigleMapInit.ts                                | 120  | (v2FCRef.current \|\| EMPTY_FEATURE_COLLECTION) as any                                                                                                                       |
| client/src/components/wigle/useWigleMapInit.ts                                | 122  | (v3FCRef.current \|\| EMPTY_FEATURE_COLLECTION) as any                                                                                                                       |
| client/src/hooks/useKeplerDeck.ts                                             | 70   | object as any                                                                                                                                                                |
| client/src/hooks/useKeplerDeck.ts                                             | 70   | object as any                                                                                                                                                                |
| client/src/hooks/useKeplerDeck.ts                                             | 71   | object as any                                                                                                                                                                |
| client/src/hooks/useNetworkData.ts                                            | 33   | err as { status?: number; message?: string; data?: unknown }                                                                                                                 |
| client/src/hooks/useObservations.ts                                           | 78   | {} as any                                                                                                                                                                    |
| client/src/hooks/useObservations.ts                                           | 83   | observationFilters.enabled as any                                                                                                                                            |
| client/src/utils/filterCapabilities.ts                                        | 56   | filtersForPage as any                                                                                                                                                        |
| client/src/utils/filterUrlState.ts                                            | 24   | JSON.parse(rawFilters) as NetworkFilters                                                                                                                                     |
| client/src/utils/filterUrlState.ts                                            | 25   | JSON.parse(rawEnabled) as Record<string, boolean>                                                                                                                            |
| client/src/utils/geospatial/observationTooltipProps.ts                        | 57   | network as any                                                                                                                                                               |
| client/src/utils/geospatial/renderNetworkTooltip.ts                           | 315  | props as any                                                                                                                                                                 |
| client/src/utils/geospatial/renderNetworkTooltip.ts                           | 316  | props as any                                                                                                                                                                 |
| client/src/utils/geospatial/renderNetworkTooltip.ts                           | 357  | props as any                                                                                                                                                                 |
| client/src/utils/geospatial/renderNetworkTooltip.ts                           | 358  | props as any                                                                                                                                                                 |
| client/src/utils/geospatial/renderNetworkTooltip.ts                           | 360  | props as any                                                                                                                                                                 |
| client/src/utils/geospatial/renderNetworkTooltip.ts                           | 361  | props as any                                                                                                                                                                 |
| client/src/utils/mapHelpers.ts                                                | 142  | freq as any                                                                                                                                                                  |
| client/src/utils/mapOrientationControls.ts                                    | 61   | map as any                                                                                                                                                                   |
| client/src/utils/mapOrientationControls.ts                                    | 98   | map as any                                                                                                                                                                   |
| client/src/utils/mapOrientationControls.ts                                    | 109  | map as any                                                                                                                                                                   |
| client/src/utils/wigle/constants.ts                                           | 9    | { v2: true, v3: false, kml: false, fieldOffices: true, residentAgencies: true, federalCourthouses: true, } as const                                                          |
| client/src/utils/wigle/geojson.ts                                             | 19   | [] as any[]                                                                                                                                                                  |
| client/src/utils/wigle/geojson.ts                                             | 27   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 27   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 28   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 28   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 28   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 35   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 35   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 36   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 36   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 36   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 45   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 46   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 47   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 50   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 53   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 55   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 56   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 58   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 59   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 59   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 60   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 60   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 61   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 63   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 63   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 64   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 65   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 66   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 67   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 68   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 69   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 70   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 71   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 72   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 74   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 75   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 76   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 77   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 78   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 80   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 81   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 83   | ((row as any).observed_at ? 'wigle-v3' : 'wigle-v2') as \| 'wigle-v2' \| 'wigle-v3'                                                                                          |
| client/src/utils/wigle/geojson.ts                                             | 83   | row as any                                                                                                                                                                   |
| client/src/utils/wigle/geojson.ts                                             | 86   | row as any                                                                                                                                                                   |
| server/src/api/routes/v1/admin/adminGeocodingHelpers.ts                       | 120  | entry as Record<string, unknown>                                                                                                                                             |
| server/src/api/routes/v1/admin/aws.ts                                         | 52   | {} as Record<string, number>                                                                                                                                                 |
| server/src/api/routes/v1/admin/import.ts                                      | 438  | (req.files \|\| []) as any[]                                                                                                                                                 |
| server/src/api/routes/v1/backup.ts                                            | 44   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/geospatial.ts                                        | 15   | global as any                                                                                                                                                                |
| server/src/api/routes/v1/geospatial.ts                                        | 18   | global as any                                                                                                                                                                |
| server/src/api/routes/v1/health.ts                                            | 16   | checks as any                                                                                                                                                                |
| server/src/api/routes/v1/health.ts                                            | 18   | checks as any                                                                                                                                                                |
| server/src/api/routes/v1/health.ts                                            | 18   | err as any                                                                                                                                                                   |
| server/src/api/routes/v1/health.ts                                            | 25   | secretsManager as any                                                                                                                                                        |
| server/src/api/routes/v1/health.ts                                            | 33   | secretsManager as any                                                                                                                                                        |
| server/src/api/routes/v1/health.ts                                            | 36   | secretsManager as any                                                                                                                                                        |
| server/src/api/routes/v1/health.ts                                            | 37   | secretsManager as any                                                                                                                                                        |
| server/src/api/routes/v1/health.ts                                            | 51   | checks as any                                                                                                                                                                |
| server/src/api/routes/v1/health.ts                                            | 60   | checks as any                                                                                                                                                                |
| server/src/api/routes/v1/health.ts                                            | 70   | checks as any                                                                                                                                                                |
| server/src/api/routes/v1/misc.ts                                              | 54   | data as any                                                                                                                                                                  |
| server/src/api/routes/v1/misc.ts                                              | 54   | data as any                                                                                                                                                                  |
| server/src/api/routes/v1/misc.ts                                              | 55   | data as any                                                                                                                                                                  |
| server/src/api/routes/v1/networks/manufacturer.ts                             | 94   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/networks/manufacturer.ts                             | 95   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/networks/manufacturer.ts                             | 96   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/networks/observations.ts                             | 186  | bssids as unknown[]                                                                                                                                                          |
| server/src/api/routes/v1/networks/search.ts                                   | 45   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/networks/search.ts                                   | 46   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/networks/tags.ts                                     | 211  | reasonValidation as any                                                                                                                                                      |
| server/src/api/routes/v1/networks/tags.ts                                     | 222  | reasonValidation as any                                                                                                                                                      |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                         | 68   | data as any                                                                                                                                                                  |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                         | 97   | data as any                                                                                                                                                                  |
| server/src/api/routes/v1/wigle/database.ts                                    | 110  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 110  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 111  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 111  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 112  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 131  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 132  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 133  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 134  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 195  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 196  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 197  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 243  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/database.ts                                    | 244  | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/detail.ts                                      | 235  | detailResponse as any                                                                                                                                                        |
| server/src/api/routes/v1/wigle/detail.ts                                      | 239  | detailResponse as any                                                                                                                                                        |
| server/src/api/routes/v1/wigle/detail.ts                                      | 334  | req.files as any                                                                                                                                                             |
| server/src/api/routes/v1/wigle/detail.ts                                      | 338  | req.files as any                                                                                                                                                             |
| server/src/api/routes/v1/wigle/observations.ts                                | 27   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/observations.ts                                | 28   | req as any                                                                                                                                                                   |
| server/src/api/routes/v1/wigle/search.ts                                      | 102  | req.query as any                                                                                                                                                             |
| server/src/api/routes/v2/filteredHandlers.ts                                  | 24   | body as { pageType?: unknown }                                                                                                                                               |
| server/src/api/routes/v2/filteredHandlers.ts                                  | 54   | body as Record<string, unknown>                                                                                                                                              |
| server/src/api/routes/v2/filteredHandlers.ts                                  | 440  | req.body as Record<string, unknown>                                                                                                                                          |
| server/src/api/routes/v2/filteredHelpers.ts                                   | 120  | JSON.parse(value) as T                                                                                                                                                       |
| server/src/api/routes/v2/filteredHelpers.ts                                   | 168  | signalEvidence as Record<string, unknown>                                                                                                                                    |
| server/src/api/routes/v2/filteredHelpers.ts                                   | 169  | signalEvidence as Record<string, unknown>                                                                                                                                    |
| server/src/api/routes/v2/filteredHelpers.ts                                   | 170  | signalEvidence as Record<string, unknown>                                                                                                                                    |
| server/src/config/routeConfig.ts                                              | 7    | { maxPageSize: CONFIG.MAX_PAGE_SIZE, minValidTimestamp: CONFIG.MIN_VALID_TIMESTAMP, filteredDefaultLimit: 500, geospatialDefaultLimit: 5000, geospatialMaxLimit: 500000,     |
| server/src/config/routeConfig.ts                                              | 18   | { critical: '80-100', high: '60-79', medium: '40-59', low: '20-39', none: '0-19', } as const                                                                                 |
| server/src/config/routeConfig.ts                                              | 25   | { defaultLimit: 500, maxLimit: 5000, maxOffset: 1000000, maxPage: 1000000, } as const                                                                                        |
| server/src/config/routeConfig.ts                                              | 31   | { maxLimit: 1000, maxOffset: 10000000, maxObservationCount: 100000000, maxBulkBssids: 10000, } as const                                                                      |
| server/src/core/initialization/databaseInit.ts                                | 27   | client as unknown as { host: string; port: number }                                                                                                                          |
| server/src/core/initialization/databaseInit.ts                                | 27   | client as unknown                                                                                                                                                            |
| server/src/core/initialization/databaseInit.ts                                | 27   | client as unknown as { host: string; port: number }                                                                                                                          |
| server/src/core/initialization/databaseInit.ts                                | 27   | client as unknown                                                                                                                                                            |
| server/src/errors/AppError.ts                                                 | 335  | this.originalError as any                                                                                                                                                    |
| server/src/errors/AppError.ts                                                 | 362  | error as any                                                                                                                                                                 |
| server/src/errors/errorHandler.ts                                             | 154  | this.error.toJSON(includeStack) as ReturnType<AppError['toJSON']> & { error: { data?: Record<string, unknown> }; }                                                           |
| server/src/logging/logger.ts                                                  | 121  | logger as any                                                                                                                                                                |
| server/src/repositories/baseRepository.ts                                     | 94   | options as any                                                                                                                                                               |
| server/src/repositories/jobRunRepository.ts                                   | 158  | {} as Record<string, any>                                                                                                                                                    |
| server/src/repositories/networkRepository.ts                                  | 34   | filters as any                                                                                                                                                               |
| server/src/repositories/networkRepository.ts                                  | 35   | filters as any                                                                                                                                                               |
| server/src/services/awsService.ts                                             | 52   | JSON.parse(identityDocument) as { region?: unknown }                                                                                                                         |
| server/src/services/backgroundJobs/config.ts                                  | 7    | { backup: 'backup_job_config', mlScoring: 'ml_scoring_job_config', mvRefresh: 'mv_refresh_job_config', siblingDetection: 'sibling_detection_job_config', } as const          |
| server/src/services/backupService.ts                                          | 328  | (await uploadBackupToS3( getConfiguredS3BackupBucket(), dbFilePath, dbFileName, source )) as any                                                                             |
| server/src/services/backupService.ts                                          | 337  | (await uploadBackupToS3( getConfiguredS3BackupBucket(), globalsFilePath, globalsFileName, source )) as any                                                                   |
| server/src/services/backupService.ts                                          | 452  | (await uploadBackupToS3( getConfiguredS3BackupBucket(), dbFilePath, dbFileName, source )) as any                                                                             |
| server/src/services/backupService.ts                                          | 461  | (await uploadBackupToS3( getConfiguredS3BackupBucket(), globalsFilePath, globalsFileName, source )) as any                                                                   |
| server/src/services/externalServiceHandler.ts                                 | 34   | options as any                                                                                                                                                               |
| server/src/services/filterQueryBuilder/SchemaCompat.ts                        | 1    | { network: 'ne', observation: 'o', networkTags: 'nt', manufacturer: 'rm', } as const                                                                                         |
| server/src/services/filterQueryBuilder/SchemaCompat.ts                        | 8    | { networkBssid: (alias: string = SCHEMA_ALIASES.network) => `UPPER(${alias}.bssid)`, manufacturerName: (alias: string = SCHEMA_ALIASES.manufacturer) => `COALESCE(to_jsonb($ |
| server/src/services/filterQueryBuilder/SchemaCompat.ts                        | 24   | { isIgnored: (alias: string = SCHEMA_ALIASES.networkTags) => `COALESCE((to_jsonb(${alias})->>'is_ignored')::boolean, FALSE)`, } as const                                     |
| server/src/services/filterQueryBuilder/constants.ts                           | 78   | {} as Record<FilterKey, boolean>                                                                                                                                             |
| server/src/services/filterQueryBuilder/modules/GeospatialModule.ts            | 17   | this.ctx.context as any                                                                                                                                                      |
| server/src/services/filterQueryBuilder/modules/NetworkModule.ts               | 26   | this.ctx.context as any                                                                                                                                                      |
| server/src/services/filterQueryBuilder/modules/NetworkModule.ts               | 68   | this.ctx.context as any                                                                                                                                                      |
| server/src/services/filterQueryBuilder/modules/ObservationModule.ts           | 55   | this.ctx.getParams() as any[]                                                                                                                                                |
| server/src/services/filterQueryBuilder/modules/networkFastPathCountBuilder.ts | 29   | ctx.getParams() as any[]                                                                                                                                                     |
| server/src/services/filterQueryBuilder/modules/networkFastPathListBuilder.ts  | 133  | ctx.getParams() as any[]                                                                                                                                                     |
| server/src/services/filterQueryBuilder/modules/networkMetricsBuilder.ts       | 101  | ctx.getParams() as any[]                                                                                                                                                     |
| server/src/services/filterQueryBuilder/modules/networkMetricsBuilder.ts       | 169  | ctx.getParams() as any[]                                                                                                                                                     |
| server/src/services/filterQueryBuilder/modules/networkNoFilterBuilder.ts      | 112  | ctx.getParams() as any[]                                                                                                                                                     |
| server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts      | 163  | ctx.getParams() as any[]                                                                                                                                                     |
| server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts      | 202  | ctx.getParams() as any[]                                                                                                                                                     |
| server/src/services/filterQueryBuilder/normalizers.ts                         | 31   | enabled as Record<string, unknown>                                                                                                                                           |
| server/src/services/filterQueryBuilder/normalizers.ts                         | 186  | filters as Record<string, unknown>                                                                                                                                           |
| server/src/services/filterQueryBuilder/normalizers.ts                         | 187  | { ...source } as Filters                                                                                                                                                     |
| server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts         | 45   | context as any                                                                                                                                                               |
| server/src/services/geocoding/daemonState.ts                                  | 29   | JSON.parse(row.value) as GeocodeDaemonConfig                                                                                                                                 |
| server/src/services/ml/modelScoring.ts                                        | 11   | { distance_range_km: { min: 0, max: 9.29 }, unique_days: { min: 1, max: 222 }, observation_count: { min: 1, max: 2260 }, max_signal: { min: -149, max: 127 }, unique_locat   |
| server/src/services/networkListService.ts                                     | 65   | searchNetworksBySSID(searchPattern, limit, offset) as Promise<{ rows: any[]; total: number; }>                                                                               |
| server/src/services/ouiGroupingService.ts                                     | 66   | group as any                                                                                                                                                                 |
| server/src/services/ouiGroupingService.ts                                     | 71   | group as any                                                                                                                                                                 |
| server/src/services/ouiGroupingService.ts                                     | 99   | group as any                                                                                                                                                                 |
| server/src/services/ouiGroupingService.ts                                     | 102  | group as any                                                                                                                                                                 |
| server/src/services/ouiGroupingService.ts                                     | 103  | group as any                                                                                                                                                                 |
| server/src/services/ouiGroupingService.ts                                     | 161  | new Date(row.last_seen) as any                                                                                                                                               |
| server/src/services/ouiGroupingService.ts                                     | 161  | new Date(row.first_seen) as any                                                                                                                                              |
| server/src/services/pgadmin/control.ts                                        | 58   | err as any                                                                                                                                                                   |
| server/src/services/reports/threatReportRenderers.ts                          | 182  | err as any                                                                                                                                                                   |
| server/src/services/wigleEnrichmentService.ts                                 | 19   | container as any                                                                                                                                                             |
| server/src/services/wigleEnrichmentService.ts                                 | 246  | (await response.json()) as any                                                                                                                                               |
| server/src/services/wigleEnrichmentService.ts                                 | 454  | (await response.json()) as any                                                                                                                                               |
| server/src/services/wigleImport/params.ts                                     | 39   | value as Record<string, unknown>                                                                                                                                             |
| server/src/services/wigleImportService.ts                                     | 63   | err as any                                                                                                                                                                   |
| server/src/services/wigleImportService.ts                                     | 96   | err as any                                                                                                                                                                   |
| server/src/validation/middleware.ts                                           | 20   | validator as any                                                                                                                                                             |
| server/src/validation/middleware.ts                                           | 38   | req as any                                                                                                                                                                   |
| server/src/validation/middleware.ts                                           | 40   | validator as any                                                                                                                                                             |
| server/src/validation/middleware.ts                                           | 43   | req as any                                                                                                                                                                   |
| server/src/validation/middleware.ts                                           | 81   | validator as any                                                                                                                                                             |
| server/src/validation/middleware.ts                                           | 101  | validator as any                                                                                                                                                             |
| server/src/validation/middleware.ts                                           | 122  | validator as any                                                                                                                                                             |
| server/src/validation/middleware.ts                                           | 142  | validator as any                                                                                                                                                             |
| server/src/validation/schemas/commonSchemas.ts                                | 340  | obj as Record<string, unknown>                                                                                                                                               |

### Interfaces / Types Defined But Never Referenced

| File                                          | Line | Detail                                                                                 |
| --------------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| client/src/components/KeplerPage.tsx          | 17   | Interface `Window` has no detected references beyond its declaration.                  |
| client/src/types/filters.ts                   | 165  | Interface `FilterQuery` has no detected references beyond its declaration.             |
| client/src/types/filters.ts                   | 174  | Interface `NetworkWithThreat` has no detected references beyond its declaration.       |
| client/src/types/network.ts                   | 116  | Type `ContextMenuState` has no detected references beyond its declaration.             |
| client/src/types/network.ts                   | 130  | Type `NetworkType` has no detected references beyond its declaration.                  |
| client/src/utils/mapboxLoader.ts              | 10   | Interface `Window` has no detected references beyond its declaration.                  |
| client/src/vite-env.d.ts                      | 8    | Interface `ImportMeta` has no detected references beyond its declaration.              |
| server/src/api/routes/v2/filteredHelpers.ts   | 42   | Interface `QueryResult` has no detected references beyond its declaration.             |
| server/src/services/wigleEnrichmentService.ts | 28   | Interface `WigleV3DetailResponse` has no detected references beyond its declaration.   |
| server/src/types/express.d.ts                 | 3    | Interface `Request` augmentation has no direct references outside declaration merging. |
| server/src/utils/routeMounts.ts               | 9    | Type `QueryFunction` has no detected references beyond its declaration.                |

### Redundant Type Re-Exports

| File                                               | Line | Detail                                                                                               |
| -------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| client/src/components/filter/index.ts              | 6    | Type-only barrel re-export `FilterSectionProps` / `FilterInputProps` is unused anywhere in the repo. |
| client/src/components/admin/hooks/useApiTesting.ts | 5    | Type-only barrel re-export `ApiInput` / `ApiPreset` is unused anywhere in the repo.                  |

## Phase 5 — Structural / Architectural Smell

### Files Over 300 Lines

| File                                                                                    | Line | Detail     |
| --------------------------------------------------------------------------------------- | ---- | ---------- |
| client/src/components/WiglePage.tsx                                                     | 1    | 763 lines. |
| client/src/components/admin/tabs/WigleSearchTab.tsx                                     | 1    | 703 lines. |
| client/src/components/admin/tabs/ConfigurationTab.tsx                                   | 1    | 692 lines. |
| client/src/components/admin/tabs/WigleDetailTab.tsx                                     | 1    | 659 lines. |
| client/src/components/geospatial/networkTable/cellRenderers.tsx                         | 1    | 643 lines. |
| server/src/api/routes/v1/admin/import.ts                                                | 1    | 605 lines. |
| client/src/stores/filterStore.ts                                                        | 1    | 586 lines. |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                         | 1    | 567 lines. |
| server/src/services/wigleService.ts                                                     | 1    | 561 lines. |
| client/src/components/analytics/components/AnalyticsCharts.tsx                          | 1    | 543 lines. |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                     | 1    | 521 lines. |
| server/src/api/routes/v2/filteredHandlers.ts                                            | 1    | 511 lines. |
| client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx               | 1    | 509 lines. |
| server/src/services/backupService.ts                                                    | 1    | 502 lines. |
| server/src/services/geocoding/cacheStore.ts                                             | 1    | 497 lines. |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                           | 1    | 495 lines. |
| client/src/components/geospatial/modals/NetworkNoteModal.tsx                            | 1    | 490 lines. |
| client/src/components/admin/hooks/useConfiguration.ts                                   | 1    | 485 lines. |
| server/src/services/wigleEnrichmentService.ts                                           | 1    | 482 lines. |
| server/src/api/routes/v1/wigle/detail.ts                                                | 1    | 477 lines. |
| client/src/constants/network.ts                                                         | 1    | 462 lines. |
| server/src/validation/schemas/commonSchemas.ts                                          | 1    | 459 lines. |
| client/src/components/admin/hooks/apiTestingPresets.ts                                  | 1    | 458 lines. |
| server/src/services/geocodingCacheService.ts                                            | 1    | 450 lines. |
| server/src/validation/schemas/complexValidators.ts                                      | 1    | 448 lines. |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                    | 1    | 447 lines. |
| server/src/services/wigleImport/runRepository.ts                                        | 1    | 447 lines. |
| server/src/repositories/wigleQueriesRepository.ts                                       | 1    | 427 lines. |
| client/src/components/modals/NetworkTimeFrequencyModal.tsx                              | 1    | 426 lines. |
| client/src/api/adminApi.ts                                                              | 1    | 421 lines. |
| server/src/api/routes/v1/wigle/search.ts                                                | 1    | 419 lines. |
| server/src/api/routes/v1/networks/list.ts                                               | 1    | 418 lines. |
| server/src/errors/AppError.ts                                                           | 1    | 418 lines. |
| client/src/components/DashboardPage.tsx                                                 | 1    | 407 lines. |
| server/src/validation/schemas/networkSchemas.ts                                         | 1    | 397 lines. |
| client/src/components/AdminPage.tsx                                                     | 1    | 396 lines. |
| client/src/components/admin/tabs/DbStatsTab.tsx                                         | 1    | 392 lines. |
| server/src/api/routes/v1/admin/oui.ts                                                   | 1    | 390 lines. |
| server/src/validation/middleware.ts                                                     | 1    | 387 lines. |
| client/src/components/StartPage.tsx                                                     | 1    | 383 lines. |
| client/src/components/geospatial/hooks/useMapLayers.ts                                  | 1    | 367 lines. |
| server/src/repositories/threatRepository.ts                                             | 1    | 366 lines. |
| server/src/services/adminOrphanNetworksService.ts                                       | 1    | 366 lines. |
| server/src/services/secretsManager.ts                                                   | 1    | 361 lines. |
| client/src/components/admin/components/WigleRunsCard.tsx                                | 1    | 360 lines. |
| server/src/api/routes/v2/filteredHelpers.ts                                             | 1    | 343 lines. |
| server/src/validation/schemas/geospatialSchemas.ts                                      | 1    | 343 lines. |
| client/src/components/geospatial/hooks/useWigleLayers.ts                                | 1    | 342 lines. |
| server/src/services/backgroundJobsService.ts                                            | 1    | 341 lines. |
| server/src/services/wigleImportRunService.ts                                            | 1    | 341 lines. |
| client/src/components/admin/tabs/data-import/OrphanNetworksPanel.tsx                    | 1    | 340 lines. |
| client/src/hooks/useKeplerDeck.ts                                                       | 1    | 339 lines. |
| server/src/services/v2Service.ts                                                        | 1    | 334 lines. |
| client/src/components/admin/types/admin.types.ts                                        | 1    | 333 lines. |
| client/src/components/hooks/useFederalCourthouses.ts                                    | 1    | 330 lines. |
| client/src/components/admin/tabs/WigleStatsTab.tsx                                      | 1    | 329 lines. |
| client/src/components/hooks/useAgencyOffices.ts                                         | 1    | 320 lines. |
| server/src/services/filterQueryBuilder/modules/networkFastPathSupplementalPredicates.ts | 1    | 309 lines. |
| server/src/services/exportService.ts                                                    | 1    | 306 lines. |
| server/src/services/threatScoringService.ts                                             | 1    | 306 lines. |

### Functions Over 50 Lines

| File                                                                                    | Line | Detail                                                        |
| --------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| client/src/components/WiglePage.tsx                                                     | 27   | `WiglePage` spans 734 lines.                                  |
| client/src/components/admin/tabs/WigleSearchTab.tsx                                     | 74   | `WigleSearchTab` spans 629 lines.                             |
| client/src/components/admin/tabs/WigleDetailTab.tsx                                     | 46   | `WigleDetailTab` spans 613 lines.                             |
| client/src/components/admin/tabs/ConfigurationTab.tsx                                   | 165  | `ConfigurationTab` spans 525 lines.                           |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                         | 67   | `useNetworkContextMenu` spans 500 lines.                      |
| client/src/components/admin/tabs/data-import/V3EnrichmentManagerTable.tsx               | 28   | `V3EnrichmentManagerTable` spans 481 lines.                   |
| client/src/components/geospatial/modals/NetworkNoteModal.tsx                            | 26   | `NetworkNoteModal` spans 464 lines.                           |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                           | 33   | `useMapStyleControls` spans 462 lines.                        |
| client/src/components/admin/hooks/useConfiguration.ts                                   | 42   | `useConfiguration` spans 443 lines.                           |
| client/src/components/analytics/components/AnalyticsCharts.tsx                          | 99   | `AnalyticsCharts` spans 442 lines.                            |
| client/src/components/modals/NetworkTimeFrequencyModal.tsx                              | 15   | `NetworkTimeFrequencyModal` spans 409 lines.                  |
| client/src/components/geospatial/hooks/useGeospatialExplorerState.ts                    | 59   | `useGeospatialExplorerState` spans 388 lines.                 |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                           | 105  | `changeMapStyle` spans 387 lines.                             |
| client/src/components/DashboardPage.tsx                                                 | 25   | `DashboardPage` spans 382 lines.                              |
| server/src/api/routes/v2/filteredHandlers.ts                                            | 162  | `createHandlers` spans 347 lines.                             |
| client/src/components/geospatial/hooks/useMapLayers.ts                                  | 26   | `useMapLayers` spans 341 lines.                               |
| client/src/components/admin/tabs/data-import/OrphanNetworksPanel.tsx                    | 15   | `OrphanNetworksPanel` spans 325 lines.                        |
| client/src/utils/geospatial/renderNetworkTooltip.ts                                     | 205  | `renderNetworkTooltip` spans 316 lines.                       |
| server/src/services/secretsManager.ts                                                   | 46   | `SecretsManager` spans 312 lines.                             |
| client/src/components/admin/tabs/DbStatsTab.tsx                                         | 89   | `DbStatsTab` spans 303 lines.                                 |
| server/src/services/backgroundJobsService.ts                                            | 34   | `BackgroundJobsService` spans 303 lines.                      |
| server/src/services/filterQueryBuilder/modules/networkFastPathSupplementalPredicates.ts | 6    | `buildFastPathSupplementalPredicates` spans 303 lines.        |
| client/src/hooks/useKeplerDeck.ts                                                       | 37   | `useKeplerDeck` spans 302 lines.                              |
| client/src/components/geospatial/hooks/useWigleLayers.ts                                | 55   | `useWigleLayers` spans 287 lines.                             |
| client/src/components/admin/tabs/geocoding/GeocodingRunsCard.tsx                        | 13   | `GeocodingRunsCard` spans 284 lines.                          |
| client/src/components/StartPage.tsx                                                     | 104  | `StartPage` spans 279 lines.                                  |
| client/src/components/admin/components/WigleRunsCard.tsx                                | 83   | `WigleRunsCard` spans 277 lines.                              |
| client/src/components/hooks/useFederalCourthouses.ts                                    | 42   | `useFederalCourthouses` spans 275 lines.                      |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                            | 10   | `useMapLayersToggle` spans 274 lines.                         |
| client/src/components/admin/tabs/AwsTab.tsx                                             | 21   | `AwsTab` spans 271 lines.                                     |
| client/src/components/Navigation.tsx                                                    | 5    | `Navigation` spans 267 lines.                                 |
| client/src/components/admin/tabs/UsersTab.tsx                                           | 25   | `UsersTab` spans 261 lines.                                   |
| client/src/components/filters/sections/ThreatFilters.tsx                                | 20   | `ThreatFilters` spans 254 lines.                              |
| client/src/components/admin/tabs/WigleStatsTab.tsx                                      | 83   | `WigleStatsTab` spans 246 lines.                              |
| client/src/components/GeospatialExplorer.tsx                                            | 22   | `GeospatialExplorer` spans 245 lines.                         |
| client/src/components/hooks/useAgencyOffices.ts                                         | 47   | `useAgencyOffices` spans 244 lines.                           |
| client/src/components/admin/hooks/useWigleSearch.ts                                     | 11   | `useWigleSearch` spans 242 lines.                             |
| server/src/services/mobileIngestService.ts                                              | 33   | `MobileIngestService` spans 241 lines.                        |
| client/src/components/admin/tabs/geocoding/GeocodingDaemonCard.tsx                      | 9    | `GeocodingDaemonCard` spans 233 lines.                        |
| client/src/components/admin/tabs/GeocodingTab.tsx                                       | 9    | `GeocodingTab` spans 227 lines.                               |
| client/src/components/admin/tabs/PgAdminTab.tsx                                         | 37   | `PgAdminTab` spans 224 lines.                                 |
| client/src/components/geospatial/table/NetworkTableHeaderGrid.tsx                       | 30   | `NetworkTableHeaderGrid` spans 218 lines.                     |
| server/src/services/backupService.ts                                                    | 259  | `runPostgresBackup` spans 218 lines.                          |
| client/src/components/admin/tabs/BackupsTab.tsx                                         | 49   | `BackupsTab` spans 214 lines.                                 |
| server/src/repositories/networkRepository.ts                                            | 15   | `NetworkRepository` spans 214 lines.                          |
| client/src/components/KeplerPage.tsx                                                    | 23   | `KeplerPage` spans 213 lines.                                 |
| client/src/components/geospatial/panels/NetworkExplorerHeader.tsx                       | 23   | `NetworkExplorerHeader` spans 212 lines.                      |
| client/src/components/FilterPanel.tsx                                                   | 30   | `FilterPanel` spans 210 lines.                                |
| client/src/components/geospatial/panels/WigleObservationsPanel.tsx                      | 26   | `WigleObservationsPanel` spans 210 lines.                     |
| server/src/services/geocodingCacheService.ts                                            | 65   | `runGeocodeCacheUpdateInternal` spans 206 lines.              |
| server/src/services/ouiGroupingService.ts                                               | 6    | `OUIGroupingService` spans 203 lines.                         |
| client/src/components/geospatial/toolbar/MapToolbarNav.tsx                              | 14   | `MapToolbarNav` spans 202 lines.                              |
| client/src/components/geospatial/hooks/useCoreObservationLayers.ts                      | 40   | `useCoreObservationLayers` spans 198 lines.                   |
| client/src/components/geospatial/table/NetworkTableBodyGrid.tsx                         | 31   | `NetworkTableBodyGrid` spans 193 lines.                       |
| client/src/hooks/useNetworkData.ts                                                      | 53   | `useNetworkData` spans 190 lines.                             |
| server/src/services/filterQueryBuilder/networkWhereBuilder.ts                           | 7    | `buildNetworkWhere` spans 190 lines.                          |
| client/src/components/analytics/components/AnalyticsLayout.tsx                          | 30   | `AnalyticsLayout` spans 189 lines.                            |
| client/src/components/geospatial/toolbar/MapToolbar.tsx                                 | 101  | `MapToolbar` spans 189 lines.                                 |
| client/src/components/wigle/mapHandlers.ts                                              | 17   | `attachClickHandlers` spans 188 lines.                        |
| server/src/services/authService.ts                                                      | 24   | `AuthService` spans 188 lines.                                |
| client/src/components/auth/ChangePasswordForm.tsx                                       | 12   | `ChangePasswordForm` spans 185 lines.                         |
| client/src/components/filters/sections/GeocodingFilters.tsx                             | 18   | `GeocodingFilters` spans 183 lines.                           |
| client/src/components/analytics/hooks/useCardLayout.ts                                  | 34   | `useCardLayout` spans 174 lines.                              |
| client/src/components/geospatial/hooks/useSummaryLayers.ts                              | 22   | `useSummaryLayers` spans 174 lines.                           |
| client/src/components/filters/sections/SpatialFilters.tsx                               | 21   | `SpatialFilters` spans 173 lines.                             |
| client/src/components/geospatial/hooks/useNetworkNotes.ts                               | 8    | `useNetworkNotes` spans 172 lines.                            |
| client/src/components/kepler/KeplerControls.tsx                                         | 28   | `KeplerControls` spans 170 lines.                             |
| client/src/components/admin/tabs/ApiTestingTab.tsx                                      | 52   | `ApiTestingTab` spans 169 lines.                              |
| server/src/websocket/ssmTerminal.ts                                                     | 60   | `initializeSsmWebSocket` spans 169 lines.                     |
| server/src/repositories/baseRepository.ts                                               | 28   | `BaseRepository` spans 168 lines.                             |
| client/src/components/admin/hooks/useGeocodingCache.ts                                  | 22   | `useGeocodingCache` spans 167 lines.                          |
| client/src/components/dashboard/cardDefinitions.ts                                      | 11   | `createInitialCards` spans 167 lines.                         |
| client/src/components/WigleControlPanel.tsx                                             | 25   | `WigleControlPanel` spans 167 lines.                          |
| client/src/components/hooks/useFederalCourthouses.ts                                    | 80   | `addSourceAndLayers` spans 165 lines.                         |
| client/src/components/admin/tabs/JobsTab.tsx                                            | 46   | `JobsTab` spans 164 lines.                                    |
| client/src/components/admin/components/ObservationsCard.tsx                             | 27   | `ObservationsCard` spans 158 lines.                           |
| client/src/components/admin/hooks/useApiTesting.ts                                      | 7    | `useApiTesting` spans 154 lines.                              |
| server/src/services/networking/filterBuilders/textRangeFilters.ts                       | 9    | `applyTextAndRangeFilters` spans 154 lines.                   |
| server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts                | 17   | `buildNetworkSlowPathListQuery` spans 152 lines.              |
| client/src/hooks/useObservations.ts                                                     | 22   | `useObservations` spans 151 lines.                            |
| client/src/components/wigle/useWigleMapInit.ts                                          | 30   | `useWigleMapInit` spans 147 lines.                            |
| client/src/components/AdminPage.tsx                                                     | 249  | `AdminPage` spans 145 lines.                                  |
| server/src/services/threatReportService.ts                                              | 12   | `getThreatReportData` spans 145 lines.                        |
| server/src/services/admin/dataQualityAdminService.ts                                    | 21   | `DataQualityAdminService` spans 144 lines.                    |
| server/src/services/filterQueryBuilder/FilterBuildContext.ts                            | 24   | `FilterBuildContext` spans 144 lines.                         |
| client/src/components/filters/sections/RadioFilters.tsx                                 | 20   | `RadioFilters` spans 143 lines.                               |
| server/src/services/geocoding/cacheStore.ts                                             | 85   | `upsertGeocodeCacheBatch` spans 143 lines.                    |
| client/src/components/admin/components/SsmTerminal.tsx                                  | 20   | `SsmTerminal` spans 140 lines.                                |
| client/src/components/NetworkContextMenu.tsx                                            | 11   | `NetworkContextMenu` spans 140 lines.                         |
| client/src/components/admin/tabs/data-import/ObservationsPanel.tsx                      | 11   | `ObservationsPanel` spans 138 lines.                          |
| client/src/components/geospatial/table/NetworkTableRow.tsx                              | 32   | `NetworkTableRowComponent` spans 138 lines.                   |
| client/src/components/hooks/useAgencyOffices.ts                                         | 72   | `addSourceAndLayers` spans 137 lines.                         |
| server/src/services/filteredAnalyticsService.ts                                         | 58   | `getFilteredAnalytics` spans 137 lines.                       |
| server/src/services/filterQueryBuilder/modules/observationSecurityTemporalPredicates.ts | 6    | `buildObservationSecurityTemporalPredicates` spans 137 lines. |
| server/src/utils/routeMounts.ts                                                         | 57   | `mountApiRoutes` spans 137 lines.                             |
| server/src/api/routes/v1/wigle/detail.ts                                                | 169  | `handleWigleDetailRequest` spans 135 lines.                   |
| server/src/validation/schemas/complexValidators.ts                                      | 313  | `validateFilters` spans 135 lines.                            |
| client/src/utils/geospatial/tooltipDataNormalizer.ts                                    | 78   | `normalizeTooltipData` spans 134 lines.                       |
| server/src/services/threatScoringService.ts                                             | 148  | `ThreatScoringService` spans 134 lines.                       |
| client/src/components/geospatial/toolbar/MapToolbarSearch.tsx                           | 20   | `MapToolbarSearch` spans 132 lines.                           |
| server/src/services/geocoding/daemonRuntime.ts                                          | 78   | `runGeocodeDaemonLoop` spans 131 lines.                       |
| server/src/repositories/threatRepository.ts                                             | 230  | `createThreatRepository` spans 130 lines.                     |
| server/src/services/filterQueryBuilder/SqlFragmentLibrary.ts                            | 8    | `SqlFragmentLibrary` spans 130 lines.                         |
| client/src/components/admin/hooks/useDataImport.ts                                      | 5    | `useDataImport` spans 129 lines.                              |
| client/src/components/admin/tabs/DataExportTab.tsx                                      | 20   | `DataExportTab` spans 129 lines.                              |
| client/src/components/filters/sections/EngagementFilters.tsx                            | 19   | `EngagementFilters` spans 129 lines.                          |
| client/src/components/geospatial/hooks/useSiblingLinks.ts                               | 12   | `useSiblingLinks` spans 129 lines.                            |
| server/src/services/adminOrphanNetworksService.ts                                       | 232  | `backfillOrphanNetworkFromWigle` spans 128 lines.             |
| client/src/components/filters/sections/TimeFilters.tsx                                  | 31   | `TimeFilters` spans 127 lines.                                |
| server/src/services/wigleService.ts                                                     | 99   | `getWiglePageNetwork` spans 127 lines.                        |
| client/src/components/geospatial/toolbar/MapToolbarActions.tsx                          | 57   | `MapToolbarActions` spans 126 lines.                          |
| client/src/components/geospatial/overlays/GeospatialOverlayContent.tsx                  | 52   | `GeospatialOverlayContentComponent` spans 125 lines.          |
| client/src/hooks/useFilteredData.ts                                                     | 45   | `useFilteredData` spans 124 lines.                            |
| server/src/api/routes/v2/filteredHandlers.ts                                            | 166  | `list` spans 124 lines.                                       |
| client/src/components/DashboardPage.tsx                                                 | 158  | `renderCard` spans 122 lines.                                 |
| client/src/components/admin/tabs/geocoding/GeocodingStatsCard.tsx                       | 19   | `GeocodingStatsCard` spans 119 lines.                         |
| server/src/services/explorerQueries.ts                                                  | 110  | `buildExplorerV2Query` spans 118 lines.                       |
| server/src/services/wigleImportRunService.ts                                            | 82   | `executeImportLoop` spans 117 lines.                          |
| client/src/components/contextMenu/NetworkContextNoteModal.tsx                           | 18   | `NetworkContextNoteModal` spans 116 lines.                    |
| server/src/services/wigleEnrichmentService.ts                                           | 60   | `getEnrichmentCatalog` spans 116 lines.                       |
| client/src/utils/geospatial/setupPopupDrag.ts                                           | 32   | `setupPopupDrag` spans 114 lines.                             |
| client/src/components/geospatial/hooks/useLocationSearch.ts                             | 19   | `useLocationSearch` spans 113 lines.                          |
| client/src/hooks/useAuth.tsx                                                            | 48   | `AuthProvider` spans 113 lines.                               |
| server/src/api/routes/v2/filteredHelpers.ts                                             | 200  | `buildOrderBy` spans 113 lines.                               |
| client/src/components/wigle/mapHandlers.ts                                              | 24   | `handleUnclustered` spans 112 lines.                          |
| client/src/components/wigle/useWigleMapInit.ts                                          | 56   | `initMap` spans 112 lines.                                    |
| server/src/services/networking/queryParts.ts                                            | 21   | `buildNetworkQueryParts` spans 111 lines.                     |
| client/src/components/admin/hooks/useConfiguration.ts                                   | 276  | `loadMaskedConfig` spans 110 lines.                           |
| client/src/components/geospatial/panels/NetworkExplorerSection.tsx                      | 59   | `NetworkExplorerSection` spans 110 lines.                     |
| client/src/hooks/useNetworkData.ts                                                      | 112  | `fetchNetworks` spans 109 lines.                              |
| client/src/components/geospatial/toolbar/MapToolbarDropdowns.tsx                        | 17   | `LayersDropdown` spans 107 lines.                             |
| client/src/utils/networkFilterParams.ts                                                 | 32   | `appendNetworkFilterParams` spans 107 lines.                  |
| server/src/services/filterQueryBuilder/universalFilterQueryBuilder.ts                   | 28   | `UniversalFilterQueryBuilder` spans 107 lines.                |
| client/src/api/client.ts                                                                | 11   | `ApiClient` spans 106 lines.                                  |
| client/src/hooks/useObservations.ts                                                     | 52   | `fetchObservations` spans 106 lines.                          |
| client/src/components/filters/sections/ActivityFilters.tsx                              | 18   | `ActivityFilters` spans 105 lines.                            |
| client/src/components/filters/sections/QualityFilters.tsx                               | 18   | `QualityFilters` spans 105 lines.                             |
| client/src/utils/geospatial/setupPopupPin.ts                                            | 22   | `setupPopupPin` spans 105 lines.                              |
| client/src/components/geospatial/panels/NearestAgenciesPanel.tsx                        | 11   | `NearestAgenciesPanel` spans 104 lines.                       |
| server/src/services/explorerQueries.ts                                                  | 5    | `buildLegacyExplorerQuery` spans 104 lines.                   |
| server/src/api/routes/v1/keplerHelpers.ts                                               | 101  | `inferRadioType` spans 103 lines.                             |
| server/src/services/geocoding/cacheStore.ts                                             | 351  | `loadCacheStats` spans 102 lines.                             |
| client/src/components/admin/tabs/JobRunHistory.tsx                                      | 5    | `JobRunHistory` spans 101 lines.                              |
| client/src/components/auth/LoginForm.tsx                                                | 10   | `LoginForm` spans 101 lines.                                  |
| server/src/services/adminDbStatsService.ts                                              | 9    | `getDetailedDatabaseStats` spans 101 lines.                   |
| server/src/services/filterQueryBuilder/modules/networkNoFilterBuilder.ts                | 17   | `buildNetworkNoFilterListQuery` spans 101 lines.              |
| server/src/api/routes/v1/explorer/shared.ts                                             | 70   | `inferRadioType` spans 100 lines.                             |
| client/src/utils/networkDataTransformation.ts                                           | 87   | `mapApiRowToNetwork` spans 99 lines.                          |
| client/src/components/admin/components/SourceTagInput.tsx                               | 17   | `SourceTagInput` spans 98 lines.                              |
| client/src/components/admin/tabs/JobOptionsEditor.tsx                                   | 4    | `JobOptionsEditor` spans 98 lines.                            |
| server/src/services/reports/threatReportRenderers.ts                                    | 77   | `renderHtml` spans 98 lines.                                  |
| server/src/services/wigleImport/runRepository.ts                                        | 277  | `getImportCompletenessSummary` spans 98 lines.                |
| server/src/api/routes/v2/filteredHandlers.ts                                            | 291  | `geospatial` spans 97 lines.                                  |
| server/src/services/ml/trainer.ts                                                       | 24   | `ThreatMLModel` spans 96 lines.                               |
| client/src/components/geospatial/modals/WigleLookupDialog.tsx                           | 12   | `WigleLookupDialog` spans 95 lines.                           |
| client/src/components/admin/tabs/JobScheduleEditor.tsx                                  | 13   | `JobScheduleEditor` spans 94 lines.                           |
| server/src/services/wigleService.ts                                                     | 232  | `getWiglePageNetworkFromMv` spans 93 lines.                   |
| client/src/components/ActiveFiltersSummary.tsx                                          | 47   | `ActiveFiltersSummary` spans 92 lines.                        |
| client/src/components/geospatial/table/ColumnItem.tsx                                   | 15   | `ColumnItem` spans 92 lines.                                  |
| client/src/utils/Tooltip.tsx                                                            | 17   | `Tooltip` spans 92 lines.                                     |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts                                   | 14   | `registerWiGLERoutes` spans 92 lines.                         |
| server/src/services/networking/sorting.ts                                               | 65   | `parseNetworkSort` spans 92 lines.                            |
| client/src/components/admin/hooks/usePgAdmin.ts                                         | 5    | `usePgAdmin` spans 91 lines.                                  |
| client/src/components/admin/tabs/JobCard.tsx                                            | 43   | `JobCard` spans 91 lines.                                     |
| client/src/components/geospatial/hooks/useMapInitialization.ts                          | 25   | `useMapInitialization` spans 91 lines.                        |
| client/src/components/geospatial/overlays/GeospatialOverlays.tsx                        | 59   | `GeospatialOverlays` spans 91 lines.                          |
| server/src/services/filterQueryBuilder/modules/networkMetricsBuilder.ts                 | 12   | `buildNetworkDashboardMetricsQuery` spans 91 lines.           |
| client/src/components/dashboard/MetricCard.tsx                                          | 28   | `MetricCard` spans 90 lines.                                  |
| server/src/services/wigleClient.ts                                                      | 100  | `fetchWigle` spans 90 lines.                                  |
| client/src/components/analytics/hooks/useAnalyticsData.ts                               | 60   | `useAnalyticsData` spans 89 lines.                            |
| client/src/hooks/useNetworkNotes.ts                                                     | 28   | `useNetworkNotes` spans 89 lines.                             |
| server/src/services/reports/threatReportRenderers.ts                                    | 176  | `renderPdfBuffer` spans 88 lines.                             |
| server/src/services/wigleImport/pageProcessor.ts                                        | 5    | `processSuccessfulPage` spans 88 lines.                       |
| client/src/components/wigle/useWigleData.ts                                             | 18   | `useWigleData` spans 87 lines.                                |
| client/src/App.tsx                                                                      | 39   | `AppContent` spans 86 lines.                                  |
| client/src/components/filters/sections/SecurityFilters.tsx                              | 20   | `SecurityFilters` spans 86 lines.                             |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                         | 315  | `handleWigleLookup` spans 86 lines.                           |
| client/src/components/geospatial/markers/GeospatialMarkerLegend.tsx                     | 16   | `GeospatialMarkerLegend` spans 85 lines.                      |
| client/src/utils/wigle/wigleTooltipRenderer.ts                                          | 54   | `renderWigleTooltip` spans 84 lines.                          |
| server/src/services/filterQueryBuilder/radioPredicates.ts                               | 109  | `buildRadioPredicates` spans 84 lines.                        |
| client/src/components/admin/hooks/useBackups.ts                                         | 5    | `useBackups` spans 83 lines.                                  |
| client/src/components/admin/tabs/data-import/ImportHistory.tsx                          | 135  | `ImportHistory` spans 83 lines.                               |
| client/src/components/geospatial/toolbar/MapToolbarControls.tsx                         | 91   | `OverlayToggles` spans 83 lines.                              |
| server/src/services/networkService.ts                                                   | 22   | `getFilteredNetworks` spans 83 lines.                         |
| client/src/components/admin/hooks/useWigleDetail.ts                                     | 47   | `useWigleDetail` spans 81 lines.                              |
| client/src/components/admin/tabs/DataImportTab.tsx                                      | 10   | `DataImportTab` spans 81 lines.                               |
| client/src/components/geospatial/networkTagMenu/NetworkTagMenuAdminActions.tsx          | 14   | `NetworkTagMenuAdminActions` spans 81 lines.                  |
| client/src/components/geospatial/toolbar/MapToolbarDropdowns.tsx                        | 140  | `MapStyleDropdown` spans 81 lines.                            |
| server/src/services/filterQueryBuilder/modules/networkFastPathIdentityPredicates.ts     | 4    | `buildFastPathIdentityPredicates` spans 81 lines.             |
| server/src/services/filterQueryBuilder/modules/NetworkModule.ts                         | 19   | `NetworkModule` spans 81 lines.                               |
| server/src/services/filterQueryBuilder/modules/observationSpatialQualityPredicates.ts   | 4    | `buildObservationSpatialQualityPredicates` spans 81 lines.    |
| client/src/components/geospatial/hooks/useGeospatialMap.ts                              | 30   | `useGeospatialMap` spans 80 lines.                            |
| server/src/services/backupService.ts                                                    | 168  | `runDockerizedLocalPgDump` spans 80 lines.                    |
| server/src/services/exportService.ts                                                    | 207  | `generateKML` spans 80 lines.                                 |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                         | 456  | `loadBatchWigleObservations` spans 79 lines.                  |
| server/src/services/wigleImport/runRepository.ts                                        | 28   | `reconcileRunProgress` spans 79 lines.                        |
| client/src/components/geospatial/hooks/useMapPopups.ts                                  | 14   | `useMapPopups` spans 78 lines.                                |
| client/src/components/admin/hooks/useWigleRuns.ts                                       | 27   | `useWigleRuns` spans 77 lines.                                |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                         | 205  | `handleTagAction` spans 77 lines.                             |
| client/src/directions/useDirectionsMode.ts                                              | 42   | `useDirectionsMode` spans 77 lines.                           |
| client/src/utils/geospatial/setupPopupDrag.ts                                           | 62   | `handleMouseDown` spans 77 lines.                             |
| server/src/services/pgadmin/control.ts                                                  | 93   | `startPgAdmin` spans 77 lines.                                |
| server/src/services/wigleEnrichmentService.ts                                           | 291  | `runEnrichmentLoop` spans 77 lines.                           |
| client/src/components/admin/hooks/useWigleSearch.ts                                     | 45   | `runSearch` spans 76 lines.                                   |
| client/src/components/WiglePage.tsx                                                     | 459  | `toggleBuildings` spans 76 lines.                             |
| server/src/services/cacheService.ts                                                     | 5    | `CacheService` spans 76 lines.                                |
| client/src/components/geospatial/hooks/useNetworkSelection.ts                           | 9    | `useNetworkSelection` spans 75 lines.                         |
| server/src/services/wigleEnrichmentService.ts                                           | 215  | `fetchAndImportDetail` spans 75 lines.                        |
| client/src/components/geospatial/GeospatialTableContent.tsx                             | 34   | `GeospatialTableContentComponent` spans 74 lines.             |
| server/src/repositories/jobRunRepository.ts                                             | 89   | `getJobStatus` spans 74 lines.                                |
| server/src/services/v2Queries.ts                                                        | 15   | `buildListNetworksQuery` spans 74 lines.                      |
| server/src/services/wigleService.ts                                                     | 381  | `getWigleDatabase` spans 74 lines.                            |
| client/src/components/admin/hooks/useMLTraining.ts                                      | 5    | `useMLTraining` spans 73 lines.                               |
| client/src/components/AppHeader.tsx                                                     | 13   | `AppHeader` spans 73 lines.                                   |
| server/src/services/exportService.ts                                                    | 98   | `getFullDatabaseSnapshot` spans 73 lines.                     |
| server/src/services/filterQueryBuilder/modules/networkFastPathListBuilder.ts            | 30   | `buildFastPathListSql` spans 73 lines.                        |
| client/src/components/geospatial/hooks/useMapLayersToggle.ts                            | 124  | `add3DBuildings` spans 72 lines.                              |
| client/src/hooks/useAgencyLayer.ts                                                      | 23   | `useAgencyLayer` spans 72 lines.                              |
| client/src/utils/geospatial/setupPopupTether.ts                                         | 151  | `setupPopupTether` spans 72 lines.                            |
| server/src/repositories/agencyRepository.ts                                             | 102  | `findNearestAgenciesBatch` spans 72 lines.                    |
| server/src/services/analytics/threatAnalytics.ts                                        | 60   | `getThreatTrends` spans 72 lines.                             |
| client/src/directions/directionsLayer.ts                                                | 38   | `applyDirectionsRoute` spans 71 lines.                        |
| server/src/validation/schemas/geospatialSchemas.ts                                      | 222  | `validateUSState` spans 71 lines.                             |
| client/src/components/admin/tabs/config/GeocodingConfig.tsx                             | 36   | `GeocodingConfig` spans 69 lines.                             |
| client/src/components/geospatial/hooks/useSummaryLayers.ts                              | 112  | `syncSummarySource` spans 69 lines.                           |
| client/src/components/geospatial/networkTagMenu/NetworkTagMenu.tsx                      | 38   | `NetworkTagMenu` spans 69 lines.                              |
| client/src/components/geospatial/toolbar/MapToolbarControls.tsx                         | 11   | `ViewControls` spans 69 lines.                                |
| client/src/components/admin/tabs/config/AWSConfig.tsx                                   | 35   | `AWSConfig` spans 68 lines.                                   |
| server/src/services/ml/scoringService.ts                                                | 18   | `scoreAllNetworks` spans 68 lines.                            |
| server/src/services/wigleImportService.ts                                               | 8    | `importWigleV2Json` spans 68 lines.                           |
| client/src/components/geospatial/GeospatialMapContent.tsx                               | 17   | `GeospatialMapContentComponent` spans 67 lines.               |
| client/src/components/geospatial/hooks/useSummaryLayers.ts                              | 44   | `ensureSummaryLayers` spans 67 lines.                         |
| client/src/components/kepler/KeplerVisualization.tsx                                    | 20   | `KeplerVisualization` spans 67 lines.                         |
| client/src/utils/wigle/geojson.ts                                                       | 25   | `rowsToGeoJSON` spans 67 lines.                               |
| server/src/services/filterQueryBuilder/modules/networkMetricsBuilder.ts                 | 104  | `buildThreatSeverityCountsQuery` spans 67 lines.              |
| client/src/components/filters/sections/IdentityFilters.tsx                              | 19   | `IdentityFilters` spans 66 lines.                             |
| client/src/components/geospatial/hooks/useSiblingLinks.ts                               | 66   | `loadVisibleSiblingGroups` spans 66 lines.                    |
| server/src/api/routes/v2/filteredHandlers.ts                                            | 95   | `buildFilteredObservationsResponse` spans 66 lines.           |
| server/src/services/admin/siblingDetectionAdminService.ts                               | 15   | `runSiblingRefreshJob` spans 66 lines.                        |
| server/src/services/dashboardService.ts                                                 | 66   | `DashboardService` spans 66 lines.                            |
| server/src/services/networking/filterBuilders/locationFilters.ts                        | 6    | `applyLocationFilters` spans 66 lines.                        |
| server/src/validation/schemas/complexValidators.ts                                      | 173  | `validateObservation` spans 66 lines.                         |
| client/src/components/geospatial/hooks/useWigleLayers.ts                                | 191  | `ensureWigleLayers` spans 65 lines.                           |
| client/src/utils/geospatial/observationTooltipProps.ts                                  | 4    | `buildObservationTooltipProps` spans 65 lines.                |
| server/src/services/ml/repository.ts                                                    | 62   | `upsertLegacyThreatScore` spans 65 lines.                     |
| client/src/components/admin/hooks/useWigleSearch.ts                                     | 128  | `importAllResults` spans 64 lines.                            |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                         | 134  | `openContextMenu` spans 64 lines.                             |
| client/src/utils/mapOrientationControls.ts                                              | 48   | `attachMapOrientationControls` spans 64 lines.                |
| server/src/api/routes/v1/dashboard.ts                                                   | 59   | `sendDashboardMetrics` spans 64 lines.                        |
| server/src/services/filterQueryBuilder/modules/analyticsQueryBuilders.ts                | 5    | `buildAnalyticsQueriesFromContext` spans 64 lines.            |
| server/src/services/filterQueryBuilder/modules/networkFastPathSecurityPredicates.ts     | 4    | `buildEncryptionClauses` spans 64 lines.                      |
| server/src/services/filterQueryBuilder/normalizers.ts                                   | 181  | `normalizeFilters` spans 64 lines.                            |
| server/src/services/filterQueryBuilder/validators.ts                                    | 10   | `validateFilterPayload` spans 64 lines.                       |
| server/src/services/wigleEnrichmentService.ts                                           | 418  | `validateWigleApiCredit` spans 64 lines.                      |
| client/src/utils/wigle/security.ts                                                      | 36   | `normalizeSecurityLabel` spans 63 lines.                      |
| server/src/services/bedrockService.ts                                                   | 92   | `analyzeNetworks` spans 63 lines.                             |
| server/src/services/reports/threatReportRenderers.ts                                    | 13   | `renderMarkdown` spans 63 lines.                              |
| server/src/services/v2Queries.ts                                                        | 90   | `getNetworkDetailQueries` spans 63 lines.                     |
| server/src/utils/queryPerformanceTracker.ts                                             | 26   | `QueryPerformanceTracker` spans 63 lines.                     |
| client/src/components/admin/tabs/DbStatsTab.tsx                                         | 117  | `renderTableList` spans 62 lines.                             |
| client/src/utils/wigle/wigleTooltipNormalizer.ts                                        | 68   | `normalizeWigleTooltipData` spans 62 lines.                   |
| server/src/services/filterQueryBuilder/modules/analyticsQueryContext.ts                 | 17   | `buildAnalyticsQueryContext` spans 62 lines.                  |
| server/src/services/geocoding/cacheStore.ts                                             | 288  | `fetchRows` spans 62 lines.                                   |
| server/src/services/wigleSearchApiService.ts                                            | 11   | `fetchWigleSearchPage` spans 62 lines.                        |
| server/src/validation/schemas/complexValidators.ts                                      | 245  | `validateTag` spans 62 lines.                                 |
| client/src/components/admin/tabs/config/HomeLocationConfig.tsx                          | 32   | `HomeLocationConfig` spans 61 lines.                          |
| client/src/components/admin/tabs/data-import/SQLiteImportCard.tsx                       | 21   | `SQLiteImportCard` spans 61 lines.                            |
| client/src/components/geospatial/hooks/useColumnVisibility.ts                           | 26   | `useColumnVisibility` spans 61 lines.                         |
| client/src/components/geospatial/hooks/useMapLayers.ts                                  | 286  | `handleMouseEnter` spans 61 lines.                            |
| client/src/components/wigle/eventHandlers.ts                                            | 18   | `createUnclusteredClickHandler` spans 61 lines.               |
| client/src/directions/directionsClient.ts                                               | 34   | `fetchDirections` spans 61 lines.                             |
| server/src/services/geocoding/mapbox.ts                                                 | 47   | `mapboxReverse` spans 61 lines.                               |
| client/src/components/admin/tabs/ml/ModelOperationsCard.tsx                             | 27   | `ModelOperationsCard` spans 60 lines.                         |
| client/src/components/wigle/kmlLayers.ts                                                | 32   | `ensureKmlLayers` spans 60 lines.                             |
| client/src/components/wigle/mapLayers.ts                                                | 4    | `ensureV2Layers` spans 60 lines.                              |
| client/src/components/wigle/mapLayers.ts                                                | 65   | `ensureV3Layers` spans 60 lines.                              |
| client/src/components/geospatial/MapStatusBar.tsx                                       | 15   | `MapStatusBar` spans 59 lines.                                |
| client/src/components/geospatial/table/ColumnSelector.tsx                               | 71   | `ColumnSelector` spans 59 lines.                              |
| client/src/components/hooks/useAgencyOffices.ts                                         | 210  | `handleUnclusteredClick` spans 59 lines.                      |
| server/src/repositories/wiglePersistenceRepository.ts                                   | 7    | `insertWigleV2SearchResult` spans 59 lines.                   |
| client/src/components/geospatial/hooks/useNetworkNotes.ts                               | 60   | `handleSaveNote` spans 58 lines.                              |
| client/src/hooks/useChangePassword.ts                                                   | 10   | `useChangePassword` spans 58 lines.                           |
| server/src/services/backgroundJobs/mlBehavioralScoring.ts                               | 60   | `scoreBehavioralThreats` spans 58 lines.                      |
| server/src/services/filterQueryBuilder/FilterPredicateBuilder.ts                        | 34   | `FilterPredicateBuilder` spans 58 lines.                      |
| server/src/services/geocoding/cacheStore.ts                                             | 229  | `seedAddressCandidates` spans 58 lines.                       |
| server/src/services/geocoding/jobState.ts                                               | 25   | `loadRecentJobHistory` spans 58 lines.                        |
| client/src/components/admin/tabs/config/SmartyConfig.tsx                                | 31   | `SmartyConfig` spans 57 lines.                                |
| client/src/components/admin/tabs/config/WigleConfig.tsx                                 | 32   | `WigleConfig` spans 57 lines.                                 |
| client/src/components/contextMenu/NetworkContextMenuMenu.tsx                            | 13   | `NetworkContextMenuMenu` spans 57 lines.                      |
| client/src/components/geospatial/hooks/useNearestAgencies.ts                            | 16   | `useNearestAgencies` spans 57 lines.                          |
| server/src/services/filterQueryBuilder/modules/geospatialQueryContext.ts                | 16   | `buildGeospatialQueryContext` spans 57 lines.                 |
| server/src/services/geocodingCacheService.ts                                            | 333  | `startGeocodeCacheUpdate` spans 57 lines.                     |
| server/src/services/ml/modelScoring.ts                                                  | 77   | `scoreNetworkWithModel` spans 57 lines.                       |
| server/src/services/v2Queries.ts                                                        | 173  | `buildThreatMapQueries` spans 57 lines.                       |
| client/src/components/geospatial/hooks/useWigleLayers.ts                                | 102  | `makeObsPopup` spans 56 lines.                                |
| client/src/components/admin/tabs/config/MapboxConfig.tsx                                | 34   | `MapboxConfig` spans 55 lines.                                |
| client/src/components/geospatial/hooks/useMapPopups.ts                                  | 25   | `handleClick` spans 55 lines.                                 |
| client/src/components/geospatial/hooks/useMapStyleControls.ts                           | 48   | `exportToGoogleEarth` spans 55 lines.                         |
| client/src/components/geospatial/networkTagMenu/NetworkTagMenuActionButton.tsx          | 17   | `NetworkTagMenuActionButton` spans 54 lines.                  |
| client/src/components/hooks/useFederalCourthouses.ts                                    | 246  | `handleClick` spans 54 lines.                                 |
| server/src/services/adminOrphanNetworksService.ts                                       | 153  | `listOrphanNetworks` spans 54 lines.                          |
| server/src/services/analytics/coreAnalytics.ts                                          | 92   | `getRadioTypeOverTime` spans 54 lines.                        |
| server/src/services/analytics/networkAnalytics.ts                                       | 156  | `getDashboardStats` spans 54 lines.                           |
| server/src/services/pgadmin/control.ts                                                  | 23   | `getPgAdminStatus` spans 54 lines.                            |
| client/src/components/geospatial/hooks/useColumnSelectorPosition.ts                     | 10   | `useColumnSelectorPosition` spans 53 lines.                   |
| client/src/hooks/useKepler.ts                                                           | 14   | `useKepler` spans 53 lines.                                   |
| server/src/services/adminMaintenanceService.ts                                          | 46   | `refreshColocationView` spans 53 lines.                       |
| server/src/services/backgroundJobs/mvRefresh.ts                                         | 47   | `refreshMaterializedViews` spans 53 lines.                    |
| server/src/services/filterQueryBuilder/modules/ObservationModule.ts                     | 5    | `ObservationModule` spans 53 lines.                           |
| server/src/utils/networkSqlExpressions.ts                                               | 48   | `encryptionTypePredicate` spans 53 lines.                     |
| server/src/validation/schemas/complexValidators.ts                                      | 114  | `validateNetworkForCreate` spans 53 lines.                    |
| client/src/components/admin/tabs/ConfigurationTab.tsx                                   | 110  | `FlagRow` spans 52 lines.                                     |
| client/src/components/admin/tabs/DbStatsTab.tsx                                         | 180  | `renderMVList` spans 52 lines.                                |
| client/src/components/admin/tabs/wigleCoverageStatusMeta.ts                             | 1    | `getCoverageStatusMeta` spans 52 lines.                       |
| client/src/components/analytics/AnalyticsPage.tsx                                       | 14   | `Analytics` spans 52 lines.                                   |
| client/src/components/geospatial/hooks/useBoundingBoxFilter.ts                          | 13   | `useBoundingBoxFilter` spans 52 lines.                        |
| client/src/hooks/useDashboard.ts                                                        | 53   | `useDashboard` spans 52 lines.                                |
| client/src/utils/geospatial/setupPopupPin.ts                                            | 61   | `togglePin` spans 52 lines.                                   |
| server/src/services/adminSiblingService.ts                                              | 57   | `getNetworkSiblingLinksBatch` spans 52 lines.                 |
| server/src/services/filterQueryBuilder/modules/analyticsQueryBuilders.ts                | 70   | `buildAnalyticsQueriesFromMaterializedView` spans 52 lines.   |
| client/src/components/admin/hooks/useApiTesting.ts                                      | 89   | `runApiRequest` spans 51 lines.                               |
| client/src/components/contextMenu/NetworkContextMenuTable.tsx                           | 12   | `NetworkContextMenuTable` spans 51 lines.                     |
| client/src/components/geospatial/hooks/useNetworkContextMenu.ts                         | 403  | `loadWigleObservations` spans 51 lines.                       |
| client/src/components/geospatial/hooks/useWigleLayers.ts                                | 257  | `syncWigleSource` spans 51 lines.                             |
| client/src/utils/mapHelpers.ts                                                          | 60   | `resolveRadioTech` spans 51 lines.                            |
| server/src/services/networking/sorting.ts                                               | 13   | `getSortColumnMap` spans 51 lines.                            |
| server/src/validation/schemas/temporalSchemas.ts                                        | 159  | `validateTimeWindow` spans 51 lines.                          |

### Circular Imports

| File                           | Line | Detail                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| server/src/config/container.ts | 1    | Runtime import cycle detected: `server/src/config/container.ts -> server/src/services/admin/importExportAdminService.ts -> server/src/services/admin/networkNotesAdminService.ts -> server/src/services/admin/networkTagsAdminService.ts -> server/src/services/admin/settingsAdminService.ts -> server/src/services/admin/siblingDetectionAdminService.ts -> server/src/config/container.ts`. |

### Business Logic Living In Route Handlers Instead Of Services

| File                                                  | Line | Detail                                                                                                                                     |
| ----------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| server/src/api/routes/v2/filteredHandlers.ts          | 95   | Route file owns filter parsing, query-builder orchestration, row enrichment, transparency normalization, pagination, and response shaping. |
| server/src/api/routes/v1/admin/import.ts              | 1    | Import route is 604 lines and mixes upload handling, validation, orchestration, and response policy instead of thin service delegation.    |
| server/src/api/routes/v1/wigle/detail.ts              | 37   | Route file performs JSON parsing, null-byte stripping, normalization, import orchestration, and response synthesis.                        |
| server/src/api/routes/v1/wigle/search.ts              | 42   | Route file mixes validation, API-version selection, DB writes for saved search terms, and import-run orchestration.                        |
| server/src/api/routes/v1/geospatial.ts                | 39   | Route file contains URL validation, retry policy, upstream fetch proxying, and tile URL construction logic.                                |
| server/src/api/routes/v1/settingsMultiSecretRoutes.ts | 33   | Route file validates secret payloads and calls external WiGLE profile verification directly.                                               |
| server/src/api/routes/v1/mobileIngest.ts              | 30   | Route file embeds API-key auth, trust-mode normalization, backup gating, and auto-process branching.                                       |
| server/src/api/routes/v1/settings.ts                  | 48   | Route file writes settings directly via DB wrapper instead of delegating all persistence to services.                                      |
| server/src/api/routes/v1/health.ts                    | 15   | Health route performs direct dependency checks and pool queries inline.                                                                    |

### Direct DB Queries Outside Repository Files

| File                                                 | Line | Detail                                                                          |
| ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| server/src/api/routes/v1/health.ts                   | 15   | await pool.query('SELECT 1');                                                   |
| server/src/config/database.ts                        | 73   | return pool.query(text, params);                                                |
| server/src/core/initialization/databaseInit.ts       | 40   | await client.query('SELECT 1 FROM app.api_network_explorer_mv LIMIT 1');        |
| server/src/core/initialization/databaseInit.ts       | 45   | await client.query('REFRESH MATERIALIZED VIEW app.api_network_explorer_mv');    |
| server/src/services/admin/dataQualityAdminService.ts | 25   | await this.pool.query('REFRESH MATERIALIZED VIEW app.api_network_explorer_mv'); |
| server/src/services/admin/dataQualityAdminService.ts | 30   | const result = await this.pool.query(`                                          |
| server/src/services/admin/dataQualityAdminService.ts | 53   | const result = await this.pool.query(`                                          |
| server/src/services/admin/dataQualityAdminService.ts | 73   | await this.pool.query(                                                          |
| server/src/services/admin/dataQualityAdminService.ts | 96   | await this.pool.query(                                                          |
| server/src/services/admin/dataQualityAdminService.ts | 114  | await this.pool.query(                                                          |
| server/src/services/admin/dataQualityAdminService.ts | 132  | await this.pool.query(                                                          |
| server/src/services/admin/dataQualityAdminService.ts | 151  | await this.pool.query(`                                                         |
| server/src/services/adminDbService.ts                | 83   | return pool.query(text, params);                                                |
| server/src/services/exportService.ts                 | 12   | const result = await db.query(`                                                 |
| server/src/services/exportService.ts                 | 36   | db.query(`                                                                      |
| server/src/services/exportService.ts                 | 53   | db.query(`                                                                      |
| server/src/services/exportService.ts                 | 78   | const result = await db.query(`                                                 |
| server/src/services/exportService.ts                 | 180  | const result = await db.query(                                                  |
| server/src/services/miscService.ts                   | 18   | const result = await pool.query(qualityQuery);                                  |
| server/src/services/ouiGroupingService.ts            | 17   | const networks = await client.query(`                                           |
| server/src/services/ouiGroupingService.ts            | 62   | await client.query('BEGIN');                                                    |
| server/src/services/ouiGroupingService.ts            | 84   | await client.query(                                                             |
| server/src/services/ouiGroupingService.ts            | 108  | await client.query('COMMIT');                                                   |
| server/src/services/ouiGroupingService.ts            | 111  | if (client) await client.query('ROLLBACK');                                     |
| server/src/services/ouiGroupingService.ts            | 128  | const macSequences = await client.query(`                                       |
| server/src/services/ouiGroupingService.ts            | 148  | await client.query('BEGIN');                                                    |
| server/src/services/ouiGroupingService.ts            | 175  | await client.query(                                                             |
| server/src/services/ouiGroupingService.ts            | 199  | await client.query('COMMIT');                                                   |
| server/src/services/ouiGroupingService.ts            | 202  | if (client) await client.query('ROLLBACK');                                     |
| server/src/services/wigleImport/pageProcessor.ts     | 17   | await client.query('BEGIN');                                                    |
| server/src/services/wigleImport/pageProcessor.ts     | 28   | await client.query(                                                             |
| server/src/services/wigleImport/pageProcessor.ts     | 44   | const runResult = await client.query(                                           |
| server/src/services/wigleImport/pageProcessor.ts     | 77   | await client.query('COMMIT');                                                   |
| server/src/services/wigleImport/pageProcessor.ts     | 87   | await client.query('ROLLBACK');                                                 |
| server/src/services/wigleImport/runRepository.ts     | 31   | await client.query('BEGIN');                                                    |
| server/src/services/wigleImport/runRepository.ts     | 32   | const pageSummary = await client.query(                                         |
| server/src/services/wigleImport/runRepository.ts     | 44   | const latestCursorResult = await client.query(                                  |
| server/src/services/wigleImport/runRepository.ts     | 54   | const runResult = await client.query(                                           |
| server/src/services/wigleImport/runRepository.ts     | 98   | await client.query('COMMIT');                                                   |
| server/src/services/wigleImport/runRepository.ts     | 101  | await client.query('ROLLBACK');                                                 |
| server/src/services/wigleImportService.ts            | 15   | await client.query('BEGIN');                                                    |
| server/src/services/wigleImportService.ts            | 20   | await client.query('SAVEPOINT sp_network');                                     |
| server/src/services/wigleImportService.ts            | 22   | await client.query(                                                             |
| server/src/services/wigleImportService.ts            | 59   | await client.query('RELEASE SAVEPOINT sp_network');                             |
| server/src/services/wigleImportService.ts            | 62   | await client.query('ROLLBACK TO SAVEPOINT sp_network');                         |
| server/src/services/wigleImportService.ts            | 67   | await client.query('COMMIT');                                                   |
| server/src/services/wigleImportService.ts            | 70   | await client.query('ROLLBACK');                                                 |

### Client / Server Cross-Boundary Imports

| File | Line | Detail     |
| ---- | ---- | ---------- |
| -    | -    | None found |

## Phase 6 — Test Coverage Gaps

### Service Files With No Corresponding Test File

| File                                                                            | Line | Detail                                    |
| ------------------------------------------------------------------------------- | ---- | ----------------------------------------- |
| server/src/services/admin/siblingDetectionQueries.ts                            | 1    | No test file imports this service module. |
| server/src/services/adminSiblingService.ts                                      | 1    | No test file imports this service module. |
| server/src/services/bedrockService.ts                                           | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/NetworkWhereBuildContext.ts              | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/AnalyticsModule.ts               | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/NetworkModule.ts                 | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/ObservationModule.ts             | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/networkFastPathPredicateTypes.ts | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/networkNoFilterBuilder.ts        | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/networkPredicateAdapters.ts      | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/networkSlowPathBuilder.ts        | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/modules/observationFilterBuilder.ts      | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/spatialHelpers.ts                        | 1    | No test file imports this service module. |
| server/src/services/filterQueryBuilder/types.ts                                 | 1    | No test file imports this service module. |
| server/src/services/filteredAnalyticsService.ts                                 | 1    | No test file imports this service module. |
| server/src/services/geocoding/types.ts                                          | 1    | No test file imports this service module. |
| server/src/services/networking/filterBuilders/locationFilters.ts                | 1    | No test file imports this service module. |
| server/src/services/networking/filterBuilders/securityRadioFilters.ts           | 1    | No test file imports this service module. |
| server/src/services/networking/filterBuilders/textRangeFilters.ts               | 1    | No test file imports this service module. |
| server/src/services/networking/types.ts                                         | 1    | No test file imports this service module. |
| server/src/services/threatScoring.types.ts                                      | 1    | No test file imports this service module. |
| server/src/services/wigleBulkPolicy.ts                                          | 1    | No test file imports this service module. |
| server/src/services/wigleSearchApiService.ts                                    | 1    | No test file imports this service module. |

### Repository Files With No Corresponding Test File

| File | Line | Detail     |
| ---- | ---- | ---------- |
| -    | -    | None found |

### Test Files With Only Skipped Tests

| File | Line | Detail     |
| ---- | ---- | ---------- |
| -    | -    | None found |

### Tests Importing Paths That No Longer Exist

| File                                                                                | Line | Detail                                                        |
| ----------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------- |
| client/src/components/admin/tabs/data-import/**tests**/OrphanNetworksPanel.test.tsx | 6    | Unresolved relative import: `../../../../../../api/adminApi`. |

## Summary

- Phase 1 issues: 83
- Phase 2 issues: 163
- Phase 3 issues: 58
- Phase 4 issues: 2403
- Phase 5 issues: 444
- Phase 6 issues: 24

- Top 5 highest-priority fixes with rationale:
  1. Break the `server/src/config/container.ts` admin-service cycle. Rationale: runtime import cycles make initialization order fragile and encourage services to reach back into the container instead of depending on explicit interfaces. Estimated effort tier: high.
  2. Split oversized route handlers like `server/src/api/routes/v2/filteredHandlers.ts`, `server/src/api/routes/v1/admin/import.ts`, and `server/src/api/routes/v1/wigle/detail.ts`. Rationale: these files mix transport, validation, orchestration, and transformation logic, which increases regression risk and blocks targeted testing. Estimated effort tier: high.
  3. Eliminate dead client modules and unused utilities/components (`FilterButton`, `HamburgerButton`, `NetworkContextMenu`, `mapboxLoader`, `macUtils`, popup tether helpers). Rationale: they increase cognitive load and hide the real active UI path. Estimated effort tier: low.
  4. Triage the `any` / assertion hot spots in geospatial and WiGLE flows (`client/src/components/WiglePage.tsx`, geospatial hooks, `server/src/api/routes/v1/wigle/*`). Rationale: these are exactly where data-shape drift is most likely and where type suppression is currently masking it. Estimated effort tier: medium.
  5. Remove dependency cruft and add missing direct dependencies (`uuid`, `@testing-library/react`, `@jest/globals`) while pruning unused packages (`node-cron`, `react-window`, `better-sqlite3`, `node-fetch`, etc.). Rationale: undeclared direct deps are fragile in CI, and unused packages create false maintenance surface. Estimated effort tier: trivial.
