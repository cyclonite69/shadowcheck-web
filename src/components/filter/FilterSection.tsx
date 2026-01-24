/**
 * Collapsible filter section component
 */
import React, { useState } from 'react';
import type { FilterSectionProps } from './types';

const ChevronDown = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export const FilterSection: React.FC<FilterSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`filter-panel__section-toggle w-full flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2.5'
        }`}
      >
        <span
          className={`filter-panel__section-title font-medium text-slate-200 ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {title}
        </span>
        <span
          className={`inline-flex items-center justify-center rounded-md border border-slate-700/80 bg-slate-800/70 ${
            compact ? 'h-4 w-4' : 'h-5 w-5'
          }`}
        >
          <ChevronDown
            className={`filter-panel__section-icon text-slate-300 transition-transform ${
              compact ? 'w-3 h-3' : 'w-4 h-4'
            } ${isOpen ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      {isOpen && (
        <div
          className={`filter-panel__section-body space-y-2 bg-slate-900/30 ${
            compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
