/**
 * Active Filters Summary Component
 * Shows which filters are active and which are ignored on current page
 */

import React from 'react';
import { useFilterStore } from '../stores/filterStore';
import { AdaptedFilters } from '../utils/filterCapabilities';

interface ActiveFiltersSummaryProps {
  adaptedFilters: AdaptedFilters;
  compact?: boolean;
}

const formatFilterValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '';
  }

  if (typeof value === 'object') {
    if ('type' in value && 'relativeWindow' in value) {
      return value.relativeWindow || 'custom';
    }
    return JSON.stringify(value);
  }

  return String(value);
};

const formatFilterLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

export const ActiveFiltersSummary: React.FC<ActiveFiltersSummaryProps> = ({
  adaptedFilters,
  compact = false,
}) => {
  const { clearFilters } = useFilterStore();
  const { filtersForPage, ignoredFilters, ignoredCount } = adaptedFilters;

  const activeCount = Object.keys(filtersForPage).length;
  const totalActive = activeCount + ignoredCount;

  if (totalActive === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
          <span>✓</span>
          <span>{activeCount} active</span>
        </div>
        {ignoredCount > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30"
            title={`Ignored filters: ${ignoredFilters.map((f) => formatFilterLabel(f.key)).join(', ')}`}
          >
            <span>⚠</span>
            <span>{ignoredCount} ignored</span>
          </div>
        )}
        <button
          onClick={clearFilters}
          className="px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
          title="Clear all filters"
        >
          ✕ Clear
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-xs">
      {/* Active filters */}
      {activeCount > 0 && (
        <div className="space-y-1">
          <div className="font-semibold text-blue-300">Active Filters ({activeCount})</div>
          <div className="space-y-1">
            {Object.entries(filtersForPage).map(([key, value]) => (
              <div
                key={key}
                className="flex items-start gap-2 px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20"
              >
                <span className="text-blue-400 font-medium">{formatFilterLabel(key)}:</span>
                <span className="text-slate-300 flex-1">{formatFilterValue(key, value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ignored filters */}
      {ignoredCount > 0 && (
        <div className="space-y-1">
          <div className="font-semibold text-amber-300">Ignored on This Page ({ignoredCount})</div>
          <div className="text-amber-200/70 text-[10px] mb-1">
            These filters are active but not supported by this page
          </div>
          <div className="space-y-1">
            {ignoredFilters.map(({ key, value }) => (
              <div
                key={key}
                className="flex items-start gap-2 px-2 py-1 bg-amber-500/10 rounded border border-amber-500/20"
              >
                <span className="text-amber-400 font-medium">{formatFilterLabel(key)}:</span>
                <span className="text-slate-400 flex-1">{formatFilterValue(key, value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clear button */}
      <button
        onClick={clearFilters}
        className="w-full px-3 py-1.5 text-slate-300 bg-slate-700/50 hover:bg-slate-600/50 rounded border border-slate-600/50 transition-colors"
      >
        Clear All Filters
      </button>
    </div>
  );
};
