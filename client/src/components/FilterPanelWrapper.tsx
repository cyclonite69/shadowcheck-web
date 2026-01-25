import React from 'react';
import { FilterPanel } from './FilterPanel';
import { ActiveFiltersSummary } from './ActiveFiltersSummary';

interface FilterPanelWrapperProps {
  isOpen: boolean;
  adaptedFilters: any;
}

export const FilterPanelWrapper: React.FC<FilterPanelWrapperProps> = ({
  isOpen,
  adaptedFilters,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed top-16 left-3 w-72 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-600/60 shadow-2xl p-3 space-y-2 overflow-y-auto overflow-x-hidden z-40 max-h-[calc(100vh-80px)] pointer-events-auto"
      style={{ borderRight: '1px solid rgba(71, 85, 105, 0.8)' }}
    >
      <ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
      <FilterPanel density="compact" />
    </div>
  );
};
