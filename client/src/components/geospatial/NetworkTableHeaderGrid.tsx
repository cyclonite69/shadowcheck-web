import { useState, useRef } from 'react';
import type { NetworkRow, SortState } from '../../types/network';
import { API_SORT_MAP, NETWORK_COLUMNS } from '../../constants/network';

interface NetworkTableHeaderGridProps {
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  sort: SortState[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
  onColumnSort: (column: keyof NetworkRow, shiftKey: boolean) => void;
  onReorderColumns?: (from: keyof NetworkRow | 'select', to: keyof NetworkRow | 'select') => void;
}

export const NetworkTableHeaderGrid = ({
  visibleColumns,
  sort,
  allSelected,
  someSelected,
  onToggleSelectAll,
  onColumnSort,
  onReorderColumns,
}: NetworkTableHeaderGridProps) => {
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  // Build grid template columns - MUST match NetworkTableBodyGrid exactly
  const gridTemplateColumns = visibleColumns
    .map((col) => {
      if (col === 'select') return '40px';
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
      style={{
        display: 'grid',
        gridTemplateColumns,
        alignItems: 'center',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        padding: '8px',
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
  );
};
