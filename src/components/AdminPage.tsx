import React, { useState, useEffect, useRef, useCallback } from 'react';

// SVG Icons
const Settings = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24M19.78 19.78l-4.24-4.24m-3.08-3.08l-4.24-4.24" />
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
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const Upload = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const Key = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
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

const AdminPage: React.FC = () => {
  const [mapboxToken, setMapboxToken] = useState('');
  const [homeLocation, setHomeLocation] = useState({ lat: '', lng: '' });
  const [importStatus, setImportStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wigleToken, setWigleToken] = useState('');
  const [wigleApiName, setWigleApiName] = useState('');

  const [cards, setCards] = useState([
    { id: 1, title: 'SQLite Import', icon: Database, x: 0, y: 60, w: 50, h: 280, type: 'import' },
    {
      id: 2,
      title: 'Mapbox Configuration',
      icon: Key,
      x: 50,
      y: 60,
      w: 50,
      h: 280,
      type: 'mapbox',
    },
    {
      id: 3,
      title: 'Home Location',
      icon: Settings,
      x: 0,
      y: 350,
      w: 50,
      h: 280,
      type: 'location',
    },
    { id: 4, title: 'WiGLE API', icon: Key, x: 50, y: 350, w: 50, h: 280, type: 'wigle' },
    {
      id: 5,
      title: 'WiGLE Import',
      icon: Upload,
      x: 0,
      y: 640,
      w: 50,
      h: 280,
      type: 'wigle-import',
    },
    { id: 6, title: 'Data Export', icon: Upload, x: 50, y: 640, w: 50, h: 280, type: 'export' },
  ]);

  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeStartRef = useRef({ startX: 0, startY: 0, startW: 0, startH: 0 });

  const handleMouseDown = useCallback(
    (e, cardId, action) => {
      e.preventDefault();
      if (action === 'move') {
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setDragging(cardId);
      } else if (action === 'resize') {
        const card = cards.find((c) => c.id === cardId);
        resizeStartRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startW: card.w,
          startH: card.h,
        };
        setResizing(cardId);
      }
    },
    [cards]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (dragging) {
        const container = e.currentTarget.getBoundingClientRect();
        const newX = ((e.clientX - container.left - dragOffset.x) / container.width) * 100;
        const newY = e.clientY - container.top - dragOffset.y;
        setCards((prev) =>
          prev.map((card) =>
            card.id === dragging
              ? { ...card, x: Math.max(0, Math.min(50, newX)), y: Math.max(60, newY) }
              : card
          )
        );
      } else if (resizing) {
        const deltaX = e.clientX - resizeStartRef.current.startX;
        const deltaY = e.clientY - resizeStartRef.current.startY;
        const container = e.currentTarget.getBoundingClientRect();
        const newW = resizeStartRef.current.startW + (deltaX / container.width) * 100;
        const newH = resizeStartRef.current.startH + deltaY;
        setCards((prev) =>
          prev.map((card) =>
            card.id === resizing
              ? { ...card, w: Math.max(25, Math.min(100, newW)), h: Math.max(200, newH) }
              : card
          )
        );
      }
    },
    [dragging, resizing, dragOffset]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const tokenResponse = await fetch('/api/mapbox-token');
      const tokenData = await tokenResponse.json();
      if (tokenData.token && tokenData.token !== 'your-mapbox-token-here') {
        setMapboxToken(tokenData.token);
      }

      const homeResponse = await fetch('/api/home-location');
      const homeData = await homeResponse.json();
      if (homeData.latitude && homeData.longitude) {
        setHomeLocation({
          lat: homeData.latitude.toString(),
          lng: homeData.longitude.toString(),
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveMapboxToken = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/mapbox-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mapboxToken }),
      });
      if (response.ok) {
        alert('Mapbox token saved successfully!');
      } else {
        alert('Failed to save Mapbox token');
      }
    } catch (error) {
      alert('Error saving Mapbox token');
    } finally {
      setIsLoading(false);
    }
  };

  const saveHomeLocation = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/home-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: parseFloat(homeLocation.lat),
          longitude: parseFloat(homeLocation.lng),
        }),
      });
      if (response.ok) {
        alert('Home location saved successfully!');
      } else {
        alert('Failed to save home location');
      }
    } catch (error) {
      alert('Error saving home location');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('database', file);

    try {
      setIsLoading(true);
      setImportStatus('Uploading database...');

      const response = await fetch('/api/admin/import-sqlite', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setImportStatus(`Import successful! Imported ${result.imported || 0} networks.`);
      } else {
        setImportStatus(`Import failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setImportStatus('Import failed: Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCardContent = (card) => {
    const height = card.h - 60;

    switch (card.type) {
      case 'import':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Import WiGLE SQLite databases</div>
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block text-white">
                Select SQLite Database
              </label>
              <input
                type="file"
                accept=".sqlite,.db,.sqlite3"
                onChange={handleFileImport}
                disabled={isLoading}
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
              />
            </div>
            {importStatus && (
              <div
                className={`text-sm p-2 rounded mb-4 ${
                  importStatus.includes('successful')
                    ? 'bg-green-900 text-green-200'
                    : importStatus.includes('failed')
                      ? 'bg-red-900 text-red-200'
                      : 'bg-blue-900 text-blue-200'
                }`}
              >
                {importStatus}
              </div>
            )}
            {isLoading && <div className="text-center text-sm text-slate-400">Processing...</div>}
          </div>
        );

      case 'mapbox':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Configure Mapbox access token</div>
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block text-white">
                Mapbox Access Token
              </label>
              <input
                type="password"
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                placeholder="pk.eyJ1..."
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
              />
            </div>
            <div className="flex justify-center">
              <button
                onClick={saveMapboxToken}
                disabled={isLoading || !mapboxToken}
                style={{
                  padding: '6px 16px',
                  background:
                    isLoading || !mapboxToken ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.7)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  cursor: isLoading || !mapboxToken ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                💾 Save
              </button>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Set your home coordinates</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="text-xs font-medium mb-1 block text-white">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={homeLocation.lat}
                  onChange={(e) => setHomeLocation((prev) => ({ ...prev, lat: e.target.value }))}
                  placeholder="43.0234"
                  className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-white">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={homeLocation.lng}
                  onChange={(e) => setHomeLocation((prev) => ({ ...prev, lng: e.target.value }))}
                  placeholder="-83.6968"
                  className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                />
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={saveHomeLocation}
                disabled={isLoading || !homeLocation.lat || !homeLocation.lng}
                style={{
                  padding: '6px 16px',
                  background:
                    isLoading || !homeLocation.lat || !homeLocation.lng
                      ? 'rgba(168, 85, 247, 0.5)'
                      : 'rgba(168, 85, 247, 0.7)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  cursor:
                    isLoading || !homeLocation.lat || !homeLocation.lng ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                }}
              >
                📍 Save
              </button>
            </div>
          </div>
        );

      case 'wigle':
        return (
          <div className="p-4 overflow-y-auto" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Configure WiGLE API credentials</div>
            <div className="mb-3">
              <label className="text-xs font-medium mb-2 block text-white">API Name</label>
              <input
                type="text"
                value={wigleApiName}
                onChange={(e) => setWigleApiName(e.target.value)}
                placeholder="AIDxxxxxxxx"
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block text-white">API Token</label>
              <input
                type="password"
                value={wigleToken}
                onChange={(e) => setWigleToken(e.target.value)}
                placeholder="Token..."
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
              />
            </div>
            <button
              onClick={async () => {
                try {
                  setIsLoading(true);
                  const response = await fetch('/api/admin/wigle-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiName: wigleApiName, apiToken: wigleToken }),
                  });
                  if (response.ok) {
                    alert('WiGLE credentials saved successfully!');
                  } else {
                    alert('Failed to save WiGLE credentials');
                  }
                } catch (error) {
                  alert('Error saving WiGLE credentials');
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading || !wigleApiName || !wigleToken}
              style={{
                padding: '6px 16px',
                background:
                  isLoading || !wigleApiName || !wigleToken
                    ? 'rgba(6, 182, 212, 0.5)'
                    : 'rgba(6, 182, 212, 0.7)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '6px',
                color: '#e2e8f0',
                cursor: isLoading || !wigleApiName || !wigleToken ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                marginBottom: '8px',
              }}
            >
              💾 Save
            </button>
            <div className="space-y-1.5 flex flex-col items-center">
              <button
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    const response = await fetch('/api/wigle/test');
                    const data = await response.json();
                    alert(
                      response.ok ? `Connected! User: ${data.user || 'OK'}` : 'Connection failed'
                    );
                  } catch (error) {
                    alert('Connection test failed');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                style={{
                  padding: '5px 12px',
                  background: isLoading ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.7)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                }}
              >
                🔌 Test
              </button>
              <button
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    const response = await fetch('/api/wigle/import-nearby', { method: 'POST' });
                    const data = await response.json();
                    alert(
                      response.ok ? `Imported ${data.imported || 0} networks` : 'Import failed'
                    );
                  } catch (error) {
                    alert('Import failed');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                style={{
                  padding: '5px 12px',
                  background: isLoading ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.7)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  borderRadius: '6px',
                  color: '#e2e8f0',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                }}
              >
                📥 Import
              </button>
            </div>
          </div>
        );

      case 'wigle-import':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Import WiGLE JSON files</div>
            <div className="space-y-3">
              <div className="text-xs text-slate-500">
                Place JSON files in:{' '}
                <code className="bg-slate-700 px-1 rounded">imports/wigle/</code>
              </div>
              <button
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const response = await fetch('/api/import/wigle', { method: 'POST' });
                    const result = await response.json();
                    if (result.success) {
                      setImportStatus(
                        `✅ Imported ${result.totalImported} networks from ${result.results.length} files`
                      );
                    } else {
                      setImportStatus(`❌ Error: ${result.error}`);
                    }
                  } catch (error) {
                    setImportStatus(`❌ Error: ${error.message}`);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="w-full p-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium"
              >
                {isLoading ? '⏳ Importing...' : '📥 Import WiGLE JSONs'}
              </button>
              {importStatus && (
                <div className="text-xs p-2 rounded bg-slate-700 text-slate-300">
                  {importStatus}
                </div>
              )}
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="p-4" style={{ height }}>
            <div className="text-sm text-slate-400 mb-4">Export data and generate reports</div>
            <div className="space-y-3">
              <button
                className="w-full p-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                onClick={() => window.open('/api/export/networks/csv', '_blank')}
              >
                📊 Export Networks CSV
              </button>
              <button
                className="w-full p-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                onClick={() => window.open('/api/export/threats/json', '_blank')}
              >
                🚨 Export Threats JSON
              </button>
              <button
                className="w-full p-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium"
                onClick={() => window.open('/api/export/observations/geojson', '_blank')}
              >
                🗺️ Export GeoJSON
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex"
      style={{
        background:
          'radial-gradient(circle at 20% 20%, rgba(52, 211, 153, 0.06), transparent 25%), radial-gradient(circle at 80% 0%, rgba(59, 130, 246, 0.06), transparent 20%), linear-gradient(135deg, #0a1525 0%, #0d1c31 40%, #0a1424 100%)',
      }}
    >
      <div className="relative flex-1 overflow-y-auto" style={{ height: '100vh' }}>
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
              ShadowCheck Administration
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
              System configuration and data management
            </p>
          </div>
        </div>

        {/* Cards */}
        <div style={{ minHeight: '2100px', position: 'relative' }}>
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
                }}
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
                <div className="overflow-hidden">{renderCardContent(card)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
