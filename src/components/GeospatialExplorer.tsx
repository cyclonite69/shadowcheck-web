import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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

// Types
import type { NetworkTag, NetworkRow } from '../types/network';

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

  // Selection state for observations
  const [selectedNetworks, setSelectedNetworks] = useState<Set<string>>(new Set());
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
  const [visibleColumns, setVisibleColumns] = useState<(keyof NetworkRow | 'select')[]>(() => {
    const saved = localStorage.getItem('shadowcheck_visible_columns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (key): key is keyof NetworkRow | 'select' =>
              typeof key === 'string' && key in NETWORK_COLUMNS
          );
          if (valid.length) return valid;
        }
      } catch {
        // Fall through to default
      }
    }
    return Object.keys(NETWORK_COLUMNS).filter(
      (k) => NETWORK_COLUMNS[k as keyof typeof NETWORK_COLUMNS].default
    ) as (keyof NetworkRow | 'select')[];
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

  // Context menu state for network tagging
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    network: NetworkRow | null;
    tag: NetworkTag | null;
    position: 'below' | 'above';
  }>({
    visible: false,
    x: 0,
    y: 0,
    network: null,
    tag: null,
    position: 'below',
  });
  const [tagLoading, setTagLoading] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Note modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedBssid, setSelectedBssid] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [noteAttachments, setNoteAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Persist visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('shadowcheck_visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

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

  // Handle resize drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      logDebug(`Resize handle clicked: ${e.clientY}`);
      e.preventDefault();
      e.stopPropagation();
      setResizing(true);

      const startY = e.clientY;
      const startHeight = mapHeight;

      const handleMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        const deltaY = e.clientY - startY;
        const newHeight = Math.max(150, Math.min(containerHeight - 150, startHeight + deltaY));
        logDebug(`Resizing to: ${newHeight}`);
        setMapHeight(newHeight);

        // Force map resize if it exists
        if (mapRef.current) {
          setTimeout(() => mapRef.current?.resize(), 0);
        }
      };

      const handleMouseUp = (e: MouseEvent) => {
        logDebug('Resize ended');
        e.preventDefault();
        setResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [mapHeight, containerHeight]
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

  useNetworkInfiniteScroll({
    containerRef: tableContainerRef,
    hasMore: pagination.hasMore,
    isLoadingMore,
    onLoadMore: loadMore,
  });

  // Server-side sorting - no client-side sorting needed
  const filteredNetworks = useMemo(() => networks, [networks]);

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

  const toggleSelectNetwork = (bssid: string) => {
    setSelectedNetworks((prev) => {
      const ns = new Set(prev);
      ns.has(bssid) ? ns.delete(bssid) : ns.add(bssid);
      return ns;
    });
  };

  const selectNetworkExclusive = (bssid: string) => {
    setSelectedNetworks(new Set([bssid]));
  };

  // Context menu handlers for network tagging
  const openContextMenu = async (e: React.MouseEvent, network: NetworkRow) => {
    e.preventDefault();
    e.stopPropagation();

    const menuHeight = 320; // Height of context menu in pixels
    const menuWidth = 200; // Width of context menu in pixels
    const padding = 10; // Padding from screen edge

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    let posX = e.clientX;
    let posY = e.clientY;
    let position: 'below' | 'above' = 'below';

    // ========== VERTICAL POSITIONING ==========
    // Check if menu would go off bottom of screen
    if (posY + menuHeight + padding > viewportHeight) {
      // Flip menu upward
      posY = e.clientY - menuHeight;
      position = 'above';
    }

    // Ensure menu doesn't go above top of screen
    if (posY < padding) {
      posY = padding;
      position = 'below'; // Reset to below if we hit top
    }

    // ========== HORIZONTAL POSITIONING ==========
    // Check if menu would go off right side of screen
    if (posX + menuWidth + padding > viewportWidth) {
      posX = viewportWidth - menuWidth - padding;
    }

    // Check if menu would go off left side of screen
    if (posX - padding < 0) {
      posX = padding;
    }

    // Fetch current tag state for this network
    try {
      const response = await fetch(`/api/network-tags/${encodeURIComponent(network.bssid)}`);
      const tag = await response.json();
      setContextMenu({
        visible: true,
        x: posX,
        y: posY,
        network,
        tag,
        position,
      });
    } catch (err) {
      logError('Failed to fetch network tag', err);
      setContextMenu({
        visible: true,
        x: posX,
        y: posY,
        network,
        tag: {
          bssid: network.bssid,
          is_ignored: false,
          ignore_reason: null,
          threat_tag: null,
          notes: null,
          exists: false,
        },
        position,
      });
    }
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  };

  const handleTagAction = async (
    action: 'ignore' | 'threat' | 'suspect' | 'false_positive' | 'investigate' | 'clear',
    notes?: string
  ) => {
    if (!contextMenu.network) return;
    setTagLoading(true);
    try {
      const bssid = encodeURIComponent(contextMenu.network.bssid);
      let response;

      switch (action) {
        case 'ignore':
          response = await fetch(`/api/network-tags/${bssid}/ignore`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ignore_reason: 'known_friend' }),
          });
          break;
        case 'threat':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'THREAT', threat_confidence: 1.0 }),
          });
          break;
        case 'suspect':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'SUSPECT', threat_confidence: 0.7 }),
          });
          break;
        case 'false_positive':
          response = await fetch(`/api/network-tags/${bssid}/threat`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threat_tag: 'FALSE_POSITIVE', threat_confidence: 1.0 }),
          });
          break;
        case 'investigate':
          response = await fetch(`/api/network-tags/${bssid}/investigate`, { method: 'PATCH' });
          break;
        case 'clear':
          response = await fetch(`/api/network-tags/${bssid}`, { method: 'DELETE' });
          break;
      }

      if (response?.ok) {
        const result = await response.json();
        setContextMenu((prev) => ({ ...prev, tag: result.tag || { ...prev.tag, exists: false } }));
      }
    } catch (err) {
      logError('Failed to update network tag', err);
    } finally {
      setTagLoading(false);
      closeContextMenu();
    }
  };

  // Save note function
  const handleSaveNote = async () => {
    if (!noteContent.trim() || !selectedBssid) return;

    try {
      // Step 1: Create the note
      const response = await fetch('/api/admin/network-notes/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bssid: selectedBssid,
          content: noteContent,
          note_type: noteType,
          user_id: 'geospatial_user',
        }),
      });

      if (!response.ok) throw new Error('Failed to create note');

      const data = await response.json();
      const noteId = data.note_id;

      // Step 2: Upload attachments if any
      if (noteAttachments.length > 0) {
        for (const file of noteAttachments) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('bssid', selectedBssid);

          const mediaResponse = await fetch(`/api/admin/network-notes/${noteId}/media`, {
            method: 'POST',
            body: formData,
          });

          if (!mediaResponse.ok) {
            console.warn(`Failed to upload media: ${file.name}`);
          }
        }
      }

      // Success: Reset form
      setShowNoteModal(false);
      setNoteContent('');
      setNoteType('general');
      setSelectedBssid('');
      setNoteAttachments([]);
    } catch (err) {
      logError('Failed to save note', err);
    }
  };

  // Handle file selection for attachments
  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNoteAttachments((prev) => [...prev, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment from pending list
  const removeAttachment = (index: number) => {
    setNoteAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);

  const toggleSelectAll = () => {
    if (selectedNetworks.size === filteredNetworks.length) {
      // All selected, deselect all
      setSelectedNetworks(new Set());
    } else {
      // Some or none selected, select all visible
      setSelectedNetworks(new Set(filteredNetworks.map((n) => n.bssid)));
    }
  };

  const allSelected =
    filteredNetworks.length > 0 && selectedNetworks.size === filteredNetworks.length;
  const someSelected = selectedNetworks.size > 0 && selectedNetworks.size < filteredNetworks.length;

  useObservationLayers({
    mapReady,
    mapRef,
    mapboxRef,
    activeObservationSets,
    networkLookup,
  });

  const toggleColumn = (col: keyof NetworkRow | 'select') => {
    setVisibleColumns((v) => (v.includes(col) ? v.filter((c) => c !== col) : [...v, col]));
  };

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
