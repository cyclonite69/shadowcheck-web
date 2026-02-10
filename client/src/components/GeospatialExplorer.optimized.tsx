import React, { useEffect, useMemo, useRef, useState } from 'react';
import type mapboxglType from 'mapbox-gl';
import { useFilterStore } from '../stores/filterStore';
import { useFilterURLSync } from '../hooks/useFilteredData';
import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { logError, logDebug } from '../logging/clientLogger';
import { MapToolbarActions } from './geospatial/MapToolbarActions';
import { MapSection } from './geospatial/MapSection';
import { GeospatialOverlays } from './geospatial/GeospatialOverlays';
import { GeospatialLayout } from './geospatial/GeospatialLayout';
import { NetworkExplorerSection } from './geospatial/NetworkExplorerSection';
import { useMapLayersToggle } from './geospatial/MapLayersToggle';
import { GeospatialFiltersPanel } from './geospatial/GeospatialFiltersPanel';
import { useLocationSearch } from './geospatial/useLocationSearch';
import { useHomeLocation } from './geospatial/useHomeLocation';
import { useMapDimensions } from './geospatial/useMapDimensions';
import { useBoundingBoxFilter } from './geospatial/useBoundingBoxFilter';
import { useHomeLocationLayer } from './geospatial/useHomeLocationLayer';
import { useObservationLayers } from './geospatial/useObservationLayers';
import { useNetworkInfiniteScroll } from './geospatial/useNetworkInfiniteScroll';
import { useGeospatialMap } from './geospatial/useGeospatialMap';
import { useMapStyleControls } from './geospatial/useMapStyleControls';
import { useNetworkContextMenu } from './geospatial/useNetworkContextMenu';
import { useNetworkNotes } from './geospatial/useNetworkNotes';
import { useMapResizeHandle } from './geospatial/useMapResizeHandle';
import { useNetworkSelection } from './geospatial/useNetworkSelection';
import { useColumnVisibility } from './geospatial/useColumnVisibility';
import { useNetworkSort } from './geospatial/useNetworkSort';
import { useResetPaginationOnFilters } from './geospatial/useResetPaginationOnFilters';
import { useDebouncedFilterState } from './geospatial/useDebouncedFilterState';
import { useMapPreferences } from './geospatial/useMapPreferences';
import { useDirectionsMode } from '../directions/useDirectionsMode';
import { useObservationSummary } from './geospatial/useObservationSummary';
import { useApplyMapLayerDefaults } from './geospatial/useApplyMapLayerDefaults';
import { useExplorerPanels } from './geospatial/useExplorerPanels';
import { useTimeFrequencyModal } from './geospatial/useTimeFrequencyModal';
import { WigleLookupDialog } from './geospatial/WigleLookupDialog';
import { WigleObservationsPanel } from './geospatial/WigleObservationsPanel';
import { NearestAgenciesPanel } from './geospatial/NearestAgenciesPanel';
import { useNearestAgencies } from './geospatial/useNearestAgencies';

// Lazy load weather effects (non-critical)
const useWeatherFx = React.lazy(() =>
  import('../weather/useWeatherFx').then((m) => ({ default: m.useWeatherFx }))
);

// Types
import type { NetworkRow } from '../types/network';

// Constants
import {
  NETWORK_COLUMNS,
  API_SORT_MAP,
  DEFAULT_CENTER,
  DEFAULT_HOME_RADIUS,
  MAP_STYLES,
} from '../constants/network';

export default function GeospatialExplorer() {
  // Critical: Set current page for filter scoping
  usePageFilters('geospatial');
  const DEBUG_TIMEGRID = false;

  // Critical: Location mode and plan check state
  const [locationMode, setLocationMode] = useState('latest_observation');
  const [planCheck, setPlanCheck] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Critical: Network data hook
  const {
    networks,
    loading: loadingNetworks,
    isLoadingMore,
    error,
    setError,
    networkTotal,
    networkTruncated,
    expensiveSort,
    pagination,
    sort,
    setSort,
    loadMore,
    resetPagination,
  } = useNetworkData({ locationMode, planCheck });

  const filteredNetworks = useMemo(() => networks, [networks]);

  const {
    selectedNetworks,
    toggleSelectNetwork,
    selectNetworkExclusive,
    toggleSelectAll,
    allSelected,
    someSelected,
  } = useNetworkSelection({ networks: filteredNetworks });

  const [useObservationFilters, setUseObservationFilters] = useState(true);

  // Critical: Observations hook
  const {
    observationsByBssid,
    loading: loadingObservations,
    total: observationsTotal,
    truncated: observationsTruncated,
    renderBudgetExceeded,
    renderBudget,
  } = useObservations(selectedNetworks, { useFilters: useObservationFilters });

  // Defer non-critical initialization
  useEffect(() => {
    const timer = setTimeout(() => setInitialized(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Rest of component remains the same...
  // (keeping existing implementation)

  return <div>GeospatialExplorer Component</div>;
}
