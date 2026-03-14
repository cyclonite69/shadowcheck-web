import { useEffect, useMemo, useState } from 'react';
import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { networkApi } from '../api/networkApi';
import { useAuth } from '../hooks/useAuth';
import { logError } from '../logging/clientLogger';
import { MapToolbarActions } from './geospatial/MapToolbarActions';
import { MapSection } from './geospatial/MapSection';
import { GeospatialOverlays } from './geospatial/GeospatialOverlays';
import { GeospatialLayout } from './geospatial/GeospatialLayout';
import { NetworkExplorerSection } from './geospatial/NetworkExplorerSection';
import { GeospatialFiltersPanel } from './geospatial/GeospatialFiltersPanel';
import { useNearestAgencies } from './geospatial/useNearestAgencies';
import { useNetworkContextMenu } from './geospatial/useNetworkContextMenu';
import { useNetworkNotes } from './geospatial/useNetworkNotes';
import { useNetworkSelection } from './geospatial/useNetworkSelection';
import { useTimeFrequencyModal } from './geospatial/useTimeFrequencyModal';
import { WigleLookupDialog } from './geospatial/WigleLookupDialog';
import { WigleObservationsPanel } from './geospatial/WigleObservationsPanel';
import { NearestAgenciesPanel } from './geospatial/NearestAgenciesPanel';
import { renderAgencyPopupCard } from '../utils/geospatial/renderMapPopupCards';
import { fitBoundsWithZoomInset } from '../utils/geospatial/mapViewUtils';
import { useSiblingLinks } from './geospatial/useSiblingLinks';
import { useGeospatialExplorerState } from './geospatial/useGeospatialExplorerState';
import { NETWORK_COLUMNS, MAP_STYLES } from '../constants/network';
import { NetworkRow } from '../types/network';

export default function GeospatialExplorer() {
  usePageFilters('geospatial');
  const { isAdmin } = useAuth();
  const [locationMode, setLocationMode] = useState('latest_observation');

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
      if (
        newSelection.size > 0 &&
        Array.from(newSelection)[0] !== Array.from(selectedNetworks)[0]
      ) {
        if (wigleObservations.observations.length > 0) clearWigleObservations();
        if (timeFreqModal) closeTimeFrequency();
      }
    },
  });

  const {
    observationsByBssid,
    loading: loadingObservations,
    total: observationsTotal,
    truncated: observationsTruncated,
    renderBudgetExceeded,
    renderBudget,
  } = useObservations(selectedNetworks, { useFilters: true });

  const state = useGeospatialExplorerState({
    selectedNetworks,
    networks,
    observationsByBssid,
    resetPagination,
    setSort,
    setError,
    locationMode,
    sort,
  });

  const { linkedSiblingBssids, visibleSiblingGroupMap, setLinkedSiblingBssids } = useSiblingLinks({
    isAdmin,
    selectedAnchorBssid: selectedNetworks.size === 1 ? Array.from(selectedNetworks)[0] : null,
    networks,
  });

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
  const [siblingPairLoading, setSiblingPairLoading] = useState(false);

  const {
    agencies,
    loading: agenciesLoading,
    error: agenciesError,
  } = useNearestAgencies(
    state.showAgenciesPanel
      ? selectedNetworks.size >= 1
        ? Array.from(selectedNetworks)
        : null
      : null
  );

  const manualSiblingTarget = useMemo(() => {
    if (selectedNetworks.size !== 1) return null;
    const sBssid = Array.from(selectedNetworks)[0];
    const cBssid = contextMenu.network?.bssid || null;
    if (!sBssid || !cBssid || sBssid === cBssid) return null;
    return {
      bssid: sBssid,
      ssid: networks.find((n) => n.bssid === sBssid)?.ssid || null,
      isLinked: linkedSiblingBssids.has(cBssid),
    };
  }, [contextMenu.network, linkedSiblingBssids, networks, selectedNetworks]);

  const handleMarkSiblingPair = async () => {
    const anchor = manualSiblingTarget?.bssid;
    const context = contextMenu.network?.bssid;
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

  useEffect(() => {
    if (!state.mapReady || !state.mapRef.current || !state.mapboxRef.current) return;
    const map = state.mapRef.current;
    const layerId = 'nearest-agencies-layer';
    const sourceId = 'nearest-agencies';
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    if (agencies.length === 0 || !state.showAgenciesPanel) return;

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: agencies.map((a) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [a.longitude, a.latitude] },
          properties: {
            name: a.name,
            type: a.office_type,
            distance: (a.distance_meters || 0) / 1000,
            hasWigleObs: a.has_wigle_obs,
          },
        })),
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

    const clickHandler = (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties;
      new state.mapboxRef.current.Popup({ className: 'sc-popup', maxWidth: '360px', offset: 14 })
        .setLngLat(e.lngLat)
        .setHTML(
          renderAgencyPopupCard({
            name: p.name,
            officeType: p.type,
            distanceKm: Number(p.distance),
            hasWigleObs: Boolean(p.hasWigleObs),
          })
        )
        .addTo(map);
    };
    map.on('click', layerId, clickHandler);
    return () => {
      map.off('click', layerId, clickHandler);
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    };
  }, [state.mapReady, state.mapRef, state.mapboxRef, agencies, state.showAgenciesPanel]);

  return (
    <GeospatialLayout
      filtersOpen={state.filtersOpen}
      filterPanel={<GeospatialFiltersPanel />}
      content={
        <>
          <MapSection
            mapHeight={state.mapHeight}
            title="ShadowCheck Geospatial Intelligence"
            toolbar={
              <MapToolbarActions
                {...state}
                locationSearchRef={state.locationSearchRef}
                onSelectSearchResult={(res) => {
                  if (state.searchMode === 'directions') {
                    const dest: [number, number] = [res.center[0], res.center[1]];
                    const origin = state.homeLocation.center;
                    state.fetchRoute(origin, dest).then((data) => {
                      if (data && state.mapRef.current && state.mapboxRef.current) {
                        const bounds = new state.mapboxRef.current.LngLatBounds(
                          origin,
                          origin
                        ).extend(dest);
                        data.coordinates.forEach((c: any) => bounds.extend(c));
                        fitBoundsWithZoomInset(state.mapRef.current, bounds, {
                          padding: 60,
                          duration: 2000,
                        });
                      }
                    });
                    state.setShowSearchResults(false);
                    state.setLocationSearch('');
                  } else {
                    state.flyToLocation(res);
                  }
                }}
                onSearchModeToggle={() => {
                  const next = state.searchMode === 'address' ? 'directions' : 'address';
                  state.setSearchMode(next);
                  if (next === 'address') state.clearRoute();
                }}
                onMapStyleChange={state.changeMapStyle}
                mapStyles={MAP_STYLES}
                canFit={selectedNetworks.size > 0}
                onWigle={() =>
                  wigleObservations.observations.length > 0
                    ? clearWigleObservations()
                    : loadBatchWigleObservations(Array.from(selectedNetworks))
                }
                onToggleAgenciesPanel={state.toggleAgenciesPanel}
                wigleLoading={wigleObservations.loading}
                wigleActive={wigleObservations.observations.length > 0}
                selectedCount={selectedNetworks.size}
              />
            }
            mapError={state.mapError}
            mapReady={state.mapReady}
            embeddedView={state.embeddedView}
            mapRef={state.mapRef}
            mapContainerRef={state.mapContainerRef}
            onResizeMouseDown={state.handleMouseDown}
          />
          <NetworkExplorerSection
            expensiveSort={expensiveSort}
            quickSearch={state.quickSearch}
            onQuickSearchChange={state.setQuickSearch}
            locationMode={locationMode}
            onLocationModeChange={setLocationMode}
            filtersOpen={state.filtersOpen}
            onToggleFilters={state.toggleFilters}
            showColumnSelector={state.showColumnSelector}
            columnDropdownRef={state.columnDropdownRef}
            visibleColumns={state.visibleColumns}
            columns={NETWORK_COLUMNS}
            onToggleColumnSelector={state.toggleColumnSelector}
            onToggleColumn={state.toggleColumn}
            sort={sort}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={toggleSelectAll}
            onColumnSort={state.handleColumnSort}
            onReorderColumns={state.reorderColumns}
            tableContainerRef={state.tableContainerRef}
            loadingNetworks={loadingNetworks}
            filteredNetworks={filteredNetworks}
            error={error}
            selectedNetworks={selectedNetworks}
            linkedSiblingBssids={linkedSiblingBssids}
            siblingGroupMap={visibleSiblingGroupMap}
            selectedAnchorBssid={
              selectedNetworks.size === 1 ? Array.from(selectedNetworks)[0] : null
            }
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
            observationCount={state.observationCount}
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
            contextMenuRef={contextMenuRef}
            onTagAction={handleTagAction}
            onCloseContextMenu={closeContextMenu}
            onOpenTimeFrequency={() => {
              const n = contextMenu.network;
              if (n)
                openTimeFrequency({ bssid: String(n.bssid || ''), ssid: String(n.ssid || '') });
              closeContextMenu();
            }}
            onOpenNote={() => {
              void openNoteModalForBssid(contextMenu.network?.bssid || '');
              closeContextMenu();
            }}
            hasExistingNote={contextMenu.hasExistingNote}
            onGenerateThreatReport={handleGenerateThreatReportPdf}
            onMapWigleObservations={() => {
              if (contextMenu.network) loadWigleObservations(contextMenu.network);
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
            fileInputRef={fileInputRef}
            onNoteTypeChange={setNoteType}
            onNoteContentChange={setNoteContent}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={removeAttachment}
            onCloseNoteOverlay={() => setShowNoteModal(false)}
            onCloseNote={resetNoteState}
            onCancelNote={resetNoteState}
            onSaveNote={handleSaveNote}
            timeFreqModal={state.timeFreqModal}
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
          {state.showAgenciesPanel && (
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
