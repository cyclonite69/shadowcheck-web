// ===== FILE: src/components/analytics/components/AnalyticsFilters.tsx =====
// PURPOSE: Filter UI component for analytics page
// EXTRACTS: Filter button and panel overlay logic

import React from 'react';
import { FilterPanel } from '../../FilterPanel';
import { FilterIcon } from '../utils/chartConstants';

interface AnalyticsFiltersProps {
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  showFilters,
  setShowFilters,
}) => {
  return (
    <>
      {/* Filter Panel */}
      {showFilters && (
        <div
          className="fixed top-20 right-4 w-[440px] bg-slate-900/95 border border-slate-600/60 backdrop-blur-xl rounded-xl shadow-2xl z-40 pointer-events-auto"
          style={{
            maxHeight: 'calc(100vh - 100px)',
          }}
        >
          <div
            className="p-3 space-y-2 overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 100px)' }}
          >
            <FilterPanel density="compact" />
          </div>
        </div>
      )}

      {/* Filter Icon Button - Only visible on hover in upper left */}
      <div
        className="fixed top-0 left-0 w-16 h-16 group"
        style={{
          zIndex: 100000,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          aria-label={showFilters ? 'Hide filters' : 'Show filters'}
          title={showFilters ? 'Hide filters' : 'Show filters'}
          onClick={() => setShowFilters(!showFilters)}
          className="absolute top-4 left-4 w-12 h-12 rounded-lg flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          style={{
            background: showFilters
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          }}
        >
          <FilterIcon size={24} className="text-white" />
        </button>
      </div>
    </>
  );
};

// ===== END FILE =====
