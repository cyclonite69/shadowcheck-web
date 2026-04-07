import React from 'react';
import type { NetworkRow } from '../../../../types/network';
import type { NetworkColumnConfig } from '../../../../constants/network';

interface ColumnItemProps {
  columnKey: keyof NetworkRow | 'select';
  columnConfig: NetworkColumnConfig;
  isVisible: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: (col: keyof NetworkRow | 'select') => void;
  onMove: (col: keyof NetworkRow | 'select', direction: 'left' | 'right') => void;
}

export const ColumnItem: React.FC<ColumnItemProps> = ({
  columnKey,
  columnConfig,
  isVisible,
  isFirst,
  isLast,
  onToggle,
  onMove,
}) => {
  return (
    <div
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
          onClick={() => onMove(columnKey, 'left')}
          disabled={!isVisible || isFirst}
          title="Move left"
          style={{
            border: '1px solid rgba(71, 85, 105, 0.6)',
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#e2e8f0',
            borderRadius: '4px',
            width: '22px',
            height: '22px',
            cursor: !isVisible || isFirst ? 'not-allowed' : 'pointer',
            opacity: !isVisible || isFirst ? 0.4 : 1,
          }}
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => onMove(columnKey, 'right')}
          disabled={!isVisible || isLast}
          title="Move right"
          style={{
            border: '1px solid rgba(71, 85, 105, 0.6)',
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#e2e8f0',
            borderRadius: '4px',
            width: '22px',
            height: '22px',
            cursor: !isVisible || isLast ? 'not-allowed' : 'pointer',
            opacity: !isVisible || isLast ? 0.4 : 1,
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
          checked={isVisible}
          onChange={() => onToggle(columnKey)}
          style={{ marginRight: '8px' }}
        />
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {columnConfig.label}
        </span>
      </label>
    </div>
  );
};
