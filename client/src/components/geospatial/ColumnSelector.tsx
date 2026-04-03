import React from 'react';
import { createPortal } from 'react-dom';
import type { NetworkRow } from '../../types/network';
import type { NetworkColumnConfig } from '../../constants/network';

interface ColumnSelectorProps {
  visible: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  columns: Partial<Record<keyof NetworkRow | 'select', NetworkColumnConfig>>;
  onToggle: () => void;
  onToggleColumn: (col: keyof NetworkRow | 'select') => void;
  onMoveColumn: (col: keyof NetworkRow | 'select', direction: 'left' | 'right') => void;
}

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

export const ColumnSelector = ({
  visible,
  anchorRef,
  visibleColumns,
  columns,
  onToggle,
  onToggleColumn,
  onMoveColumn,
}: ColumnSelectorProps) => {
  const [menuPosition, setMenuPosition] = React.useState<MenuPosition>({
    top: 44,
    left: 12,
    width: 280,
    maxHeight: 400,
  });
  const orderedColumns = React.useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    const visibleEntries = visibleColumns
      .map((col) => [col, columns[col]] as const)
      .filter((entry): entry is readonly [keyof NetworkRow | 'select', NetworkColumnConfig] =>
        Boolean(entry[1])
      );
    const hiddenEntries = (
      Object.entries(columns) as Array<
        [keyof NetworkRow | 'select', NetworkColumnConfig | undefined]
      >
    ).filter((entry): entry is [keyof NetworkRow | 'select', NetworkColumnConfig] => {
      const [col, column] = entry;
      return Boolean(column) && !visibleSet.has(col);
    });

    return [...visibleEntries, ...hiddenEntries];
  }, [columns, visibleColumns]);

  React.useLayoutEffect(() => {
    if (!visible) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const preferredHeight = Math.min(420, Math.max(220, spaceBelow));
      const preferredWidth = Math.min(320, Math.max(240, rect.width + 80));
      const maxLeft = Math.max(margin, viewportWidth - preferredWidth - margin);
      const left = Math.min(Math.max(margin, rect.right - preferredWidth), maxLeft);
      const maxHeight = Math.min(420, Math.max(220, availableHeight));
      const top = openAbove
        ? Math.max(margin, rect.top - maxHeight - margin)
        : rect.bottom + margin;

      setMenuPosition({
        top,
        left,
        width: preferredWidth,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [visible, anchorRef]);

  return (
    <div className="relative" ref={anchorRef}>
      <button
        onClick={onToggle}
        style={{
          padding: '6px',
          background: 'transparent',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#cbd5e1',
        }}
      >
        ⚙️
      </button>
      {visible &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              background: 'rgba(30, 41, 59, 0.95)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '6px',
              zIndex: 10000,
              minWidth: '240px',
              width: `${menuPosition.width}px`,
              maxHeight: `${menuPosition.maxHeight}px`,
              overflowY: 'auto',
              backdropFilter: 'blur(8px)',
              overscrollBehavior: 'contain',
              boxShadow: '0 16px 40px rgba(2, 6, 23, 0.55)',
            }}
            onWheel={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {orderedColumns.map(([col, column]) => (
              <div
                key={String(col)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: '#e2e8f0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    marginRight: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onMoveColumn(col, 'left')}
                    disabled={!visibleColumns.includes(col) || visibleColumns.indexOf(col) <= 0}
                    title="Move left"
                    style={{
                      border: '1px solid rgba(71, 85, 105, 0.6)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#e2e8f0',
                      borderRadius: '4px',
                      width: '22px',
                      height: '22px',
                      cursor:
                        !visibleColumns.includes(col) || visibleColumns.indexOf(col) <= 0
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        !visibleColumns.includes(col) || visibleColumns.indexOf(col) <= 0 ? 0.4 : 1,
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveColumn(col, 'right')}
                    disabled={
                      !visibleColumns.includes(col) ||
                      visibleColumns.indexOf(col) === visibleColumns.length - 1
                    }
                    title="Move right"
                    style={{
                      border: '1px solid rgba(71, 85, 105, 0.6)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#e2e8f0',
                      borderRadius: '4px',
                      width: '22px',
                      height: '22px',
                      cursor:
                        !visibleColumns.includes(col) ||
                        visibleColumns.indexOf(col) === visibleColumns.length - 1
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        !visibleColumns.includes(col) ||
                        visibleColumns.indexOf(col) === visibleColumns.length - 1
                          ? 0.4
                          : 1,
                    }}
                  >
                    →
                  </button>
                </div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col)}
                    onChange={() => onToggleColumn(col)}
                    style={{ marginRight: '8px' }}
                  />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {column.label}
                  </span>
                </label>
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};
