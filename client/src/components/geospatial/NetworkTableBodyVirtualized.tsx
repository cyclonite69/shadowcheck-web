import React, { useCallback } from 'react';
import { List } from 'react-window';
import type { NetworkRow } from '../../types/network';
import { NetworkTableEmptyState } from './NetworkTableEmptyState';
import { NetworkTableFooter } from './NetworkTableFooter';
import { NetworkTableRow } from './NetworkTableRow';

interface NetworkTableBodyProps {
  tableContainerRef: React.RefObject<HTMLDivElement>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  loadingNetworks: boolean;
  filteredNetworks: NetworkRow[];
  error: string | null;
  selectedNetworks: Set<string>;
  onSelectExclusive: (bssid: string) => void;
  onOpenContextMenu: (event: React.MouseEvent<HTMLTableRowElement>, net: NetworkRow) => void;
  onToggleSelectNetwork: (bssid: string) => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

const ROW_HEIGHT = 32; // Height of each table row in pixels

export const NetworkTableBodyVirtualized = ({
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
}: NetworkTableBodyProps) => {
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }): React.ReactElement => {
      const net = filteredNetworks[index];
      return (
        <div style={{ ...style, display: 'table-row' }}>
          <NetworkTableRow
            net={net}
            index={index}
            visibleColumns={visibleColumns}
            isSelected={selectedNetworks.has(net.bssid)}
            onSelectExclusive={onSelectExclusive}
            onOpenContextMenu={onOpenContextMenu}
            onToggleSelectNetwork={onToggleSelectNetwork}
          />
        </div>
      );
    },
    [
      filteredNetworks,
      visibleColumns,
      selectedNetworks,
      onSelectExclusive,
      onOpenContextMenu,
      onToggleSelectNetwork,
    ]
  );

  // Show empty state if loading or no data
  if (loadingNetworks || filteredNetworks.length === 0 || error) {
    return (
      <div ref={tableContainerRef} className="flex-1 overflow-auto min-h-0">
        <table
          style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: '11px',
          }}
        >
          <tbody>
            <NetworkTableEmptyState
              loading={loadingNetworks}
              empty={!loadingNetworks && filteredNetworks.length === 0}
              error={error}
              colSpan={visibleColumns.length}
            />
          </tbody>
        </table>
      </div>
    );
  }

  // Calculate container height
  const containerHeight = tableContainerRef.current?.clientHeight || 600;

  return (
    <div ref={tableContainerRef} className="flex-1 overflow-hidden min-h-0">
      <div style={{ display: 'table', width: '100%', tableLayout: 'fixed' }}>
        <List
          defaultHeight={containerHeight - 40}
          rowCount={filteredNetworks.length}
          rowHeight={ROW_HEIGHT}
          rowComponent={Row as any}
          rowProps={{}}
          overscanCount={5}
        />
      </div>
      <NetworkTableFooter isLoadingMore={isLoadingMore} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
};
