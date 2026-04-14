import React from 'react';
import { FilterPanel } from './FilterPanel';
import { ActiveFiltersSummary } from './ActiveFiltersSummary';

interface FilterPanelContainerProps {
  /** Control visibility of the panel */
  isOpen: boolean;
  /** Adapted filters from the filter store */
  adaptedFilters?: any;
  /** CSS className for custom positioning */
  className?: string;
  /** Panel positioning mode */
  position?: 'sidebar' | 'overlay';
  /** Optional additional content to render below filter panel */
  children?: React.ReactNode;
}

export const FilterPanelContainer: React.FC<FilterPanelContainerProps> = ({
  isOpen,
  adaptedFilters,
  className = '',
  position = 'sidebar',
  children,
}) => {
  if (!isOpen) return null;

  const positionStyles =
    position === 'overlay'
      ? 'fixed top-16 left-[352px] w-[440px]'
      : 'fixed top-16 left-3 w-[440px]';

  return (
    <div
      className={`${positionStyles} max-h-[calc(100vh-80px)] bg-slate-900/95 border border-slate-600/60 backdrop-blur-xl rounded-xl shadow-2xl z-40 pointer-events-auto ${className}`}
    >
      <div className="max-h-[calc(100vh-80px)] p-3 space-y-2 overflow-y-auto">
        <FilterPanel density="compact" />
        {children}
      </div>
    </div>
  );
};
