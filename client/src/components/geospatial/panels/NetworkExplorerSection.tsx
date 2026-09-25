import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { NetworkRow, SortState } from '../../../types/network';
import type { NetworkColumnConfig } from '../../../constants/network';
import type { ColumnBadgeConfig } from '../../../types/badgeConfig';
import { MapStatusBar } from '../MapStatusBar';
import { NetworkExplorerCard } from './NetworkExplorerCard';
import { NetworkExplorerHeader } from './NetworkExplorerHeader';
import { NetworkTableBodyGrid } from '../table/NetworkTableBodyGrid';
import { NetworkTableHeaderGrid } from '../table/NetworkTableHeaderGrid';
import { logDebug } from '../../../logging/clientLogger';

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
  hydrationFailedBssids?: string[];
  unresolvedSearchBssids?: string[];
  nonRenderableBssids?: string[];
  missingDbBssids?: string[];
  siblingHydrating?: boolean;
  badgeConfigs?: Record<string, ColumnBadgeConfig>;
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
  hydrationFailedBssids = [],
  unresolvedSearchBssids = [],
  nonRenderableBssids = [],
  missingDbBssids = [],
  siblingHydrating = false,
  badgeConfigs,
}: NetworkExplorerSectionProps) => {
  const topologyMismatch =
    hydrationFailedBssids.length > 0 ||
    missingDbBssids.length > 0 ||
    unresolvedSearchBssids.length > 0;
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!topologyMismatch || siblingHydrating) {
      setShowWarning(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowWarning(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [topologyMismatch, siblingHydrating]);

  const [tableScrollLeft, setTableScrollLeft] = React.useState(0);

  const [collapseAllActive, setCollapseAllActive] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const allGroupIds = useMemo(() => new Set(siblingGroupMap?.values() ?? []), [siblingGroupMap]);

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleToggleSiblingGroups = useCallback(() => {
    setCollapseAllActive((prev) => !prev);
    setCollapsedGroups(new Set());
  }, []);

  const nonRenderableSignature = nonRenderableBssids.join(',');

  useEffect(() => {
    if (nonRenderableSignature.length > 0) {
      const bssids = nonRenderableSignature.split(',');
      logDebug('geospatial.siblings.non_renderable_refs', {
        count: bssids.length,
        bssids: bssids.slice(0, 25),
        truncated: bssids.length > 25,
      });
    }
  }, [nonRenderableSignature]);

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
        badgeConfigs={badgeConfigs}
        siblingGroupCount={allGroupIds.size}
        allCollapsed={collapseAllActive}
        onToggleSiblingGroups={handleToggleSiblingGroups}
      />

      {import.meta.env.DEV && import.meta.env.VITE_SIBLING_DEBUG === 'true' && showWarning && (
        <div className="mx-2 mb-1 rounded border border-amber-600/50 bg-amber-950/40 px-2 py-1 text-[10px] text-amber-200">
          {topologyMismatch && (
            <span>
              Sibling expansion incomplete — loaded {filteredNetworks.length} visible rows; sibling
              graph references {siblingGroupMap?.size ?? 0} BSSIDs; {unresolvedSearchBssids.length}{' '}
              sibling rows not loaded yet.
            </span>
          )}
          {hydrationFailedBssids.length > 0 && (
            <span className="block text-red-400">
              Hydration failed ({hydrationFailedBssids.length}):{' '}
              {hydrationFailedBssids.slice(0, 4).join(', ')}
              {hydrationFailedBssids.length > 4 ? '…' : ''}
            </span>
          )}
          {missingDbBssids.length > 0 && (
            <span className="block text-red-300">
              Real data inconsistency / missing DB refs ({missingDbBssids.length}):{' '}
              {missingDbBssids.slice(0, 4).join(', ')}
              {missingDbBssids.length > 4 ? '…' : ''}
            </span>
          )}
          {unresolvedSearchBssids.length > 0 && (
            <span className="block text-amber-300/80">
              Unresolved in search expansion ({unresolvedSearchBssids.length}):{' '}
              {unresolvedSearchBssids.slice(0, 4).join(', ')}
              {unresolvedSearchBssids.length > 4 ? '…' : ''}
            </span>
          )}
        </div>
      )}

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
        collapseAllActive={collapseAllActive}
        collapsedGroups={collapsedGroups}
        onToggleCollapse={toggleCollapse}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onHorizontalScroll={setTableScrollLeft}
        badgeConfigs={badgeConfigs}
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
