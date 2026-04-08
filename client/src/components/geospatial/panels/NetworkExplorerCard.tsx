import React from 'react';

interface NetworkExplorerCardProps {
  children: React.ReactNode;
}

export const NetworkExplorerCard = ({ children }: NetworkExplorerCardProps) => {
  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-900/40 rounded-xl border border-slate-700/40 backdrop-blur-md">
      {children}
    </div>
  );
};
