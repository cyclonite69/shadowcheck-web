import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../../types/network';
import type { ColumnBadgeConfig } from '../../../types/badgeConfig';
import {
  NETWORK_TABLE_COLUMN_WIDTHS,
  NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS,
} from './networkTableGridConfig';
import { NetworkTableRow } from './NetworkTableRow';
import { mixBssidColors } from '../../../utils/wigle/colors';
import { buildPatternGroupsFromCanonicalMap } from '../utils/siblingGroupGraph';
import { componentSizesFromGroupMap, logSiblingTopology } from '../utils/siblingTopologyDebug';

// ---------------------------------------------------------------------------
// Shimmer skeleton
// ---------------------------------------------------------------------------

/** Widths (as %) for the shimmer blobs within each cell — vary them so rows
 *  don't look identical. Pattern repeats every 5 rows. */
const SHIMMER_WIDTHS = [55, 70, 45, 80, 60];

interface SkeletonRowsProps {
  count: number;
  gridTemplateColumns: string;
  totalGridWidth: number;
}

const SkeletonRows: React.FC<SkeletonRowsProps> = ({
  count,
  gridTemplateColumns,
  totalGridWidth,
}) => (
  <div style={{ width: `${totalGridWidth}px`, minWidth: '100%' }}>
    <style>{`
      @keyframes sc-shimmer {
        0%   { background-position: -600px 0; }
        100% { background-position:  600px 0; }
      }
      .sc-shimmer-blob {
        border-radius: 3px;
        height: 10px;
        background: linear-gradient(
          90deg,
          rgba(255,255,255,0.04) 25%,
          rgba(255,255,255,0.10) 50%,
          rgba(255,255,255,0.04) 75%
        );
        background-size: 600px 100%;
        animation: sc-shimmer 1.4s ease-in-out infinite;
      }
    `}</style>
    {Array.from({ length: count }, (_, i) => (
      <div
        key={i}
        role="row"
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns,
          height: '32px',
          alignItems: 'center',
          padding: '0 4px',
          borderBottom: '0.5px solid rgba(255,255,255,0.04)',
          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
          animationDelay: `${(i * 0.06).toFixed(2)}s`,
        }}
      >
        {gridTemplateColumns.split(' ').map((_, colIdx) => (
          <div key={colIdx} style={{ padding: '0 6px' }}>
            <div
              className="sc-shimmer-blob"
              style={{
                width: `${SHIMMER_WIDTHS[(i + colIdx) % SHIMMER_WIDTHS.length]}%`,
                animationDelay: `${(i * 0.06 + colIdx * 0.03).toFixed(2)}s`,
              }}
            />
          </div>
        ))}
      </div>
    ))}
  </div>
);

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
  onSelectGroup?: (bssids: string[]) => void;
  onOpenContextMenu: (event: React.MouseEvent<HTMLDivElement>, net: NetworkRow) => void;
  onToggleSelectNetwork: (bssid: string) => void;
  collapseAllActive: boolean;
  collapsedGroups: Set<string>;
  onToggleCollapse: (groupId: string) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onHorizontalScroll?: (scrollLeft: number) => void;
  badgeConfigs?: Record<string, ColumnBadgeConfig>;
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
  onSelectGroup,
  onOpenContextMenu,
  onToggleSelectNetwork,
  collapseAllActive,
  collapsedGroups,
  onToggleCollapse,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onHorizontalScroll,
  badgeConfigs,
}: NetworkTableBodyGridProps) => {
  // Canonical membership from siblingGroupMap; row presence is a render concern only.
  const patternGroups = React.useMemo(() => {
    const groups = buildPatternGroupsFromCanonicalMap(siblingGroupMap);
    logSiblingTopology('patternGroups', {
      canonicalMapSize: siblingGroupMap.size,
      groupMapSize: groups.groupMap.size,
      groupCount: groups.groupMembers.size,
      componentSizes: componentSizesFromGroupMap(groups.groupMap),
    });
    return groups;
  }, [siblingGroupMap]);

  // Cache previous sortedDisplayNetworks to detect pagination vs filter/sort
  const prevSortedRef = React.useRef<NetworkRow[]>([]);

  // Re-order filteredNetworks so siblings are consecutive (lowest octet = parent, first)
  // CRITICAL: Only append new items when pagination happens to preserve scroll position
  const sortedDisplayNetworks = React.useMemo(() => {
    const { groupMap, groupMembers } = patternGroups;
    if (groupMap.size === 0) {
      prevSortedRef.current = filteredNetworks;
      return filteredNetworks;
    }

    const netByBssid = new Map<string, NetworkRow>();
    for (const net of filteredNetworks) {
      if (net.bssid) {
        netByBssid.set(net.bssid.toUpperCase(), net);
      }
    }

    // Check if this is pagination (only new items added at end) vs filter change (array replaced)
    const isPagination =
      prevSortedRef.current.length > 0 &&
      prevSortedRef.current.length < filteredNetworks.length &&
      prevSortedRef.current.every((item, idx) => item.bssid === filteredNetworks[idx]?.bssid);

    let result: NetworkRow[];

    if (isPagination) {
      // Pagination: keep existing sorted items, only process new items
      result = [...prevSortedRef.current];
      const placed = new Set<string>();

      // Mark all existing items as placed
      for (const item of result) {
        if (item.bssid) {
          placed.add(item.bssid.toUpperCase());
        }
      }

      // Only add new items starting from where we left off
      for (let i = prevSortedRef.current.length; i < filteredNetworks.length; i++) {
        const net = filteredNetworks[i];
        if (!net.bssid) {
          continue;
        }
        const bssid = net.bssid.toUpperCase();
        if (placed.has(bssid)) {
          continue;
        }

        const groupId = groupMap.get(bssid);
        if (groupId) {
          for (const memberBssid of groupMembers.get(groupId) ?? []) {
            if (placed.has(memberBssid)) {
              continue;
            }
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
    } else {
      // Filter/sort change: rebuild entire sorted list
      const placed = new Set<string>();
      result = [];

      for (const net of filteredNetworks) {
        const bssid = (net.bssid ?? '').toUpperCase();
        if (placed.has(bssid)) {
          continue;
        }
        const groupId = groupMap.get(bssid);
        if (groupId) {
          for (const memberBssid of groupMembers.get(groupId) ?? []) {
            if (placed.has(memberBssid)) {
              continue;
            }
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
    }

    prevSortedRef.current = result;
    return result;
  }, [filteredNetworks, patternGroups]);

  // Set of visible BSSIDs present in sortedDisplayNetworks before collapse is applied
  const visibleBssids = React.useMemo(() => {
    return new Set(
      sortedDisplayNetworks.map((net) => (net.bssid ?? '').toUpperCase()).filter(Boolean)
    );
  }, [sortedDisplayNetworks]);

  const handleSelectExclusive = React.useCallback(
    (bssid: string) => {
      if (bssid && onSelectGroup) {
        const bssidUpper = bssid.toUpperCase();
        const groupId = patternGroups.groupMap.get(bssidUpper);
        if (groupId) {
          const members = patternGroups.groupMembers.get(groupId) ?? [];
          if (members[0] === bssidUpper && members.length > 1) {
            const actualBssids: string[] = [];
            for (const m of members) {
              const net = filteredNetworks.find((n) => n.bssid?.toUpperCase() === m);
              if (net?.bssid) {
                actualBssids.push(net.bssid);
              }
            }
            if (actualBssids.length > 0) {
              onSelectGroup(actualBssids);
              return;
            }
          }
        }
      }
      onSelectExclusive(bssid);
    },
    [patternGroups, onSelectGroup, onSelectExclusive, filteredNetworks]
  );

  // Filter out collapsed sibling rows (keep parent).
  const displayNetworks = React.useMemo(() => {
    if (patternGroups.groupMap.size === 0) {
      return sortedDisplayNetworks;
    }
    return sortedDisplayNetworks.filter((net) => {
      const bssid = (net.bssid ?? '').toUpperCase();
      const groupId = patternGroups.groupMap.get(bssid);
      if (!groupId) {
        return true;
      }
      const isCollapsed = collapseAllActive
        ? !collapsedGroups.has(groupId)
        : collapsedGroups.has(groupId);
      if (!isCollapsed) {
        return true;
      }
      const members = patternGroups.groupMembers.get(groupId) ?? [];
      const firstVisibleMember = members.find((m) => visibleBssids.has(m));
      return bssid === firstVisibleMember;
    });
  }, [sortedDisplayNetworks, patternGroups, collapseAllActive, collapsedGroups, visibleBssids]);

  const prevRenderLogKey = React.useRef('');
  React.useEffect(() => {
    const rowBssids = new Set(
      filteredNetworks.map((n) => (n.bssid ?? '').toUpperCase()).filter(Boolean)
    );
    const membersMissingRows: string[] = [];
    patternGroups.groupMap.forEach((_gid, bssid) => {
      if (!rowBssids.has(bssid)) {
        membersMissingRows.push(bssid);
      }
    });

    const key = [
      filteredNetworks.length,
      sortedDisplayNetworks.length,
      displayNetworks.length,
      membersMissingRows.join(','),
    ].join('|');
    if (key === prevRenderLogKey.current) {
      return;
    }
    prevRenderLogKey.current = key;

    logSiblingTopology('renderPipeline.table', {
      filteredNetworksCount: filteredNetworks.length,
      sortedDisplayNetworksCount: sortedDisplayNetworks.length,
      displayNetworksCount: displayNetworks.length,
      canonicalGroupMapSize: patternGroups.groupMap.size,
      membersMissingRows,
    });
  }, [
    filteredNetworks,
    sortedDisplayNetworks.length,
    displayNetworks.length,
    patternGroups.groupMap,
  ]);

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
    if (!tableContainerRef.current) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight, scrollLeft } = tableContainerRef.current;
    onHorizontalScroll?.(scrollLeft);
    if (isLoadingMore || !hasMore) {
      return;
    }
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when 80% scrolled
    if (scrollPercentage > 0.8 && hasMore && !isLoadingMore) {
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
      if (arr) {
        arr.push(bssid);
      } else {
        groups.set(groupId, [bssid]);
      }
    });
    const colors = new Map<string, string>();
    groups.forEach((bssids, groupId) => colors.set(groupId, mixBssidColors(bssids)));
    return colors;
  }, [siblingGroupMap]);

  // Show initial loading / empty / error states only when we have no rows yet.
  if (filteredNetworks.length === 0 || error) {
    return (
      <div ref={tableContainerRef} className="flex-1 overflow-auto min-h-0">
        {loadingNetworks && (
          <SkeletonRows
            count={18}
            gridTemplateColumns={gridTemplateColumns}
            totalGridWidth={totalGridWidth}
          />
        )}
        {error && <div className="p-4 text-center text-slate-400">{`Error: ${error}`}</div>}
        {!loadingNetworks && !error && filteredNetworks.length === 0 && (
          <div className="p-4 text-center text-slate-400">No networks found</div>
        )}
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
          const firstVisibleMember = patternMembers.find((m) => visibleBssids.has(m));
          const isPatternParent = patternGroupId !== null && firstVisibleMember === bssidUpper;
          const isPatternSibling = patternGroupId !== null && !isPatternParent;
          const patternSiblingCount = patternGroupId !== null ? patternMembers.length - 1 : 0;
          const isPatternGroupCollapsed =
            patternGroupId !== null &&
            (collapseAllActive
              ? !collapsedGroups.has(patternGroupId)
              : collapsedGroups.has(patternGroupId));

          return (
            <NetworkTableRow
              key={`${net.bssid}-${virtualRow.index}`}
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
              onSelectExclusive={handleSelectExclusive}
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
              onTogglePatternGroup={onToggleCollapse}
              badgeConfigs={badgeConfigs}
            />
          );
        })}
      </div>
      {isLoadingMore && (
        <SkeletonRows
          count={4}
          gridTemplateColumns={gridTemplateColumns}
          totalGridWidth={totalGridWidth}
        />
      )}
    </div>
  );
};
