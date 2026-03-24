import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { useAuth } from '../hooks/useAuth';
import { logError } from '../logging/clientLogger';
import { GeospatialLayout } from './geospatial/GeospatialLayout';
import { GeospatialFiltersPanel } from './geospatial/GeospatialFiltersPanel';
import { useNearestAgencies } from './geospatial/useNearestAgencies';
import { useNetworkContextMenu } from './geospatial/useNetworkContextMenu';
import { useNetworkNotes } from './geospatial/useNetworkNotes';
import { useNetworkSelection } from './geospatial/useNetworkSelection';
import { useTimeFrequencyModal } from './geospatial/useTimeFrequencyModal';
import { useSiblingLinks } from './geospatial/useSiblingLinks';
import { useGeospatialExplorerState } from './geospatial/useGeospatialExplorerState';
import { useAgencyLayer } from '../hooks/useAgencyLayer';
import { useFederalCourthouses } from './hooks/useFederalCourthouses';
import { GeospatialMapContent } from './geospatial/GeospatialMapContent';
import { GeospatialTableContent } from './geospatial/GeospatialTableContent';
import { GeospatialOverlayContent } from './geospatial/GeospatialOverlayContent';

export default function GeospatialExplorer() {
  usePageFilters('geospatial');
  const { isAdmin } = useAuth();

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
  } = useNetworkData({ locationMode: 'latest_observation' }); // Default location mode

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

  const { openTimeFrequency, closeTimeFrequency } = useTimeFrequencyModal();

  // Map Layer Integration (Hook-based)
  useAgencyLayer({
    mapReady: state.mapReady,
    mapRef: state.mapRef,
    mapboxRef: state.mapboxRef,
    agencies,
    showAgenciesPanel: state.showAgenciesPanel,
  });

  useFederalCourthouses(state.mapRef, state.mapReady, state.showCourthousesPanel);

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
          />
          <GeospatialTableContent
            state={state}
            networks={networks}
            loadingNetworks={loadingNetworks}
            isLoadingMore={isLoadingMore}
            error={error}
            networkTotal={networkTotal}
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
            observationsTotal={observationsTotal}
            renderBudgetExceeded={renderBudgetExceeded}
            renderBudget={renderBudget}
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
          fileInputRef={fileInputRef}
          setNoteType={setNoteType}
          setNoteContent={setNoteContent}
          handleAddAttachment={handleAddAttachment}
          removeAttachment={removeAttachment}
          resetNoteState={resetNoteState}
          handleSaveNote={handleSaveNote}
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
