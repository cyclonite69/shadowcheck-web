import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../types/network';
import {
  NETWORK_TABLE_COLUMN_WIDTHS,
  NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS,
} from './networkTableGridConfig';
import { NetworkTableRow } from './networkTable/NetworkTableRow';

interface NetworkTableBodyGridProps {
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  loadingNetworks: boolean;
  filteredNetworks: NetworkRow[];
  error: string | null;
  selectedNetworks: Set<string>;
  linkedSiblingBssids?: Set<string>;
  siblingGroupMap?: Map<string, string>;
  selectedAnchorBssid?: string | null;
  selectedAnchorHasLinkedSiblings?: boolean;
  onSelectExclusive: (bssid: string) => void;
  onOpenContextMenu: (event: React.MouseEvent<HTMLDivElement>, net: NetworkRow) => void;
  onToggleSelectNetwork: (bssid: string) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onHorizontalScroll?: (scrollLeft: number) => void;
}

export const NetworkTableBodyGrid = ({
  tableContainerRef,
  visibleColumns,
  loadingNetworks,
  filteredNetworks,
  error,
  selectedNetworks,
  linkedSiblingBssids = new Set<string>(),
  siblingGroupMap = new Map<string, string>(),
  selectedAnchorBssid = null,
  selectedAnchorHasLinkedSiblings = false,
  onSelectExclusive,
  onOpenContextMenu,
  onToggleSelectNetwork,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onHorizontalScroll,
}: NetworkTableBodyGridProps) => {
  const virtualizer = useVirtualizer({
    count: filteredNetworks.length,
    getScrollElement: () => tableContainerRef.current,
    getItemKey: (index) => filteredNetworks[index]?.bssid ?? index,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Infinite scroll: load more when scrolled near bottom
  const handleScroll = () => {
    if (!tableContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight, scrollLeft } = tableContainerRef.current;
    onHorizontalScroll?.(scrollLeft);
    if (isLoadingMore || !hasMore) return;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when 80% scrolled
    if (scrollPercentage > 0.8) {
      onLoadMore();
    }
  };

  // Show initial loading / empty / error states only when we have no rows yet.
  if (
    (loadingNetworks && filteredNetworks.length === 0) ||
    filteredNetworks.length === 0 ||
    error
  ) {
    return (
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto min-h-0 p-4 text-center text-slate-400"
      >
        {loadingNetworks && 'Loading networks...'}
        {error && `Error: ${error}`}
        {!loadingNetworks && !error && filteredNetworks.length === 0 && 'No networks found'}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  // Build grid template columns based on visible columns
  const getColumnWidth = (col: keyof NetworkRow | 'select'): number =>
    NETWORK_TABLE_COLUMN_WIDTHS[String(col)] ?? 100;
  const gridTemplateColumns = visibleColumns.map((col) => `${getColumnWidth(col)}px`).join(' ');
  const totalGridWidth = visibleColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);
  const lockedVisibleColumns = visibleColumns.filter((col) =>
    NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(col))
  );
  const lastLockedVisibleColumn = lockedVisibleColumns[lockedVisibleColumns.length - 1] ?? null;
  const getLockedLeft = (col: keyof NetworkRow | 'select'): number =>
    visibleColumns
      .slice(0, visibleColumns.indexOf(col))
      .filter((candidate) => NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(candidate)))
      .reduce((sum, candidate) => sum + getColumnWidth(candidate), 0);
  const getLockedZIndex = (col: keyof NetworkRow | 'select'): number => {
    const idx = lockedVisibleColumns.indexOf(col);
    return idx >= 0 ? 12 - idx : 4;
  };

  return (
    <div
      ref={tableContainerRef}
      className="flex-1 overflow-auto min-h-0"
      style={{ fontSize: '11px' }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: `${totalGridWidth}px`,
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const net = filteredNetworks[virtualRow.index];
          const siblingGroupId = siblingGroupMap.get(net.bssid) || null;
          const prevSiblingGroupId =
            virtualRow.index > 0
              ? siblingGroupMap.get(filteredNetworks[virtualRow.index - 1]?.bssid) || null
              : null;
          const nextSiblingGroupId =
            virtualRow.index < filteredNetworks.length - 1
              ? siblingGroupMap.get(filteredNetworks[virtualRow.index + 1]?.bssid) || null
              : null;
          const isSiblingGroupStart =
            Boolean(siblingGroupId) && prevSiblingGroupId !== siblingGroupId;
          const isSiblingGroupEnd =
            Boolean(siblingGroupId) && nextSiblingGroupId !== siblingGroupId;

          return (
            <NetworkTableRow
              key={net.bssid}
              virtualRow={virtualRow}
              net={net}
              visibleColumns={visibleColumns}
              totalGridWidth={totalGridWidth}
              gridTemplateColumns={gridTemplateColumns}
              selectedNetworks={selectedNetworks}
              linkedSiblingBssids={linkedSiblingBssids}
              siblingGroupId={siblingGroupId}
              isSiblingGroupStart={isSiblingGroupStart}
              isSiblingGroupEnd={isSiblingGroupEnd}
              selectedAnchorBssid={selectedAnchorBssid}
              selectedAnchorHasLinkedSiblings={selectedAnchorHasLinkedSiblings}
              onSelectExclusive={onSelectExclusive}
              onOpenContextMenu={onOpenContextMenu}
              onToggleSelectNetwork={onToggleSelectNetwork}
              lockedVisibleColumns={lockedVisibleColumns}
              lastLockedVisibleColumn={lastLockedVisibleColumn}
              getLockedLeft={getLockedLeft}
              getLockedZIndex={getLockedZIndex}
            />
          );
        })}
      </div>
      {isLoadingMore && (
        <div
          style={{
            padding: '8px 12px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '11px',
          }}
        >
          Loading more networks...
        </div>
      )}
    </div>
  );
};
