import React, { useState, useEffect } from 'react';

// SVG Icons
const Settings = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24M19.78 19.78l-4.24-4.24m-3.08-3.08l-4.24-4.24" />
  </svg>
);

const Database = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
  </svg>
);

const Upload = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const Key = ({ size = 24, className = '' }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const AdminPage: React.FC = () => {
  const [mapboxToken, setMapboxToken] = useState('');
  const [homeLocation, setHomeLocation] = useState({ lat: '', lng: '' });
  const [importStatus, setImportStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load current settings
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load Mapbox token
      const tokenResponse = await fetch('/api/mapbox-token');
      const tokenData = await tokenResponse.json();
      if (tokenData.token && tokenData.token !== 'your-mapbox-token-here') {
        setMapboxToken(tokenData.token);
      }

      // Load home location
      const homeResponse = await fetch('/api/home-location');
      const homeData = await homeResponse.json();
      if (homeData.latitude && homeData.longitude) {
        setHomeLocation({
          lat: homeData.latitude.toString(),
          lng: homeData.longitude.toString()
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
        body: JSON.stringify({ token: mapboxToken })
      });
      
      if (response.ok) {
        alert('Mapbox token saved successfully!');
      } else {
        alert('Failed to save Mapbox token');
      }
    } catch (error) {
      console.error('Error saving token:', error);
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
          longitude: parseFloat(homeLocation.lng)
        })
      });
      
      if (response.ok) {
        alert('Home location saved successfully!');
      } else {
        alert('Failed to save home location');
      }
    } catch (error) {
      console.error('Error saving location:', error);
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
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setImportStatus(`Import successful! Imported ${result.imported || 0} networks.`);
      } else {
        setImportStatus(`Import failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      setImportStatus('Import failed: Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">SC</div>
          <span className="font-semibold">ShadowCheck</span>
        </div>
        <nav className="nav-links">
          <a href="/" className="nav-link">Dashboard</a>
          <a href="/networks" className="nav-link">Networks</a>
          <a href="/geospatial" className="nav-link">Geospatial</a>
          <a href="/surveillance" className="nav-link">Surveillance</a>
          <a href="/analytics" className="nav-link">Analytics</a>
          <a href="/admin" className="nav-link active">Admin</a>
        </nav>
        <div className="header-right">
          <div className="status-indicator">
            <div className="status-dot"></div>
            <span>Online</span>
          </div>
        </div>
      </header>

      <main className="app-main" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px' }}>
        
        {/* SQLite Import Panel */}
        <div className="panel">
          <div className="panel-header">
            <Database size={18} className="text-blue-400" />
            <span>📦 SQLite Import</span>
          </div>
          <div className="panel-content" style={{ padding: '16px' }}>
            <div className="text-sm text-secondary mb-4">Import WiGLE SQLite databases</div>
            
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block">Select SQLite Database</label>
              <input 
                type="file" 
                accept=".sqlite,.db,.sqlite3"
                onChange={handleFileImport}
                disabled={isLoading}
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
              />
            </div>
            
            {importStatus && (
              <div className={`text-sm p-2 rounded mb-4 ${
                importStatus.includes('successful') ? 'bg-green-900 text-green-200' : 
                importStatus.includes('failed') ? 'bg-red-900 text-red-200' : 
                'bg-blue-900 text-blue-200'
              }`}>
                {importStatus}
              </div>
            )}
            
            {isLoading && (
              <div className="text-center text-sm text-slate-400">
                Processing...
              </div>
            )}
          </div>
        </div>

        {/* Mapbox Token Panel */}
        <div className="panel">
          <div className="panel-header">
            <Key size={18} className="text-green-400" />
            <span>🗺️ Mapbox Configuration</span>
          </div>
          <div className="panel-content" style={{ padding: '16px' }}>
            <div className="text-sm text-secondary mb-4">Configure Mapbox access token</div>
            
            <div className="mb-4">
              <label className="text-xs font-medium mb-2 block">Mapbox Access Token</label>
              <input 
                type="password"
                value={mapboxToken}
                onChange={(e) => setMapboxToken(e.target.value)}
                placeholder="pk.eyJ1..."
                className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
              />
            </div>
            
            <button 
              onClick={saveMapboxToken}
              disabled={isLoading || !mapboxToken}
              className="btn btn-sm w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              💾 Save Token
            </button>
          </div>
        </div>

        {/* Home Location Panel */}
        <div className="panel">
          <div className="panel-header">
            <Settings size={18} className="text-purple-400" />
            <span>🏠 Home Location</span>
          </div>
          <div className="panel-content" style={{ padding: '16px' }}>
            <div className="text-sm text-secondary mb-4">Set your home coordinates</div>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Latitude</label>
                <input 
                  type="number"
                  step="any"
                  value={homeLocation.lat}
                  onChange={(e) => setHomeLocation(prev => ({ ...prev, lat: e.target.value }))}
                  placeholder="43.0234"
                  className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Longitude</label>
                <input 
                  type="number"
                  step="any"
                  value={homeLocation.lng}
                  onChange={(e) => setHomeLocation(prev => ({ ...prev, lng: e.target.value }))}
                  placeholder="-83.6968"
                  className="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white text-sm"
                />
              </div>
            </div>
            
            <button 
              onClick={saveHomeLocation}
              disabled={isLoading || !homeLocation.lat || !homeLocation.lng}
              className="btn btn-sm w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              📍 Save Location
            </button>
          </div>
        </div>

        {/* System Status Panel */}
        <div className="panel">
          <div className="panel-header">
            <Upload size={18} className="text-orange-400" />
            <span>⚙️ System Status</span>
          </div>
          <div className="panel-content" style={{ padding: '16px' }}>
            <div className="text-sm text-secondary mb-4">System information and status</div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Database:</span>
                <span className="text-green-400">Connected</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">API Server:</span>
                <span className="text-green-400">Running</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mapbox:</span>
                <span className={mapboxToken ? "text-green-400" : "text-red-400"}>
                  {mapboxToken ? "Configured" : "Not Configured"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Home Location:</span>
                <span className={homeLocation.lat && homeLocation.lng ? "text-green-400" : "text-red-400"}>
                  {homeLocation.lat && homeLocation.lng ? "Set" : "Not Set"}
                </span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};

export default AdminPage;
