import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map } from 'mapbox-gl';
import type * as mapboxglType from 'mapbox-gl';
import { useFilterStore } from '../stores/filterStore';
import { useFilterURLSync } from '../hooks/useFilterURLSync';
import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { networkApi } from '../api/networkApi';
import { useAuth } from '../hooks/useAuth';
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
import { useWeatherFx } from '../weather/useWeatherFx';
import { renderAgencyPopupCard } from '../utils/geospatial/renderMapPopupCards';
import { fitBoundsWithZoomInset } from '../utils/geospatial/mapViewUtils';

// Types

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
  const { isAdmin } = useAuth();

  // Location mode
  const [locationMode, setLocationMode] = useState('latest_observation');
  const [quickSearch, setQuickSearch] = useState('');

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
  } = useNetworkData({ locationMode });

  const {
    selectedNetworks,
    toggleSelectNetwork,
    selectNetworkExclusive,
    toggleSelectAll,
    allSelected,
    someSelected,
  } = useNetworkSelection({
    networks,
    onSelectionChange: (newSelection) => {
      // Auto-close panels when selection changes to a different network
      const newBssid = newSelection.size > 0 ? Array.from(newSelection)[0] : null;
      const prevBssid = selectedNetworks.size > 0 ? Array.from(selectedNetworks)[0] : null;

      if (newBssid !== prevBssid) {
        // Close panels when selecting a different network
        if (wigleObservations.observations.length > 0) {
          clearWigleObservations();
        }
        // Note: agencies panel will auto-refresh for new network
        if (timeFreqModal) {
          closeTimeFrequency();
        }
      }
    },
  });

  // Observations hook - handles fetching observations for selected networks
  const {
    observationsByBssid,
    loading: loadingObservations,
    total: observationsTotal,
    truncated: observationsTruncated,
    renderBudgetExceeded,
    renderBudget,
  } = useObservations(selectedNetworks, { useFilters: true });

  // UI state
  const [mapHeight, setMapHeight] = useState<number>(500);
  const [containerHeight, setContainerHeight] = useState<number>(800);
  const {
    mapStyle,
    setMapStyle,
    show3DBuildings,
    setShow3DBuildings,
    showTerrain,
    setShowTerrain,
  } = useMapPreferences();
  const [embeddedView, setEmbeddedView] = useState<'street-view' | 'earth' | null>(null);
  const [siblingPairLoading, setSiblingPairLoading] = useState(false);
  const [linkedSiblingBssids, setLinkedSiblingBssids] = useState<Set<string>>(new Set());
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

  // Nearest agencies for selected network(s)
  const nearestAgencyBssid = useMemo(() => {
    if (selectedNetworks.size === 1) {
      return Array.from(selectedNetworks)[0];
    } else if (selectedNetworks.size > 1) {
      return Array.from(selectedNetworks);
    }
    return null;
  }, [selectedNetworks]);

  const {
    agencies,
    loading: agenciesLoading,
    error: agenciesError,
  } = useNearestAgencies(showAgenciesPanel ? nearestAgencyBssid : null);

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
    handleGenerateThreatReportPdf,
    wigleLookupDialog,
    closeWigleLookupDialog,
    handleWigleLookup,
    wigleObservations,
    loadWigleObservations,
    loadBatchWigleObservations,
    clearWigleObservations,
  } = useNetworkContextMenu({ logError, onTagUpdated: resetPagination });

  const manualSiblingTarget = useMemo(() => {
    if (selectedNetworks.size !== 1) {
      return null;
    }

    const selectedBssid = Array.from(selectedNetworks)[0];
    const contextBssid = contextMenu.network?.bssid || null;
    if (!selectedBssid || !contextBssid || selectedBssid === contextBssid) {
      return null;
    }

    const selectedNetwork = networks.find((network) => network.bssid === selectedBssid);
    return {
      bssid: selectedBssid,
      ssid: selectedNetwork?.ssid || null,
      isLinked: linkedSiblingBssids.has(contextBssid),
    };
  }, [contextMenu.network, linkedSiblingBssids, networks, selectedNetworks]);

  const {
    showNoteModal,
    setShowNoteModal,
    selectedBssid,
    hasExistingNote,
    noteContent,
    setNoteContent,
    noteType,
    setNoteType,
    noteAttachments,
    setNoteAttachments,
    fileInputRef,
    openNoteModalForBssid,
    resetNoteState,
    handleSaveNote,
    handleAddAttachment,
    removeAttachment,
  } = useNetworkNotes({ logError });

  const { timeFreqModal, openTimeFrequency, closeTimeFrequency } = useTimeFrequencyModal();

  const selectedAnchorBssid = useMemo(() => {
    if (selectedNetworks.size !== 1) {
      return null;
    }
    return Array.from(selectedNetworks)[0];
  }, [selectedNetworks]);

  useEffect(() => {
    if (!isAdmin || !selectedAnchorBssid) {
      setLinkedSiblingBssids(new Set());
      return;
    }

    let cancelled = false;

    const loadSiblingLinks = async () => {
      try {
        const result = await networkApi.getNetworkSiblingLinks(selectedAnchorBssid);
        if (cancelled) {
          return;
        }
        const nextSet = new Set<string>(
          Array.isArray(result?.links)
            ? result.links
                .map((row: any) =>
                  String(row?.sibling_bssid || '')
                    .trim()
                    .toUpperCase()
                )
                .filter(Boolean)
            : []
        );
        setLinkedSiblingBssids(nextSet);
      } catch (error) {
        if (!cancelled) {
          logError('Failed to load sibling links', error);
          setLinkedSiblingBssids(new Set());
        }
      }
    };

    void loadSiblingLinks();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, selectedAnchorBssid]);

  const handleMarkSiblingPair = async () => {
    const anchorBssid = manualSiblingTarget?.bssid;
    const contextBssid = contextMenu.network?.bssid || null;
    const relation = manualSiblingTarget?.isLinked ? 'not_sibling' : 'sibling';

    if (!anchorBssid || !contextBssid || anchorBssid === contextBssid) {
      return;
    }

    setSiblingPairLoading(true);
    try {
      const result = await networkApi.setNetworkSiblingOverride(
        anchorBssid,
        contextBssid,
        relation
      );
      if (!result?.ok) {
        throw new Error(result?.error || 'Failed to save sibling pair');
      }
      setLinkedSiblingBssids((prev) => {
        const next = new Set(prev);
        if (relation === 'sibling') {
          next.add(contextBssid);
        } else {
          next.delete(contextBssid);
        }
        return next;
      });
      closeContextMenu();
      alert(
        `${relation === 'sibling' ? 'Saved' : 'Removed'} sibling pair:\n${anchorBssid}\n${contextBssid}`
      );
    } catch (error) {
      logError('Failed to mark manual sibling pair', error);
      alert(
        `Failed to save sibling pair: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setSiblingPairLoading(false);
    }
  };

  useFilterURLSync();
  const { getCurrentEnabled, setFilter, enableFilter } = useFilterStore();
  const enabled = getCurrentEnabled();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const raw = quickSearch.trim();
      const prefixed = raw.match(/^([sbm]):\s*(.+)$/i);

      let target: 'ssid' | 'bssid' | 'manufacturer' = 'ssid';
      let value = raw;

      if (prefixed) {
        const prefix = prefixed[1].toLowerCase();
        value = prefixed[2].trim();
        if (prefix === 'b') target = 'bssid';
        if (prefix === 'm') target = 'manufacturer';
        if (prefix === 's') target = 'ssid';
      } else {
        const macLike = /^([0-9a-f]{2}([:-]?)){2,6}[0-9a-f]{0,2}$/i.test(raw);
        const ouiLike = /^[0-9a-f]{6}$/i.test(raw);
        if (macLike) {
          target = 'bssid';
        } else if (ouiLike) {
          target = 'manufacturer';
        } else {
          target = 'ssid';
        }
      }

      const hasValue = value.length > 0;
      const nextValue = hasValue ? value : '';

      setFilter('ssid', target === 'ssid' ? nextValue : '');
      setFilter('bssid', target === 'bssid' ? nextValue : '');
      setFilter('manufacturer', target === 'manufacturer' ? nextValue : '');

      enableFilter('ssid', hasValue && target === 'ssid');
      enableFilter('bssid', hasValue && target === 'bssid');
      enableFilter('manufacturer', hasValue && target === 'manufacturer');
    }, 250);

    return () => clearTimeout(timeout);
  }, [quickSearch, setFilter, enableFilter]);

  const debouncedFilterState = useDebouncedFilterState();

  const filteredNetworks = networks;
  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const mapboxRef = useRef<typeof mapboxglType | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInitRef = useRef(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
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

  // Weather effects
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
    wigleObservations,
  });

  const { toggle3DBuildings, toggleTerrain, add3DBuildings, is3DBuildingsAvailable } =
    useMapLayersToggle({
      mapRef,
      setShow3DBuildings,
      setShowTerrain,
    });

  const addTerrain = () => toggleTerrain(true);

  useApplyMapLayerDefaults({
    mapReady,
    show3DBuildings,
    showTerrain,
    add3DBuildings,
    addTerrain,
  });

  // Render nearest agency markers
  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapboxRef.current) return;
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;

    const sourceId = 'nearest-agencies';
    const layerId = 'nearest-agencies-layer';

    // Remove existing layer and source
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    if (agencies.length === 0 || !showAgenciesPanel) return;

    // Create features for all agencies
    const features = agencies.map((agency) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [agency.longitude, agency.latitude],
      },
      properties: {
        name: agency.name,
        type: agency.office_type,
        distance: (agency.distance_meters || 0) / 1000,
        hasWigleObs: agency.has_wigle_obs,
      },
    }));

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features,
      },
    });

    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-radius': 6,
        'circle-color': ['case', ['get', 'hasWigleObs'], '#ef4444', '#10b981'],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
      },
    });

    // Add click handler for tooltip
    const clickHandler = (e: any) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const props = feature.properties;

      new mapboxgl.Popup({ className: 'sc-popup', maxWidth: '360px', offset: 14 })
        .setLngLat(e.lngLat)
        .setHTML(
          renderAgencyPopupCard({
            name: props.name,
            officeType: props.type,
            distanceKm: Number(props.distance),
            hasWigleObs: Boolean(props.hasWigleObs),
          })
        )
        .addTo(map);
    };

    const mouseEnterHandler = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const mouseLeaveHandler = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', layerId, clickHandler);
    map.on('mouseenter', layerId, mouseEnterHandler);
    map.on('mouseleave', layerId, mouseLeaveHandler);

    return () => {
      map.off('click', layerId, clickHandler);
      map.off('mouseenter', layerId, mouseEnterHandler);
      map.off('mouseleave', layerId, mouseLeaveHandler);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [mapReady, mapRef, mapboxRef, agencies, showAgenciesPanel]);

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
                onSelectSearchResult={(result) => {
                  if (searchMode === 'directions') {
                    const dest: [number, number] = [result.center[0], result.center[1]];
                    const origin = homeLocation.center;
                    fetchRoute(origin, dest).then((data) => {
                      // Fit map to show the full route from origin to destination
                      if (data && mapRef.current && mapboxRef.current) {
                        const bounds = new (mapboxRef.current as any).LngLatBounds(origin, origin);
                        bounds.extend(dest);
                        for (const coord of data.coordinates) {
                          bounds.extend(coord);
                        }
                        fitBoundsWithZoomInset(mapRef.current, bounds, {
                          padding: 60,
                          duration: 2000,
                        });
                      }
                    });
                    setShowSearchResults(false);
                    setLocationSearch('');
                  } else {
                    flyToLocation(result);
                  }
                }}
                searchMode={searchMode}
                onSearchModeToggle={() => {
                  const next = searchMode === 'address' ? 'directions' : 'address';
                  setSearchMode(next);
                  if (next === 'address') clearRoute();
                }}
                directionsLoading={directionsLoading}
                mapStyle={mapStyle}
                onMapStyleChange={changeMapStyle}
                mapStyles={MAP_STYLES}
                show3DBuildings={show3DBuildings}
                is3DBuildingsAvailable={is3DBuildingsAvailable}
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
                weatherFxMode={weatherFxMode}
                onWeatherFxModeChange={setWeatherFxMode}
                canWigle={selectedNetworks.size > 0}
                wigleLoading={wigleObservations.loading}
                wigleActive={wigleObservations.observations.length > 0}
                selectedCount={selectedNetworks.size}
                onWigle={() => {
                  if (wigleObservations.observations.length > 0) {
                    clearWigleObservations();
                  } else {
                    loadBatchWigleObservations(Array.from(selectedNetworks));
                  }
                }}
                showAgenciesPanel={showAgenciesPanel}
                onToggleAgenciesPanel={toggleAgenciesPanel}
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
            quickSearch={quickSearch}
            onQuickSearchChange={setQuickSearch}
            locationMode={locationMode}
            onLocationModeChange={(mode) => setLocationMode(mode)}
            filtersOpen={filtersOpen}
            onToggleFilters={toggleFilters}
            showColumnSelector={showColumnSelector}
            columnDropdownRef={columnDropdownRef as React.RefObject<HTMLDivElement | null>}
            visibleColumns={visibleColumns}
            columns={NETWORK_COLUMNS}
            onToggleColumnSelector={toggleColumnSelector}
            onToggleColumn={toggleColumn}
            sort={sort}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={toggleSelectAll}
            onColumnSort={handleColumnSort}
            onReorderColumns={reorderColumns}
            tableContainerRef={tableContainerRef as React.RefObject<HTMLDivElement | null>}
            loadingNetworks={loadingNetworks}
            filteredNetworks={filteredNetworks}
            error={error}
            selectedNetworks={selectedNetworks}
            linkedSiblingBssids={linkedSiblingBssids}
            selectedAnchorBssid={selectedAnchorBssid}
            selectedAnchorHasLinkedSiblings={linkedSiblingBssids.size > 0}
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
        <>
          <GeospatialOverlays
            contextMenu={contextMenu}
            tagLoading={tagLoading}
            contextMenuRef={contextMenuRef as React.RefObject<HTMLDivElement>}
            onTagAction={handleTagAction}
            onCloseContextMenu={closeContextMenu}
            onOpenTimeFrequency={() => {
              const n = contextMenu.network;
              const payload = n
                ? { bssid: String(n.bssid || ''), ssid: String(n.ssid || '') }
                : null;
              openTimeFrequency(payload);
              closeContextMenu();
            }}
            onOpenNote={() => {
              const bssid = contextMenu.network?.bssid || '';
              void openNoteModalForBssid(bssid);
              closeContextMenu();
            }}
            hasExistingNote={contextMenu.hasExistingNote}
            onGenerateThreatReport={handleGenerateThreatReportPdf}
            onMapWigleObservations={() => {
              const n = contextMenu.network;
              if (n) {
                loadWigleObservations(n);
              }
              closeContextMenu();
            }}
            wigleObservationsLoading={wigleObservations.loading}
            manualSiblingTarget={manualSiblingTarget}
            onMarkSiblingPair={handleMarkSiblingPair}
            siblingPairLoading={siblingPairLoading}
            showNoteModal={showNoteModal}
            isEditNoteMode={hasExistingNote}
            selectedBssid={selectedBssid}
            noteType={noteType}
            noteContent={noteContent}
            noteAttachments={noteAttachments}
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            onNoteTypeChange={setNoteType}
            onNoteContentChange={setNoteContent}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={removeAttachment}
            onCloseNoteOverlay={() => setShowNoteModal(false)}
            onCloseNote={resetNoteState}
            onCancelNote={resetNoteState}
            onSaveNote={handleSaveNote}
            timeFreqModal={timeFreqModal}
            onCloseTimeFrequency={closeTimeFrequency}
          />
          <WigleLookupDialog
            visible={wigleLookupDialog.visible}
            network={wigleLookupDialog.network}
            loading={wigleLookupDialog.loading}
            result={wigleLookupDialog.result}
            onLookup={handleWigleLookup}
            onClose={closeWigleLookupDialog}
          />
          <WigleObservationsPanel
            bssid={wigleObservations.bssid}
            bssids={wigleObservations.bssids}
            loading={wigleObservations.loading}
            error={wigleObservations.error}
            stats={wigleObservations.stats}
            batchStats={wigleObservations.batchStats}
            onClose={clearWigleObservations}
          />
          {showAgenciesPanel && (
            <NearestAgenciesPanel
              agencies={agencies}
              loading={agenciesLoading}
              error={agenciesError}
              networkCount={selectedNetworks.size}
            />
          )}
        </>
      }
    />
  );
}
