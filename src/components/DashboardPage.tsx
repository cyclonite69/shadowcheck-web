import React, { useState, useEffect, useRef, useCallback } from 'react';

// SVG Icons
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

const Eye = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const Database = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cards, setCards] = useState([
    // Main metrics (top row - large cards)
    {
      id: 1,
      title: 'Total Networks',
      value: 0,
      icon: Network,
      color: '#3b82f6',
      x: 0,
      y: 110,
      w: 33.33,
      h: 220,
      type: 'total-networks',
    },
    {
      id: 2,
      title: 'WiFi Networks',
      value: 0,
      icon: Wifi,
      color: '#10b981',
      x: 33.33,
      y: 110,
      w: 33.33,
      h: 220,
      type: 'wifi-count',
    },
    {
      id: 3,
      title: 'BLE Devices',
      value: 0,
      icon: Radio,
      color: '#8b5cf6',
      x: 66.66,
      y: 110,
      w: 33.34,
      h: 220,
      type: 'radio-ble',
    },

    // Radio type breakdown (second row - medium cards)
    {
      id: 4,
      title: 'Bluetooth',
      value: 0,
      icon: Bluetooth,
      color: '#06b6d4',
      x: 0,
      y: 350,
      w: 20,
      h: 160,
      type: 'radio-bt',
    },
    {
      id: 5,
      title: 'LTE',
      value: 0,
      icon: Network,
      color: '#ec4899',
      x: 20,
      y: 350,
      w: 20,
      h: 160,
      type: 'radio-lte',
    },
    {
      id: 6,
      title: 'GSM',
      value: 0,
      icon: Radio,
      color: '#f59e0b',
      x: 40,
      y: 350,
      w: 20,
      h: 160,
      type: 'radio-gsm',
    },
    {
      id: 7,
      title: '5G NR',
      value: 0,
      icon: Network,
      color: '#10b981',
      x: 60,
      y: 350,
      w: 20,
      h: 160,
      type: 'radio-nr',
    },
    {
      id: 8,
      title: 'Analytics',
      value: '→',
      icon: Database,
      color: '#64748b',
      x: 80,
      y: 350,
      w: 20,
      h: 160,
      type: 'analytics-link',
    },
  ]);

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeStartRef = useRef({
    startX: 0,
    startY: 0,
    startWidthPx: 0,
    startHeightPx: 0,
    cardXPercent: 0,
  });

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/analytics/network-types');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        const result = await response.json();
        const data = result.data || [];

        // Convert analytics data to dashboard format
        const networkCounts = {};
        let totalNetworks = 0;

        data.forEach((item) => {
          totalNetworks += item.count;
          switch (item.type) {
            case 'WiFi':
              networkCounts.wifi = item.count;
              break;
            case 'BLE':
              networkCounts.ble = item.count;
              break;
            case 'BT':
              networkCounts.bluetooth = item.count;
              break;
            case 'LTE':
              networkCounts.lte = item.count;
              break;
            case 'GSM':
              networkCounts.gsm = item.count;
              break;
            case 'NR':
              networkCounts.nr = item.count;
              break;
          }
        });

        // Update card values
        setCards((prevCards) =>
          prevCards.map((card) => {
            switch (card.type) {
              case 'total-networks':
                return { ...card, value: totalNetworks };
              case 'wifi-count':
                return { ...card, value: networkCounts.wifi || 0 };
              case 'radio-ble':
                return { ...card, value: networkCounts.ble || 0 };
              case 'radio-bt':
                return { ...card, value: networkCounts.bluetooth || 0 };
              case 'radio-lte':
                return { ...card, value: networkCounts.lte || 0 };
              case 'radio-gsm':
                return { ...card, value: networkCounts.gsm || 0 };
              case 'radio-nr':
                return { ...card, value: networkCounts.nr || 0 };
              case 'analytics-link':
                return { ...card, value: '→' };
              default:
                return card;
            }
          })
        );
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

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
      className="relative w-full min-h-screen overflow-y-auto overflow-x-hidden"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
        height: '100vh',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-800/60 shadow-2xl text-center">
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '900',
              margin: 0,
              letterSpacing: '-0.5px',
              background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.6)',
              filter:
                'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 30px rgba(100, 116, 139, 0.3))',
            }}
          >
            ShadowCheck Dashboard
          </h1>
          <p
            style={{
              fontSize: '12px',
              fontWeight: '300',
              margin: 0,
              marginTop: '4px',
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              background: 'linear-gradient(to right, #1e293b, #64748b, #475569, #1e293b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))',
              opacity: 0.8,
            }}
          >
            Real-time surveillance and threat detection metrics
          </p>
        </div>
      </div>

      {/* Cards */}
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
              transition: dragging === card.id || resizing === card.id ? 'none' : 'box-shadow 0.2s',
              cursor: dragging === card.id ? 'grabbing' : 'grab',
              userSelect: dragging || resizing ? 'none' : 'auto',
            }}
            onMouseDown={(e) => handleMouseDown(e, card.id, 'move')}
            className="relative overflow-hidden rounded-xl border border-[#20324d] bg-[#0f1e34]/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-shadow group backdrop-blur-sm outline outline-1 outline-[#13223a]/60"
          >
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />

            {/* Card Content */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-4">
              {loading ? (
                <div className="text-slate-400 text-sm">Loading...</div>
              ) : error ? (
                <div className="text-red-400 text-xs">Error</div>
              ) : (
                <>
                  {/* Icon */}
                  <div className="mb-3">
                    <Icon
                      size={card.h > 180 ? 48 : card.h > 150 ? 40 : 32}
                      className="drop-shadow-lg"
                      style={{ color: card.color }}
                    />
                  </div>

                  {/* Value - Large and Bold */}
                  <div className="mb-2">
                    <p
                      className="font-extrabold drop-shadow-2xl tracking-tight leading-none"
                      style={{
                        fontSize: card.h > 180 ? '48px' : card.h > 150 ? '36px' : '28px',
                        color: card.color,
                      }}
                    >
                      {card.value.toLocaleString()}
                    </p>
                  </div>

                  {/* Title - Elegant Typography */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 drop-shadow">
                      {card.title}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Grip Handle */}
            <div className="absolute top-2 right-2 z-20">
              <GripHorizontal
                size={14}
                className="text-white/30 group-hover:text-white/60 transition-colors"
              />
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
                background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.35) 50%)',
                borderRadius: '0 0 10px 0',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
