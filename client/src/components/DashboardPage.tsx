import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { FilterButton } from './FilterButton';
import { FilterPanelContainer } from './FilterPanelContainer';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { usePageFilters } from '../hooks/usePageFilters';
import { useDashboard } from '../hooks/useDashboard';
import { getPageCapabilities } from '../utils/filterCapabilities';

// SVG Icons - Industry Standard
import {
  AlertTriangle,
  Wifi,
  Network,
  Bluetooth,
  Radio,
  BarChart3,
  Smartphone,
  Tower,
  GripHorizontal,
} from './dashboard/icons';
import { createInitialCards } from './dashboard/cardDefinitions';

export default function DashboardPage() {
  // Set current page for filter scoping
  usePageFilters('dashboard');

  const initialCards = useMemo(
    () =>
      createInitialCards({
        Network,
        Wifi,
        Smartphone,
        Bluetooth,
        Tower,
        Radio,
        BarChart3,
        AlertTriangle,
      }),
    []
  );

  const [dragging, setDragging] = useState<number | null>(null);
  const [resizing, setResizing] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showFilters, setShowFilters] = useState(false);

  // Universal filter system
  const capabilities = getPageCapabilities('dashboard');
  const adaptedFilters = useAdaptedFilters(capabilities);
  const resizeStartRef = useRef({
    startX: 0,
    startY: 0,
    startWidthPx: 0,
    startHeightPx: 0,
    cardXPercent: 0,
  });

  // Create stable filter key for change detection
  const filterKey = JSON.stringify({
    filters: adaptedFilters.filtersForPage,
    enabled: adaptedFilters.enabledForPage,
  });

  // Fetch dashboard data using hook
  const { cards, setCards, loading, error, filtersApplied } = useDashboard(initialCards, filterKey);

  const handleMouseDown = (e: React.MouseEvent, cardId: number, mode = 'move') => {
    e.preventDefault();
    if (mode === 'move') {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      setDragging(cardId);
      setDragOffset({
        x: e.clientX - (card.x * window.innerWidth) / 100,
        y: e.clientY - card.y,
      });
    } else if (mode === 'resize') {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      resizeStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidthPx: (card.w / 100) * window.innerWidth,
        startHeightPx: card.h,
        cardXPercent: card.x,
      };
      setResizing(cardId);
    }
  };

  const handleMouseMove = useCallback(
    (e: any) => {
      if (dragging) {
        setCards((prev) =>
          prev.map((card) => {
            if (card.id !== dragging) return card;
            const newX = Math.max(
              0,
              Math.min(100 - card.w, ((e.clientX - dragOffset.x) / window.innerWidth) * 100)
            );
            const newY = Math.max(0, e.clientY - dragOffset.y);
            return { ...card, x: newX, y: newY };
          })
        );
      } else if (resizing) {
        const start = resizeStartRef.current;
        setCards((prev) =>
          prev.map((card) => {
            if (card.id !== resizing) return card;
            const widthPx = Math.max(200, start.startWidthPx + (e.clientX - start.startX));
            const newW = Math.max(
              15,
              Math.min(100 - start.cardXPercent, (widthPx / window.innerWidth) * 100)
            );
            const newH = Math.max(120, start.startHeightPx + (e.clientY - start.startY));
            return { ...card, w: newW, h: newH };
          })
        );
      }
    },
    [dragOffset.x, dragOffset.y, dragging, resizing, setCards]
  );

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null);
    }
    if (resizing) {
      setResizing(null);
    }
  }, [dragging, resizing]);

  useEffect(() => {
    if (!dragging && !resizing) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex"
      onMouseMove={(e) => handleMouseMove(e as any)}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Ambient gradient background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <FilterButton isOpen={showFilters} onClick={() => setShowFilters(!showFilters)} />
      <FilterPanelContainer isOpen={showFilters} adaptedFilters={adaptedFilters} />

      <div className="relative flex-1 overflow-y-auto h-screen">
        <div className="relative min-h-[2400px]">
          {cards.map((card) => {
            const Icon = card.icon;
            const width = `${card.w}%`;
            const left = `${card.x}%`;
            const isActive = dragging === card.id || resizing === card.id;

            return (
              <div
                key={card.id}
                style={{
                  left,
                  top: `${card.y}px`,
                  width,
                  height: `${card.h}px`,
                  transition: isActive ? 'none' : 'box-shadow 0.2s ease',
                }}
                onMouseDown={(e) => handleMouseDown(e, card.id, 'move')}
                className={`absolute p-1.5 ${isActive ? 'cursor-grabbing select-none z-30' : 'cursor-grab'}`}
              >
                <div className="h-full w-full rounded-xl border border-slate-700/40 bg-slate-900/40 backdrop-blur-md shadow-lg hover:shadow-2xl transition-all duration-300 group overflow-hidden flex flex-col hover:border-slate-600/50">
                  {/* Card gradient overlay */}
                  <div className="absolute inset-0 pointer-events-none opacity-30 bg-gradient-to-br from-white/5 via-transparent to-transparent rounded-xl" />

                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-slate-700/30 flex-shrink-0">
                    <h3 className="text-xs font-semibold text-slate-200 truncate">{card.title}</h3>
                    <GripHorizontal
                      size={14}
                      className="text-slate-500 opacity-0 group-hover:opacity-100 group-hover:text-slate-300 transition-all flex-shrink-0"
                    />
                  </div>

                  {/* Content */}
                  <div
                    className={`flex-1 px-3 py-2 flex flex-col overflow-hidden ${
                      card.type === 'analytics-link'
                        ? 'cursor-pointer hover:bg-slate-800/20 transition-all items-center justify-center'
                        : 'items-center justify-center'
                    }`}
                    onClick={() => {
                      if (card.type === 'analytics-link') {
                        window.location.href = '/analytics';
                      }
                    }}
                  >
                    {card.type === 'analytics-link' ? (
                      /* Analytics Link - CTA */
                      <div className="text-center space-y-1">
                        <div className="bg-slate-800/40 rounded p-2 inline-block">
                          <Icon
                            size={22}
                            className="drop-shadow-lg opacity-90"
                            style={{ color: card.color }}
                          />
                        </div>
                        <p className="text-xs font-semibold text-slate-200">View Analytics</p>
                        <p className="text-[10px] text-slate-500">Detailed charts & insights</p>
                      </div>
                    ) : (
                      /* KPI Tile */
                      <div className="text-center space-y-1 w-full">
                        {/* Icon */}
                        <div className="bg-slate-800/40 rounded p-1.5 inline-block">
                          <Icon
                            size={20}
                            className="drop-shadow-lg opacity-90"
                            style={{ color: card.color }}
                          />
                        </div>

                        {/* Primary Metric */}
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            Unique Networks
                          </p>
                          <p
                            className="text-2xl font-bold tracking-tight leading-tight"
                            style={{ color: card.color }}
                          >
                            {typeof card.value === 'number'
                              ? card.value.toLocaleString()
                              : card.value}
                          </p>
                        </div>

                        {/* Secondary Metric */}
                        {card.observations !== undefined && card.type !== 'analytics-link' && (
                          <div className="pt-1 border-t border-slate-700/30">
                            <p className="text-sm font-semibold text-slate-200 tabular-nums leading-tight">
                              {card.observations.toLocaleString()}
                            </p>
                            <p className="text-[10px] text-slate-500">Total Observations</p>
                          </div>
                        )}

                        {/* Status Footer */}
                        <div className="pt-1 border-t border-slate-700/30">
                          <p className="text-[10px] text-slate-500 font-medium">
                            {loading
                              ? 'Loading...'
                              : error
                                ? error
                                : filtersApplied > 0
                                  ? `${filtersApplied} filter${filtersApplied !== 1 ? 's' : ''} active`
                                  : 'All networks'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resize Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleMouseDown(e, card.id, 'resize');
                    }}
                    className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-gradient-to-tl from-white/40 to-transparent hover:from-white/60 rounded-tl-lg"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
