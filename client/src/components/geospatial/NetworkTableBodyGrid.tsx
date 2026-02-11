import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NetworkRow } from '../../types/network';
import { NETWORK_COLUMNS } from '../../constants/network';
import { macColor } from '../../utils/mapHelpers';
import { TypeBadge, ThreatBadge } from '../badges';

interface NetworkTableBodyGridProps {
  tableContainerRef: React.RefObject<HTMLDivElement>;
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
}: NetworkTableBodyGridProps) => {
  const virtualizer = useVirtualizer({
    count: filteredNetworks.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Infinite scroll: load more when scrolled near bottom
  const handleScroll = () => {
    if (!tableContainerRef.current || isLoadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // Load more when 80% scrolled
    if (scrollPercentage > 0.8) {
      onLoadMore();
    }
  };

  // Show empty state
  if (loadingNetworks || filteredNetworks.length === 0 || error) {
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
  const gridTemplateColumns = visibleColumns
    .map((col) => {
      if (col === 'select') return '40px';
      // Adjust column widths as needed
      const widths: Record<string, string> = {
        type: '60px',
        ssid: '150px',
        bssid: '140px',
        threat: '80px',
        signal: '90px',
        security: '100px',
        observations: '110px',
        distance: '100px',
        maxDist: '100px',
        threatScore: '110px',
        frequency: '90px',
        channel: '80px',
        manufacturer: '120px',
      };
      return widths[col] || '100px';
    })
    .join(' ');

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
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => {
          const net = filteredNetworks[virtualRow.index];
          const isSelected = selectedNetworks.has(net.bssid);

          return (
            <div
              key={net.bssid}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns,
                alignItems: 'center',
                borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                cursor: 'pointer',
                padding: '0 8px',
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
                  : 'transparent';
              }}
            >
              {visibleColumns.map((col) => {
                const column = NETWORK_COLUMNS[col as keyof typeof NETWORK_COLUMNS];
                if (!column) return null;

                const value = net[col as keyof NetworkRow];

                // Select checkbox
                if (col === 'select') {
                  return (
                    <div key={col} style={{ padding: '0 4px' }}>
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
                    <div key={col} style={{ padding: '0 4px' }}>
                      <TypeBadge type={(value as string) || '?'} />
                    </div>
                  );
                }

                // Threat badge with reasons and evidence
                if (col === 'threat') {
                  return (
                    <div key={col} style={{ padding: '0 4px' }}>
                      <ThreatBadge
                        threat={net.threat}
                        reasons={net.threatReasons}
                        evidence={net.threatEvidence}
                      />
                    </div>
                  );
                }

                // Signal with color coding
                if (col === 'signal') {
                  const signalValue = value as number | null;
                  let color = '#6b7280';
                  if (signalValue != null && signalValue !== 0) {
                    if (signalValue >= -50) color = '#10b981';
                    else if (signalValue >= -70) color = '#f59e0b';
                    else color = '#ef4444';
                  }
                  return (
                    <div key={col} style={{ padding: '0 4px' }}>
                      <span style={{ color, fontWeight: 600 }}>
                        {signalValue != null && signalValue !== 0 ? `${signalValue} dBm` : 'N/A'}
                      </span>
                    </div>
                  );
                }

                // Observations count badge
                if (col === 'observations') {
                  return (
                    <div key={col} style={{ padding: '0 4px' }}>
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
                      <div key={col} style={{ padding: '0 4px' }}>
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
                    <div key={col} style={{ padding: '0 4px', color: '#cbd5e1' }}>
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
                      <div key={col} style={{ padding: '0 4px' }}>
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
                    <div key={col} style={{ padding: '0 4px', color: '#cbd5e1' }}>
                      N/A
                    </div>
                  );
                }

                // BSSID with color (not SSID!)
                if (col === 'bssid') {
                  return (
                    <div
                      key={col}
                      style={{
                        padding: '0 4px',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        color: macColor(net.bssid),
                      }}
                    >
                      {value}
                    </div>
                  );
                }

                // SSID (no color, just text)
                if (col === 'ssid') {
                  return (
                    <div
                      key={col}
                      style={{
                        padding: '0 4px',
                        color: '#f1f5f9',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={value as string}
                    >
                      {value || '(hidden)'}
                    </div>
                  );
                }

                // Default text
                return (
                  <div
                    key={col}
                    style={{
                      padding: '0 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#f1f5f9',
                    }}
                    title={String(value)}
                  >
                    {value ?? 'N/A'}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
