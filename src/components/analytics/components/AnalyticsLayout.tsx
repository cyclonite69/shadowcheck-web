// ===== FILE: src/components/analytics/components/AnalyticsLayout.tsx =====
// PURPOSE: Main layout component for analytics page structure
// EXTRACTS: Layout structure from lines 988-1106 in original AnalyticsPage.tsx

import React from 'react';
import { FilterPanel } from '../../FilterPanel';
import { FilterIcon, GripHorizontal } from '../utils/chartConstants';
import { Card } from '../hooks/useCardLayout';
import { AnalyticsData } from '../hooks/useAnalyticsData';
import { AnalyticsCharts } from './AnalyticsCharts';

interface AnalyticsLayoutProps {
  cards: Card[];
  data: AnalyticsData;
  loading: boolean;
  error: string | null;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  dragging: number | null;
  resizing: number | null;
  debouncedFilterState: any;
  onMouseDown: (e: React.MouseEvent, cardId: number, mode?: 'move' | 'resize') => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
}

export const AnalyticsLayout: React.FC<AnalyticsLayoutProps> = ({
  cards,
  data,
  loading,
  error,
  showFilters,
  setShowFilters,
  dragging,
  resizing,
  debouncedFilterState,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}) => {
  return (
    <div
      className="relative w-full h-screen overflow-hidden flex bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.04),transparent_25%)] before:pointer-events-none after:absolute after:inset-0 after:bg-[radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.04),transparent_20%)] after:pointer-events-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Filter Panel */}
      {showFilters && (
        <div className="fixed top-20 right-4 max-w-md max-h-[calc(100vh-100px)] overflow-y-auto z-[100000] pointer-events-auto space-y-2">
          <FilterPanel density="compact" />
        </div>
      )}

      {/* Filter Icon Button - Only visible on hover in upper left */}
      <div className="fixed top-0 left-0 w-16 h-16 group z-[100000] pointer-events-auto">
        <button
          type="button"
          aria-label={showFilters ? 'Hide filters' : 'Show filters'}
          title={showFilters ? 'Hide filters' : 'Show filters'}
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute top-4 left-4 w-12 h-12 rounded-lg flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110 ${
            showFilters
              ? 'bg-gradient-to-br from-red-500 to-red-600'
              : 'bg-gradient-to-br from-blue-500 to-blue-600'
          }`}
        >
          <FilterIcon size={24} className="text-white" />
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto h-screen">
        {/* Cards */}
        <div className="relative min-h-[2700px]">
          {cards.map((card) => {
            const Icon = card.icon;
            const width = `calc(${card.w}% - 16px)`;
            const left = `calc(${card.x}% + 8px)`;
            const isActive = dragging === card.id || resizing === card.id;

            return (
              <div
                key={card.id}
                style={{
                  left: left,
                  top: `${card.y + 8}px`,
                  width: width,
                  height: `${card.h - 16}px`,
                  ...(isActive ? { transition: 'none' } : {}),
                }}
                className="absolute"
              >
                <div
                  onMouseDown={(e) => onMouseDown(e, card.id, 'move')}
                  className={`h-full w-full overflow-hidden rounded-xl border border-slate-700/20 bg-slate-900/30 shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/50 transition-all duration-200 group backdrop-blur-sm ${
                    isActive ? 'cursor-grabbing select-none' : 'cursor-grab select-auto'
                  }`}
                >
                  <div className="absolute inset-0 pointer-events-none opacity-2 bg-gradient-to-br from-white/5 to-transparent" />

                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-700/20">
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-slate-300/80" />
                      <h3 className="text-sm font-semibold text-slate-200">{card.title}</h3>
                    </div>
                    <GripHorizontal
                      size={14}
                      className="text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0"
                    />
                  </div>

                  {/* Content */}
                  <div
                    className="px-4 py-3 overflow-hidden"
                    style={{ height: `${card.h - 52 - 16}px` }}
                  >
                    <AnalyticsCharts
                      card={card}
                      data={data}
                      loading={loading}
                      error={error}
                      debouncedFilterState={debouncedFilterState}
                      onMouseDown={onMouseDown}
                    />
                  </div>

                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onMouseDown(e, card.id, 'resize');
                    }}
                    className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize opacity-0 group-hover:opacity-60 transition-opacity z-20 rounded-br-xl bg-gradient-to-tl from-slate-400/30 to-transparent"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ===== END FILE =====
