import React, { useState, useRef, useCallback, useEffect } from 'react';
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

// Sample Data
const networkTypesData = [
  { name: 'WiFi', value: 45000, color: '#3b82f6' },
  { name: 'BLE', value: 28000, color: '#8b5cf6' },
  { name: 'BT', value: 18000, color: '#06b6d4' },
  { name: 'LTE', value: 12000, color: '#ec4899' },
  { name: 'GSM', value: 8000, color: '#f59e0b' },
  { name: 'NR', value: 5000, color: '#10b981' },
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

// Helper functions to generate data based on time frame
const generateTemporalData = (timeFrame: string) => {
  switch (timeFrame) {
    case '30d':
      return Array.from({ length: 30 }, (_, i) => ({
        label: `Day ${i + 1}`,
        count: Math.floor(Math.random() * 10000) + 3000,
      }));
    case '90d':
      return Array.from({ length: 13 }, (_, i) => ({
        label: `Week ${i + 1}`,
        count: Math.floor(Math.random() * 15000) + 5000,
      }));
    case '6mo':
      return Array.from({ length: 26 }, (_, i) => ({
        label: `Week ${i + 1}`,
        count: Math.floor(Math.random() * 18000) + 6000,
      }));
    case '1yr':
      return Array.from({ length: 12 }, (_, i) => ({
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
          i
        ],
        count: Math.floor(Math.random() * 25000) + 10000,
      }));
    case 'all':
      return Array.from({ length: 24 }, (_, i) => ({
        label: `'${(23 - i).toString().padStart(2, '0')}`,
        count: Math.floor(Math.random() * 30000) + 15000,
      }));
    default:
      return [];
  }
};

const generateRadioTimeData = (timeFrame: string) => {
  const getDataPoint = () => ({
    WiFi: Math.floor(Math.random() * 50000) + 30000,
    BLE: Math.floor(Math.random() * 35000) + 15000,
    BT: Math.floor(Math.random() * 20000) + 8000,
    LTE: Math.floor(Math.random() * 15000) + 5000,
    GSM: Math.floor(Math.random() * 10000) + 3000,
    NR: Math.floor(Math.random() * 8000) + 2000,
  });

  switch (timeFrame) {
    case '30d':
      return Array.from({ length: 30 }, (_, i) => ({
        label: `Day ${i + 1}`,
        ...getDataPoint(),
      }));
    case '90d':
      return Array.from({ length: 13 }, (_, i) => ({
        label: `Week ${i + 1}`,
        ...getDataPoint(),
      }));
    case '6mo':
      return Array.from({ length: 26 }, (_, i) => ({
        label: `Week ${i + 1}`,
        ...getDataPoint(),
      }));
    case '1yr':
      return Array.from({ length: 12 }, (_, i) => ({
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
          i
        ],
        ...getDataPoint(),
      }));
    case 'all':
      return Array.from({ length: 24 }, (_, i) => ({
        label: `'${(23 - i).toString().padStart(2, '0')}`,
        ...getDataPoint(),
      }));
    default:
      return [];
  }
};

const threatDistributionData = [
  { range: '30-40', count: 120 },
  { range: '40-50', count: 280 },
  { range: '50-60', count: 350 },
  { range: '60-70', count: 220 },
  { range: '70-80', count: 150 },
  { range: '80-90', count: 80 },
  { range: '90-100', count: 45 },
];

const generateThreatTrendsData = (timeFrame: string) => {
  const getDataPoint = () => ({
    avgScore: Math.floor(Math.random() * 30) + 40, // Average threat score 40-70
    criticalCount: Math.floor(Math.random() * 50) + 10, // Critical threats (80+)
    highCount: Math.floor(Math.random() * 80) + 20, // High threats (70-79)
  });

  switch (timeFrame) {
    case '30d':
      return Array.from({ length: 30 }, (_, i) => ({
        label: `Day ${i + 1}`,
        ...getDataPoint(),
      }));
    case '90d':
      return Array.from({ length: 13 }, (_, i) => ({
        label: `Week ${i + 1}`,
        ...getDataPoint(),
      }));
    case '6mo':
      return Array.from({ length: 26 }, (_, i) => ({
        label: `Week ${i + 1}`,
        ...getDataPoint(),
      }));
    case '1yr':
      return Array.from({ length: 12 }, (_, i) => ({
        label: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
          i
        ],
        ...getDataPoint(),
      }));
    case 'all':
      return Array.from({ length: 24 }, (_, i) => ({
        label: `'${(23 - i).toString().padStart(2, '0')}`,
        ...getDataPoint(),
      }));
    default:
      return [];
  }
};

export default function Analytics() {
  const [timeFrame, setTimeFrame] = useState('30d'); // '30d', '90d', '6mo', '1yr', 'all'
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
      title: 'Threat Score Distribution',
      icon: AlertTriangle,
      x: 0,
      y: 460,
      w: 50,
      h: 320,
      type: 'threat-distribution',
    },
    {
      id: 5,
      title: 'Temporal Activity',
      icon: Clock,
      x: 50,
      y: 460,
      w: 50,
      h: 320,
      type: 'temporal',
    },
    {
      id: 6,
      title: 'Radio Types Over Time',
      icon: TrendingUp,
      x: 0,
      y: 810,
      w: 100,
      h: 320,
      type: 'radio-time',
    },
    {
      id: 7,
      title: 'Threat Score Trends',
      icon: AlertTriangle,
      x: 0,
      y: 1160,
      w: 100,
      h: 320,
      type: 'threat-trends',
    },
    {
      id: 8,
      title: 'Top WiFi Networks',
      icon: BarChartIcon,
      x: 0,
      y: 1510,
      w: 100,
      h: 260,
      type: 'top-networks',
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
              20,
              Math.min(100 - start.cardXPercent, (widthPx / window.innerWidth) * 100)
            );
            const newH = Math.max(150, start.startHeightPx + (e.clientY - start.startY));
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
                label={(entry) => `${entry.name}: ${entry.value.toLocaleString()}`}
                labelLine={false}
              >
                {networkTypesData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                formatter={(value, name, props) => {
                  const total = networkTypesData.reduce((sum, item) => sum + item.value, 0);
                  const percent = ((value / total) * 100).toFixed(1);
                  return [`${value.toLocaleString()} (${percent}%)`, name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{value}</span>
                )}
              />
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
                label={(entry) => `${entry.name}: ${entry.value.toLocaleString()}`}
                labelLine={false}
              >
                {securityData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                formatter={(value, name, props) => {
                  const total = securityData.reduce((sum, item) => sum + item.value, 0);
                  const percent = ((value / total) * 100).toFixed(1);
                  return [`${value.toLocaleString()} (${percent}%)`, name];
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'temporal': {
        const temporalData = generateTemporalData(timeFrame);
        const interval = Math.max(1, Math.floor(temporalData.length / 12));
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={temporalData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={interval} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      case 'radio-time': {
        const radioTimeData = generateRadioTimeData(timeFrame);
        const interval = Math.max(1, Math.floor(radioTimeData.length / 8));
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={radioTimeData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={interval} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{value}</span>
                )}
              />
              <Line type="monotone" dataKey="WiFi" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="BLE" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="BT" stroke="#06b6d4" strokeWidth={2} />
              <Line type="monotone" dataKey="LTE" stroke="#ec4899" strokeWidth={2} />
              <Line type="monotone" dataKey="GSM" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="NR" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );
      }
      case 'threat-distribution':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={threatDistributionData}
              margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis
                dataKey="range"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                label={{
                  value: 'Threat Score Range',
                  position: 'insideBottom',
                  offset: -10,
                  fill: '#94a3b8',
                  fontSize: 10,
                }}
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'threat-trends': {
        const threatTrendsData = generateThreatTrendsData(timeFrame);
        const interval = Math.max(1, Math.floor(threatTrendsData.length / 8));
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={threatTrendsData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={interval} />
              <YAxis
                yAxisId="left"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                label={{
                  value: 'Avg Threat Score',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#94a3b8',
                  fontSize: 10,
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                label={{
                  value: 'Threat Count',
                  angle: 90,
                  position: 'insideRight',
                  fill: '#94a3b8',
                  fontSize: 10,
                }}
              />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend
                wrapperStyle={{ paddingTop: '10px' }}
                iconType="circle"
                formatter={(value) => (
                  <span style={{ color: '#cbd5e1', fontSize: '11px' }}>{value}</span>
                )}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgScore"
                stroke="#f59e0b"
                strokeWidth={3}
                name="Avg Score"
                dot={{ fill: '#f59e0b', r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="criticalCount"
                stroke="#ef4444"
                strokeWidth={2}
                name="Critical (80+)"
                dot={{ fill: '#ef4444', r: 2 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="highCount"
                stroke="#f97316"
                strokeWidth={2}
                name="High (70-79)"
                dot={{ fill: '#f97316', r: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      }
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
            ShadowCheck Analytics
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
            Advanced threat analysis and network intelligence
          </p>

          {/* Time Frame Selector */}
          <div className="pointer-events-auto mt-4 flex justify-center gap-2">
            {[
              { value: '30d', label: '30 Days' },
              { value: '90d', label: '90 Days' },
              { value: '6mo', label: '6 Months' },
              { value: '1yr', label: '1 Year' },
              { value: 'all', label: 'All Time' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeFrame(option.value)}
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border:
                    timeFrame === option.value
                      ? '1px solid rgba(59, 130, 246, 0.6)'
                      : '1px solid rgba(71, 85, 105, 0.3)',
                  background:
                    timeFrame === option.value
                      ? 'rgba(59, 130, 246, 0.2)'
                      : 'rgba(15, 23, 42, 0.4)',
                  color: timeFrame === option.value ? '#60a5fa' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(4px)',
                }}
                onMouseEnter={(e) => {
                  if (timeFrame !== option.value) {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.6)';
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (timeFrame !== option.value) {
                    e.currentTarget.style.background = 'rgba(15, 23, 42, 0.4)';
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
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
