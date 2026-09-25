import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { useCurrentEnabled, useFilterStore } from '../../../stores/filterStore';
import { useMapPreferences } from './useMapPreferences';
import { useColumnVisibility } from './useColumnVisibility';
import { useExplorerPanels } from './useExplorerPanels';
import { useLocationSearch } from './useLocationSearch';
import { useHomeLocation } from './useHomeLocation';
import { useMapDimensions } from './useMapDimensions';
import { useBoundingBoxFilter } from './useBoundingBoxFilter';
import { useMapInteractionLock } from './useMapInteractionLock';
import { useHomeLocationLayer } from './useHomeLocationLayer';
import { useObservationSummary } from './useObservationSummary';
import { useMapResizeHandle } from './useMapResizeHandle';
import { useGeospatialMap } from './useGeospatialMap';
import { useDirectionsMode } from '../../../directions/useDirectionsMode';
import { useNetworkSort } from './useNetworkSort';
import { useObservationLayers } from './useObservationLayers';
import { useMapLayersToggle } from './useMapLayersToggle';
import { useApplyMapLayerDefaults } from './useApplyMapLayerDefaults';
import { useMapStyleControls } from './useMapStyleControls';
import { useResetPaginationOnFilters } from './useResetPaginationOnFilters';
import { useDebouncedFilterState } from './useDebouncedFilterState';
import { useRadiusPinDrop } from './useRadiusPinDrop';
import { useRadiusFilterLayer } from './useRadiusFilterLayer';
import { useRadiusFilterPopup } from './useRadiusFilterPopup';
import { useQuickSearchFilterSync } from './useQuickSearchFilterSync';
import { logError, logDebug } from '../../../logging/clientLogger';
import { WigleObservationsState } from './useWigleLayers';
import { networkApi } from '../../../api/networkApi';
import {
  NETWORK_COLUMNS,
  API_SORT_MAP,
  DEFAULT_CENTER,
  DEFAULT_HOME_RADIUS,
} from '../../../constants/network';
import { NetworkRow } from '../../../types/network';
import {
  expandNetworksForSiblingSearch,
  getUnresolvedSearchBssids,
} from '../utils/siblingGroupGraph';
import { componentSizesFromGroupMap, logSiblingTopology } from '../utils/siblingTopologyDebug';
import { useSiblingLinks } from './useSiblingLinks';

const MAP_HEADER_HEIGHT = 48;
const MIN_TABLE_HEIGHT = 150;

interface UseGeospatialExplorerStateProps {
  isAdmin: boolean;
  selectedAnchorBssid: string | null;
  selectedNetworks: Set<string>;
  networks: NetworkRow[];
  observationsByBssid: any;
  resetPagination: () => void;
  setSort: (sort: any) => void;
  setError: (err: any) => void;
  sort: any;
  wigleObservations: WigleObservationsState;
  clearWigleObservations: () => void;
  loadWigleObservations: (network: NetworkRow) => void;
  loadBatchWigleObservations: (bssids: string[]) => void;
  closeContextMenu: () => void;
  contextMenuNetwork?: NetworkRow | null;
  onOpenContextMenu: (e: any, network: any) => void;
  locationMode: string;
  setLocationMode: React.Dispatch<React.SetStateAction<string>>;
  showNetworkSummaries?: boolean;
  showMediaLocations?: boolean;
}

export const useGeospatialExplorerState = ({
  isAdmin,
  selectedAnchorBssid,
  selectedNetworks,
  networks,
  observationsByBssid,
  resetPagination,
  setSort,
  setError,
  sort,
  wigleObservations,
  clearWigleObservations,
  loadWigleObservations,
  loadBatchWigleObservations,
  closeContextMenu,
  contextMenuNetwork,
  onOpenContextMenu,
  locationMode,
  setLocationMode,
  showNetworkSummaries = false,
  showMediaLocations = false,
}: UseGeospatialExplorerStateProps) => {
  // UI state
  const [mapHeight, setMapHeight] = useState<number>(500);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const [embeddedView, setEmbeddedView] = useState<'street-view' | 'earth' | null>(null);
  const [quickSearch, setQuickSearch] = useState('');

  const {
    linkedSiblingBssids,
    visibleSiblingGroupMap,
    setLinkedSiblingBssids,
    missingSiblingNetworks,
    hydrationFailedBssids,
    nonRenderableBssids,
    missingDbBssids,
    siblingHydrating,
  } = useSiblingLinks({
    isAdmin,
    selectedAnchorBssid,
    networks,
    quickSearch,
  });
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [homeButtonActive, setHomeButtonActive] = useState(false);
  const [fitButtonActive, setFitButtonActive] = useState(false);
  const [homeLocation, setHomeLocation] = useState({
    center: DEFAULT_CENTER,
    radius: DEFAULT_HOME_RADIUS,
  });
  const [siblingPairLoading, setSiblingPairLoading] = useState(false);

  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const mapboxRef = useRef<typeof mapboxglType | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInitRef = useRef(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
  const lastSplitMapHeightRef = useRef(500);

  const {
    mapStyle,
    setMapStyle,
    show3DBuildings,
    setShow3DBuildings,
    showTerrain,
    setShowTerrain,
  } = useMapPreferences();

  const { visibleColumns, toggleColumn, reorderColumns, moveColumn } = useColumnVisibility({
    columns: NETWORK_COLUMNS,
  });

  const {
    filtersOpen,
    showColumnSelector,
    showAgenciesPanel,
    showCourthousesPanel,
    toggleFilters,
    toggleColumnSelector,
    toggleAgenciesPanel,
    toggleCourthousesPanel,
  } = useExplorerPanels();

  const setFilter = useFilterStore((state) => state.setFilter);
  const enabled = useCurrentEnabled();

  const lockBoundingBoxToViewport = useFilterStore((state) =>
    Boolean(state.boundingBoxViewportLocks[state.currentPage])
  );

  // Effective lock only active if bounding box filter is enabled
  const effectiveViewportLock = enabled.boundingBox && lockBoundingBoxToViewport;

  // Quick Search Effect
  useQuickSearchFilterSync({ quickSearch });

  const {
    locationSearch,
    setLocationSearch,
    searchResults,
    showSearchResults,
    setShowSearchResults,
    searchingLocation,
    locationSearchRef,
    flyToLocation,
  } = useLocationSearch({ mapRef, mapboxRef, logError });

  const debouncedFilterState = useDebouncedFilterState();

  useResetPaginationOnFilters({
    debouncedFilterState,
    sort,
    locationMode,
    resetPagination,
  });

  useHomeLocation({ setHomeLocation, logError });
  useMapDimensions({ setContainerHeight, setMapHeight });
  useBoundingBoxFilter({
    mapReady,
    mapRef,
    enabled: enabled.boundingBox,
    syncToViewport: lockBoundingBoxToViewport,
    setFilter: setFilter as any,
  });

  useMapInteractionLock({
    mapReady,
    mapRef,
    isLocked: effectiveViewportLock,
  });

  useHomeLocationLayer({ mapReady, mapRef, homeLocation });
  useRadiusFilterLayer({ mapReady, mapRef });
  useRadiusFilterPopup({ mapReady, mapRef, mapboxRef });

  const { activeObservationSets, observationCount, networkLookup } = useObservationSummary({
    selectedNetworks,
    observationsByBssid,
    networks,
  });

  const handleMouseDown = useMapResizeHandle({
    mapHeight,
    containerHeight,
    mapRef,
    setMapHeight,
    setResizing: () => {},
    logDebug,
  });

  useEffect(() => {
    const mapCollapsed = mapHeight <= MAP_HEADER_HEIGHT;
    const tableCollapsed = mapHeight >= containerHeight - 1;
    if (!mapCollapsed && !tableCollapsed) {
      lastSplitMapHeightRef.current = mapHeight;
    }
  }, [containerHeight, mapHeight]);

  const handlePaneSnap = useCallback(
    (target: 'map' | 'table') => {
      const fallbackHeight = Math.floor(containerHeight * 0.75);
      const restoreHeight = Math.max(
        MAP_HEADER_HEIGHT + MIN_TABLE_HEIGHT,
        Math.min(
          containerHeight - MIN_TABLE_HEIGHT,
          lastSplitMapHeightRef.current || fallbackHeight
        )
      );
      const nextHeight =
        target === 'map'
          ? mapHeight >= containerHeight - 1
            ? restoreHeight
            : containerHeight
          : mapHeight <= MAP_HEADER_HEIGHT
            ? restoreHeight
            : MAP_HEADER_HEIGHT;

      if (nextHeight !== MAP_HEADER_HEIGHT && nextHeight !== containerHeight) {
        lastSplitMapHeightRef.current = nextHeight;
      }

      logDebug(`Snap ${target} pane to map height: ${nextHeight}`);
      setMapHeight(nextHeight);
      if (mapRef.current) {
        setTimeout(() => mapRef.current?.resize(), 0);
      }
    },
    [containerHeight, logDebug, mapHeight]
  );

  useGeospatialMap({
    mapStyle,
    homeLocation,
    mapRef,
    mapboxRef,
    mapContainerRef,
    mapInitRef,
    setMapReady,
    setMapError,
    logError,
  });

  const {
    mode: searchMode,
    setMode: setSearchMode,
    loading: directionsLoading,
    fetchRoute,
    clearRoute,
  } = useDirectionsMode(mapRef);

  const { handleColumnSort } = useNetworkSort({
    setSort,
    setError,
    sortMap: API_SORT_MAP,
    columnConfig: NETWORK_COLUMNS,
  });

  const { mediaLocationStatus } = useObservationLayers({
    mapReady,
    mapRef,
    mapboxRef,
    mapStyle,
    activeObservationSets,
    networkLookup,
    wigleObservations,
    isViewportLocked: effectiveViewportLock,
    onOpenContextMenu,
    showNetworkSummaries,
    showMediaLocations,
    homeLat: homeLocation.center[1],
    homeLon: homeLocation.center[0],
  });

  const { toggle3DBuildings, toggleTerrain, add3DBuildings, is3DBuildingsAvailable } =
    useMapLayersToggle({
      mapRef,
      setShow3DBuildings,
      setShowTerrain,
      mapStyle,
    });

  useApplyMapLayerDefaults({
    mapReady,
    mapRef,
    show3DBuildings,
    showTerrain,
    toggle3DBuildings,
    toggleTerrain,
  });

  const { changeMapStyle } = useMapStyleControls({
    mapRef,
    setMapStyle,
    setEmbeddedView,
    setMapError,
    homeLocation,
    activeObservationSets,
    networkLookup,
    show3DBuildings,
    showTerrain,
    add3DBuildings,
    addTerrain: () => toggleTerrain(true),
    logError,
  });

  const toggleWigleForBssids = (bssids: string[]) => {
    const normalized = Array.from(new Set(bssids.filter(Boolean)));
    if (normalized.length === 0) {
      return;
    }

    const active = wigleObservations.observations.length > 0;
    const activeBssids = Array.from(new Set(wigleObservations.bssids || []));
    const sameSelection =
      active &&
      activeBssids.length === normalized.length &&
      normalized.every((bssid) => activeBssids.includes(bssid));

    if (sameSelection) {
      clearWigleObservations();
      return;
    }

    if (normalized.length === 1) {
      const net = networks.find((n) => n.bssid === normalized[0]);
      if (net) {
        loadWigleObservations(net);
        return;
      }
    }

    loadBatchWigleObservations(normalized);
  };

  const manualSiblingTarget = useMemo(() => {
    if (selectedNetworks.size !== 1) {
      return null;
    }
    const sBssid = Array.from(selectedNetworks)[0];
    const cBssid = contextMenuNetwork?.bssid || null;
    if (!sBssid || !cBssid || sBssid === cBssid) {
      return null;
    }
    return {
      bssid: sBssid,
      ssid: networks.find((n) => n.bssid === sBssid)?.ssid || null,
      isLinked: linkedSiblingBssids.has(cBssid),
    };
  }, [contextMenuNetwork, linkedSiblingBssids, networks, selectedNetworks]);

  const handleMarkSiblingPair = async () => {
    const anchor = manualSiblingTarget?.bssid;
    const context = contextMenuNetwork?.bssid;
    if (!anchor || !context) {
      return;
    }
    const relation = manualSiblingTarget?.isLinked ? 'not_sibling' : 'sibling';
    setSiblingPairLoading(true);
    try {
      const res = await networkApi.setNetworkSiblingOverride(anchor, context, relation);
      if (!res?.ok) {
        throw new Error(res?.error || 'Failed');
      }
      setLinkedSiblingBssids((prev) => {
        const next = new Set(prev);
        relation === 'sibling' ? next.add(context) : next.delete(context);
        return next;
      });
      closeContextMenu();
    } catch (err) {
      logError('Sibling error', err);
    } finally {
      setSiblingPairLoading(false);
    }
  };

  const {
    contextMenu: radiusContextMenu,
    closeContextMenu: closeRadiusContextMenu,
    setRadiusFromContextMenu,
    clearRadiusFilter,
  } = useRadiusPinDrop(mapReady, mapRef);

  const missingSiblings = missingSiblingNetworks ?? [];

  const expansionResult = useMemo(
    () =>
      expandNetworksForSiblingSearch(
        networks,
        missingSiblings,
        visibleSiblingGroupMap,
        quickSearch
      ),
    [networks, missingSiblings, visibleSiblingGroupMap, quickSearch]
  );
  const filteredNetworks = expansionResult.networks;
  const unresolvedSearchBssids = useMemo(
    () =>
      getUnresolvedSearchBssids(
        expansionResult.unresolvedBssids,
        hydrationFailedBssids,
        nonRenderableBssids,
        missingDbBssids
      ),
    [expansionResult.unresolvedBssids, hydrationFailedBssids, nonRenderableBssids, missingDbBssids]
  );

  const prevPipelineLogKey = useRef('');
  useEffect(() => {
    const key = [
      quickSearch,
      networks.length,
      filteredNetworks.length,
      visibleSiblingGroupMap.size,
      unresolvedSearchBssids.join(','),
      hydrationFailedBssids.join(','),
    ].join('|');
    if (key === prevPipelineLogKey.current) {
      return;
    }
    prevPipelineLogKey.current = key;

    logSiblingTopology('expandNetworksForSiblingSearch', {
      quickSearch: quickSearch.trim() || '(none)',
      searchHitCount: networks.length,
      includeBssidCount: visibleSiblingGroupMap.size,
      hydratedRowCount: filteredNetworks.length,
      expandedRowCount: filteredNetworks.length,
      unresolvedBssids: unresolvedSearchBssids,
      graphMapSize: visibleSiblingGroupMap.size,
      componentSizes: componentSizesFromGroupMap(visibleSiblingGroupMap),
    });
    logSiblingTopology('renderPipeline', {
      apiNetworkCount: networks.length,
      filteredNetworksCount: filteredNetworks.length,
      graphMapSize: visibleSiblingGroupMap.size,
      hydrationFailedBssids,
      unresolvedSearchBssids,
      quickSearch: quickSearch.trim() || '(none)',
    });
  }, [
    quickSearch,
    networks.length,
    filteredNetworks.length,
    visibleSiblingGroupMap.size,
    unresolvedSearchBssids,
    hydrationFailedBssids,
  ]);

  return {
    mapHeight,
    containerHeight,
    mapStyle,
    show3DBuildings,
    showTerrain,
    embeddedView,
    quickSearch,
    setQuickSearch,
    mapReady,
    mapError,
    homeButtonActive,
    setHomeButtonActive,
    fitButtonActive,
    setFitButtonActive,
    homeLocation,
    tableContainerRef,
    mapRef,
    mapboxRef,
    mapContainerRef,
    columnDropdownRef,
    visibleColumns,
    toggleColumn,
    reorderColumns,
    moveColumn,
    filtersOpen,
    showColumnSelector,
    showAgenciesPanel,
    showCourthousesPanel,
    toggleFilters,
    toggleColumnSelector,
    toggleAgenciesPanel,
    toggleCourthousesPanel,
    locationSearch,
    setLocationSearch,
    searchResults,
    showSearchResults,
    setShowSearchResults,
    searchingLocation,
    locationSearchRef,
    flyToLocation,
    activeObservationSets,
    observationCount,
    networkLookup,
    handleMouseDown,
    handlePaneSnap,
    searchMode,
    setSearchMode,
    directionsLoading,
    fetchRoute,
    clearRoute,
    handleColumnSort,
    toggle3DBuildings,
    toggleTerrain,
    is3DBuildingsAvailable,
    changeMapStyle,
    isViewportLocked: effectiveViewportLock,
    locationMode,
    setLocationMode,
    siblingPairLoading,
    toggleWigleForBssids,
    manualSiblingTarget,
    handleMarkSiblingPair,
    filteredNetworks,
    unresolvedSearchBssids,
    hydrationFailedBssids,
    nonRenderableBssids,
    missingDbBssids,
    linkedSiblingBssids,
    visibleSiblingGroupMap,
    setLinkedSiblingBssids,
    radiusContextMenu,
    closeRadiusContextMenu,
    setRadiusFromContextMenu,
    clearRadiusFilter,
    siblingHydrating,
    mediaLocationStatus,
  };
};
