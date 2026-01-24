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
    <div className="fixed top-16 left-[352px] w-72 max-h-[calc(100vh-80px)] bg-slate-900/95 border border-slate-600/60 backdrop-blur-xl rounded-xl shadow-2xl p-3 space-y-2 overflow-y-auto overflow-x-hidden z-40 pointer-events-auto">
      <ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
      <FilterPanel density="compact" />
    </div>
  );
};
