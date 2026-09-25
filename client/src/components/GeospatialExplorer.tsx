import { useState, useCallback } from 'react';
import { usePageFilters } from '../hooks/usePageFilters';
import { useNetworkData } from '../hooks/useNetworkData';
import { useObservations } from '../hooks/useObservations';
import { useAuth } from '../hooks/useAuth';
import { useAdminRuntimeConfig } from '../hooks/useAdminRuntimeConfig';
import { logError } from '../logging/clientLogger';
import { GeospatialLayout } from './geospatial/GeospatialLayout';
import { GeospatialFiltersPanel } from './geospatial/panels/GeospatialFiltersPanel';
import { useNearestAgencies } from './geospatial/hooks/useNearestAgencies';
import { useNearestCourthouses } from './geospatial/hooks/useNearestCourthouses';
import { useNetworkSelection } from './geospatial/hooks/useNetworkSelection';
import { useGeospatialOverlayOrchestration } from './geospatial/hooks/useGeospatialOverlayOrchestration';
import { useGeospatialExplorerState } from './geospatial/hooks/useGeospatialExplorerState';
import { useAgencyLayer } from '../hooks/useAgencyLayer';
import { useFederalCourthouses } from './hooks/useFederalCourthouses';
import { GeospatialMapContent } from './geospatial/GeospatialMapContent';
import { GeospatialTableContent } from './geospatial/GeospatialTableContent';
import { GeospatialOverlayContent } from './geospatial/overlays/GeospatialOverlayContent';
import { MapRadiusContextMenu } from './geospatial/MapRadiusContextMenu';

export default function GeospatialExplorer() {
  usePageFilters('geospatial');
  const { isAdmin } = useAuth();
  const runtimeConfig = useAdminRuntimeConfig(isAdmin);
  const badgeStudioEnabled = runtimeConfig?.featureFlags?.badgeStudio === true;

  const [locationMode, setLocationMode] = useState('latest_observation');
  const [showNetworkSummaries, setShowNetworkSummaries] = useState(false);
  const [showMediaLocations, setShowMediaLocations] = useState(false);

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
  const overlay = useGeospatialOverlayOrchestration({ logError, resetPagination });
  const {
    contextMenu,
    openContextMenu,
    clearWigleObservations,
    wigleObservations,
    loadWigleObservations,
    loadBatchWigleObservations,
    closeContextMenu,
  } = overlay;

  // Selection
  const {
    selectedNetworks,
    toggleSelectNetwork,
    selectNetworkExclusive,
    toggleSelectAll,
    allSelected,
    someSelected,
    setSelectedNetworks,
  } = useNetworkSelection({
    networks,
    onSelectionChange: (newSelection) => {
      if (
        newSelection.size > 0 &&
        Array.from(newSelection)[0] !== Array.from(selectedNetworks)[0]
      ) {
        if (Object.keys(observationsByBssid).length > 0) {
          clearWigleObservations();
        }
      }
    },
  });

  const selectNetworkGroup = useCallback(
    (bssids: string[]) => {
      setSelectedNetworks(new Set(bssids));
    },
    [setSelectedNetworks]
  );

  // Observations
  const {
    observationsByBssid,
    loading: loadingObservations,
    total: observationsTotal,
    truncated: observationsTruncated,
    renderBudgetExceeded,
    renderBudget,
  } = useObservations(selectedNetworks, { useFilters: true });

  const selectedAnchorBssid = selectedNetworks.size === 1 ? Array.from(selectedNetworks)[0] : null;

  // Orchestrator State (Hook-based)
  const state = useGeospatialExplorerState({
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
    contextMenuNetwork: contextMenu.network,
    onOpenContextMenu: openContextMenu,
    locationMode,
    setLocationMode,
    showNetworkSummaries,
    showMediaLocations,
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

  const {
    courthouses,
    loading: courthousesLoading,
    error: courthousesError,
  } = useNearestCourthouses(
    state.showCourthousesPanel
      ? selectedNetworks.size >= 1
        ? Array.from(selectedNetworks)
        : null
      : null
  );

  // Map Layer Integration (Hook-based)
  useAgencyLayer({
    mapReady: state.mapReady,
    mapRef: state.mapRef,
    mapboxRef: state.mapboxRef,
    agencies,
    showAgenciesPanel: state.showAgenciesPanel,
  });

  useFederalCourthouses(
    state.mapRef,
    state.mapReady,
    state.showCourthousesPanel,
    state.mapboxRef,
    false,
    courthouses
  );

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
            showMediaLocations={showMediaLocations}
            onToggleMediaLocations={setShowMediaLocations}
          />
          <GeospatialTableContent
            badgeStudioEnabled={badgeStudioEnabled}
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
            linkedSiblingBssids={state.linkedSiblingBssids}
            visibleSiblingGroupMap={state.visibleSiblingGroupMap}
            selectNetworkExclusive={selectNetworkExclusive}
            onSelectGroup={selectNetworkGroup}
            onOpenContextMenu={openContextMenu}
            toggleSelectNetwork={toggleSelectNetwork}
            loadMore={loadMore}
            filteredNetworks={state.filteredNetworks}
            loadingObservations={loadingObservations}
            observationsTruncated={observationsTruncated}
            observationsTotal={observationsTotal ?? 0}
            renderBudgetExceeded={renderBudgetExceeded}
            renderBudget={renderBudget ?? 0}
            hydrationFailedBssids={state.hydrationFailedBssids}
            unresolvedSearchBssids={state.unresolvedSearchBssids}
            nonRenderableBssids={state.nonRenderableBssids}
            missingDbBssids={state.missingDbBssids}
          />
        </>
      }
      overlays={
        <>
          <GeospatialOverlayContent
            state={state}
            toggleWigleForBssids={state.toggleWigleForBssids}
            selectedNetworks={selectedNetworks}
            manualSiblingTarget={state.manualSiblingTarget}
            handleMarkSiblingPair={state.handleMarkSiblingPair}
            siblingPairLoading={state.siblingPairLoading}
            agencies={agencies}
            agenciesLoading={agenciesLoading}
            agenciesError={agenciesError}
            courthouses={courthouses}
            courthousesLoading={courthousesLoading}
            courthousesError={courthousesError}
            mapRef={state.mapRef}
            {...overlay}
          />
          <MapRadiusContextMenu
            menu={state.radiusContextMenu}
            onSetCenter={state.setRadiusFromContextMenu}
            onClear={state.clearRadiusFilter}
            onClose={state.closeRadiusContextMenu}
          />
        </>
      }
    />
  );
}
