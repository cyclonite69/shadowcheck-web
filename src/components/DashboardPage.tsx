import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { logError } from '../logging/clientLogger';
import { FilterPanel } from './FilterPanel';
import { ActiveFiltersSummary } from './ActiveFiltersSummary';
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
      w: 50,
      h: 200,
      type: 'total-networks',
    },
    {
      id: 2,
      title: 'WiFi Networks',
      value: 0,
      icon: Wifi,
      color: '#10b981',
      x: 50,
      y: 80,
      w: 50,
      h: 200,
      type: 'wifi-count',
    },
    {
      id: 3,
      title: 'BLE Devices',
      value: 0,
      icon: Smartphone,
      color: '#8b5cf6',
      x: 0,
      y: 290,
      w: 50,
      h: 200,
      type: 'radio-ble',
    },
    {
      id: 4,
      title: 'Bluetooth Classic',
      value: 0,
      icon: Bluetooth,
      color: '#06b6d4',
      x: 50,
      y: 290,
      w: 50,
      h: 200,
      type: 'radio-bt',
    },
    {
      id: 5,
      title: 'LTE Networks',
      value: 0,
      icon: Tower,
      color: '#ec4899',
      x: 0,
      y: 500,
      w: 50,
      h: 200,
      type: 'radio-lte',
    },
    {
      id: 6,
      title: 'GSM Networks',
      value: 0,
      icon: Radio,
      color: '#f59e0b',
      x: 50,
      y: 500,
      w: 50,
      h: 200,
      type: 'radio-gsm',
    },
    {
      id: 7,
      title: '5G NR Networks',
      value: 0,
      icon: Tower,
      color: '#10b981',
      x: 0,
      y: 710,
      w: 50,
      h: 200,
      type: 'radio-nr',
    },
    {
      id: 8,
      title: 'Analytics Dashboard',
      value: '→',
      icon: BarChart3,
      color: '#64748b',
      x: 50,
      y: 710,
      w: 50,
      h: 200,
      type: 'analytics-link',
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
        const response = await fetch(`/api/dashboard-metrics?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();

        setCards((prev) =>
          prev.map((card) => {
            switch (card.type) {
              case 'total-networks':
                return { ...card, value: data.networks?.total || 0 };
              case 'wifi-count':
                return { ...card, value: data.networks?.wifi || 0 };
              case 'radio-ble':
                return { ...card, value: data.networks?.ble || 0 };
              case 'radio-bt':
                return { ...card, value: data.networks?.bluetooth || 0 };
              case 'radio-lte':
                return { ...card, value: data.networks?.lte || 0 };
              case 'radio-gsm':
                return { ...card, value: data.networks?.gsm || 0 };
              case 'radio-nr':
                return { ...card, value: data.networks?.nr || 0 };
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
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Filter Panel */}
      {showFilters && (
        <div
          className="fixed top-20 right-4 max-w-md space-y-2"
          style={{
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            zIndex: 100000,
            pointerEvents: 'auto',
          }}
        >
          <ActiveFiltersSummary adaptedFilters={adaptedFilters} compact />
          <FilterPanel density="compact" />
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
          onClick={() => setShowFilters(!showFilters)}
          className="absolute top-4 left-4 w-12 h-12 rounded-lg flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
          style={{
            background: showFilters
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto" style={{ height: '100vh', paddingTop: 0 }}>
        {/* Cards */}
        <div style={{ minHeight: '2400px', position: 'relative', paddingTop: 0 }}>
          {cards.map((card) => {
            const Icon = card.icon;
            const width = `${card.w}%`;
            const left = `${card.x}%`;

            return (
              <div
                key={card.id}
                style={{
                  position: 'absolute',
                  left: left,
                  top: `${card.y}px`,
                  width: width,
                  height: `${card.h}px`,
                  transition:
                    dragging === card.id || resizing === card.id ? 'none' : 'box-shadow 0.2s',
                  cursor: dragging === card.id ? 'grabbing' : 'grab',
                  userSelect: dragging || resizing ? 'none' : 'auto',
                }}
                onMouseDown={(e) => handleMouseDown(e, card.id, 'move')}
                className="relative overflow-hidden rounded-xl border border-[#20324d] bg-[#0f1e34]/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-shadow group backdrop-blur-sm outline outline-1 outline-[#13223a]/60"
              >
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />

                {/* Header */}
                <div className="flex items-center justify-between p-4 bg-[#132744]/95 border-b border-[#1c3050]">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">{card.title}</h3>
                  </div>
                  <GripHorizontal
                    size={16}
                    className="text-white/50 group-hover:text-white transition-colors flex-shrink-0"
                  />
                </div>

                {/* Content */}
                <div
                  className={`p-2 overflow-hidden flex flex-col items-center justify-center text-center ${
                    card.type === 'analytics-link'
                      ? 'cursor-pointer hover:bg-[#132744]/50 transition-colors'
                      : ''
                  }`}
                  style={{ height: `${card.h - 40}px` }}
                  onClick={() => {
                    if (card.type === 'analytics-link') {
                      window.location.href = '/analytics';
                    }
                  }}
                >
                  {/* Icon */}
                  <div className="mb-2">
                    <Icon size={32} className="drop-shadow-lg" style={{ color: card.color }} />
                  </div>

                  {/* Value - Large and Bold */}
                  <div className="mb-1">
                    <p
                      className="font-extrabold drop-shadow-2xl tracking-tight leading-none"
                      style={{
                        fontSize: '28px',
                        color: card.color,
                      }}
                    >
                      {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                    </p>
                  </div>

                  {/* Subtitle */}
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      {card.type === 'analytics-link'
                        ? 'View detailed analytics'
                        : loading
                          ? 'Loading...'
                          : error
                            ? error
                            : filtersApplied > 0
                              ? `Filtered (${filtersApplied} active)`
                              : 'All networks'}
                    </p>
                  </div>
                </div>

                {/* Resize Handle */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleMouseDown(e, card.id, 'resize');
                  }}
                  className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  style={{
                    background:
                      'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.35) 50%)',
                    borderRadius: '0 0 10px 0',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
