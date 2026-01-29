import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { logError } from '../logging/clientLogger';
import { FilterButton } from './FilterButton';
import { FilterPanelWrapper } from './FilterPanelWrapper';
import { useAdaptedFilters } from '../hooks/useAdaptedFilters';
import { usePageFilters } from '../hooks/usePageFilters';
import { getPageCapabilities } from '../utils/filterCapabilities';

// SVG Icons - Industry Standard
const AlertTriangle = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const Wifi = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M5.59 15.87A24 24 0 0 1 12 13c2.59 0 5.11.28 7.59.87M2.13 12.94A36 36 0 0 1 12 10c3.46 0 6.87.48 10.13 1.36M2 9.13a48 48 0 0 1 20 0" />
  </svg>
);

const Network = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M5 22v-5M19 22v-5M12 8v-3M7 19h10" />
  </svg>
);

const Bluetooth = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6.5 6.5l11 11L12 23l-5.5-5.5L12 12l5.5-5.5L12 1l5.5 5.5-11 11" />
  </svg>
);

const Radio = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49M7.76 16.24a6 6 0 0 1 0-8.49M20.07 4.93a10 10 0 0 1 0 14.14M3.93 19.07a10 10 0 0 1 0-14.14" />
  </svg>
);

const BarChart3 = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

const Smartphone = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const Tower = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 11a9 9 0 0 1 16 0" />
    <path d="M6 11a7 7 0 0 1 12 0" />
    <path d="M8 11a5 5 0 0 1 8 0" />
    <path d="M10 11a3 3 0 0 1 4 0" />
    <path d="M12 11v10" />
    <path d="M8 21l8-4" />
    <path d="M16 21l-8-4" />
  </svg>
);

const GripHorizontal = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
    <circle cx="9" cy="5" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="9" cy="19" r="1.5" />
    <circle cx="15" cy="5" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="15" cy="19" r="1.5" />
  </svg>
);

export default function DashboardPage() {
  // Set current page for filter scoping
  usePageFilters('dashboard');

  const [cards, setCards] = useState([
    {
      id: 1,
      title: 'Total Networks',
      value: 0,
      icon: Network,
      color: '#3b82f6',
      x: 0,
      y: 80,
      w: 33.33,
      h: 200,
      type: 'total-networks',
      observations: 0,
    },
    {
      id: 2,
      title: 'WiFi Networks',
      value: 0,
      icon: Wifi,
      color: '#10b981',
      x: 33.33,
      y: 80,
      w: 33.33,
      h: 200,
      type: 'wifi-count',
      observations: 0,
    },
    {
      id: 3,
      title: 'BLE Devices',
      value: 0,
      icon: Smartphone,
      color: '#8b5cf6',
      x: 66.66,
      y: 80,
      w: 33.33,
      h: 200,
      type: 'radio-ble',
      observations: 0,
    },
    {
      id: 4,
      title: 'Bluetooth Classic',
      value: 0,
      icon: Bluetooth,
      color: '#06b6d4',
      x: 0,
      y: 290,
      w: 33.33,
      h: 200,
      type: 'radio-bt',
      observations: 0,
    },
    {
      id: 5,
      title: 'LTE Networks',
      value: 0,
      icon: Tower,
      color: '#ec4899',
      x: 33.33,
      y: 290,
      w: 33.33,
      h: 200,
      type: 'radio-lte',
      observations: 0,
    },
    {
      id: 6,
      title: 'GSM Networks',
      value: 0,
      icon: Radio,
      color: '#f59e0b',
      x: 66.66,
      y: 290,
      w: 33.33,
      h: 200,
      type: 'radio-gsm',
      observations: 0,
    },
    {
      id: 7,
      title: '5G NR Networks',
      value: 0,
      icon: Tower,
      color: '#14b8a6',
      x: 0,
      y: 500,
      w: 33.33,
      h: 200,
      type: 'radio-nr',
      observations: 0,
    },
    {
      id: 8,
      title: 'Analytics Dashboard',
      value: '→',
      icon: BarChart3,
      color: '#64748b',
      x: 33.33,
      y: 500,
      w: 33.33,
      h: 200,
      type: 'analytics-link',
      observations: 0,
    },
    {
      id: 9,
      title: 'Critical Threats',
      value: 0,
      icon: AlertTriangle,
      color: '#ef4444', // Red
      x: 66.66,
      y: 500,
      w: 33.33,
      h: 200,
      type: 'threat-critical',
      observations: 0,
    },
    {
      id: 10,
      title: 'High Threats',
      value: 0,
      icon: AlertTriangle,
      color: '#f97316', // Orange
      x: 0,
      y: 710,
      w: 33.33,
      h: 200,
      type: 'threat-high',
      observations: 0,
    },
    {
      id: 11,
      title: 'Medium Threats',
      value: 0,
      icon: AlertTriangle,
      color: '#eab308', // Yellow
      x: 33.33,
      y: 710,
      w: 33.33,
      h: 200,
      type: 'threat-medium',
      observations: 0,
    },
    {
      id: 12,
      title: 'Low Threats',
      value: 0,
      icon: AlertTriangle,
      color: '#22c55e', // Green
      x: 66.66,
      y: 710,
      w: 33.33,
      h: 200,
      type: 'threat-low',
      observations: 0,
    },
  ]);

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Universal filter system
  const capabilities = getPageCapabilities('dashboard');
  const adaptedFilters = useAdaptedFilters(capabilities);
  const [filtersApplied, setFiltersApplied] = useState(0);
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

  // Fetch dashboard data - on mount and when filters change (debounced)
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          filters: JSON.stringify(adaptedFilters.filtersForPage),
          enabled: JSON.stringify(adaptedFilters.enabledForPage),
        });

        // Parallel fetch for dashboard metrics and threat severity counts
        const [dashboardRes, threatsRes] = await Promise.all([
          fetch(`/api/dashboard-metrics?${params}`, { signal: controller.signal }),
          fetch('/api/v2/threats/severity-counts', { signal: controller.signal }),
        ]);

        if (!dashboardRes.ok) throw new Error('Failed to fetch dashboard metrics');

        const data = await dashboardRes.json();
        let threatCounts = { counts: { critical: 0, high: 0, medium: 0, low: 0 } };

        if (threatsRes.ok) {
          threatCounts = await threatsRes.json();
        }

        // Debug: Log API response to verify observations data
        console.log('[Dashboard] API response:', {
          networks: data.networks,
          observations: data.observations,
          threatCounts,
          hasObservations: !!data.observations,
        });

        setCards((prev) =>
          prev.map((card) => {
            switch (card.type) {
              case 'total-networks':
                return {
                  ...card,
                  value: data.networks?.total || 0,
                  observations: data.observations?.total || 0,
                };
              case 'wifi-count':
                return {
                  ...card,
                  value: data.networks?.wifi || 0,
                  observations: data.observations?.wifi || 0,
                };
              case 'radio-ble':
                return {
                  ...card,
                  value: data.networks?.ble || 0,
                  observations: data.observations?.ble || 0,
                };
              case 'radio-bt':
                return {
                  ...card,
                  value: data.networks?.bluetooth || 0,
                  observations: data.observations?.bluetooth || 0,
                };
              case 'radio-lte':
                return {
                  ...card,
                  value: data.networks?.lte || 0,
                  observations: data.observations?.lte || 0,
                };
              case 'radio-gsm':
                return {
                  ...card,
                  value: data.networks?.gsm || 0,
                  observations: data.observations?.gsm || 0,
                };
              case 'radio-nr':
                return {
                  ...card,
                  value: data.networks?.nr || 0,
                  observations: data.observations?.nr || 0,
                };
              case 'threat-critical':
                return {
                  ...card,
                  value: threatCounts.counts?.critical?.unique_networks || 0,
                  observations: threatCounts.counts?.critical?.total_observations || 0,
                };
              case 'threat-high':
                return {
                  ...card,
                  value: threatCounts.counts?.high?.unique_networks || 0,
                  observations: threatCounts.counts?.high?.total_observations || 0,
                };
              case 'threat-medium':
                return {
                  ...card,
                  value: threatCounts.counts?.medium?.unique_networks || 0,
                  observations: threatCounts.counts?.medium?.total_observations || 0,
                };
              case 'threat-low':
                return {
                  ...card,
                  value: threatCounts.counts?.low?.unique_networks || 0,
                  observations: threatCounts.counts?.low?.total_observations || 0,
                };
              default:
                return card;
            }
          })
        );
        setFiltersApplied(data.filtersApplied || 0);
        setError(null);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          logError('Dashboard fetch error', err);
          setError('Failed to load metrics');
        }
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [filterKey]); // Re-fetch when filters change

  const handleMouseDown = (e, cardId, mode = 'move') => {
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
    (e) => {
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
    [dragOffset.x, dragOffset.y, dragging, resizing]
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
      onMouseMove={handleMouseMove}
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
      <FilterPanelWrapper isOpen={showFilters} adaptedFilters={adaptedFilters} />

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
                        {card.observations !== undefined && (
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
