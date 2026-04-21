import React from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../../types/network';
import { NETWORK_COLUMNS } from '../../../constants/network';
import { NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS } from './networkTableGridConfig';
import { renderNetworkTableCell } from '../networkTable/cellRenderers';
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
  lockedVisibleColumns: _lockedVisibleColumns,
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
      role="row"
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
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenContextMenu(event, net);
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = isSelected
          ? 'rgba(59, 130, 246, 0.15)'
          : isSiblingLinkedRow
            ? `${siblingColor}12`
            : 'rgba(71, 85, 105, 0.1)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = isSelected
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

export const NetworkTableRow = React.memo(NetworkTableRowComponent, (prevProps, nextProps) => {
  const sameVisibleColumnOrder =
    prevProps.visibleColumns.length === nextProps.visibleColumns.length &&
    prevProps.visibleColumns.every((col, index) => col === nextProps.visibleColumns[index]);
  const prevBssid = prevProps.net.bssid ?? '';
  const nextBssid = nextProps.net.bssid ?? '';

  return (
    prevBssid === nextBssid &&
    prevProps.net.ssid === nextProps.net.ssid &&
    prevProps.net.bestlevel === nextProps.net.bestlevel &&
    prevProps.net.threat?.level === nextProps.net.threat?.level &&
    prevProps.selectedNetworks.has(prevBssid) === nextProps.selectedNetworks.has(nextBssid) &&
    prevProps.linkedSiblingBssids.has(prevBssid) === nextProps.linkedSiblingBssids.has(nextBssid) &&
    prevProps.siblingGroupId === nextProps.siblingGroupId &&
    prevProps.siblingGroupColor === nextProps.siblingGroupColor &&
    prevProps.virtualRow.start === nextProps.virtualRow.start &&
    prevProps.virtualRow.size === nextProps.virtualRow.size &&
    prevProps.totalGridWidth === nextProps.totalGridWidth &&
    prevProps.gridTemplateColumns === nextProps.gridTemplateColumns &&
    prevProps.selectedAnchorBssid === nextProps.selectedAnchorBssid &&
    prevProps.selectedAnchorHasLinkedSiblings === nextProps.selectedAnchorHasLinkedSiblings &&
    sameVisibleColumnOrder &&
    prevProps.lockedVisibleColumns.length === nextProps.lockedVisibleColumns.length &&
    prevProps.lockedVisibleColumns.every(
      (col, index) => col === nextProps.lockedVisibleColumns[index]
    ) &&
    prevProps.lastLockedVisibleColumn === nextProps.lastLockedVisibleColumn
  );
});
