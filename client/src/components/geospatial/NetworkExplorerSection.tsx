import React from 'react';
import type { NetworkRow, SortState } from '../../types/network';
import { MapStatusBar } from './MapStatusBar';
import { NetworkExplorerCard } from './NetworkExplorerCard';
import { NetworkExplorerHeader } from './NetworkExplorerHeader';
import { NetworkTableBody } from './NetworkTableBody';
import { NetworkTableBodyGrid } from './NetworkTableBodyGrid';
import { NetworkTableHeader } from './NetworkTableHeader';
import { NetworkTableHeaderGrid } from './NetworkTableHeaderGrid';

// Feature flag for virtualization - using CSS Grid layout
const USE_VIRTUALIZATION = true;

interface ColumnDefinition {
  label: string;
}

interface NetworkExplorerSectionProps {
  expensiveSort: boolean;
  planCheck: boolean;
  onPlanCheckChange: (checked: boolean) => void;
  locationMode: string;
  onLocationModeChange: (mode: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  showColumnSelector: boolean;
  columnDropdownRef: React.RefObject<HTMLDivElement>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  columns: Record<string, ColumnDefinition>;
  onToggleColumnSelector: () => void;
  onToggleColumn: (col: keyof NetworkRow | 'select') => void;
  sort: SortState[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
  onColumnSort: (column: keyof NetworkRow, shiftKey: boolean) => void;
  onReorderColumns?: (from: keyof NetworkRow | 'select', to: keyof NetworkRow | 'select') => void;
  tableContainerRef: React.RefObject<HTMLDivElement>;
  loadingNetworks: boolean;
  filteredNetworks: NetworkRow[];
  error: string | null;
  selectedNetworks: Set<string>;
  onSelectExclusive: (bssid: string) => void;
  onOpenContextMenu: (
    event: React.MouseEvent<HTMLDivElement | HTMLTableRowElement>,
    net: NetworkRow
  ) => void;
  onToggleSelectNetwork: (bssid: string) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  visibleCount: number;
  networkTruncated: boolean;
  networkTotal: number;
  selectedCount: number;
  observationCount: number;
  observationsTruncated: boolean;
  observationsTotal: number;
  renderBudgetExceeded: boolean;
  renderBudget: number;
  loadingObservations: boolean;
}

export const NetworkExplorerSection = ({
  expensiveSort,
  planCheck,
  onPlanCheckChange,
  locationMode,
  onLocationModeChange,
  filtersOpen,
  onToggleFilters,
  showColumnSelector,
  columnDropdownRef,
  visibleColumns,
  columns,
  onToggleColumnSelector,
  onToggleColumn,
  sort,
  allSelected,
  someSelected,
  onToggleSelectAll,
  onColumnSort,
  onReorderColumns,
  tableContainerRef,
  loadingNetworks,
  filteredNetworks,
  error,
  selectedNetworks,
  onSelectExclusive,
  onOpenContextMenu,
  onToggleSelectNetwork,
  isLoadingMore,
  hasMore,
  onLoadMore,
  visibleCount,
  networkTruncated,
  networkTotal,
  selectedCount,
  observationCount,
  observationsTruncated,
  observationsTotal,
  renderBudgetExceeded,
  renderBudget,
  loadingObservations,
}: NetworkExplorerSectionProps) => {
  return (
    <NetworkExplorerCard>
      <NetworkExplorerHeader
        expensiveSort={expensiveSort}
        planCheck={planCheck}
        onPlanCheckChange={onPlanCheckChange}
        locationMode={locationMode}
        onLocationModeChange={onLocationModeChange}
        filtersOpen={filtersOpen}
        onToggleFilters={onToggleFilters}
        showColumnSelector={showColumnSelector}
        columnDropdownRef={columnDropdownRef}
        visibleColumns={visibleColumns}
        columns={columns}
        onToggleColumnSelector={onToggleColumnSelector}
        onToggleColumn={onToggleColumn}
      />

      {USE_VIRTUALIZATION && filteredNetworks.length > 100 ? (
        <>
          <NetworkTableHeaderGrid
            visibleColumns={visibleColumns}
            sort={sort}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={onToggleSelectAll}
            onColumnSort={onColumnSort}
            onReorderColumns={onReorderColumns}
          />
          <NetworkTableBodyGrid
            tableContainerRef={tableContainerRef}
            visibleColumns={visibleColumns}
            loadingNetworks={loadingNetworks}
            filteredNetworks={filteredNetworks}
            error={error}
            selectedNetworks={selectedNetworks}
            onSelectExclusive={onSelectExclusive}
            onOpenContextMenu={onOpenContextMenu}
            onToggleSelectNetwork={onToggleSelectNetwork}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
          />
        </>
      ) : (
        <>
          <NetworkTableHeader
            visibleColumns={visibleColumns}
            sort={sort}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelectAll={onToggleSelectAll}
            onColumnSort={onColumnSort}
            onReorderColumns={onReorderColumns}
          />
          <NetworkTableBody
            tableContainerRef={tableContainerRef}
            visibleColumns={visibleColumns}
            loadingNetworks={loadingNetworks}
            filteredNetworks={filteredNetworks}
            error={error}
            selectedNetworks={selectedNetworks}
            onSelectExclusive={onSelectExclusive}
            onOpenContextMenu={onOpenContextMenu}
            onToggleSelectNetwork={onToggleSelectNetwork}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
          />
        </>
      )}

      <MapStatusBar
        visibleCount={visibleCount}
        networkTruncated={networkTruncated}
        networkTotal={networkTotal}
        selectedCount={selectedCount}
        observationCount={observationCount}
        observationsTruncated={observationsTruncated}
        observationsTotal={observationsTotal}
        renderBudgetExceeded={renderBudgetExceeded}
        renderBudget={renderBudget}
        loadingNetworks={loadingNetworks}
        loadingObservations={loadingObservations}
      />
    </NetworkExplorerCard>
  );
};
