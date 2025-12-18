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
    <path d="M5 22v-5M19 22v-5M12 8v-3" />
    <path d="M7 19h10" />
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

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const [cards, setCards] = useState([
    {
      id: 1,
      title: 'CRITICAL',
      value: 0,
      color: 'from-red-700 via-red-600 to-red-800',
      icon: AlertTriangle,
      x: 0,
      y: 90,
      w: 40,
      h: 210,
      key: 'critical',
    },
    {
      id: 2,
      title: 'HIGH',
      value: 0,
      color: 'from-orange-600 via-orange-500 to-orange-700',
      icon: AlertTriangle,
      x: 40,
      y: 90,
      w: 30,
      h: 210,
      key: 'high',
    },
    {
      id: 3,
      title: 'MEDIUM',
      value: 0,
      color: 'from-amber-600 via-amber-500 to-amber-700',
      icon: AlertTriangle,
      x: 70,
      y: 90,
      w: 30,
      h: 210,
      key: 'medium',
    },
    {
      id: 5,
      title: 'Total Networks',
      value: 0,
      color: 'from-blue-800 via-blue-700 to-blue-900',
      icon: Network,
      x: 0,
      y: 330,
      w: 20,
      h: 160,
      key: 'total',
    },
    {
      id: 6,
      title: 'Threats Detected',
      value: 0,
      color: 'from-blue-800 via-blue-700 to-blue-900',
      icon: AlertTriangle,
      x: 20,
      y: 330,
      w: 20,
      h: 160,
      key: 'threats',
    },
    {
      id: 7,
      title: 'Active Surveillance',
      value: 0,
      color: 'from-blue-800 via-blue-700 to-blue-900',
      icon: Eye,
      x: 40,
      y: 330,
      w: 20,
      h: 160,
      key: 'surveillance',
    },
    {
      id: 8,
      title: 'Data Enriched',
      value: 0,
      color: 'from-blue-800 via-blue-700 to-blue-900',
      icon: Database,
      x: 60,
      y: 330,
      w: 20,
      h: 160,
      key: 'enriched',
    },
    {
      id: 9,
      title: 'WIFI Networks',
      value: 0,
      color: 'from-blue-800 via-blue-700 to-blue-900',
      icon: Wifi,
      x: 80,
      y: 330,
      w: 20,
      h: 160,
      key: 'wifi',
    },
    {
      id: 4,
      title: 'LOW',
      value: 0,
      color: 'from-emerald-700 via-emerald-600 to-emerald-800',
      icon: AlertTriangle,
      x: 70,
      y: 530,
      w: 30,
      h: 180,
      key: 'low',
    },
  ]);

  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/metrics');

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        setMetrics(data);

        // Update card values with real data
        setCards((prevCards) =>
          prevCards.map((card) => {
            switch (card.key) {
              case 'critical':
                return { ...card, value: data.threats?.critical || 0 };
              case 'high':
                return { ...card, value: data.threats?.high || 0 };
              case 'medium':
                return { ...card, value: data.threats?.medium || 0 };
              case 'low':
                return { ...card, value: data.threats?.low || 0 };
              case 'total':
                return { ...card, value: data.networks?.total || 0 };
              case 'threats':
                return {
                  ...card,
                  value:
                    (data.threats?.critical || 0) +
                    (data.threats?.high || 0) +
                    (data.threats?.medium || 0) +
                    (data.threats?.low || 0),
                };
              case 'surveillance':
                return { ...card, value: data.surveillance || 0 };
              case 'enriched':
                return { ...card, value: data.enriched || 0 };
              case 'wifi':
                return { ...card, value: data.networks?.wifi || 0 };
              default:
                return card;
            }
          })
        );
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const handleMouseDown = (e, cardId, mode = 'move') => {
    if (mode === 'move') {
      const card = cards.find((c) => c.id === cardId);
      setDragging(cardId);
      setDragOffset({
        x: e.clientX - (card.x * window.innerWidth) / 100,
        y: e.clientY - card.y,
      });
    } else if (mode === 'resize') {
      setResizing(cardId);
    }
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setCards(
        cards.map((card) => {
          if (card.id === dragging) {
            const newX = Math.max(
              0,
              Math.min(100 - card.w, ((e.clientX - dragOffset.x) / window.innerWidth) * 100)
            );
            const newY = Math.max(0, e.clientY - dragOffset.y);
            return { ...card, x: newX, y: newY };
          }
          return card;
        })
      );
    } else if (resizing) {
      setCards(
        cards.map((card) => {
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
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };

  return (
    <div
      className="relative w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm">Drag cards to move • Drag corner to resize</p>
      </div>

      {/* Cards Container */}
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
            }}
            onMouseDown={(e) => handleMouseDown(e, card.id, 'move')}
            className={`relative overflow-hidden bg-gradient-to-br ${card.color} border border-white/5 rounded-xl p-4 flex flex-col justify-between shadow-2xl hover:shadow-blue-600/30 transition-shadow group backdrop-blur-sm`}
          >
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-br from-white/20 via-white/5 to-transparent" />
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-200 text-xs font-semibold uppercase tracking-wide drop-shadow">
                  {card.title}
                </p>
              </div>
              <GripHorizontal
                size={16}
                className="text-white/50 group-hover:text-white transition-opacity flex-shrink-0 ml-2"
              />
            </div>

            {/* Value */}
            <div className="flex items-end justify-between">
              <p className="text-4xl font-extrabold text-white drop-shadow">
                {card.value.toLocaleString()}
              </p>
              <Icon size={32} className="text-white/60 flex-shrink-0" />
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, card.id, 'resize');
              }}
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.4) 50%)',
                borderRadius: '0 0 8px 0',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
