import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../../types/network';
import {
  NETWORK_TABLE_COLUMN_WIDTHS,
  NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS,
} from './networkTableGridConfig';
import { NetworkTableRow } from './NetworkTableRow';
import { mixBssidColors } from '../../../utils/wigle/colors';

function getLastOctet(bssid: string): number {
  const parts = bssid.split(':');
  return parseInt(parts[parts.length - 1] ?? '00', 16);
}

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
  // Sibling grouping driven by DB results from network_siblings_effective (via siblingGroupMap prop).
  // Only includes networks visible in the current page; singletons (one visible member) are dropped.
  const patternGroups = React.useMemo(() => {
    const groupMap = new Map<string, string>(); // bssid (upper) → groupId
    const groupMembers = new Map<string, string[]>(); // groupId → sorted bssids (upper)

    if (siblingGroupMap.size === 0) return { groupMap, groupMembers };

    const visibleBssids = new Set<string>();
    for (const net of filteredNetworks) {
      if (net.bssid) visibleBssids.add(net.bssid.toUpperCase());
    }

    siblingGroupMap.forEach((groupId, bssid) => {
      const bssidUpper = bssid.toUpperCase();
      if (!visibleBssids.has(bssidUpper)) return;
      groupMap.set(bssidUpper, groupId);
      const arr = groupMembers.get(groupId) ?? [];
      arr.push(bssidUpper);
      groupMembers.set(groupId, arr);
    });

    const singletons: string[] = [];
    groupMembers.forEach((members, groupId) => {
      if (members.length < 2) {
        singletons.push(groupId);
      } else {
        members.sort((a, b) => getLastOctet(a) - getLastOctet(b));
      }
    });
    for (const groupId of singletons) {
      const members = groupMembers.get(groupId)!;
      groupMap.delete(members[0]);
      groupMembers.delete(groupId);
    }

    return { groupMap, groupMembers };
  }, [filteredNetworks, siblingGroupMap]);

  // Re-order filteredNetworks so siblings are consecutive (lowest octet = parent, first)
  const sortedDisplayNetworks = React.useMemo(() => {
    const { groupMap, groupMembers } = patternGroups;
    if (groupMap.size === 0) return filteredNetworks;

    const netByBssid = new Map<string, NetworkRow>();
    for (const net of filteredNetworks) {
      if (net.bssid) netByBssid.set(net.bssid.toUpperCase(), net);
    }

    const placed = new Set<string>();
    const result: NetworkRow[] = [];

    for (const net of filteredNetworks) {
      const bssid = (net.bssid ?? '').toUpperCase();
      if (placed.has(bssid)) continue;
      const groupId = groupMap.get(bssid);
      if (groupId) {
        for (const memberBssid of groupMembers.get(groupId) ?? []) {
          if (placed.has(memberBssid)) continue;
          const member = netByBssid.get(memberBssid);
          if (member) {
            result.push(member);
            placed.add(memberBssid);
          }
        }
      } else {
        result.push(net);
        placed.add(bssid);
      }
    }

    return result;
  }, [filteredNetworks, patternGroups]);

  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());

  const toggleCollapse = React.useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // Filter out collapsed sibling rows (keep parent)
  const displayNetworks = React.useMemo(() => {
    if (patternGroups.groupMap.size === 0) return sortedDisplayNetworks;
    return sortedDisplayNetworks.filter((net) => {
      const bssid = (net.bssid ?? '').toUpperCase();
      const groupId = patternGroups.groupMap.get(bssid);
      if (!groupId || !collapsedGroups.has(groupId)) return true;
      const members = patternGroups.groupMembers.get(groupId) ?? [];
      return bssid === members[0];
    });
  }, [sortedDisplayNetworks, patternGroups, collapsedGroups]);

  // Reduced overscan from 10 → 5 to render fewer off-screen rows and improve performance
  // This significantly reduces DOM nodes and render work during scrolling
  const virtualizer = useVirtualizer({
    count: displayNetworks.length,
    getScrollElement: () => tableContainerRef.current,
    getItemKey: (index) => displayNetworks[index]?.bssid ?? index,
    estimateSize: () => 32,
    overscan: 5,
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

  // Memoize expensive grid calculations - these should only recompute when visibleColumns changes
  const { gridTemplateColumns, totalGridWidth, lockedVisibleColumns, lastLockedVisibleColumn } =
    React.useMemo(() => {
      const getColumnWidth = (col: keyof NetworkRow | 'select'): number =>
        (NETWORK_TABLE_COLUMN_WIDTHS as any)[String(col)] ?? 100;
      const gridTemplateCols = visibleColumns.map((col) => `${getColumnWidth(col)}px`).join(' ');
      const totalWidth = visibleColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);
      const lockedCols = visibleColumns.filter((col) =>
        NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(col))
      );
      const lastLockedCol = lockedCols[lockedCols.length - 1] ?? null;

      return {
        gridTemplateColumns: gridTemplateCols,
        totalGridWidth: totalWidth,
        lockedVisibleColumns: lockedCols,
        lastLockedVisibleColumn: lastLockedCol,
      };
    }, [visibleColumns]);

  // Memoize column helper functions
  const getLockedLeft = React.useCallback(
    (col: keyof NetworkRow | 'select'): number =>
      visibleColumns
        .slice(0, visibleColumns.indexOf(col))
        .filter((candidate) => NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(candidate)))
        .reduce(
          (sum, candidate) =>
            sum + ((NETWORK_TABLE_COLUMN_WIDTHS as any)[String(candidate)] ?? 100),
          0
        ),
    [visibleColumns]
  );

  const getLockedZIndex = React.useCallback(
    (col: keyof NetworkRow | 'select'): number => {
      const idx = lockedVisibleColumns.indexOf(col);
      return idx >= 0 ? 12 - idx : 4;
    },
    [lockedVisibleColumns]
  );

  // Compute mixed BSSID color per sibling group
  const siblingGroupColors = React.useMemo(() => {
    const groups = new Map<string, string[]>();
    siblingGroupMap.forEach((groupId, bssid) => {
      const arr = groups.get(groupId);
      if (arr) arr.push(bssid);
      else groups.set(groupId, [bssid]);
    });
    const colors = new Map<string, string>();
    groups.forEach((bssids, groupId) => colors.set(groupId, mixBssidColors(bssids)));
    return colors;
  }, [siblingGroupMap]);

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
          const net = displayNetworks[virtualRow.index];
          const siblingGroupId = siblingGroupMap.get(net.bssid) || null;
          const prevSiblingGroupId =
            virtualRow.index > 0
              ? siblingGroupMap.get(displayNetworks[virtualRow.index - 1]?.bssid) || null
              : null;
          const nextSiblingGroupId =
            virtualRow.index < displayNetworks.length - 1
              ? siblingGroupMap.get(displayNetworks[virtualRow.index + 1]?.bssid) || null
              : null;
          const isSiblingGroupStart =
            Boolean(siblingGroupId) && prevSiblingGroupId !== siblingGroupId;
          const isSiblingGroupEnd =
            Boolean(siblingGroupId) && nextSiblingGroupId !== siblingGroupId;

          const bssidUpper = (net.bssid ?? '').toUpperCase();
          const patternGroupId = patternGroups.groupMap.get(bssidUpper) ?? null;
          const patternMembers = patternGroupId
            ? (patternGroups.groupMembers.get(patternGroupId) ?? [])
            : [];
          const isPatternParent = patternGroupId !== null && patternMembers[0] === bssidUpper;
          const isPatternSibling = patternGroupId !== null && !isPatternParent;
          const patternSiblingCount = patternGroupId !== null ? patternMembers.length - 1 : 0;
          const isPatternGroupCollapsed =
            patternGroupId !== null && collapsedGroups.has(patternGroupId);

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
              siblingGroupColor={
                siblingGroupId ? (siblingGroupColors.get(siblingGroupId) ?? null) : null
              }
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
              isPatternParent={isPatternParent}
              isPatternSibling={isPatternSibling}
              patternGroupId={patternGroupId}
              patternSiblingCount={patternSiblingCount}
              isPatternGroupCollapsed={isPatternGroupCollapsed}
              onTogglePatternGroup={toggleCollapse}
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
