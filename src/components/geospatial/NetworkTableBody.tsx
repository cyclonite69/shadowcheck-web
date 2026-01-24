import React from 'react';
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

export const NetworkTableBody = ({
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
          {!loadingNetworks &&
            filteredNetworks.map((net, idx) => (
              <NetworkTableRow
                key={net.bssid}
                net={net}
                index={idx}
                visibleColumns={visibleColumns}
                isSelected={selectedNetworks.has(net.bssid)}
                onSelectExclusive={onSelectExclusive}
                onOpenContextMenu={onOpenContextMenu}
                onToggleSelectNetwork={onToggleSelectNetwork}
              />
            ))}
        </tbody>
      </table>
      <NetworkTableFooter isLoadingMore={isLoadingMore} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
};
