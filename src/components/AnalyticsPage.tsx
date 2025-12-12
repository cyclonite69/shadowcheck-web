import React, { useState, useRef } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// SVG Icons
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

const Signal = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const Lock = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const Clock = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const BarChartIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="M17 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4" />
    <path d="M3 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3" />
  </svg>
);

const TrendingUp = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 17" />
    <polyline points="17 6 23 6 23 12" />
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

// Sample Data
const networkTypesData = [
  { name: 'WiFi', value: 45000, color: '#3b82f6' },
  { name: 'BLE', value: 28000, color: '#8b5cf6' },
  { name: 'LTE', value: 12000, color: '#ec4899' },
  { name: 'GSM', value: 8000, color: '#f59e0b' },
];

const signalStrengthData = [
  { range: '-90 to -80', count: 450 },
  { range: '-80 to -70', count: 1200 },
  { range: '-70 to -60', count: 2800 },
  { range: '-60 to -50', count: 3200 },
  { range: '-50 to -40', count: 2100 },
];

const securityData = [
  { name: 'WPA2', value: 35000, color: '#10b981' },
  { name: 'WPA3', value: 18000, color: '#06b6d4' },
  { name: 'OPEN', value: 8000, color: '#f59e0b' },
  { name: 'WEP', value: 2000, color: '#ef4444' },
];

const temporalData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  count: Math.floor(Math.random() * 5000) + 1000,
}));

const radioTimeData = Array.from({ length: 30 }, (_, i) => ({
  date: `Dec ${i + 1}`,
  WiFi: Math.floor(Math.random() * 50000) + 30000,
  BLE: Math.floor(Math.random() * 35000) + 15000,
  LTE: Math.floor(Math.random() * 15000) + 5000,
}));

export default function Analytics() {
  const [cards, setCards] = useState([
    {
      id: 1,
      title: 'Network Types',
      icon: Wifi,
      x: 0,
      y: 110,
      w: 33.33,
      h: 320,
      type: 'network-types',
    },
    {
      id: 2,
      title: 'Signal Strength',
      icon: Signal,
      x: 33.33,
      y: 110,
      w: 33.33,
      h: 320,
      type: 'signal',
    },
    {
      id: 3,
      title: 'Security Types',
      icon: Lock,
      x: 66.66,
      y: 110,
      w: 33.34,
      h: 320,
      type: 'security',
    },
    {
      id: 4,
      title: 'Temporal Activity',
      icon: Clock,
      x: 0,
      y: 460,
      w: 50,
      h: 320,
      type: 'temporal',
    },
    {
      id: 5,
      title: 'Radio Types Over Time',
      icon: TrendingUp,
      x: 50,
      y: 460,
      w: 50,
      h: 320,
      type: 'radio-time',
    },
    {
      id: 6,
      title: 'Top WiFi Networks',
      icon: BarChartIcon,
      x: 0,
      y: 820,
      w: 100,
      h: 260,
      type: 'top-networks',
    },
  ]);

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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
              20,
              Math.min(
                100 - card.x,
                ((e.clientX - (card.x * window.innerWidth) / 100) / window.innerWidth) * 100
              )
            );
            const newH = Math.max(150, e.clientY - card.y);
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

  const renderChart = (card) => {
    const height = card.h - 50;

    switch (card.type) {
      case 'network-types':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={networkTypesData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {networkTypesData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'signal':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={signalStrengthData}
              margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis
                dataKey="range"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'security':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={securityData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {securityData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'temporal':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={temporalData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'radio-time':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={radioTimeData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={5} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Line type="monotone" dataKey="WiFi" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="BLE" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="LTE" stroke="#ec4899" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'top-networks':
        return (
          <div style={{ height: height, overflowY: 'auto', paddingRight: 8 }}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  borderRadius: '6px',
                  borderLeft: '3px solid #3b82f6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#cbd5e1',
                      fontFamily: 'monospace',
                    }}
                  >
                    {['aa:bb:cc:dd:ee:ff', 'ff:ee:dd:cc:bb:aa', '11:22:33:44:55:66'][idx % 3]}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {['Home-WiFi', 'Cafe-Net', 'Office-5G'][idx % 3]}
                  </div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#60a5fa' }}>
                  {Math.floor(Math.random() * 5000) + 1000}
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="relative w-full min-h-screen overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <h1 className="text-3xl font-bold text-white drop-shadow">Analytics Dashboard</h1>
        <p className="text-gray-400 text-sm">Drag to move • Drag edge to resize</p>
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
            }}
            onMouseDown={(e) => handleMouseDown(e, card.id, 'move')}
            className="relative overflow-hidden rounded-lg border border-[#20324d] bg-[#0f1e34]/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-shadow group backdrop-blur-sm outline outline-1 outline-[#13223a]/60"
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
            <div className="p-4 overflow-hidden">{renderChart(card)}</div>

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
