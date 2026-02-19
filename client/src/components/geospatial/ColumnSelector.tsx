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
}

export const ColumnSelector = ({
  visible,
  anchorRef,
  visibleColumns,
  columns,
  onToggle,
  onToggleColumn,
}: ColumnSelectorProps) => {
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
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: '6px',
            zIndex: 50,
            minWidth: '200px',
            maxHeight: '400px',
            overflowY: 'auto',
            backdropFilter: 'blur(8px)',
          }}
        >
          {Object.entries(columns).map(([col, column]) => (
            <label
              key={col}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
            >
              <input
                type="checkbox"
                checked={visibleColumns.includes(col as keyof NetworkRow | 'select')}
                onChange={() => onToggleColumn(col as keyof NetworkRow | 'select')}
                style={{ marginRight: '8px' }}
              />
              {column.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
