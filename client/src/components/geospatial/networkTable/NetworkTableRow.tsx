import React from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../../types/network';
import { NETWORK_COLUMNS } from '../../../constants/network';
import { NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS } from '../networkTableGridConfig';
import { renderNetworkTableCell } from './cellRenderers';
import { macColor } from '../../../utils/mapHelpers';

interface NetworkTableRowProps {
  net: NetworkRow;
  virtualRow: VirtualItem;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  totalGridWidth: number;
  gridTemplateColumns: string;
  selectedNetworks: Set<string>;
  linkedSiblingBssids: Set<string>;
  siblingGroupId: string | null;
  siblingGroupColor: string | null;
  isSiblingGroupStart: boolean;
  isSiblingGroupEnd: boolean;
  selectedAnchorBssid: string | null;
  selectedAnchorHasLinkedSiblings: boolean;
  onSelectExclusive: (bssid: string) => void;
  onOpenContextMenu: (event: React.MouseEvent<HTMLDivElement>, net: NetworkRow) => void;
  onToggleSelectNetwork: (bssid: string) => void;
  lockedVisibleColumns: Array<keyof NetworkRow | 'select'>;
  lastLockedVisibleColumn: keyof NetworkRow | 'select' | null;
  getLockedLeft: (col: keyof NetworkRow | 'select') => number;
  getLockedZIndex: (col: keyof NetworkRow | 'select') => number;
}

const NetworkTableRowComponent: React.FC<NetworkTableRowProps> = ({
  net,
  virtualRow,
  visibleColumns,
  totalGridWidth,
  gridTemplateColumns,
  selectedNetworks,
  linkedSiblingBssids,
  siblingGroupId,
  siblingGroupColor,
  isSiblingGroupStart,
  isSiblingGroupEnd,
  selectedAnchorBssid,
  selectedAnchorHasLinkedSiblings,
  onSelectExclusive,
  onOpenContextMenu,
  onToggleSelectNetwork,
  lockedVisibleColumns,
  lastLockedVisibleColumn,
  getLockedLeft,
  getLockedZIndex,
}) => {
  const isSelected = net.bssid ? selectedNetworks.has(net.bssid) : false;
  const isLinkedSibling = net.bssid ? linkedSiblingBssids.has(net.bssid) : false;
  const showSelectedAnchorLink =
    net.bssid === selectedAnchorBssid && selectedAnchorHasLinkedSiblings;
  const isSiblingLinkedRow = Boolean(siblingGroupId) || showSelectedAnchorLink || isLinkedSibling;
  const siblingColor = siblingGroupColor || macColor(net.bssid ?? '');
  const rowBackground = isSelected
    ? 'rgba(59, 130, 246, 0.1)'
    : isSiblingLinkedRow
      ? `${siblingColor}0a`
      : 'rgba(15, 23, 42, 0.45)';
  const rowAccent = isSiblingLinkedRow
    ? [
        `inset 3px 0 0 ${siblingColor}cc`,
        isSiblingGroupStart ? `inset 0 1px 0 ${siblingColor}55` : '',
        isSiblingGroupEnd ? `inset 0 -1px 0 ${siblingColor}55` : '',
      ]
        .filter(Boolean)
        .join(', ')
    : undefined;

  const getStickyCellStyle = (col: keyof NetworkRow | 'select'): React.CSSProperties => {
    const isLocked = NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(col));
    return isLocked
      ? {
          position: 'sticky',
          left: `${getLockedLeft(col)}px`,
          zIndex: getLockedZIndex(col),
          background: rowBackground,
          boxShadow:
            col === lastLockedVisibleColumn ? '1px 0 0 rgba(71, 85, 105, 0.25)' : undefined,
        }
      : { minWidth: 0, overflow: 'hidden' };
  };

  const renderCell = (col: keyof NetworkRow | 'select') => {
    const column = NETWORK_COLUMNS[col as keyof typeof NETWORK_COLUMNS];
    const value = net[col as keyof NetworkRow];
    const stickyCellStyle = getStickyCellStyle(col);
    const {
      content,
      style: overrideStyle,
      title,
    } = renderNetworkTableCell({
      column: col,
      columnConfig: column,
      row: net,
      value,
      isSelected,
      isLinkedSibling,
      showSelectedAnchorLink,
      onToggleSelectNetwork,
    });

    return (
      <div
        key={col}
        style={{
          ...stickyCellStyle,
          padding: '0 4px',
          ...overrideStyle,
        }}
        title={title}
      >
        {content}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: `${virtualRow.start}px`,
        left: 0,
        width: `${totalGridWidth}px`,
        height: `${virtualRow.size}px`,
        display: 'grid',
        gridTemplateColumns,
        minWidth: 0,
        alignItems: 'center',
        overflow: 'hidden',
        background: rowBackground,
        boxShadow: rowAccent,
        cursor: 'pointer',
        padding: 0,
        borderTop: isSiblingGroupStart ? '1px solid rgba(103, 232, 249, 0.35)' : undefined,
        borderBottom: isSiblingGroupEnd
          ? '1px solid rgba(103, 232, 249, 0.35)'
          : '1px solid rgba(71, 85, 105, 0.2)',
      }}
      onClick={() => onSelectExclusive(net.bssid)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenContextMenu(e, net);
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isSelected
          ? 'rgba(59, 130, 246, 0.15)'
          : isSiblingLinkedRow
            ? `${siblingColor}12`
            : 'rgba(71, 85, 105, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isSelected
          ? 'rgba(59, 130, 246, 0.1)'
          : isSiblingLinkedRow
            ? `${siblingColor}0a`
            : 'rgba(15, 23, 42, 0.45)';
      }}
    >
      {visibleColumns.map(renderCell)}
    </div>
  );
};

/**
 * Memoized NetworkTableRow - only re-renders when network data or selection state actually changes.
 * This prevents re-renders on every parent update and significantly improves performance when
 * scrolling or dragging the map (which updates parent but not individual rows).
 */
export const NetworkTableRow = React.memo(NetworkTableRowComponent, (prevProps, nextProps) => {
  const sameVisibleColumnOrder =
    prevProps.visibleColumns.length === nextProps.visibleColumns.length &&
    prevProps.visibleColumns.every((col, index) => col === nextProps.visibleColumns[index]);

  // Return true if props are equal (skip re-render), false if different (re-render)
  const propsEqual =
    // Network data changed?
    prevProps.net.bssid === nextProps.net.bssid &&
    prevProps.net.ssid === nextProps.net.ssid &&
    prevProps.net.bestlevel === nextProps.net.bestlevel &&
    prevProps.net.threat?.level === nextProps.net.threat?.level &&
    // Selection state changed?
    prevProps.selectedNetworks.has(prevProps.net.bssid) ===
      nextProps.selectedNetworks.has(nextProps.net.bssid) &&
    // Sibling linking changed?
    prevProps.linkedSiblingBssids.has(prevProps.net.bssid) ===
      nextProps.linkedSiblingBssids.has(nextProps.net.bssid) &&
    prevProps.siblingGroupId === nextProps.siblingGroupId &&
    prevProps.siblingGroupColor === nextProps.siblingGroupColor &&
    // Position changed?
    prevProps.virtualRow.start === nextProps.virtualRow.start &&
    prevProps.virtualRow.size === nextProps.virtualRow.size &&
    // Layout changed?
    sameVisibleColumnOrder &&
    prevProps.gridTemplateColumns === nextProps.gridTemplateColumns &&
    prevProps.totalGridWidth === nextProps.totalGridWidth;

  return propsEqual; // true = skip re-render, false = do re-render
});
