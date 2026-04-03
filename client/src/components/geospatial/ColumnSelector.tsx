import React from 'react';
import type { NetworkRow } from '../../types/network';
import type { NetworkColumnConfig } from '../../constants/network';

interface ColumnSelectorProps {
  visible: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  visibleColumns: Array<keyof NetworkRow | 'select'>;
  columns: Partial<Record<keyof NetworkRow | 'select', NetworkColumnConfig>>;
  onToggle: () => void;
  onToggleColumn: (col: keyof NetworkRow | 'select') => void;
  onMoveColumn: (col: keyof NetworkRow | 'select', direction: 'up' | 'down') => void;
}

type MenuPosition = {
  top: number;
  right: number;
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
    right: 12,
    maxHeight: 400,
  });

  React.useLayoutEffect(() => {
    if (!visible) return;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - margin;
      const preferredHeight = Math.min(420, Math.max(220, spaceBelow));

      setMenuPosition({
        top: rect.bottom + margin,
        right: Math.max(margin, window.innerWidth - rect.right),
        maxHeight: preferredHeight,
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
      {visible && (
        <div
          style={{
            position: 'fixed',
            top: `${menuPosition.top}px`,
            right: `${menuPosition.right}px`,
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '6px',
            zIndex: 200,
            minWidth: '240px',
            width: 'min(320px, calc(100vw - 16px))',
            maxHeight: `${menuPosition.maxHeight}px`,
            overflowY: 'auto',
            backdropFilter: 'blur(8px)',
            overscrollBehavior: 'contain',
            boxShadow: '0 16px 40px rgba(2, 6, 23, 0.55)',
          }}
          onWheel={(event) => event.stopPropagation()}
        >
          {Object.entries(columns).map(([col, column]) => (
            <div
              key={col}
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
                  flexDirection: 'column',
                  gap: '4px',
                  marginRight: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => onMoveColumn(col as keyof NetworkRow | 'select', 'up')}
                  disabled={visibleColumns.indexOf(col as keyof NetworkRow | 'select') <= 0}
                  title="Move up"
                  style={{
                    border: '1px solid rgba(71, 85, 105, 0.6)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e2e8f0',
                    borderRadius: '4px',
                    width: '22px',
                    height: '22px',
                    cursor:
                      visibleColumns.indexOf(col as keyof NetworkRow | 'select') <= 0
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      visibleColumns.indexOf(col as keyof NetworkRow | 'select') <= 0 ? 0.4 : 1,
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveColumn(col as keyof NetworkRow | 'select', 'down')}
                  disabled={
                    visibleColumns.indexOf(col as keyof NetworkRow | 'select') ===
                    visibleColumns.length - 1
                  }
                  title="Move down"
                  style={{
                    border: '1px solid rgba(71, 85, 105, 0.6)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e2e8f0',
                    borderRadius: '4px',
                    width: '22px',
                    height: '22px',
                    cursor:
                      visibleColumns.indexOf(col as keyof NetworkRow | 'select') ===
                      visibleColumns.length - 1
                        ? 'not-allowed'
                        : 'pointer',
                    opacity:
                      visibleColumns.indexOf(col as keyof NetworkRow | 'select') ===
                      visibleColumns.length - 1
                        ? 0.4
                        : 1,
                  }}
                >
                  ↓
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
                  checked={visibleColumns.includes(col as keyof NetworkRow | 'select')}
                  onChange={() => onToggleColumn(col as keyof NetworkRow | 'select')}
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
        </div>
      )}
    </div>
  );
};
