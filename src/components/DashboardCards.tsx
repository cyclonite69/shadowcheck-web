import React, { useState } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const BarChartIcon = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="M17 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4" />
    <path d="M3 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3" />
  </svg>
);

const ThreatDistributionData = [
  { range: '30-40', count: 5 },
  { range: '40-50', count: 12 },
  { range: '50-60', count: 28 },
  { range: '60-70', count: 45 },
  { range: '70-80', count: 68 },
  { range: '80-90', count: 92 },
  { range: '90-100', count: 95 },
];

const TemporalData = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i.toString().padStart(2, '0')}:00`,
  threats: Math.floor(Math.random() * 12000) + 2000,
}));

const RadioTypeData = [
  { name: 'WIFI', value: 36391, color: '#3b82f6' },
  { name: 'BLE', value: 75163, color: '#8b5cf6' },
  { name: 'BLUETOOTH', value: 5754, color: '#06b6d4' },
  { name: 'LTE', value: 259, color: '#ec4899' },
  { name: 'GSM', value: 120, color: '#f59e0b' },
];

export default function Dashboard() {
  const [hoveredRadio, setHoveredRadio] = useState(null);

  const SeverityCard = ({ label, count, severity, Icon }) => {
    const severityColors = {
      critical: 'from-red-900 to-red-700 border-red-600',
      high: 'from-orange-900 to-orange-700 border-orange-600',
      medium: 'from-yellow-900 to-yellow-700 border-yellow-600',
      low: 'from-green-900 to-green-700 border-green-600',
    };

    return (
      <div className={`bg-gradient-to-br ${severityColors[severity]} border border-opacity-30 rounded-lg p-6 flex flex-col justify-between h-full`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-300 text-sm font-medium mb-2">{label}</p>
            <p className="text-4xl font-bold text-white">{count}</p>
          </div>
          <Icon size={32} className="text-white opacity-40" />
        </div>
      </div>
    );
  };

  const MetricCard = ({ title, value, unit, Icon }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">{title}</p>
        <Icon size={18} className="text-slate-500" />
      </div>
      <p className="text-2xl font-bold text-blue-400">{value.toLocaleString()}</p>
      {unit && <p className="text-xs text-gray-500 mt-1">{unit}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Threat Dashboard</h1>
        <p className="text-gray-400 text-sm">Real-time surveillance and threat detection metrics</p>
      </div>

      {/* Primary Metrics - Full Width Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SeverityCard label="CRITICAL" count={238} severity="critical" Icon={AlertTriangle} />
        <SeverityCard label="HIGH" count={205} severity="high" Icon={Zap} />
        <SeverityCard label="MEDIUM" count={62} severity="medium" Icon={Activity} />
        <SeverityCard label="LOW" count={0} severity="low" Icon={Eye} />
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <MetricCard title="Total Networks" value={117687} Icon={Network} />
        <MetricCard title="Threats Detected" value={53282} Icon={AlertTriangle} />
        <MetricCard title="Active Surveillance" value={49} Icon={Eye} />
        <MetricCard title="Data Enriched" value={0} Icon={Database} />
        <MetricCard title="WIFI Networks" value={36391} Icon={Wifi} />
        <MetricCard title="BLE Devices" value={75163} Icon={Zap} />
      </div>

      {/* Charts - Full Width Sections */}
      <div className="grid grid-cols-1 gap-6">
        {/* Threat Score Distribution */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <BarChartIcon size={20} className="text-blue-400 mr-3" />
            <h2 className="text-lg font-semibold text-white">Threat Score Distribution</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ThreatDistributionData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="range" stroke="rgb(148, 163, 184)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgb(148, 163, 184)" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }} />
              <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Temporal Activity Pattern */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Activity size={20} className="text-blue-400 mr-3" />
            <h2 className="text-lg font-semibold text-white">Temporal Activity Pattern (24h)</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={TemporalData} margin={{ top: 10, right: 30, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
              <XAxis dataKey="hour" stroke="rgb(148, 163, 184)" style={{ fontSize: '12px' }} interval={2} />
              <YAxis stroke="rgb(148, 163, 184)" style={{ fontSize: '12px' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '6px' }} />
              <Line type="monotone" dataKey="threats" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Radio Type Distribution */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Wifi size={20} className="text-blue-400 mr-3" />
            <h2 className="text-lg font-semibold text-white">Radio Type Distribution</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={RadioTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {RadioTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} opacity={hoveredRadio === null || hoveredRadio === index ? 1 : 0.3} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="col-span-2">
              <div className="space-y-3">
                {RadioTypeData.map((item, idx) => (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredRadio(idx)}
                    onMouseLeave={() => setHoveredRadio(null)}
                    className="cursor-pointer transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                        <span className="text-sm font-medium text-gray-300">{item.name}</span>
                      </div>
                      <span className="text-lg font-bold text-white">{item.value.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          backgroundColor: item.color,
                          width: `${(item.value / 117687) * 100}%`,
                          opacity: hoveredRadio === null || hoveredRadio === idx ? 1 : 0.3,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
