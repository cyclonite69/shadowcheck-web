import React, { useState, useCallback, useMemo } from 'react';
import type { NetworkRow, SortState } from '../../../types/network';
import type { NetworkColumnConfig } from '../../../constants/network';
import { MapStatusBar } from '../MapStatusBar';
import { NetworkExplorerCard } from './NetworkExplorerCard';
import { NetworkExplorerHeader } from './NetworkExplorerHeader';
import { NetworkTableBodyGrid } from '../table/NetworkTableBodyGrid';
import { NetworkTableHeaderGrid } from '../table/NetworkTableHeaderGrid';

interface NetworkExplorerSectionProps {
  expensiveSort: boolean;
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  showColumnSelector: boolean;
  columnDropdownRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  columns: Partial<Record<keyof NetworkRow | 'select', NetworkColumnConfig>>;
  onToggleColumnSelector: () => void;
  onToggleColumn: (col: keyof NetworkRow | 'select') => void;
  onMoveColumn: (col: keyof NetworkRow | 'select', direction: 'left' | 'right') => void;
  sort: SortState[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
  onColumnSort: (column: keyof NetworkRow, shiftKey: boolean) => void;
  onReorderColumns?: (from: keyof NetworkRow | 'select', to: keyof NetworkRow | 'select') => void;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  loadingNetworks: boolean;
  filteredNetworks: NetworkRow[];
  error: string | null;
  selectedNetworks: Set<string>;
  linkedSiblingBssids?: Set<string>;
  siblingGroupMap?: Map<string, string>;
  selectedAnchorBssid?: string | null;
  selectedAnchorHasLinkedSiblings?: boolean;
  onSelectExclusive: (bssid: string) => void;
  onSelectGroup?: (bssids: string[]) => void;
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
  networkTotal: number | null;
  selectedCount: number;
  observationCount: number;
  observationsTruncated: boolean;
  observationsTotal: number | null;
  renderBudgetExceeded: boolean;
  renderBudget: number | null;
  loadingObservations: boolean;
}

export const NetworkExplorerSection = ({
  expensiveSort,
  quickSearch,
  onQuickSearchChange,
  filtersOpen,
  onToggleFilters,
  showColumnSelector,
  columnDropdownRef,
  visibleColumns,
  columns,
  onToggleColumnSelector,
  onToggleColumn,
  onMoveColumn,
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
  linkedSiblingBssids,
  siblingGroupMap,
  selectedAnchorBssid,
  selectedAnchorHasLinkedSiblings,
  onSelectExclusive,
  onSelectGroup,
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
  const [tableScrollLeft, setTableScrollLeft] = React.useState(0);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const allGroupIds = useMemo(() => new Set(siblingGroupMap?.values() ?? []), [siblingGroupMap]);

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleToggleSiblingGroups = useCallback(() => {
    setCollapsedGroups((prev) =>
      prev.size === 0 ? new Set(siblingGroupMap?.values() ?? []) : new Set()
    );
  }, [siblingGroupMap]);

  return (
    <NetworkExplorerCard>
      <NetworkExplorerHeader
        expensiveSort={expensiveSort}
        quickSearch={quickSearch}
        onQuickSearchChange={onQuickSearchChange}
        filtersOpen={filtersOpen}
        onToggleFilters={onToggleFilters}
        showColumnSelector={showColumnSelector}
        columnDropdownRef={columnDropdownRef}
        visibleColumns={visibleColumns}
        columns={columns}
        onToggleColumnSelector={onToggleColumnSelector}
        onToggleColumn={onToggleColumn}
        onMoveColumn={onMoveColumn}
        siblingGroupCount={allGroupIds.size}
        allCollapsed={collapsedGroups.size > 0}
        onToggleSiblingGroups={handleToggleSiblingGroups}
      />

      <NetworkTableHeaderGrid
        visibleColumns={visibleColumns}
        sort={sort}
        allSelected={allSelected}
        someSelected={someSelected}
        onToggleSelectAll={onToggleSelectAll}
        onColumnSort={onColumnSort}
        onReorderColumns={onReorderColumns}
        scrollLeft={tableScrollLeft}
      />
      <NetworkTableBodyGrid
        tableContainerRef={tableContainerRef}
        visibleColumns={visibleColumns}
        loadingNetworks={loadingNetworks}
        filteredNetworks={filteredNetworks}
        error={error}
        selectedNetworks={selectedNetworks}
        linkedSiblingBssids={linkedSiblingBssids}
        siblingGroupMap={siblingGroupMap}
        selectedAnchorBssid={selectedAnchorBssid}
        selectedAnchorHasLinkedSiblings={selectedAnchorHasLinkedSiblings}
        onSelectExclusive={onSelectExclusive}
        onSelectGroup={onSelectGroup}
        onOpenContextMenu={onOpenContextMenu}
        onToggleSelectNetwork={onToggleSelectNetwork}
        collapsedGroups={collapsedGroups}
        onToggleCollapse={toggleCollapse}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onHorizontalScroll={setTableScrollLeft}
      />

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
