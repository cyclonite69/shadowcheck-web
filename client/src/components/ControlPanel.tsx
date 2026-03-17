import React from 'react';

interface ControlPanelProps {
  isOpen: boolean;
  className?: string;
  onShowFilters: () => void;
  showFilters: boolean;
  children: React.ReactNode;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isOpen,
  className = '',
  onShowFilters,
  showFilters,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed top-16 left-4 w-80 max-h-[calc(100vh-100px)] bg-slate-900/95 border border-blue-500/25 backdrop-blur-xl rounded-xl shadow-2xl p-5 space-y-3.5 text-sm overflow-y-auto z-40 pointer-events-auto ${className}`}
    >
      <div className="border-b border-blue-500/20 pb-3.5 mb-1.5">
        <h3 className="text-xl font-bold text-blue-400">🛡️ ShadowCheck</h3>
        <p className="text-xs text-slate-400 mt-1">Network Visualization</p>
        <button
          onClick={onShowFilters}
          className={`mt-3 w-full px-3 py-2 text-sm font-semibold text-white rounded-lg border shadow-lg transition-all hover:shadow-xl ${
            showFilters
              ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-600'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600'
          }`}
        >
          {showFilters ? '✕ Hide Filters' : '🔍 Show Filters'}
        </button>
      </div>

      {children}
    </div>
  );
};
