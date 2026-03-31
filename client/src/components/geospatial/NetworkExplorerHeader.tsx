import React from 'react';
import type { NetworkRow } from '../../types/network';
import type { NetworkColumnConfig } from '../../constants/network';
import { ColumnSelector } from './ColumnSelector';

interface NetworkExplorerHeaderProps {
  expensiveSort: boolean;
  quickSearch: string;
  onQuickSearchChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  showColumnSelector: boolean;
  columnDropdownRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  columns: Partial<Record<keyof NetworkRow | 'select', NetworkColumnConfig>>;
  onToggleColumnSelector: () => void;
  onToggleColumn: (col: keyof NetworkRow | 'select') => void;
}

export const NetworkExplorerHeader = ({
  expensiveSort,
  quickSearch,
  onQuickSearchChange,
  filtersOpen,
  onToggleFilters,
  showColumnSelector,
  columnDropdownRef,
  visibleColumns,
  columns,
  onToggleColumnSelector,
  onToggleColumn,
}: NetworkExplorerHeaderProps) => {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
        Networks Explorer
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: '#cbd5e1',
            padding: '4px 6px',
            borderRadius: '6px',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
          title="Filters apply to both network list and observations on map"
        >
          <input type="checkbox" checked={true} disabled style={{ cursor: 'not-allowed' }} />
          Filters apply to list + map
        </label>
        {expensiveSort && (
          <span
            style={{
              fontSize: '10px',
              color: '#fbbf24',
              border: '1px solid rgba(251, 191, 36, 0.4)',
              padding: '2px 6px',
              borderRadius: '999px',
              background: 'rgba(120, 53, 15, 0.3)',
            }}
          >
            Expensive sort
          </span>
        )}
        <input
          type="text"
          value={quickSearch}
          onChange={(e) => onQuickSearchChange(e.target.value)}
          placeholder="Quick search (SSID+Manufacturer by default). Prefix: b:, s:, m:"
          title="Quick identity search. Unprefixed text searches SSID and manufacturer. Prefix with s:, b:, or m: to target one field."
          style={{
            width: '320px',
            maxWidth: '38vw',
            padding: '4px 8px',
            fontSize: '11px',
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            color: '#e2e8f0',
            borderRadius: '6px',
          }}
        />
        <button
          onClick={onToggleFilters}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            background: filtersOpen ? 'rgba(59, 130, 246, 0.9)' : 'rgba(30, 41, 59, 0.9)',
            border: filtersOpen
              ? '1px solid rgba(59, 130, 246, 0.8)'
              : '1px solid rgba(148, 163, 184, 0.3)',
            color: '#f8fafc',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          {filtersOpen ? 'Hide Filters' : 'Show Filters'}
        </button>
        <ColumnSelector
          visible={showColumnSelector}
          anchorRef={columnDropdownRef}
          visibleColumns={visibleColumns}
          columns={columns}
          onToggle={onToggleColumnSelector}
          onToggleColumn={onToggleColumn}
        />
      </div>
    </div>
  );
};
