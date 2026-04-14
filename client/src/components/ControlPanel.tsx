import React from 'react';

interface ControlPanelProps {
  isOpen: boolean;
  className?: string;
  children: React.ReactNode;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ isOpen, className = '', children }) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed top-16 left-4 w-80 max-h-[calc(100vh-100px)] bg-slate-900/95 border border-blue-500/25 backdrop-blur-xl rounded-xl shadow-2xl p-5 space-y-3.5 text-sm overflow-y-auto z-40 pointer-events-auto ${className}`}
    >
      <div className="border-b border-blue-500/20 pb-3.5 mb-1.5">
        <h3 className="text-xl font-bold text-slate-100">
          🛡️ Shadow<span className="text-blue-400">Check</span>
        </h3>
        <p className="text-xs text-slate-400 mt-1">Network Visualization</p>
      </div>

      {children}
    </div>
  );
};
