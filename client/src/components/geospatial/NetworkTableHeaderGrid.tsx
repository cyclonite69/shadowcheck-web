import { useRef, useState } from 'react';
import type { NetworkRow, SortState } from '../../types/network';
import { API_SORT_MAP, NETWORK_COLUMNS } from '../../constants/network';
import {
  NETWORK_TABLE_HEADER_X_OFFSET_PX,
  NETWORK_TABLE_COLUMN_WIDTHS,
  NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS,
} from './networkTableGridConfig';

interface NetworkTableHeaderGridProps {
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  sort: SortState[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
  onColumnSort: (column: keyof NetworkRow, shiftKey: boolean) => void;
  onReorderColumns?: (from: keyof NetworkRow | 'select', to: keyof NetworkRow | 'select') => void;
  scrollLeft?: number;
}

export const NetworkTableHeaderGrid = ({
  visibleColumns,
  sort,
  allSelected,
  someSelected,
  onToggleSelectAll,
  onColumnSort,
  onReorderColumns,
  scrollLeft = 0,
}: NetworkTableHeaderGridProps) => {
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  // Build grid template columns - MUST match NetworkTableBodyGrid exactly
  const getColumnWidth = (col: keyof NetworkRow | 'select'): number =>
    NETWORK_TABLE_COLUMN_WIDTHS[String(col)] ?? 100;
  const gridTemplateColumns = visibleColumns.map((col) => `${getColumnWidth(col)}px`).join(' ');
  const totalGridWidth = visibleColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);
  const lockedVisibleColumns = visibleColumns.filter((col) =>
    NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(col))
  );
  const lastLockedVisibleColumn = lockedVisibleColumns[lockedVisibleColumns.length - 1] ?? null;
  const getLockedLeft = (col: keyof NetworkRow | 'select'): number =>
    visibleColumns
      .slice(0, visibleColumns.indexOf(col))
      .filter((candidate) => NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(candidate)))
      .reduce((sum, candidate) => sum + getColumnWidth(candidate), 0);
  const getLockedZIndex = (col: keyof NetworkRow | 'select'): number => {
    const idx = lockedVisibleColumns.indexOf(col);
    return idx >= 0 ? 20 - idx : 12;
  };

  return (
    <div
      style={{
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          minWidth: `${totalGridWidth}px`,
          transform: `translateX(${NETWORK_TABLE_HEADER_X_OFFSET_PX - scrollLeft}px)`,
          alignItems: 'center',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
          padding: '8px 0',
          fontSize: '11px',
          fontWeight: 600,
          color: '#cbd5e1',
          background: 'rgba(13, 31, 45, 0.5)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {visibleColumns.map((col) => {
          const column = NETWORK_COLUMNS[col as keyof typeof NETWORK_COLUMNS];
          if (!column) return null;

          const sortIndex = sort.findIndex((s) => s.column === col);
          const sortState = sortIndex >= 0 ? sort[sortIndex] : null;
          const isSortable =
            col !== 'select' && Boolean(API_SORT_MAP[col as keyof NetworkRow]) && column.sortable;

          return (
            <div
              key={col}
              style={{
                ...(NETWORK_TABLE_LOCKED_HORIZONTAL_COLUMNS.includes(String(col))
                  ? {
                      position: 'sticky',
                      left: `${getLockedLeft(col)}px`,
                      zIndex: getLockedZIndex(col),
                      boxShadow:
                        col === lastLockedVisibleColumn
                          ? '1px 0 0 rgba(71, 85, 105, 0.35)'
                          : undefined,
                    }
                  : {}),
                padding: '5px 8px',
                minWidth: 0,
                overflow: 'hidden',
                background: sortState ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.98)',
                cursor: isSortable ? 'pointer' : 'default',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onClick={(e) => isSortable && onColumnSort(col as keyof NetworkRow, e.shiftKey)}
              title={
                isSortable
                  ? 'Click to sort (Shift+click for multi-sort)'
                  : col === 'select'
                    ? undefined
                    : undefined
              }
            >
              {/* Select all checkbox */}
              {col === 'select' ? (
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all networks"
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onToggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {column.label}
                  </span>
                  {sortState && (
                    <span style={{ fontSize: '10px', color: '#60a5fa', flexShrink: 0 }}>
                      {sortState.direction === 'asc' ? '↑' : '↓'}
                      {sort.length > 1 && <span style={{ fontSize: '8px' }}>{sortIndex + 1}</span>}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
