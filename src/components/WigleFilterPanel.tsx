import React from 'react';
import { FilterPanel } from './FilterPanel';
import { ActiveFiltersSummary } from './ActiveFiltersSummary';

interface WigleFilterPanelProps {
  isOpen: boolean;
  adaptedFilters: any;
}

export const WigleFilterPanel: React.FC<WigleFilterPanelProps> = ({ isOpen, adaptedFilters }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-16 left-[352px] w-80 max-h-[calc(100vh-100px)] bg-slate-900/95 border border-blue-500/25 backdrop-blur-xl rounded-xl shadow-2xl p-4 space-y-2 overflow-y-auto z-40 pointer-events-auto">
      <ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
      <FilterPanel density="compact" />
    </div>
  );
};
