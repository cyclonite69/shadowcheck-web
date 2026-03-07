import { useEffect, useRef, useState } from 'react';
import type { NetworkRow, SortState } from '../../types/network';
import { API_SORT_MAP, NETWORK_COLUMNS } from '../../constants/network';

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
  manufacturer: 120,
  all_tags: 120,
  wigle_v3_observation_count: 90,
  wigle_v3_last_import_at: 140,
};

const LOCKED_HORIZONTAL_COLUMNS = ['select', 'type', 'ssid', 'bssid'];

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
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);

  // Build grid template columns - MUST match NetworkTableBodyGrid exactly
  const getColumnWidth = (col: keyof NetworkRow | 'select'): number =>
    COLUMN_WIDTHS[String(col)] ?? 100;
  const gridTemplateColumns = visibleColumns.map((col) => `${getColumnWidth(col)}px`).join(' ');
  const totalGridWidth = visibleColumns.reduce((sum, col) => sum + getColumnWidth(col), 0);
  const lockedVisibleColumns = visibleColumns.filter((col) =>
    LOCKED_HORIZONTAL_COLUMNS.includes(String(col))
  );
  const lastLockedVisibleColumn = lockedVisibleColumns[lockedVisibleColumns.length - 1] ?? null;

  useEffect(() => {
    if (!headerScrollRef.current) return;
    if (Math.abs(headerScrollRef.current.scrollLeft - scrollLeft) > 1) {
      headerScrollRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  return (
    <div
      ref={headerScrollRef}
      style={{
        overflowX: 'hidden',
        overflowY: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          minWidth: `${totalGridWidth}px`,
          alignItems: 'center',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
          padding: '8px 0',
          fontSize: '11px',
          fontWeight: 600,
          color: '#cbd5e1',
          background: 'rgba(15, 23, 42, 0.5)',
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

          const isDraggable = col !== 'select' && !!onReorderColumns;
          const isDropTarget = dropTarget === col && dragCol !== col;

          return (
            <div
              key={col}
              draggable={isDraggable}
              onDragStart={(e) => {
                if (!isDraggable) return;
                setDragCol(col);
                e.dataTransfer.effectAllowed = 'move';
                if (!dragImageRef.current) {
                  const el = document.createElement('div');
                  el.style.position = 'absolute';
                  el.style.top = '-9999px';
                  document.body.appendChild(el);
                  dragImageRef.current = el;
                }
                dragImageRef.current.textContent = column.label;
                dragImageRef.current.style.cssText =
                  'position:absolute;top:-9999px;padding:4px 8px;background:#1e293b;color:#e2e8f0;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em;white-space:nowrap;';
                e.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
              }}
              onDragOver={(e) => {
                if (!isDraggable || !dragCol || dragCol === col) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDropTarget(col);
              }}
              onDragLeave={() => {
                if (dropTarget === col) setDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragCol && dragCol !== col && onReorderColumns) {
                  onReorderColumns(
                    dragCol as keyof NetworkRow | 'select',
                    col as keyof NetworkRow | 'select'
                  );
                }
                setDragCol(null);
                setDropTarget(null);
              }}
              onDragEnd={() => {
                setDragCol(null);
                setDropTarget(null);
              }}
              style={{
                ...(LOCKED_HORIZONTAL_COLUMNS.includes(String(col))
                  ? {
                      position: 'sticky',
                      left: `${visibleColumns
                        .slice(0, visibleColumns.indexOf(col))
                        .filter((candidate) =>
                          LOCKED_HORIZONTAL_COLUMNS.includes(String(candidate))
                        )
                        .reduce((sum, candidate) => sum + getColumnWidth(candidate), 0)}px`,
                      zIndex: 12,
                      boxShadow:
                        col === lastLockedVisibleColumn
                          ? '1px 0 0 rgba(71, 85, 105, 0.35)'
                          : undefined,
                    }
                  : {}),
                padding: '5px 8px',
                background: sortState ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.98)',
                cursor: isDraggable ? 'grab' : isSortable ? 'pointer' : 'default',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                borderLeft: isDropTarget ? '2px solid #3b82f6' : undefined,
                opacity: dragCol === col ? 0.5 : 1,
              }}
              onClick={(e) => isSortable && onColumnSort(col as keyof NetworkRow, e.shiftKey)}
              title={
                isSortable
                  ? 'Click to sort, drag to reorder (Shift+click for multi-sort)'
                  : col === 'select'
                    ? undefined
                    : 'Drag to reorder'
              }
            >
              {/* Select all checkbox */}
              {col === 'select' ? (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={onToggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              ) : (
                <>
                  <span>{column.label}</span>
                  {sortState && (
                    <span style={{ fontSize: '10px', color: '#60a5fa' }}>
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
