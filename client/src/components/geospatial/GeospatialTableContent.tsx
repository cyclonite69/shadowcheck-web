import React from 'react';
import { NetworkExplorerSection } from './panels/NetworkExplorerSection';
import { NETWORK_COLUMNS } from '../../constants/network';

interface GeospatialTableContentProps {
  state: any;
  networks: any[];
  loadingNetworks: boolean;
  isLoadingMore: boolean;
  error: any;
  networkTotal: number;
  networkTruncated: boolean;
  expensiveSort: boolean;
  pagination: any;
  sort: any;
  toggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
  selectedNetworks: Set<string>;
  linkedSiblingBssids: Set<string>;
  visibleSiblingGroupMap: Map<string, string>;
  selectNetworkExclusive: (bssid: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, network: any) => void;
  toggleSelectNetwork: (bssid: string) => void;
  loadMore: () => void;
  filteredNetworks: any[];
  loadingObservations: boolean;
  observationsTruncated: boolean;
  observationsTotal: number;
  renderBudgetExceeded: boolean;
  renderBudget: number;
}

const GeospatialTableContentComponent: React.FC<GeospatialTableContentProps> = ({
  state,
  networks,
  loadingNetworks,
  isLoadingMore,
  error,
  networkTotal,
  networkTruncated,
  expensiveSort,
  pagination,
  sort,
  toggleSelectAll,
  allSelected,
  someSelected,
  selectedNetworks,
  linkedSiblingBssids,
  visibleSiblingGroupMap,
  selectNetworkExclusive,
  onOpenContextMenu,
  toggleSelectNetwork,
  loadMore,
  filteredNetworks,
  loadingObservations,
  observationsTruncated,
  observationsTotal,
  renderBudgetExceeded,
  renderBudget,
}) => (
  <NetworkExplorerSection
    expensiveSort={expensiveSort}
    quickSearch={state.quickSearch}
    onQuickSearchChange={state.setQuickSearch}
    filtersOpen={state.filtersOpen}
    onToggleFilters={state.toggleFilters}
    showColumnSelector={state.showColumnSelector}
    columnDropdownRef={state.columnDropdownRef}
    visibleColumns={state.visibleColumns}
    columns={NETWORK_COLUMNS}
    onToggleColumnSelector={state.toggleColumnSelector}
    onToggleColumn={state.toggleColumn}
    onMoveColumn={state.moveColumn}
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
    selectedAnchorBssid={selectedNetworks.size === 1 ? Array.from(selectedNetworks)[0] : null}
    selectedAnchorHasLinkedSiblings={linkedSiblingBssids.size > 0}
    onSelectExclusive={selectNetworkExclusive}
    onOpenContextMenu={onOpenContextMenu}
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
);

export const GeospatialTableContent = React.memo(GeospatialTableContentComponent);
