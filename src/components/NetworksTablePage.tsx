import React, { useState } from 'react';

// SVG Icons
const Wifi = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5.59 15.87A24 24 0 0 1 12 13c2.59 0 5.11.28 7.59.87M2.13 12.94A36 36 0 0 1 12 10c3.46 0 6.87.48 10.13 1.36M2 9.13a48 48 0 0 1 20 0" />
  </svg>
);

const Search = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const Settings = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24M19.78 19.78l-4.24-4.24m-3.08-3.08l-4.24-4.24" />
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

const ChevronUp = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ChevronDown = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// All available columns
const ALL_COLUMNS = [
  { key: 'type', label: 'Type', sortable: true, default: true },
  { key: 'ssid', label: 'SSID', sortable: true, default: true },
  { key: 'bssid', label: 'BSSID', sortable: true, default: true },
  { key: 'signal', label: 'Signal', sortable: true, default: true },
  { key: 'security', label: 'Security', sortable: true, default: true },
  { key: 'observations', label: 'Observations', sortable: true, default: false },
  { key: 'lastSeen', label: 'Last Seen', sortable: true, default: true },
  { key: 'frequency', label: 'Frequency', sortable: true, default: false },
  { key: 'channel', label: 'Channel', sortable: true, default: false },
];

// Sample network data
const sampleNetworks = Array.from({ length: 45 }, (_, i) => ({
  id: i,
  type: ['W', 'E', 'B', 'L'][Math.floor(Math.random() * 4)],
  ssid: ['Home-WiFi', 'CaffeNet', 'Airport-Guest', 'Office-5G', '(hidden)'][Math.floor(Math.random() * 5)],
  bssid: `aa:bb:cc:dd:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
  signal: Math.floor(Math.random() * 40) - 90,
  security: ['WPA2', 'WPA3', 'OPEN', 'WEP'][Math.floor(Math.random() * 4)],
  lastSeen: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleString(),
  observations: Math.floor(Math.random() * 5000) + 100,
  frequency: (2.4 + Math.random() * 3.6).toFixed(3),
  channel: Math.floor(Math.random() * 14) + 1,
}));

const TypeBadge = ({ type }) => {
  const types = { W: { label: 'WiFi', color: '#3b82f6' }, E: { label: 'BLE', color: '#8b5cf6' }, B: { label: 'BT', color: '#3b82f6' }, L: { label: 'LTE', color: '#10b981' } };
  const t = types[type] || types.W;
  const bgColor = `${t.color}22`;
  const borderColor = `${t.color}44`;
  return <span className="px-2 py-0.5 border rounded text-xs font-medium whitespace-nowrap" style={{ backgroundColor: bgColor, borderColor: borderColor, color: t.color }}>{t.label}</span>;
};

const SignalBadge = ({ signal }) => {
  let color = '#94a3b8';
  if (signal >= -50) {color = '#10b981';} else if (signal >= -70) {color = '#f59e0b';} else {color = '#ef4444';}
  return <span style={{ color }} className="font-semibold">{signal} dBm</span>;
};

const ObservationsBadge = ({ count }) => (
  <span className="bg-blue-500 bg-opacity-20 text-blue-300 px-2 py-0.5 rounded text-xs font-semibold">{count}</span>
);

const CellRenderer = ({ column, value }) => {
  if (column.key === 'type') {return <TypeBadge type={value} />;}
  if (column.key === 'signal') {return <SignalBadge signal={value} />;}
  if (column.key === 'observations') {return <ObservationsBadge count={value} />;}
  return <span>{value}</span>;
};

export default function NetworksTablePage() {
  const [cards, setCards] = useState([
    { id: 1, title: 'Networks', icon: Wifi, x: 0, y: 0, w: 100, h: 600, type: 'networks-table' },
  ]);

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [securityFilter, setSecurityFilter] = useState('');
  const [signalFilter, setSignalFilter] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState(new Set());
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.filter(c => c.default).map(c => c.key));
  const [sortConfig, setSortConfig] = useState([{ key: 'lastSeen', direction: 'desc' }]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

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
          const newH = Math.max(300, e.clientY - card.y);
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

  const toggleColumn = (colKey) => {
    setVisibleColumns(prev =>
      prev.includes(colKey) ? prev.filter(c => c !== colKey) : [...prev, colKey]
    );
  };

  const handleSort = (colKey, shiftKey) => {
    if (shiftKey) {
      const existing = sortConfig.findIndex(s => s.key === colKey);
      if (existing > -1) {
        const newSort = [...sortConfig];
        if (newSort[existing].direction === 'asc') {
          newSort[existing].direction = 'desc';
        } else {
          newSort.splice(existing, 1);
        }
        setSortConfig(newSort);
      } else {
        setSortConfig([...sortConfig, { key: colKey, direction: 'asc' }]);
      }
    } else {
      const existing = sortConfig.find(s => s.key === colKey);
      if (existing && sortConfig.length === 1) {
        setSortConfig([{ key: colKey, direction: existing.direction === 'asc' ? 'desc' : 'asc' }]);
      } else {
        setSortConfig([{ key: colKey, direction: 'asc' }]);
      }
    }
  };

  let filteredNetworks = sampleNetworks.filter(net => {
    if (searchTerm && !net.ssid.toLowerCase().includes(searchTerm.toLowerCase()) && !net.bssid.toLowerCase().includes(searchTerm.toLowerCase())) {return false;}
    if (typeFilter && net.type !== typeFilter) {return false;}
    if (securityFilter && net.security !== securityFilter) {return false;}
    if (signalFilter) {
      if (signalFilter === 'strong' && net.signal < -50) {return false;}
      if (signalFilter === 'medium' && (net.signal < -70 || net.signal >= -50)) {return false;}
      if (signalFilter === 'weak' && net.signal >= -70) {return false;}
    }
    return true;
  });

  // Multi-field sort
  filteredNetworks = [...filteredNetworks].sort((a, b) => {
    for (const sort of sortConfig) {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      if (cmp !== 0) {
        return sort.direction === 'asc' ? cmp : -cmp;
      }
    }
    return 0;
  });

  const toggleSelectNetwork = (id) => {
    const newSelected = new Set(selectedNetworks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNetworks(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedNetworks.size === filteredNetworks.length) {
      setSelectedNetworks(new Set());
    } else {
      setSelectedNetworks(new Set(filteredNetworks.map(n => n.id)));
    }
  };

  const displayColumns = ALL_COLUMNS.filter(c => visibleColumns.includes(c.key));

  return (
    <div
      className="relative w-full min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="absolute top-0 left-0 right-0 p-6 z-50 pointer-events-none">
        <h1 className="text-3xl font-bold text-white">Networks</h1>
        <p className="text-gray-400 text-sm">Drag to move • Drag edge to resize • {filteredNetworks.length} networks</p>
      </div>

      {cards.map(card => {
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

            <div className="flex gap-3 p-3 bg-slate-900 border-b border-slate-700 flex-shrink-0 flex-wrap items-center relative">
              <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                <Search size={16} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search SSID, BSSID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                <option value="">All Types</option>
                <option value="W">WiFi</option>
                <option value="E">BLE</option>
                <option value="B">BT</option>
                <option value="L">LTE</option>
              </select>
              <select value={securityFilter} onChange={(e) => setSecurityFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                <option value="">All Security</option>
                <option value="WPA2">WPA2</option>
                <option value="WPA3">WPA3</option>
                <option value="OPEN">OPEN</option>
                <option value="WEP">WEP</option>
              </select>
              <select value={signalFilter} onChange={(e) => setSignalFilter(e.target.value)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                <option value="">All Signals</option>
                <option value="strong">Strong (≥ -50)</option>
                <option value="medium">Medium (-70 to -50)</option>
                <option value="weak">Weak (&lt; -70)</option>
              </select>
              <button onClick={() => setShowColumnMenu(!showColumnMenu)} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-blue-400 hover:border-blue-500 transition-colors flex items-center gap-1">
                <Settings size={14} />
                Cols
              </button>

              {showColumnMenu && (
                <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded shadow-lg z-10 p-2 min-w-max">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 p-1 hover:bg-slate-700 rounded cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="cursor-pointer"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto" style={{ fontSize: '12px' }}>
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
                  <tr>
                    <th className="w-10 p-2 text-left">
                      <input type="checkbox" checked={selectedNetworks.size === filteredNetworks.length && filteredNetworks.length > 0} onChange={toggleSelectAll} className="cursor-pointer" />
                    </th>
                    {displayColumns.map(col => {
                      const sortIdx = sortConfig.findIndex(s => s.key === col.key);
                      const isSorted = sortIdx > -1;
                      return (
                        <th
                          key={col.key}
                          className="p-2 text-left text-blue-400 font-semibold cursor-pointer hover:bg-slate-800 transition-colors"
                          onClick={(e) => col.sortable && handleSort(col.key, e.shiftKey)}
                          title={col.sortable ? 'Click to sort, Shift+Click for multi-sort' : ''}
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            {isSorted && (
                              <span className="flex items-center gap-0.5 text-xs bg-blue-500 bg-opacity-30 px-1 rounded">
                                {sortConfig[sortIdx].direction === 'asc' ? <ChevronUp /> : <ChevronDown />}
                                {sortConfig.length > 1 && sortIdx + 1}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filteredNetworks.map(net => (
                    <tr key={net.id} className="border-b border-slate-700 hover:bg-slate-700 hover:bg-opacity-40 transition-colors">
                      <td className="w-10 p-2">
                        <input
                          type="checkbox"
                          checked={selectedNetworks.has(net.id)}
                          onChange={() => toggleSelectNetwork(net.id)}
                          className="cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      {displayColumns.map(col => (
                        <td
                          key={col.key}
                          className={`p-2 truncate max-w-[120px] ${col.key === 'bssid' ? 'font-mono text-slate-400' : ''}`}
                          title={col.key === 'lastSeen' ? net[col.key] : ''}
                        >
                          <CellRenderer column={col} value={net[col.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
