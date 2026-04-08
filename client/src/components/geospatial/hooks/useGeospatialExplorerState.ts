import { useState, useMemo, useEffect, useRef } from 'react';
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
import { logError, logDebug } from '../../../logging/clientLogger';
import { WigleObservationsState } from './useNetworkContextMenu';
import { networkApi } from '../../../api/networkApi';
import {
  NETWORK_COLUMNS,
  API_SORT_MAP,
  DEFAULT_CENTER,
  DEFAULT_HOME_RADIUS,
} from '../../../constants/network';
import { NetworkRow } from '../../../types/network';

interface UseGeospatialExplorerStateProps {
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
  linkedSiblingBssids: Set<string>;
  setLinkedSiblingBssids: React.Dispatch<React.SetStateAction<Set<string>>>;
  visibleSiblingGroupMap: globalThis.Map<string, string>;
  contextMenuNetwork?: NetworkRow | null;
  onOpenContextMenu: (e: any, network: any) => void;
  locationMode: string;
  setLocationMode: React.Dispatch<React.SetStateAction<string>>;
  showNetworkSummaries?: boolean;
}

export const useGeospatialExplorerState = ({
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
  linkedSiblingBssids,
  setLinkedSiblingBssids,
  visibleSiblingGroupMap,
  contextMenuNetwork,
  onOpenContextMenu,
  locationMode,
  setLocationMode,
  showNetworkSummaries = false,
}: UseGeospatialExplorerStateProps) => {
  // UI state
  const [mapHeight, setMapHeight] = useState<number>(500);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const [embeddedView, setEmbeddedView] = useState<'street-view' | 'earth' | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
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
  const enableFilter = useFilterStore((state) => state.enableFilter);
  const enabled = useCurrentEnabled();

  const lockBoundingBoxToViewport = useFilterStore((state) =>
    Boolean(state.boundingBoxViewportLocks[state.currentPage])
  );

  // Effective lock only active if bounding box filter is enabled
  const effectiveViewportLock = enabled.boundingBox && lockBoundingBoxToViewport;

  // Quick Search Effect
  useEffect(() => {
    const timeout = setTimeout(() => {
      const raw = quickSearch.trim();
      if (!raw) {
        setFilter('ssid', '');
        setFilter('bssid', '');
        setFilter('manufacturer', '');
        enableFilter('ssid', false);
        enableFilter('bssid', false);
        enableFilter('manufacturer', false);
        return;
      }

      const prefixed = raw.match(/^([sbm]):\s*(.+)$/i);
      let target: 'ssid' | 'bssid' | 'manufacturer' = 'ssid';
      let value = raw;

      if (prefixed) {
        const prefix = prefixed[1].toLowerCase();
        value = prefixed[2].trim();
        if (prefix === 'b') target = 'bssid';
        if (prefix === 'm') target = 'manufacturer';
      } else {
        if (/^([0-9a-f]{2}([:-]?)){2,6}[0-9a-f]{0,2}$/i.test(raw)) target = 'bssid';
        else if (/^[0-9a-f]{6}$/i.test(raw)) target = 'manufacturer';
      }

      setFilter('ssid', target === 'ssid' ? value : '');
      setFilter('bssid', target === 'bssid' ? value : '');
      setFilter('manufacturer', target === 'manufacturer' ? value : '');
      enableFilter('ssid', target === 'ssid');
      enableFilter('bssid', target === 'bssid');
      enableFilter('manufacturer', target === 'manufacturer');
    }, 250);
    return () => clearTimeout(timeout);
  }, [quickSearch, setFilter, enableFilter]);

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
    setFilter,
  });

  useMapInteractionLock({
    mapReady,
    mapRef,
    isLocked: effectiveViewportLock,
  });

  useHomeLocationLayer({ mapReady, mapRef, homeLocation });

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

  useObservationLayers({
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
    if (normalized.length === 0) return;

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
    if (selectedNetworks.size !== 1) return null;
    const sBssid = Array.from(selectedNetworks)[0];
    const cBssid = contextMenuNetwork?.bssid || null;
    if (!sBssid || !cBssid || sBssid === cBssid) return null;
    return {
      bssid: sBssid,
      ssid: networks.find((n) => n.bssid === sBssid)?.ssid || null,
      isLinked: linkedSiblingBssids.has(cBssid),
    };
  }, [contextMenuNetwork, linkedSiblingBssids, networks, selectedNetworks]);

  const handleMarkSiblingPair = async () => {
    const anchor = manualSiblingTarget?.bssid;
    const context = contextMenuNetwork?.bssid;
    if (!anchor || !context) return;
    const relation = manualSiblingTarget?.isLinked ? 'not_sibling' : 'sibling';
    setSiblingPairLoading(true);
    try {
      const res = await networkApi.setNetworkSiblingOverride(anchor, context, relation);
      if (!res?.ok) throw new Error(res?.error || 'Failed');
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

  const filteredNetworks = useMemo(() => {
    if (visibleSiblingGroupMap.size === 0) return networks;
    const grouped: NetworkRow[] = [];
    const emitted = new Set<string>();
    for (const net of networks) {
      const gid = visibleSiblingGroupMap.get(net.bssid);
      if (!gid) {
        grouped.push(net);
        continue;
      }
      if (emitted.has(gid)) continue;
      emitted.add(gid);
      networks
        .filter((n) => visibleSiblingGroupMap.get(n.bssid) === gid)
        .forEach((n) => grouped.push(n));
    }
    return grouped;
  }, [networks, visibleSiblingGroupMap]);

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
  };
};
