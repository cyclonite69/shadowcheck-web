import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../types/network';
import { NETWORK_COLUMNS } from '../../constants/network';
import { macColor } from '../../utils/mapHelpers';
import { TypeBadge, ThreatBadge } from '../badges';
import {
  getSignalColor,
  getSignalDisplay,
  getTimespanBadgeStyle,
  getTimespanDisplay,
} from '../../utils/networkFormatting';

const COLUMN_WIDTHS: Record<string, number> = {
  select: 40,
  type: 60,
  ssid: 150,
  bssid: 140,
  threat: 80,
  signal: 90,
  security: 100,
  observations: 110,
  distance: 100,
  maxDist: 100,
  threatScore: 110,
  frequency: 90,
  channel: 80,
  timespanDays: 100,
  manufacturer: 120,
  all_tags: 120,
  wigle_v3_observation_count: 90,
  wigle_v3_last_import_at: 140,
};

const LOCKED_HORIZONTAL_COLUMNS = ['select', 'type', 'ssid', 'bssid'];

interface NetworkTableBodyGridProps {
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  loadingNetworks: boolean;
  filteredNetworks: NetworkRow[];
  error: string | null;
  selectedNetworks: Set<string>;
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
    COLUMN_WIDTHS[String(col)] ?? 100;
  const gridTemplateColumns = visibleColumns.map((col) => `${getColumnWidth(col)}px`).join(' ');
  const totalGridWidth = visibleColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);
  const lockedVisibleColumns = visibleColumns.filter((col) =>
    LOCKED_HORIZONTAL_COLUMNS.includes(String(col))
  );
  const lastLockedVisibleColumn = lockedVisibleColumns[lockedVisibleColumns.length - 1] ?? null;
  const getLockedLeft = (col: keyof NetworkRow | 'select'): number =>
    visibleColumns
      .slice(0, visibleColumns.indexOf(col))
      .filter((candidate) => LOCKED_HORIZONTAL_COLUMNS.includes(String(candidate)))
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
          const isSelected = selectedNetworks.has(net.bssid);
          const rowBackground = isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(15, 23, 42, 0.45)';

          return (
            <div
              key={net.bssid}
              style={{
                position: 'absolute',
                top: `${virtualRow.start}px`,
                left: 0,
                width: `${totalGridWidth}px`,
                height: `${virtualRow.size}px`,
                display: 'grid',
                gridTemplateColumns,
                alignItems: 'center',
                borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                background: rowBackground,
                cursor: 'pointer',
                padding: '0',
              }}
              onClick={() => onSelectExclusive(net.bssid)}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenContextMenu(e, net);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isSelected
                  ? 'rgba(59, 130, 246, 0.15)'
                  : 'rgba(71, 85, 105, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected
                  ? 'rgba(59, 130, 246, 0.1)'
                  : 'rgba(15, 23, 42, 0.45)';
              }}
            >
              {visibleColumns.map((col) => {
                const column = NETWORK_COLUMNS[col as keyof typeof NETWORK_COLUMNS];
                if (!column) return null;

                const value = net[col as keyof NetworkRow];
                const isLockedColumn = LOCKED_HORIZONTAL_COLUMNS.includes(String(col));
                const stickyCellStyle: React.CSSProperties = isLockedColumn
                  ? {
                      position: 'sticky',
                      left: `${getLockedLeft(col)}px`,
                      zIndex: getLockedZIndex(col),
                      background: rowBackground,
                      boxShadow:
                        col === lastLockedVisibleColumn
                          ? '1px 0 0 rgba(71, 85, 105, 0.25)'
                          : undefined,
                    }
                  : {};

                // Select checkbox
                if (col === 'select') {
                  return (
                    <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectNetwork(net.bssid)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                  );
                }

                // Type badge
                if (col === 'type') {
                  return (
                    <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                      <TypeBadge type={(value as any) || '?'} />
                    </div>
                  );
                }

                // Threat badge with reasons and evidence
                if (col === 'threat') {
                  const allTagsTooltip =
                    typeof net.all_tags === 'string' && net.all_tags.trim().length > 0
                      ? `Manual tags: ${net.all_tags}`
                      : undefined;
                  return (
                    <div
                      key={col}
                      style={{ ...stickyCellStyle, padding: '0 4px' }}
                      title={allTagsTooltip}
                    >
                      <ThreatBadge
                        threat={net.threat || undefined}
                        reasons={net.threatReasons as any}
                        evidence={net.threatEvidence as any}
                      />
                    </div>
                  );
                }

                // Signal with color coding
                if (col === 'signal') {
                  const signalValue = value as number | null;
                  return (
                    <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                      <span style={{ color: getSignalColor(signalValue), fontWeight: 600 }}>
                        {getSignalDisplay(signalValue)}
                      </span>
                    </div>
                  );
                }

                // Observations count badge
                if (col === 'observations') {
                  return (
                    <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                      <span
                        style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#93c5fd',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '500',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          display: 'inline-block',
                        }}
                      >
                        {value as number}
                      </span>
                    </div>
                  );
                }

                // Channel badge (WiFi only)
                if (col === 'channel') {
                  const channelValue = value as number | null;
                  const networkType = net.type;
                  if (networkType === 'W' && channelValue !== null && channelValue !== 0) {
                    return (
                      <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            display: 'inline-block',
                          }}
                        >
                          {channelValue}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={col}
                      style={{ ...stickyCellStyle, padding: '0 4px', color: '#cbd5e1' }}
                    >
                      {networkType === 'W' ? 'N/A' : '—'}
                    </div>
                  );
                }

                // Frequency
                if (col === 'frequency') {
                  const freqValue = value as number | null;
                  if (freqValue !== null && freqValue !== 0) {
                    const isWiFi = net.type === 'W';
                    return (
                      <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                        <span
                          style={{
                            color: isWiFi ? '#10b981' : '#94a3b8',
                            fontWeight: isWiFi ? '600' : '400',
                          }}
                        >
                          {freqValue} MHz
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={col}
                      style={{ ...stickyCellStyle, padding: '0 4px', color: '#cbd5e1' }}
                    >
                      N/A
                    </div>
                  );
                }

                // Timespan badge (3-tier traffic light)
                if (col === 'timespanDays') {
                  const days = value as number | null;
                  if (days !== null && days >= 0) {
                    const { bg, color, border } = getTimespanBadgeStyle(days);
                    return (
                      <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                        <span
                          style={{
                            background: bg,
                            color,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500',
                            border: `1px solid ${border}`,
                            display: 'inline-block',
                          }}
                        >
                          {getTimespanDisplay(days)}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={col}
                      style={{ ...stickyCellStyle, padding: '0 4px', color: '#94a3b8' }}
                    >
                      Not computed
                    </div>
                  );
                }

                // BSSID with color (not SSID!)
                if (col === 'bssid') {
                  return (
                    <div
                      key={col}
                      style={{
                        ...stickyCellStyle,
                        padding: '0 4px',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        color: macColor(net.bssid),
                      }}
                    >
                      {value as any}
                    </div>
                  );
                }

                // SSID (no color, just text)
                if (col === 'ssid') {
                  return (
                    <div
                      key={col}
                      style={{
                        ...stickyCellStyle,
                        padding: '0 4px',
                        color: '#f1f5f9',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={value as string}
                    >
                      {(value as any) || '(hidden)'}
                    </div>
                  );
                }

                if (column.render) {
                  return (
                    <div key={col} style={{ ...stickyCellStyle, padding: '0 4px' }}>
                      {column.render(value, net)}
                    </div>
                  );
                }

                // Default text
                return (
                  <div
                    key={col}
                    style={{
                      ...stickyCellStyle,
                      padding: '0 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#f1f5f9',
                    }}
                    title={
                      typeof value === 'string' || typeof value === 'number' ? String(value) : ''
                    }
                  >
                    {
                      (typeof value === 'string' ||
                      typeof value === 'number' ||
                      typeof value === 'boolean'
                        ? (value as any)
                        : value == null
                          ? 'N/A'
                          : '—') as any
                    }
                  </div>
                );
              })}
            </div>
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
