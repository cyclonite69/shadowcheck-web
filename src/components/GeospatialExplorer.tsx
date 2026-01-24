import React, { useEffect, useMemo, useRef, useState } from 'react';
import type mapboxglType from 'mapbox-gl';
import { useDebouncedFilters, useFilterStore } from '../stores/filterStore';
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
  // Set current page for filter scoping
  usePageFilters('geospatial');
  const DEBUG_TIMEGRID = false;

  // Location mode and plan check state (needed by useNetworkData)
  const [locationMode, setLocationMode] = useState('latest_observation');
  const [planCheck, setPlanCheck] = useState(false);

  // Network data hook - handles fetching, pagination, sorting
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

  // Server-side sorting - no client-side sorting needed
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

  // Observations hook - handles fetching observations for selected networks
  const {
    observationsByBssid,
    loading: loadingObservations,
    total: observationsTotal,
    truncated: observationsTruncated,
    renderBudgetExceeded,
    renderBudget,
  } = useObservations(selectedNetworks, { useFilters: useObservationFilters });

  // UI state
  const [mapHeight, setMapHeight] = useState<number>(500);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const [mapStyle, setMapStyle] = useState<string>(() => {
    return localStorage.getItem('shadowcheck_map_style') || 'mapbox://styles/mapbox/dark-v11';
  });
  const [show3DBuildings, setShow3DBuildings] = useState<boolean>(() => {
    return localStorage.getItem('shadowcheck_show_3d_buildings') === 'true';
  });
  const [showTerrain, setShowTerrain] = useState<boolean>(() => {
    return localStorage.getItem('shadowcheck_show_terrain') === 'true';
  });
  const [embeddedView, setEmbeddedView] = useState<'street-view' | 'earth' | null>(null);
  const [resizing, setResizing] = useState(false);
  const { visibleColumns, toggleColumn } = useColumnVisibility({
    columns: NETWORK_COLUMNS,
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Map and location state
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [homeButtonActive, setHomeButtonActive] = useState(false);
  const [fitButtonActive, setFitButtonActive] = useState(false);
  const [homeLocation, setHomeLocation] = useState<{
    center: [number, number];
    radius: number;
  }>({ center: DEFAULT_CENTER, radius: DEFAULT_HOME_RADIUS });

  const {
    contextMenu,
    tagLoading,
    contextMenuRef,
    openContextMenu,
    closeContextMenu,
    handleTagAction,
  } = useNetworkContextMenu({ logError });

  const {
    showNoteModal,
    setShowNoteModal,
    selectedBssid,
    setSelectedBssid,
    noteContent,
    setNoteContent,
    noteType,
    setNoteType,
    noteAttachments,
    setNoteAttachments,
    fileInputRef,
    handleSaveNote,
    handleAddAttachment,
    removeAttachment,
  } = useNetworkNotes({ logError });

  // Time-frequency modal state
  const [timeFreqModal, setTimeFreqModal] = useState<{ bssid: string; ssid: string } | null>(null);

  useFilterURLSync();
  const { getCurrentEnabled, setFilter } = useFilterStore();
  const enabled = getCurrentEnabled();

  // Set up debounced filter state
  const [debouncedFilterState, setDebouncedFilterState] = useState(() =>
    useFilterStore.getState().getAPIFilters()
  );
  useDebouncedFilters((payload) => setDebouncedFilterState(payload), 500);

  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxglType.Map | null>(null);
  const mapboxRef = useRef<mapboxglType | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInitRef = useRef(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);
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

  // Location search moved into useLocationSearch hook

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [JSON.stringify(debouncedFilterState), JSON.stringify(sort), locationMode, resetPagination]);

  useHomeLocation({ setHomeLocation, logError });

  useMapDimensions({ setContainerHeight, setMapHeight });
  useBoundingBoxFilter({
    mapReady,
    mapRef,
    enabled: enabled.boundingBox,
    setFilter,
  });

  useHomeLocationLayer({ mapReady, mapRef, homeLocation });

  // Apply persisted 3D buildings and terrain settings when map is ready
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    // Apply 3D buildings if persisted as enabled
    if (show3DBuildings) {
      add3DBuildings();
    }

    // Apply terrain if persisted as enabled
    if (showTerrain) {
      addTerrain();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]); // Only run when map becomes ready, not when settings change

  const activeObservationSets = useMemo(
    () =>
      Array.from(selectedNetworks).map((bssid) => ({
        bssid,
        observations: observationsByBssid[bssid] || [],
      })),
    [observationsByBssid, selectedNetworks]
  );
  const observationCount = useMemo(
    () => activeObservationSets.reduce((acc, set) => acc + set.observations.length, 0),
    [activeObservationSets]
  );
  const networkLookup = useMemo(() => {
    const map = new Map<string, NetworkRow>();
    networks.forEach((net) => {
      map.set(net.bssid, net);
    });
    return map;
  }, [networks]);

  const handleMouseDown = useMapResizeHandle({
    mapHeight,
    containerHeight,
    mapRef,
    setMapHeight,
    setResizing,
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

  useNetworkInfiniteScroll({
    containerRef: tableContainerRef,
    hasMore: pagination.hasMore,
    isLoadingMore,
    onLoadMore: loadMore,
  });

  const handleColumnSort = (column: keyof NetworkRow, _shiftKey: boolean) => {
    const colConfig = NETWORK_COLUMNS[column as keyof typeof NETWORK_COLUMNS];
    if (!colConfig || !colConfig.sortable) return;
    if (!API_SORT_MAP[column]) {
      setError(`Sort not supported for ${String(column)}`);
      return;
    }

    setSort((prevSort) => {
      const existingIndex = prevSort.findIndex((s) => s.column === column);
      const nextDirection =
        existingIndex >= 0 && prevSort[existingIndex].direction === 'asc' ? 'desc' : 'asc';

      if (_shiftKey) {
        const next = [...prevSort];
        if (existingIndex >= 0) {
          next[existingIndex] = { column, direction: nextDirection };
        } else {
          next.push({ column, direction: 'asc' });
        }
        return next;
      }

      return [{ column, direction: existingIndex >= 0 ? nextDirection : 'asc' }];
    });
  };

  useObservationLayers({
    mapReady,
    mapRef,
    mapboxRef,
    activeObservationSets,
    networkLookup,
  });

  const { toggle3DBuildings, toggleTerrain } = useMapLayersToggle({
    mapRef,
    setShow3DBuildings,
    setShowTerrain,
  });

  // Helper functions for internal use
  const add3DBuildings = () => toggle3DBuildings(true);
  const addTerrain = () => toggleTerrain(true);

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
    addTerrain,
    logError,
  });

  return (
    <GeospatialLayout
      filtersOpen={filtersOpen}
      filterPanel={<GeospatialFiltersPanel />}
      content={
        <>
          {/* Map Card */}
          <MapSection
            mapHeight={mapHeight}
            title="ShadowCheck Geospatial Intelligence"
            toolbar={
              <MapToolbarActions
                locationSearchRef={locationSearchRef}
                locationSearch={locationSearch}
                setLocationSearch={setLocationSearch}
                searchingLocation={searchingLocation}
                showSearchResults={showSearchResults}
                setShowSearchResults={setShowSearchResults}
                searchResults={searchResults}
                onSelectSearchResult={flyToLocation}
                mapStyle={mapStyle}
                onMapStyleChange={changeMapStyle}
                mapStyles={MAP_STYLES}
                show3DBuildings={show3DBuildings}
                toggle3DBuildings={toggle3DBuildings}
                showTerrain={showTerrain}
                toggleTerrain={toggleTerrain}
                fitButtonActive={fitButtonActive}
                canFit={selectedNetworks.size > 0}
                mapboxRef={mapboxRef}
                mapRef={mapRef}
                activeObservationSets={activeObservationSets}
                setFitButtonActive={setFitButtonActive}
                homeButtonActive={homeButtonActive}
                setHomeButtonActive={setHomeButtonActive}
                homeLocation={homeLocation}
                logError={logError}
              />
            }
            mapReady={mapReady}
            mapError={mapError}
            embeddedView={embeddedView}
            mapRef={mapRef}
            mapContainerRef={mapContainerRef}
            onResizeMouseDown={handleMouseDown}
          />

          <NetworkExplorerSection
            expensiveSort={expensiveSort}
            planCheck={planCheck}
            onPlanCheckChange={setPlanCheck}
            locationMode={locationMode}
            onLocationModeChange={setLocationMode}
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            showColumnSelector={showColumnSelector}
            columnDropdownRef={columnDropdownRef}
            visibleColumns={visibleColumns}
            columns={NETWORK_COLUMNS}
            onToggleColumnSelector={() => setShowColumnSelector((v) => !v)}
            onToggleColumn={toggleColumn}
            sort={sort}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={toggleSelectAll}
            onColumnSort={handleColumnSort}
            tableContainerRef={tableContainerRef}
            loadingNetworks={loadingNetworks}
            filteredNetworks={filteredNetworks}
            error={error}
            selectedNetworks={selectedNetworks}
            onSelectExclusive={selectNetworkExclusive}
            onOpenContextMenu={openContextMenu}
            onToggleSelectNetwork={toggleSelectNetwork}
            isLoadingMore={isLoadingMore}
            hasMore={pagination.hasMore}
            onLoadMore={loadMore}
            visibleCount={filteredNetworks.length}
            networkTruncated={networkTruncated}
            networkTotal={networkTotal}
            selectedCount={selectedNetworks.size}
            observationCount={observationCount}
            observationsTruncated={observationsTruncated}
            observationsTotal={observationsTotal}
            renderBudgetExceeded={renderBudgetExceeded}
            renderBudget={renderBudget}
            loadingObservations={loadingObservations}
          />
        </>
      }
      overlays={
        <GeospatialOverlays
          contextMenu={contextMenu}
          tagLoading={tagLoading}
          contextMenuRef={contextMenuRef}
          onTagAction={handleTagAction}
          onCloseContextMenu={closeContextMenu}
          onOpenTimeFrequency={() => {
            const n = contextMenu.network;
            const payload = n ? { bssid: String(n.bssid || ''), ssid: String(n.ssid || '') } : null;
            setTimeFreqModal(payload);
            closeContextMenu();
          }}
          onOpenNote={() => {
            setShowNoteModal(true);
            setSelectedBssid(contextMenu.network?.bssid || '');
            closeContextMenu();
          }}
          showNoteModal={showNoteModal}
          selectedBssid={selectedBssid}
          noteType={noteType}
          noteContent={noteContent}
          noteAttachments={noteAttachments}
          fileInputRef={fileInputRef}
          onNoteTypeChange={setNoteType}
          onNoteContentChange={setNoteContent}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={removeAttachment}
          onCloseNoteOverlay={() => setShowNoteModal(false)}
          onCloseNote={() => {
            setShowNoteModal(false);
            setNoteContent('');
            setNoteAttachments([]);
          }}
          onCancelNote={() => {
            setShowNoteModal(false);
            setNoteContent('');
            setNoteType('general');
            setNoteAttachments([]);
          }}
          onSaveNote={handleSaveNote}
          timeFreqModal={timeFreqModal}
          onCloseTimeFrequency={() => setTimeFreqModal(null)}
        />
      }
    />
  );
}
