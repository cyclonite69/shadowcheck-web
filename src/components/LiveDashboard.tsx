import React, { useState, useEffect } from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// SVG Icons
const AlertTriangle = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const Activity = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const Eye = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const Wifi = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5.59 15.87A24 24 0 0 1 12 13c2.59 0 5.11.28 7.59.87M2.13 12.94A36 36 0 0 1 12 10c3.46 0 6.87.48 10.13 1.36M2 9.13a48 48 0 0 1 20 0" />
  </svg>
);

const Zap = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const Network = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M5 22v-5M19 22v-5M12 8v-3" />
    <path d="M7 19h10" />
  </svg>
);

const Database = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
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

const Loader = ({ size = 20, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" opacity="0.3" />
    <circle cx="12" cy="12" r="10" style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }} />
  </svg>
);

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredRadio, setHoveredRadio] = useState(null);
  const [cards, setCards] = useState([
    { id: 'severity', title: 'Threat Severity', x: 0, y: 0, w: 100, h: 220, type: 'severity' },
    { id: 'metrics', title: 'Key Metrics', x: 0, y: 220, w: 100, h: 160, type: 'metrics' },
    { id: 'temporal', title: 'Activity Timeline', x: 0, y: 380, w: 65, h: 320, type: 'temporal' },
    { id: 'radio', title: 'Radio Distribution', x: 65, y: 380, w: 35, h: 320, type: 'radio' },
  ]);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3001/api/v1/dashboard/metrics');

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        setError(err.message);
        setMetrics({
          threats: { critical: 238, high: 205, medium: 62, low: 0 },
          networks: { total: 117687, wifi: 36391, ble: 75163, bluetooth: 5754, lte: 259 },
          surveillance: 49,
          enriched: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMouseDown = (e, cardId, mode = 'move') => {
    if (mode === 'move') {
      const card = cards.find(c => c.id === cardId);
      setDragging(cardId);
      setDragOffset({
        x: e.clientX - (card.x * window.innerWidth / 100),
        y: e.clientY - card.y,
      });
    } else if (mode === 'resize') {
      setResizing(cardId);
    }
  };

  const handleMouseMove = (e) => {
    if (dragging) {
      setCards(cards.map(card => {
        if (card.id === dragging) {
          const newX = Math.max(0, Math.min(100 - card.w, (e.clientX - dragOffset.x) / window.innerWidth * 100));
          const newY = Math.max(0, e.clientY - dragOffset.y);
          return { ...card, x: newX, y: newY };
        }
        return card;
      }));
    } else if (resizing) {
      setCards(cards.map(card => {
        if (card.id === resizing) {
          const newW = Math.max(25, Math.min(100 - card.x, (e.clientX - (card.x * window.innerWidth / 100)) / window.innerWidth * 100));
          const newH = Math.max(150, e.clientY - card.y);
          return { ...card, w: newW, h: newH };
        }
        return card;
      }));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setResizing(null);
  };

  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader size={40} className="text-blue-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400">Loading threat metrics...</p>
        </div>
      </div>
    );
  }

  const m = metrics || {};
  const threats = m.threats || {};
  const networks = m.networks || {};

  const radioData = [
    { name: 'WIFI', value: networks.wifi || 0, color: '#3b82f6' },
    { name: 'BLE', value: networks.ble || 0, color: '#8b5cf6' },
    { name: 'BLUETOOTH', value: networks.bluetooth || 0, color: '#06b6d4' },
    { name: 'LTE', value: networks.lte || 0, color: '#ec4899' },
  ].filter(d => d.value > 0);

  const temporalData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    threats: Math.floor(Math.random() * 5000) + 1000,
  }));

  const SeverityCard = ({ label, count, severity, Icon }) => {
    const severityColors = {
      critical: 'from-red-900 to-red-700 border-red-600',
      high: 'from-orange-900 to-orange-700 border-orange-600',
      medium: 'from-yellow-900 to-yellow-700 border-yellow-600',
      low: 'from-green-900 to-green-700 border-green-600',
    };

    return (
      <div className={`bg-gradient-to-br ${severityColors[severity]} border border-opacity-30 rounded-lg p-4 flex flex-col justify-between h-full`}>
        <p className="text-gray-300 text-sm font-medium">{label}</p>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold text-white">{count}</p>
          <Icon size={24} className="text-white opacity-40" />
        </div>
      </div>
    );
  };

  const MetricCard = ({ title, value, Icon }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">{title}</p>
      <div className="flex items-end justify-between">
        <p className="text-xl font-bold text-blue-400">{(value || 0).toLocaleString()}</p>
        <Icon size={16} className="text-slate-500" />
      </div>
    </div>
  );

  return (
    <div
      className="relative w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <h1 className="text-3xl font-bold text-white">Threat Dashboard</h1>
        <p className="text-gray-400 text-sm">Drag cards to move • Drag edges to resize</p>
      </div>

      {error && (
        <div className="absolute top-20 left-6 right-6 z-40 p-3 bg-yellow-900 bg-opacity-30 border border-yellow-600 rounded text-yellow-300 text-sm">
          Using fallback data: {error}
        </div>
      )}

      {cards.map(card => {
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
            className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg hover:shadow-xl transition-shadow group flex flex-col"
          >
            <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
              <h3 className="text-sm font-semibold text-white">{card.title}</h3>
              <GripHorizontal size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0" />
            </div>

            <div className="flex-1 overflow-auto p-4">
              {card.type === 'severity' && (
                <div className="grid grid-cols-4 gap-4 h-full">
                  <SeverityCard label="CRITICAL" count={threats.critical || 0} severity="critical" Icon={AlertTriangle} />
                  <SeverityCard label="HIGH" count={threats.high || 0} severity="high" Icon={Zap} />
                  <SeverityCard label="MEDIUM" count={threats.medium || 0} severity="medium" Icon={Activity} />
                  <SeverityCard label="LOW" count={threats.low || 0} severity="low" Icon={Eye} />
                </div>
              )}

              {card.type === 'metrics' && (
                <div className="grid grid-cols-6 gap-4 h-full">
                  <MetricCard title="Total Networks" value={networks.total} Icon={Network} />
                  <MetricCard title="Threats" value={(threats.critical || 0) + (threats.high || 0) + (threats.medium || 0)} Icon={AlertTriangle} />
                  <MetricCard title="Surveillance" value={m.surveillance} Icon={Eye} />
                  <MetricCard title="Enriched" value={m.enriched} Icon={Database} />
                  <MetricCard title="WIFI" value={networks.wifi} Icon={Wifi} />
                  <MetricCard title="BLE" value={networks.ble} Icon={Zap} />
                </div>
              )}

              {card.type === 'temporal' && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={temporalData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                    <XAxis dataKey="hour" stroke="rgb(148, 163, 184)" style={{ fontSize: '12px' }} interval={2} />
                    <YAxis stroke="rgb(148, 163, 184)" style={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }} />
                    <Line type="monotone" dataKey="threats" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}

              {card.type === 'radio' && radioData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={radioData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {radioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} opacity={hoveredRadio === null || hoveredRadio === index ? 1 : 0.3} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

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
