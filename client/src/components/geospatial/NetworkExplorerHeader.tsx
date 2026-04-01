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

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono, monospace)' };

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
        display: 'flex',
        alignItems: 'center',
        height: '40px',
        padding: '0 14px',
        gap: 0,
        background: '#0d1f2d',
        borderBottom: '0.5px solid rgba(59,130,246,0.08)',
      }}
    >
      {/* Title */}
      <span
        style={{
          ...mono,
          fontSize: '13px',
          fontWeight: 500,
          color: '#e2e8f0',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}
      >
        Networks <span style={{ color: '#60a5fa' }}>Explorer</span>
      </span>

      {/* Separator */}
      <div
        style={{
          width: '1px',
          height: '16px',
          background: 'rgba(255,255,255,0.07)',
          margin: '0 10px',
          flexShrink: 0,
        }}
      />

      {/* Filters checkbox */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'default',
          flexShrink: 0,
        }}
        title="Filters apply to both network list and observations on map"
      >
        <div
          style={{
            width: '13px',
            height: '13px',
            borderRadius: '3px',
            border: '0.5px solid rgba(59,130,246,0.35)',
            background: 'rgba(59,130,246,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            color: '#60a5fa',
            lineHeight: 1,
          }}
        >
          ✓
        </div>
        <span style={{ ...mono, fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
          Filters apply to list + map
        </span>
      </label>

      {expensiveSort && (
        <>
          <div
            style={{
              width: '1px',
              height: '16px',
              background: 'rgba(255,255,255,0.07)',
              margin: '0 10px',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              ...mono,
              fontSize: '10px',
              color: '#fbbf24',
              border: '0.5px solid rgba(251,191,36,0.3)',
              padding: '2px 6px',
              borderRadius: '999px',
              background: 'rgba(120,53,15,0.3)',
            }}
          >
            Expensive sort
          </span>
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Quick search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(3,105,161,0.12)',
            border: '0.5px solid rgba(3,105,161,0.25)',
            borderRadius: '6px',
            height: '28px',
            padding: '0 9px',
            minWidth: '180px',
            maxWidth: '220px',
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ opacity: 0.3, flexShrink: 0 }}
          >
            <circle cx="6" cy="6" r="5" />
            <line x1="10" y1="10" x2="13" y2="13" />
          </svg>
          <input
            type="text"
            value={quickSearch}
            onChange={(e) => onQuickSearchChange(e.target.value)}
            placeholder="SSID+Manufacturer by default. Prefix: b:, s:, m:"
            title="Quick identity search. Unprefixed text searches SSID and manufacturer. Prefix with s:, b:, or m: to target one field."
            style={{
              flex: 1,
              ...mono,
              fontSize: '11px',
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'rgba(255,255,255,0.65)',
              minWidth: 0,
              maxWidth: '100%',
            }}
          />
        </div>

        {/* Show Filters */}
        <button
          onClick={onToggleFilters}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            height: '28px',
            padding: '0 10px',
            borderRadius: '6px',
            border: filtersOpen
              ? '0.5px solid rgba(59,130,246,0.25)'
              : '0.5px solid rgba(255,255,255,0.10)',
            background: filtersOpen ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.03)',
            color: filtersOpen ? '#60a5fa' : 'rgba(255,255,255,0.45)',
            ...mono,
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <line x1="1" y1="3" x2="13" y2="3" />
            <line x1="3" y1="7" x2="11" y2="7" />
            <line x1="5" y1="11" x2="9" y2="11" />
          </svg>
          {filtersOpen ? 'Hide Filters' : 'Show Filters'}
        </button>

        {/* Column selector (gear) */}
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
