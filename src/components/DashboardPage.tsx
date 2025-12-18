import React, { useState, useEffect } from 'react';

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
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" />
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
  const [dashboardData, setDashboardData] = useState({
    threats: { critical: 238, high: 205, medium: 62, low: 0 },
    metrics: { total: 117687, detected: 53282, surveillance: 49, enriched: 0, wifi: 36391 },
    radioTypes: { wifi: 36391, ble: 75163, bluetooth: 5754, lte: 259, gsm: 120 },
  });

  const [cards, setCards] = useState([
    // Threat severity cards (top row)
    {
      id: 1,
      title: 'CRITICAL',
      value: 238,
      gradient: 'linear-gradient(to bottom right, #dc2626, #991b1b)',
      icon: AlertTriangle,
      x: 0,
      y: 80,
      w: 25,
      h: 180,
      type: 'threat',
    },
    {
      id: 2,
      title: 'HIGH',
      value: 205,
      gradient: 'linear-gradient(to bottom right, #ea580c, #9a3412)',
      icon: AlertTriangle,
      x: 25,
      y: 80,
      w: 25,
      h: 180,
      type: 'threat',
    },
    {
      id: 3,
      title: 'MEDIUM',
      value: 62,
      gradient: 'linear-gradient(to bottom right, #ca8a04, #854d0e)',
      icon: AlertTriangle,
      x: 50,
      y: 80,
      w: 25,
      h: 180,
      type: 'threat',
    },
    {
      id: 4,
      title: 'LOW',
      value: 0,
      gradient: 'linear-gradient(to bottom right, #16a34a, #166534)',
      icon: AlertTriangle,
      x: 75,
      y: 80,
      w: 25,
      h: 180,
      type: 'threat',
    },

    // Metric cards (second row)
    {
      id: 5,
      title: 'TOTAL NETWORKS',
      value: 117687,
      gradient: 'linear-gradient(to bottom right, #1d4ed8, #1e3a8a)',
      icon: Network,
      x: 0,
      y: 280,
      w: 20,
      h: 120,
      type: 'metric',
    },
    {
      id: 6,
      title: 'THREATS DETECTED',
      value: 53282,
      gradient: 'linear-gradient(to bottom right, #1d4ed8, #1e3a8a)',
      icon: AlertTriangle,
      x: 20,
      y: 280,
      w: 20,
      h: 120,
      type: 'metric',
    },
    {
      id: 7,
      title: 'ACTIVE SURVEILLANCE',
      value: 49,
      gradient: 'linear-gradient(to bottom right, #1d4ed8, #1e3a8a)',
      icon: Eye,
      x: 40,
      y: 280,
      w: 20,
      h: 120,
      type: 'metric',
    },
    {
      id: 8,
      title: 'DATA ENRICHED',
      value: 0,
      gradient: 'linear-gradient(to bottom right, #1d4ed8, #1e3a8a)',
      icon: Database,
      x: 60,
      y: 280,
      w: 20,
      h: 120,
      type: 'metric',
    },
    {
      id: 9,
      title: 'WIFI NETWORKS',
      value: 36391,
      gradient: 'linear-gradient(to bottom right, #1d4ed8, #1e3a8a)',
      icon: Wifi,
      x: 80,
      y: 280,
      w: 20,
      h: 120,
      type: 'metric',
    },

    // Radio type cards (individual network types)
    {
      id: 10,
      title: 'WIFI',
      value: 36391,
      gradient: 'linear-gradient(to bottom right, #2563eb, #1e40af)',
      icon: Wifi,
      x: 0,
      y: 420,
      w: 16,
      h: 140,
      type: 'radio',
    },
    {
      id: 11,
      title: 'BLE',
      value: 75163,
      gradient: 'linear-gradient(to bottom right, #9333ea, #6b21a8)',
      icon: Radio,
      x: 17,
      y: 420,
      w: 16,
      h: 140,
      type: 'radio',
    },
    {
      id: 12,
      title: 'BLUETOOTH',
      value: 5754,
      gradient: 'linear-gradient(to bottom right, #0891b2, #155e75)',
      icon: Bluetooth,
      x: 34,
      y: 420,
      w: 16,
      h: 140,
      type: 'radio',
    },
    {
      id: 13,
      title: 'LTE',
      value: 259,
      gradient: 'linear-gradient(to bottom right, #059669, #065f46)',
      icon: Network,
      x: 51,
      y: 420,
      w: 16,
      h: 140,
      type: 'radio',
    },
    {
      id: 14,
      title: 'GSM',
      value: 120,
      gradient: 'linear-gradient(to bottom right, #4f46e5, #3730a3)',
      icon: Radio,
      x: 68,
      y: 420,
      w: 16,
      h: 140,
      type: 'radio',
    },
  ]);

  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(null);

  // Load real data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
          // Update card values with real data
          setCards((prevCards) =>
            prevCards.map((card) => {
              switch (card.id) {
                case 1:
                  return { ...card, value: data.threats?.critical || 238 };
                case 2:
                  return { ...card, value: data.threats?.high || 205 };
                case 3:
                  return { ...card, value: data.threats?.medium || 62 };
                case 4:
                  return { ...card, value: data.threats?.low || 0 };
                case 5:
                  return { ...card, value: data.metrics?.total || 117687 };
                case 6:
                  return { ...card, value: data.metrics?.detected || 53282 };
                case 7:
                  return { ...card, value: data.metrics?.surveillance || 49 };
                case 8:
                  return { ...card, value: data.metrics?.enriched || 0 };
                case 9:
                  return { ...card, value: data.metrics?.wifi || 36391 };
                case 10:
                  return { ...card, value: data.radioTypes?.wifi || 36391 };
                case 11:
                  return { ...card, value: data.radioTypes?.ble || 75163 };
                case 12:
                  return { ...card, value: data.radioTypes?.bluetooth || 5754 };
                case 13:
                  return { ...card, value: data.radioTypes?.lte || 259 };
                case 14:
                  return { ...card, value: data.radioTypes?.gsm || 120 };
                default:
                  return card;
              }
            })
          );
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };
    loadData();
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
      setResizing(cardId);
    }
  };

  const handleMouseMove = React.useCallback(
    (e) => {
      if (dragging) {
        setCards((prev) =>
          prev.map((card) => {
            if (card.id === dragging) {
              const newX = Math.max(
                0,
                Math.min(100 - card.w, ((e.clientX - dragOffset.x) / window.innerWidth) * 100)
              );
              const newY = Math.max(80, e.clientY - dragOffset.y);
              return { ...card, x: newX, y: newY };
            }
            return card;
          })
        );
      } else if (resizing) {
        setCards((prev) =>
          prev.map((card) => {
            if (card.id === resizing) {
              const newW = Math.max(
                15,
                Math.min(
                  100 - card.x,
                  ((e.clientX - (card.x * window.innerWidth) / 100) / window.innerWidth) * 100
                )
              );
              const newH = Math.max(100, e.clientY - card.y);
              return { ...card, w: newW, h: newH };
            }
            return card;
          })
        );
      }
    },
    [dragOffset.x, dragOffset.y, dragging, resizing]
  );

  const handleMouseUp = React.useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  React.useEffect(() => {
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
      className="relative w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 overflow-hidden"
      onMouseMove={(e) => handleMouseMove(e.nativeEvent)}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <div className="bg-slate-900/30 backdrop-blur-md rounded-2xl p-6 border border-slate-700/50">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-slate-300 text-sm mt-2 font-light tracking-wide">
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
              background: card.gradient,
              transition: dragging === card.id || resizing === card.id ? 'none' : 'box-shadow 0.2s',
              cursor: dragging === card.id ? 'grabbing' : 'grab',
              userSelect: dragging || resizing ? 'none' : 'auto',
            }}
            onMouseDown={(e) => handleMouseDown(e, card.id, 'move')}
            className="relative overflow-hidden rounded-xl border border-white/10 shadow-2xl hover:shadow-3xl transition-shadow group backdrop-blur-sm p-4 flex flex-col justify-between"
          >
            {/* Soft gradient overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-br from-white/20 via-transparent to-black/20" />

            {/* Card Content - Centered & Balanced */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center">
              {/* Icon */}
              <div className="mb-3">
                <Icon
                  size={card.type === 'threat' ? 48 : 40}
                  className="text-white/80 drop-shadow-lg"
                />
              </div>

              {/* Value - Large and Bold */}
              <div className="mb-2">
                <p className="text-5xl font-extrabold text-white drop-shadow-2xl tracking-tight leading-none">
                  {card.value.toLocaleString()}
                </p>
              </div>

              {/* Title - Elegant Typography */}
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-white/90 drop-shadow">
                  {card.title}
                </p>
              </div>
            </div>

            {/* Grip Handle - Subtle corner indicator */}
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
