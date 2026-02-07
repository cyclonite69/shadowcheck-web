import { useState, useRef } from 'react';
import type { NetworkRow, SortState } from '../../types/network';
import { API_SORT_MAP, NETWORK_COLUMNS } from '../../constants/network';

interface NetworkTableHeaderProps {
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  sort: SortState[];
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
  onColumnSort: (column: keyof NetworkRow, shiftKey: boolean) => void;
  onReorderColumns?: (from: keyof NetworkRow | 'select', to: keyof NetworkRow | 'select') => void;
}

export const NetworkTableHeader = ({
  visibleColumns,
  sort,
  allSelected,
  someSelected,
  onToggleSelectAll,
  onColumnSort,
  onReorderColumns,
}: NetworkTableHeaderProps) => {
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  return (
    <div style={{ paddingRight: '8px' }}>
      <table
        style={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'separate',
          borderSpacing: 0,
          fontSize: '11px',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
            {visibleColumns.map((col) => {
              const column = NETWORK_COLUMNS[col as keyof typeof NETWORK_COLUMNS];
              // CRASH-PROOF: Skip unknown columns (stale localStorage keys)
              if (!column) return null;
              const sortIndex = sort.findIndex((s) => s.column === col);
              const sortState = sortIndex >= 0 ? sort[sortIndex] : null;
              const isSortable =
                col !== 'select' &&
                Boolean(API_SORT_MAP[col as keyof NetworkRow]) &&
                column.sortable;

              const isDraggable = col !== 'select' && !!onReorderColumns;
              const isDropTarget = dropTarget === col && dragCol !== col;

              return (
                <th
                  key={col}
                  scope="col"
                  draggable={isDraggable}
                  onDragStart={(e) => {
                    if (!isDraggable) return;
                    setDragCol(col);
                    e.dataTransfer.effectAllowed = 'move';
                    // Use a transparent drag image to avoid default ghost
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
                  onClick={(e) => isSortable && onColumnSort(col as keyof NetworkRow, e.shiftKey)}
                  style={{
                    width: column.width,
                    minWidth: column.width,
                    maxWidth: column.width,
                    padding: '5px 8px',
                    background: sortState ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(8px)',
                    textAlign: 'left',
                    color: sortState ? '#93c5fd' : '#e2e8f0',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    fontSize: '11px',
                    borderRight: '1px solid rgba(71, 85, 105, 0.2)',
                    borderBottom: '1px solid rgba(71, 85, 105, 0.4)',
                    cursor: isDraggable ? 'grab' : isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    position: 'relative',
                    boxSizing: 'border-box',
                    opacity: dragCol === col ? 0.5 : 1,
                    borderLeft: isDropTarget ? '2px solid #3b82f6' : undefined,
                  }}
                  title={
                    isSortable
                      ? 'Click to sort, drag to reorder (Shift+click for multi-sort)'
                      : col === 'select'
                        ? undefined
                        : 'Drag to reorder'
                  }
                >
                  {col === 'select' ? (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      aria-label="Select all rows"
                      title="Select all rows"
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={onToggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{column.label}</span>
                      {sortState && (
                        <span style={{ fontSize: '10px', opacity: 0.8 }}>
                          {sortState.direction === 'asc' ? '↑' : '↓'}
                          {sort.length > 1 && <sup>{sortIndex + 1}</sup>}
                        </span>
                      )}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
      </table>
    </div>
  );
};
