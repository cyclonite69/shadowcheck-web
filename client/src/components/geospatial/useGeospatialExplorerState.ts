import { useState, useMemo, useEffect, useRef } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { useFilterStore } from '../stores/filterStore';
import { useMapPreferences } from './useMapPreferences';
import { useColumnVisibility } from './useColumnVisibility';
import { useExplorerPanels } from './useExplorerPanels';
import { useLocationSearch } from './useLocationSearch';
import { useHomeLocation } from './useHomeLocation';
import { useMapDimensions } from './useMapDimensions';
import { useBoundingBoxFilter } from './useBoundingBoxFilter';
import { useHomeLocationLayer } from './useHomeLocationLayer';
import { useObservationSummary } from './useObservationSummary';
import { useMapResizeHandle } from './useMapResizeHandle';
import { useGeospatialMap } from './useGeospatialMap';
import { useWeatherFx } from '../weather/useWeatherFx';
import { useDirectionsMode } from '../directions/useDirectionsMode';
import { useNetworkSort } from './useNetworkSort';
import { useObservationLayers } from './useObservationLayers';
import { useMapLayersToggle } from './useMapLayersToggle';
import { useApplyMapLayerDefaults } from './useApplyMapLayerDefaults';
import { useMapStyleControls } from './useMapStyleControls';
import { useResetPaginationOnFilters } from './useResetPaginationOnFilters';
import { useDebouncedFilterState } from './useDebouncedFilterState';
import { logError, logDebug } from '../logging/clientLogger';
import {
  NETWORK_COLUMNS,
  API_SORT_MAP,
  DEFAULT_CENTER,
  DEFAULT_HOME_RADIUS,
} from '../constants/network';
import { NetworkData } from '../types/network';

interface UseGeospatialExplorerStateProps {
  selectedNetworks: Set<string>;
  networks: NetworkData[];
  observationsByBssid: any;
  resetPagination: () => void;
  setSort: (sort: any) => void;
  setError: (err: any) => void;
  locationMode: string;
  sort: any;
}

export const useGeospatialExplorerState = ({
  selectedNetworks,
  networks,
  observationsByBssid,
  resetPagination,
  setSort,
  setError,
  locationMode,
  sort,
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

  const { visibleColumns, toggleColumn, reorderColumns } = useColumnVisibility({
    columns: NETWORK_COLUMNS,
  });

  const {
    filtersOpen,
    showColumnSelector,
    showAgenciesPanel,
    toggleFilters,
    toggleColumnSelector,
    toggleAgenciesPanel,
  } = useExplorerPanels();

  const { setFilter, enableFilter, getCurrentEnabled } = useFilterStore();
  const enabled = getCurrentEnabled();

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
    setFilter,
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

  const { weatherFxMode, setWeatherFxMode } = useWeatherFx(mapRef, mapContainerRef, mapReady);

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
    activeObservationSets,
    networkLookup,
    wigleObservations: null, // Passed from context menu hook in component
  });

  const { toggle3DBuildings, toggleTerrain, add3DBuildings, is3DBuildingsAvailable } =
    useMapLayersToggle({
      mapRef,
      setShow3DBuildings,
      setShowTerrain,
    });

  useApplyMapLayerDefaults({
    mapReady,
    show3DBuildings,
    showTerrain,
    add3DBuildings,
    addTerrain: () => toggleTerrain(true),
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
    filtersOpen,
    showColumnSelector,
    showAgenciesPanel,
    toggleFilters,
    toggleColumnSelector,
    toggleAgenciesPanel,
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
    weatherFxMode,
    setWeatherFxMode,
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
  };
};
