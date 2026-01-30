// ===== FILE: src/components/analytics/components/AnalyticsLayout.tsx =====
// PURPOSE: Main layout component for analytics page structure
// EXTRACTS: Layout structure from lines 988-1106 in original AnalyticsPage.tsx

import React from 'react';
import { FilterButton } from '../../FilterButton';
import { FilterPanelContainer } from '../../FilterPanelContainer';
import { GripHorizontal } from '../utils/chartConstants';
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
  adaptedFilters: any;
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
  adaptedFilters,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}) => {
  return (
    <div
      className="relative w-full h-screen overflow-hidden flex"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Filter Button and Panel - Same as Dashboard */}
      <FilterButton isOpen={showFilters} onClick={() => setShowFilters(!showFilters)} />
      <FilterPanelContainer isOpen={showFilters} adaptedFilters={adaptedFilters} />

      <div className="relative flex-1 overflow-y-auto h-screen">
        {/* Cards */}
        <div className="relative min-h-[2700px]">
          {cards.map((card) => {
            const Icon = card.icon;
            const width = `${card.w}%`;
            const left = `${card.x}%`;
            const isActive = dragging === card.id || resizing === card.id;

            return (
              <div
                key={card.id}
                style={{
                  left: left,
                  top: `${card.y}px`,
                  width: width,
                  height: `${card.h}px`,
                  ...(isActive ? { transition: 'none' } : {}),
                }}
                onMouseDown={(e) => onMouseDown(e, card.id, 'move')}
                className={`absolute ${isActive ? 'cursor-grabbing select-none' : 'cursor-grab select-auto'}`}
              >
                <div className="h-full w-full p-2">
                  <div className="h-full w-full overflow-hidden rounded-xl border border-slate-700/20 bg-slate-900/35 shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/25 transition-all duration-200 group backdrop-blur-sm">
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
                      style={{ height: `calc(100% - 52px)` }}
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ===== END FILE =====
