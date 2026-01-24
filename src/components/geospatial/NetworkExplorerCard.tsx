import React from 'react';

interface NetworkExplorerCardProps {
  children: React.ReactNode;
}

export const NetworkExplorerCard = ({ children }: NetworkExplorerCardProps) => {
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden min-h-0"
      style={{
        background: 'rgba(30, 41, 59, 0.4)',
        borderRadius: '12px',
        border: '1px solid rgba(71, 85, 105, 0.3)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </div>
  );
};
