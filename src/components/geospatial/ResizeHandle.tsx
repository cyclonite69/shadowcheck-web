import React from 'react';

interface ResizeHandleProps {
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const ResizeHandle = ({ onMouseDown }: ResizeHandleProps) => {
  return (
    <div
      className="cursor-row-resize hover:bg-blue-500/20 transition-colors flex items-center justify-center"
      style={{
        height: '8px',
        background: 'rgba(71, 85, 105, 0.3)',
        borderRadius: '4px',
        userSelect: 'none',
      }}
      onMouseDown={onMouseDown}
    >
      <div
        style={{
          width: '24px',
          height: '2px',
          background: 'rgba(148, 163, 184, 0.6)',
          borderRadius: '1px',
        }}
      ></div>
    </div>
  );
};
