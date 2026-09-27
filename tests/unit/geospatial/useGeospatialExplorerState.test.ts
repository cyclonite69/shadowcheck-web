import fs from 'fs';
import path from 'path';

describe('useGeospatialExplorerState hook structure', () => {
  const filePath = path.resolve(
    process.cwd(),
    'client/src/components/geospatial/hooks/useGeospatialExplorerState.ts'
  );
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(filePath, 'utf8');
  });

  test('imports all required sub-hooks and helpers', () => {
    // Sub-hooks imports
    const expectedSubHooks = [
      'useCurrentEnabled',
      'useFilterStore',
      'useMapPreferences',
      'useColumnVisibility',
      'useExplorerPanels',
      'useLocationSearch',
      'useHomeLocation',
      'useMapDimensions',
      'useBoundingBoxFilter',
      'useMapInteractionLock',
      'useHomeLocationLayer',
      'useObservationSummary',
      'useMapResizeHandle',
      'useGeospatialMap',
      'useDirectionsMode',
      'useNetworkSort',
      'useObservationLayers',
      'useMapLayersToggle',
      'useApplyMapLayerDefaults',
      'useMapStyleControls',
      'useResetPaginationOnFilters',
      'useDebouncedFilterState',
      'useRadiusPinDrop',
      'useRadiusFilterLayer',
      'useRadiusFilterPopup',
      'useQuickSearchFilterSync',
      'useSiblingLinks',
    ];

    expectedSubHooks.forEach((hookName) => {
      expect(source).toContain(hookName);
    });

    // Helper imports
    expect(source).toContain('expandNetworksForSiblingSearch');
    expect(source).toContain('getUnresolvedSearchBssids');
    expect(source).toContain('componentSizesFromGroupMap');
    expect(source).toContain('logSiblingTopology');
    expect(source).toContain('networkApi');
  });

  test('accepts the correct properties in its input signature', () => {
    expect(source).toContain('isAdmin');
    expect(source).toContain('selectedAnchorBssid');
    expect(source).toContain('selectedNetworks');
    expect(source).toContain('networks');
    expect(source).toContain('observationsByBssid');
    expect(source).toContain('resetPagination');
    expect(source).toContain('setSort');
    expect(source).toContain('setError');
    expect(source).toContain('sort');
    expect(source).toContain('wigleObservations');
    expect(source).toContain('clearWigleObservations');
    expect(source).toContain('loadWigleObservations');
    expect(source).toContain('loadBatchWigleObservations');
    expect(source).toContain('closeContextMenu');
    expect(source).toContain('contextMenuNetwork');
    expect(source).toContain('onOpenContextMenu');
    expect(source).toContain('locationMode');
    expect(source).toContain('setLocationMode');
    expect(source).toContain('showNetworkSummaries');
    expect(source).toContain('showMediaLocations');
  });

  test('returns the media layer status from observation-layer orchestration', () => {
    expect(source).toContain('const { mediaLocationStatus } = useObservationLayers({');
    expect(source).toContain('mediaLocationStatus,');
  });

  test('asserts all expected return keys are present in return statement', () => {
    const expectedReturnKeys = [
      'mapHeight',
      'containerHeight',
      'mapStyle',
      'show3DBuildings',
      'showTerrain',
      'embeddedView',
      'quickSearch',
      'setQuickSearch',
      'mapReady',
      'mapError',
      'homeButtonActive',
      'setHomeButtonActive',
      'fitButtonActive',
      'setFitButtonActive',
      'homeLocation',
      'tableContainerRef',
      'mapRef',
      'mapboxRef',
      'mapContainerRef',
      'columnDropdownRef',
      'visibleColumns',
      'toggleColumn',
      'reorderColumns',
      'moveColumn',
      'filtersOpen',
      'showColumnSelector',
      'showAgenciesPanel',
      'showCourthousesPanel',
      'showAlprCameras',
      'toggleFilters',
      'toggleColumnSelector',
      'toggleAgenciesPanel',
      'toggleCourthousesPanel',
      'toggleAlprCameras',
      'locationSearch',
      'setLocationSearch',
      'searchResults',
      'showSearchResults',
      'setShowSearchResults',
      'searchingLocation',
      'locationSearchRef',
      'flyToLocation',
      'activeObservationSets',
      'observationCount',
      'networkLookup',
      'handleMouseDown',
      'handlePaneSnap',
      'searchMode',
      'setSearchMode',
      'directionsLoading',
      'fetchRoute',
      'clearRoute',
      'handleColumnSort',
      'toggle3DBuildings',
      'toggleTerrain',
      'is3DBuildingsAvailable',
      'changeMapStyle',
      'isViewportLocked',
      'locationMode',
      'setLocationMode',
      'siblingPairLoading',
      'toggleWigleForBssids',
      'manualSiblingTarget',
      'handleMarkSiblingPair',
      'filteredNetworks',
      'unresolvedSearchBssids',
      'hydrationFailedBssids',
      'nonRenderableBssids',
      'missingDbBssids',
      'linkedSiblingBssids',
      'visibleSiblingGroupMap',
      'setLinkedSiblingBssids',
      'radiusContextMenu',
      'closeRadiusContextMenu',
      'setRadiusFromContextMenu',
      'clearRadiusFilter',
      'siblingHydrating',
      'mediaLocationStatus',
    ];

    expectedReturnKeys.forEach((key) => {
      // Find the key inside the return statement block
      // To prevent false matches elsewhere, we search for either `key,` or `key:` in the return payload block
      const returnIndex = source.indexOf('return {');
      expect(returnIndex).toBeGreaterThan(-1);
      const returnBlock = source.substring(returnIndex);

      const hasExactKey =
        returnBlock.includes(`  ${key},`) ||
        returnBlock.includes(`  ${key}:`) ||
        returnBlock.includes(`\n    ${key},`) ||
        returnBlock.includes(`\n    ${key}:`);

      expect(hasExactKey).toBe(true);
    });
  });
});
