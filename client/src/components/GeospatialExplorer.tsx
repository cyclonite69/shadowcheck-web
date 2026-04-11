import { useState } from 'react';
import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { useAuth } from '../hooks/useAuth';
import { logError } from '../logging/clientLogger';
import { GeospatialLayout } from './geospatial/GeospatialLayout';
import { GeospatialFiltersPanel } from './geospatial/panels/GeospatialFiltersPanel';
import { useNearestAgencies } from './geospatial/hooks/useNearestAgencies';
import { useNetworkContextMenu } from './geospatial/hooks/useNetworkContextMenu';
import { useNetworkNotes } from './geospatial/hooks/useNetworkNotes';
import { useNetworkSelection } from './geospatial/hooks/useNetworkSelection';
import { useTimeFrequencyModal } from './geospatial/hooks/useTimeFrequencyModal';
import { useSiblingLinks } from './geospatial/hooks/useSiblingLinks';
import { useGeospatialExplorerState } from './geospatial/hooks/useGeospatialExplorerState';
import { useAgencyLayer } from '../hooks/useAgencyLayer';
import { useFederalCourthouses } from './hooks/useFederalCourthouses';
import { GeospatialMapContent } from './geospatial/GeospatialMapContent';
import { GeospatialTableContent } from './geospatial/GeospatialTableContent';
import { GeospatialOverlayContent } from './geospatial/overlays/GeospatialOverlayContent';

export default function GeospatialExplorer() {
  usePageFilters('geospatial');
  const { isAdmin } = useAuth();

  const [locationMode, setLocationMode] = useState('latest_observation');
  const [showNetworkSummaries, setShowNetworkSummaries] = useState(false);

  // Basic Data Fetching
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

  // High-level context menu & Dialogs
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

  // Selection
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
      }
    },
  });

  // Observations
  const {
    observationsByBssid,
    loading: loadingObservations,
    total: observationsTotal,
    truncated: observationsTruncated,
    renderBudgetExceeded,
    renderBudget,
  } = useObservations(selectedNetworks, { useFilters: true });

  // Sibling Links
  const { linkedSiblingBssids, visibleSiblingGroupMap, setLinkedSiblingBssids } = useSiblingLinks({
    isAdmin,
    selectedAnchorBssid: selectedNetworks.size === 1 ? Array.from(selectedNetworks)[0] : null,
    networks,
  });

  // Orchestrator State (Hook-based)
  const state = useGeospatialExplorerState({
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
    contextMenuNetwork: contextMenu.network,
    onOpenContextMenu: openContextMenu,
    locationMode,
    setLocationMode,
    showNetworkSummaries,
  });

  // Agency Context
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

  // Notes & Modals
  const {
    showNoteModal,
    setShowNoteModal,
    selectedBssid,
    noteContent,
    setNoteContent,
    noteType,
    setNoteType,
    noteAttachments,
    existingNoteMedia,
    fileInputRef,
    openNoteModalForBssid,
    resetNoteState,
    handleSaveNote,
    handleDeleteNote,
    handleDeleteExistingMedia,
    openExistingMedia,
    handleAddAttachment,
    removeAttachment,
  } = useNetworkNotes({ logError });

  const { openTimeFrequency, closeTimeFrequency } = useTimeFrequencyModal();

  // Map Layer Integration (Hook-based)
  useAgencyLayer({
    mapReady: state.mapReady,
    mapRef: state.mapRef,
    mapboxRef: state.mapboxRef,
    agencies,
    showAgenciesPanel: state.showAgenciesPanel,
  });

  useFederalCourthouses(state.mapRef, state.mapReady, state.showCourthousesPanel, state.mapboxRef);

  return (
    <GeospatialLayout
      filtersOpen={state.filtersOpen}
      filterPanel={<GeospatialFiltersPanel />}
      content={
        <>
          <GeospatialMapContent
            state={state}
            selectedNetworks={selectedNetworks}
            toggleWigleForBssids={state.toggleWigleForBssids}
            wigleObservations={wigleObservations}
            onOpenContextMenu={openContextMenu}
            showNetworkSummaries={showNetworkSummaries}
            onToggleNetworkSummaries={setShowNetworkSummaries}
          />
          <GeospatialTableContent
            state={state}
            networks={networks}
            loadingNetworks={loadingNetworks}
            isLoadingMore={isLoadingMore}
            error={error}
            networkTotal={networkTotal ?? 0}
            networkTruncated={networkTruncated}
            expensiveSort={expensiveSort}
            pagination={pagination}
            sort={sort}
            locationMode={state.locationMode}
            setLocationMode={state.setLocationMode}
            toggleSelectAll={toggleSelectAll}
            allSelected={allSelected}
            someSelected={someSelected}
            selectedNetworks={selectedNetworks}
            linkedSiblingBssids={linkedSiblingBssids}
            visibleSiblingGroupMap={visibleSiblingGroupMap}
            selectNetworkExclusive={selectNetworkExclusive}
            onOpenContextMenu={openContextMenu}
            toggleSelectNetwork={toggleSelectNetwork}
            loadMore={loadMore}
            filteredNetworks={state.filteredNetworks}
            loadingObservations={loadingObservations}
            observationsTruncated={observationsTruncated}
            observationsTotal={observationsTotal ?? 0}
            renderBudgetExceeded={renderBudgetExceeded}
            renderBudget={renderBudget ?? 0}
          />
        </>
      }
      overlays={
        <GeospatialOverlayContent
          state={state}
          contextMenu={contextMenu}
          tagLoading={tagLoading}
          contextMenuRef={contextMenuRef}
          handleTagAction={handleTagAction}
          closeContextMenu={closeContextMenu}
          openTimeFrequency={openTimeFrequency}
          openNoteModalForBssid={openNoteModalForBssid}
          handleGenerateThreatReportPdf={handleGenerateThreatReportPdf}
          toggleWigleForBssids={state.toggleWigleForBssids}
          wigleObservations={wigleObservations}
          selectedNetworks={selectedNetworks}
          manualSiblingTarget={state.manualSiblingTarget}
          handleMarkSiblingPair={state.handleMarkSiblingPair}
          siblingPairLoading={state.siblingPairLoading}
          showNoteModal={showNoteModal}
          setShowNoteModal={setShowNoteModal}
          selectedBssid={selectedBssid}
          noteType={noteType}
          noteContent={noteContent}
          noteAttachments={noteAttachments}
          existingNoteMedia={existingNoteMedia}
          fileInputRef={fileInputRef}
          setNoteType={setNoteType}
          setNoteContent={setNoteContent}
          handleAddAttachment={handleAddAttachment}
          removeAttachment={removeAttachment}
          resetNoteState={resetNoteState}
          handleSaveNote={handleSaveNote}
          handleDeleteNote={handleDeleteNote}
          handleDeleteExistingMedia={handleDeleteExistingMedia}
          openExistingMedia={openExistingMedia}
          closeTimeFrequency={closeTimeFrequency}
          wigleLookupDialog={wigleLookupDialog}
          handleWigleLookup={handleWigleLookup}
          closeWigleLookupDialog={closeWigleLookupDialog}
          clearWigleObservations={clearWigleObservations}
          agencies={agencies}
          agenciesLoading={agenciesLoading}
          agenciesError={agenciesError}
        />
      }
    />
  );
}
