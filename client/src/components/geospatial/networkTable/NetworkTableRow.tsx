import React from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../../types/network';
import { NETWORK_COLUMNS } from '../../../constants/network';
import { THREAT_LEVEL_CONFIG } from '../../../constants/network';
import { NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS } from '../networkTableGridConfig';
import { renderNetworkTableCell } from './cellRenderers';

interface NetworkTableRowProps {
  net: NetworkRow;
  virtualRow: VirtualItem;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  totalGridWidth: number;
  gridTemplateColumns: string;
  selectedNetworks: Set<string>;
  linkedSiblingBssids: Set<string>;
  siblingGroupId: string | null;
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

export const NetworkTableRow: React.FC<NetworkTableRowProps> = ({
  net,
  virtualRow,
  visibleColumns,
  totalGridWidth,
  gridTemplateColumns,
  selectedNetworks,
  linkedSiblingBssids,
  siblingGroupId,
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
  const threatLevel = (
    net.threat?.level || 'NONE'
  ).toUpperCase() as keyof typeof THREAT_LEVEL_CONFIG;
  const siblingColor = (THREAT_LEVEL_CONFIG[threatLevel] || THREAT_LEVEL_CONFIG.NONE).color;
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
