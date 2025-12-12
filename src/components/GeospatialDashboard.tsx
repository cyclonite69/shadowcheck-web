import React, { useState } from 'react';

// SVG Icons
const Map = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 19.08 6.15 19.08 17.85 12 22 4.92 17.85 4.92 6.15 12 2" />
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="12" y1="17" x2="19.08" y2="12.85" />
    <line x1="12" y1="17" x2="4.92" y2="12.85" />
    <line x1="12" y1="2" x2="4.92" y2="6.15" />
    <line x1="12" y1="2" x2="19.08" y2="6.15" />
  </svg>
);

const AlertTriangle = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const Network = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M5 22v-5M19 22v-5M12 8v-3M7 19h10" />
  </svg>
);

const Search = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

// Sample data
const generateNetworks = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    type: ['W', 'E', 'B', 'L'][Math.floor(Math.random() * 4)],
    ssid: ['Home-WiFi', 'CaffeNet', 'Airport', 'Office-5G'][Math.floor(Math.random() * 4)],
    bssid: `aa:bb:cc:dd:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
    signal: Math.floor(Math.random() * 40) - 90,
    security: ['WPA2', 'WPA3', 'OPEN'][Math.floor(Math.random() * 3)],
    lat: 43.0 + (Math.random() - 0.5) * 0.1,
    lng: -87.0 + (Math.random() - 0.5) * 0.1,
    threat: Math.random() > 0.7,
    severity: ['critical', 'high', 'medium', 'low'][Math.floor(Math.random() * 4)],
  }));

const networks = generateNetworks(50);

const TypeBadge = ({ type }) => {
  const types = { W: { label: 'WiFi', color: '#3b82f6' }, E: { label: 'BLE', color: '#8b5cf6' }, B: { label: 'BT', color: '#3b82f6' }, L: { label: 'LTE', color: '#10b981' } };
  const t = types[type] || types.W;
  return <span className="px-2 py-0.5 border rounded text-xs font-medium" style={{ backgroundColor: `${t.color}22`, borderColor: `${t.color}44`, color: t.color }}>{t.label}</span>;
};

const ThreatBadge = ({ severity }) => {
  const colors = { critical: '#ef4444', high: '#f59e0b', medium: '#eab308', low: '#10b981' };
  const color = colors[severity] || '#94a3b8';
  return <span className="px-2 py-0.5 border rounded text-xs font-medium" style={{ backgroundColor: `${color}22`, borderColor: `${color}44`, color }}>{severity}</span>;
};

export default function GeospatialDashboard() {
  const [cards, setCards] = useState([
    { id: 1, title: 'Map', icon: Map, x: 0, y: 0, w: 60, h: 700, type: 'map' },
    { id: 2, title: 'Networks', icon: Network, x: 60, y: 0, w: 40, h: 350, type: 'networks' },
    { id: 3, title: 'Threats', icon: AlertTriangle, x: 60, y: 350, w: 40, h: 350, type: 'threats' },
  ]);

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [searchNetworks, setSearchNetworks] = useState('');
  const [searchThreats, setSearchThreats] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState(new Set());
  const [selectedThreats, setSelectedThreats] = useState(new Set());
  const [threatFilter, setThreatFilter] = useState('');
  const [hoveredNetwork, setHoveredNetwork] = useState(null);

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
          const newW = Math.max(20, Math.min(100 - card.x, (e.clientX - (card.x * window.innerWidth / 100)) / window.innerWidth * 100));
          const newH = Math.max(250, e.clientY - card.y);
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

  const filteredNetworks = networks.filter(n => {
    if (searchNetworks && !n.ssid.toLowerCase().includes(searchNetworks.toLowerCase()) && !n.bssid.toLowerCase().includes(searchNetworks.toLowerCase())) {return false;}
    return true;
  });

  const threatsOnly = networks.filter(n => n.threat);
  const filteredThreats = threatsOnly.filter(n => {
    if (searchThreats && !n.ssid.toLowerCase().includes(searchThreats.toLowerCase()) && !n.bssid.toLowerCase().includes(searchThreats.toLowerCase())) {return false;}
    if (threatFilter && n.severity !== threatFilter) {return false;}
    return true;
  });

  const toggleSelectNetwork = (id) => {
    const newSelected = new Set(selectedNetworks);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelectedNetworks(newSelected);
  };

  const toggleSelectThreat = (id) => {
    const newSelected = new Set(selectedThreats);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelectedThreats(newSelected);
  };

  const renderMapMarkers = () => {
    const latMin = 42.95, latMax = 43.05, lngMin = -87.05, lngMax = -86.95;

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)', borderRadius: '6px', overflow: 'hidden' }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {networks.map(net => {
            const x = ((net.lng - lngMin) / (lngMax - lngMin)) * 100;
            const y = ((latMax - net.lat) / (latMax - latMin)) * 100;
            const isSelected = selectedNetworks.has(net.id) || selectedThreats.has(net.id);
            const isHovered = hoveredNetwork === net.id;
            const isThreat = net.threat;

            return (
              <g key={net.id}>
                <circle
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r={isHovered ? 12 : 8}
                  fill={isThreat ? '#ef4444' : '#3b82f6'}
                  opacity={isSelected ? 1 : 0.6}
                  stroke={isSelected ? '#fbbf24' : 'none'}
                  strokeWidth="2"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredNetwork(net.id)}
                  onMouseLeave={() => setHoveredNetwork(null)}
                />
              </g>
            );
          })}
        </svg>
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: '11px', color: '#94a3b8' }}>
          📍 {networks.length} networks • {threatsOnly.length} threats
        </div>
      </div>
    );
  };

  const renderCard = (card) => {
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
        className="bg-slate-800 border border-slate-700 rounded-lg shadow-lg hover:shadow-xl transition-shadow group flex flex-col"
      >
        <div className="flex items-center justify-between p-4 bg-slate-900 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Icon size={18} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-white">{card.title}</h3>
          </div>
          <GripHorizontal size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0" />
        </div>

        {card.type === 'map' && (
          <div className="flex-1 p-4 overflow-hidden">{renderMapMarkers()}</div>
        )}

        {card.type === 'networks' && (
          <>
            <div className="flex items-center gap-1 p-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search networks..."
                value={searchNetworks}
                onChange={(e) => setSearchNetworks(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto text-xs">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="w-6 p-2 text-left">
                      <input type="checkbox" className="cursor-pointer" onChange={(e) => {
                        if (e.target.checked) {setSelectedNetworks(new Set(filteredNetworks.map(n => n.id)));} else {setSelectedNetworks(new Set());}
                      }} />
                    </th>
                    <th className="p-2 text-left text-blue-400 font-semibold">SSID</th>
                    <th className="p-2 text-left text-blue-400 font-semibold">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNetworks.map(net => (
                    <tr key={net.id} className="border-b border-slate-700 hover:bg-slate-700 hover:bg-opacity-40 transition-colors h-7" onMouseEnter={() => setHoveredNetwork(net.id)} onMouseLeave={() => setHoveredNetwork(null)}>
                      <td className="w-6 p-1"><input type="checkbox" checked={selectedNetworks.has(net.id)} onChange={() => toggleSelectNetwork(net.id)} className="cursor-pointer" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="p-1 truncate">{net.ssid}</td>
                      <td className="p-1 text-slate-400">{net.signal} dBm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {card.type === 'threats' && (
          <>
            <div className="flex gap-2 p-3 bg-slate-900 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                <Search size={16} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search threats..."
                  value={searchThreats}
                  onChange={(e) => setSearchThreats(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <select value={threatFilter} onChange={(e) => setThreatFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500">
                <option value="">All Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex-1 overflow-y-auto text-xs">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="w-6 p-2 text-left">
                      <input type="checkbox" className="cursor-pointer" onChange={(e) => {
                        if (e.target.checked) {setSelectedThreats(new Set(filteredThreats.map(n => n.id)));} else {setSelectedThreats(new Set());}
                      }} />
                    </th>
                    <th className="p-2 text-left text-red-400 font-semibold">SSID</th>
                    <th className="p-2 text-left text-red-400 font-semibold">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredThreats.map(net => (
                    <tr key={net.id} className="border-b border-slate-700 hover:bg-red-900 hover:bg-opacity-20 transition-colors h-7" onMouseEnter={() => setHoveredNetwork(net.id)} onMouseLeave={() => setHoveredNetwork(null)}>
                      <td className="w-6 p-1"><input type="checkbox" checked={selectedThreats.has(net.id)} onChange={() => toggleSelectThreat(net.id)} className="cursor-pointer" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="p-1 truncate">{net.ssid}</td>
                      <td className="p-1"><ThreatBadge severity={net.severity} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

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
  };

  return (
    <div
      className="relative w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <h1 className="text-3xl font-bold text-white">Geospatial</h1>
        <p className="text-gray-400 text-sm">Drag cards to move • Drag edges to resize • Hover on map to preview</p>
      </div>

      {cards.map(card => renderCard(card))}
    </div>
  );
}
