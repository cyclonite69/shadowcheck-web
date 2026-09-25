import React from 'react';
import type { NetworkRow } from '../../../types/network';
import type { NetworkColumnConfig } from '../../../constants/network';
import type { ColumnBadgeConfig } from '../../../types/badgeConfig';
import { ColumnSelector } from '../table/ColumnSelector';
import { useCurrentFilters, useCurrentEnabled, useFilterStore } from '../../../stores/filterStore';
import type { NetworkFilters } from '../../../types/filters';

// Human-readable label overrides for filter keys
const FILTER_LABELS: Partial<Record<keyof NetworkFilters, string>> = {
  ssid: 'SSID',
  bssid: 'BSSID',
  manufacturer: 'Manufacturer',
  radioTypes: 'Radio',
  encryptionTypes: 'Encryption',
  threatCategories: 'Threat Level',
  mlThreatScoreMin: 'ML Score ≥',
  mlThreatScoreMax: 'ML Score ≤',
  ruleBasedScoreMin: 'Rule Score ≥',
  ruleBasedScoreMax: 'Rule Score ≤',
  observationCountMin: 'Obs ≥',
  observationCountMax: 'Obs ≤',
  timeframe: 'Timeframe',
  surveillance: 'Surveillance',
  tag_type: 'Tag',
  distanceFromHomeMin: 'Radius ≥',
  stationaryConfidenceMin: 'Stationary ≥',
  uniqueDaysMin: 'Unique Days ≥',
};

function labelForKey(key: keyof NetworkFilters): string {
  if (FILTER_LABELS[key]) {
    return FILTER_LABELS[key]!;
  }
  // camelCase → Title Case fallback
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function valueSnippet(_key: keyof NetworkFilters, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (Array.isArray(value)) {
    return value.slice(0, 3).join(', ') + (value.length > 3 ? '…' : '');
  }
  if (typeof value === 'object' && 'relativeWindow' in (value as object)) {
    return (value as { relativeWindow?: string }).relativeWindow ?? 'custom';
  }
  return String(value);
}

/** Active filter pills — renders inline inside the toolbar row. Returns null when no filters active. */
const ActiveFilterPills: React.FC = () => {
  const filters = useCurrentFilters();
  const enabled = useCurrentEnabled();
  const enableFilter = useFilterStore((s) => s.enableFilter);
  const clearFilters = useFilterStore((s) => s.clearFilters);

  const activeKeys = (Object.keys(enabled) as Array<keyof NetworkFilters>).filter(
    (k) => enabled[k]
  );

  if (activeKeys.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {activeKeys.map((key) => {
        const snippet = valueSnippet(key, filters[key]);
        return (
          <span
            key={key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              height: '20px',
              padding: '0 7px',
              borderRadius: '999px',
              border: '0.5px solid rgba(59,130,246,0.35)',
              background: 'rgba(59,130,246,0.12)',
              color: '#93c5fd',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title={snippet ? `${labelForKey(key)}: ${snippet}` : labelForKey(key)}
          >
            <span style={{ color: 'rgba(147,197,253,0.7)' }}>{labelForKey(key)}</span>
            {snippet && (
              <span
                style={{
                  color: '#e2e8f0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '90px',
                }}
              >
                : {snippet}
              </span>
            )}
            <button
              onClick={() => enableFilter(key, false)}
              aria-label={`Remove ${labelForKey(key)} filter`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '12px',
                height: '12px',
                marginLeft: '2px',
                padding: 0,
                border: 'none',
                background: 'none',
                color: 'rgba(147,197,253,0.6)',
                cursor: 'pointer',
                flexShrink: 0,
                fontSize: '10px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </span>
        );
      })}
      {activeKeys.length > 1 && (
        <button
          onClick={clearFilters}
          style={{
            height: '20px',
            padding: '0 7px',
            borderRadius: '999px',
            border: '0.5px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.08)',
            color: 'rgba(252,165,165,0.8)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Clear all
        </button>
      )}
    </div>
  );
};

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
  onMoveColumn: (col: keyof NetworkRow | 'select', direction: 'left' | 'right') => void;
  badgeConfigs?: Record<string, ColumnBadgeConfig>;
  siblingGroupCount?: number;
  allCollapsed?: boolean;
  onToggleSiblingGroups?: () => void;
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
  onMoveColumn,
  badgeConfigs,
  siblingGroupCount = 0,
  allCollapsed = false,
  onToggleSiblingGroups,
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

      {/* Active filter pills — inline, clipped so they don't crowd right controls */}
      <ActiveFilterPills />

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

      {/* Right controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginLeft: 'auto',
          flexShrink: 0,
        }}
      >
        {siblingGroupCount > 0 && onToggleSiblingGroups && (
          <button
            onClick={onToggleSiblingGroups}
            style={{
              display: 'flex',
              alignItems: 'center',
              height: '28px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '0.5px solid rgba(55,138,221,0.25)',
              background: 'rgba(55,138,221,0.08)',
              color: '#60a5fa',
              ...mono,
              fontSize: '11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {allCollapsed ? 'Expand All' : 'Collapse All'}
          </button>
        )}
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
            color: filtersOpen ? '#60a5fa' : 'rgba(255,255,255,0.5)',
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
          onMoveColumn={onMoveColumn}
          badgeConfigs={badgeConfigs}
        />
      </div>
    </div>
  );
};
