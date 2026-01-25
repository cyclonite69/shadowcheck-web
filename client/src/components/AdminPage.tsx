import React, { useState, useEffect } from 'react';
import { logError } from '../logging/clientLogger';

// SVG Icons
const SettingsIcon = ({ size = 24, className = '' }) => (
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
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const DatabaseIcon = ({ size = 24, className = '' }) => (
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

const ShieldIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z" />
  </svg>
);

const UploadIcon = ({ size = 24, className = '' }) => (
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
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const DownloadIcon = ({ size = 24, className = '' }) => (
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

const ApiIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22 6 12 13 2 6" />
  </svg>
);

const BrainIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const TargetIcon = ({ size = 24, className = '' }) => (
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
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
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
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </svg>
);

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const API_PRESETS: { label: string; path: string; method: HttpMethod }[] = [
  { label: 'Health', path: '/api/health', method: 'GET' },
  { label: 'Dashboard', path: '/api/dashboard-metrics', method: 'GET' },
  { label: 'Networks', path: '/api/explorer/networks?limit=10', method: 'GET' },
  { label: 'ML Train', path: '/api/ml/train', method: 'POST' },
  { label: 'Kepler', path: '/api/kepler/data?limit=50', method: 'GET' },
];

// Card Component
const Card = ({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: any;
  title: string;
  color: string;
  children: React.ReactNode;
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all">
    <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white/8 via-white/5 to-transparent" />
    <div className="flex items-center space-x-3 p-4 bg-slate-900/90 border-b border-slate-800/80">
      <div className={`p-2 rounded-lg bg-gradient-to-br ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('config');
  const [isLoading, setIsLoading] = useState(false);
  const [mapboxToken, setMapboxToken] = useState('');
  const [homeLocation, setHomeLocation] = useState({ lat: '', lng: '' });
  const [importStatus, setImportStatus] = useState('');

  // ML Training state
  const [mlStatus, setMlStatus] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlResult, setMlResult] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // API Testing state
  const [endpoint, setEndpoint] = useState('/api/health');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [body, setBody] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);
  const [apiError, setApiError] = useState('');
  const [apiHealth, setApiHealth] = useState<{ status: string; version: string } | null>(null);

  // Load ML status when ML tab is active
  useEffect(() => {
    if (activeTab === 'ml') {
      fetch('/api/ml/status')
        .then((res) => res.json())
        .then((data) => setMlStatus(data))
        .catch(() => setMlStatus({ modelTrained: false, taggedNetworks: [] }));
    }
  }, [activeTab]);

  // Load API health when API tab is active
  useEffect(() => {
    if (activeTab === 'api') {
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setApiHealth({ status: 'Online', version: data.version || '1.0.0' }))
        .catch(() => setApiHealth({ status: 'Offline', version: 'N/A' }));
    }
  }, [activeTab]);

  const saveMapboxToken = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/mapbox-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mapboxToken }),
      });
      alert(response.ok ? 'Mapbox token saved!' : 'Failed to save token');
    } catch {
      alert('Error saving token');
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
      alert(response.ok ? 'Home location saved!' : 'Failed to save location');
    } catch {
      alert('Error saving location');
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
      setImportStatus('Uploading...');
      const response = await fetch('/api/admin/import-sqlite', { method: 'POST', body: formData });
      const result = await response.json();
      setImportStatus(
        response.ok
          ? `Imported ${result.imported || 0} networks`
          : `Failed: ${result.error || 'Unknown error'}`
      );
    } catch {
      setImportStatus('Import failed: Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const trainModel = async () => {
    setMlLoading(true);
    setMlResult(null);
    try {
      const res = await fetch('/api/ml/train', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setMlResult({
          type: 'success',
          message: `Model trained successfully! ${data.trainingSamples} samples (${data.threatCount} threats, ${data.safeCount} safe)`,
        });
        fetch('/api/ml/status')
          .then((r) => r.json())
          .then(setMlStatus);
      } else {
        setMlResult({
          type: 'error',
          message: data.error || `HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (err) {
      setMlResult({ type: 'error', message: `Network error: ${err.message}` });
    } finally {
      setMlLoading(false);
    }
  };

  const runApiRequest = async () => {
    setApiError('');
    setApiResult(null);
    setApiLoading(true);
    const start = performance.now();
    try {
      const opts: RequestInit = { method };
      if (method !== 'GET' && method !== 'DELETE' && body.trim()) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = body;
      }
      const res = await fetch(endpoint, opts);
      const text = await res.text();
      setApiResult({
        ok: res.ok,
        status: res.status,
        durationMs: Math.round(performance.now() - start),
        body: text,
      });
    } catch (err: any) {
      setApiError(err?.message || 'Request failed');
    } finally {
      setApiLoading(false);
    }
  };

  const tabs = [
    { id: 'config', label: 'Configuration', icon: SettingsIcon },
    { id: 'api', label: 'API Testing', icon: ApiIcon },
    { id: 'ml', label: 'ML Training', icon: BrainIcon },
    { id: 'imports', label: 'Data Import', icon: UploadIcon },
    { id: 'exports', label: 'Data Export', icon: DownloadIcon },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Ambient gradient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Centered Container */}
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl mb-4">
            <SettingsIcon size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-slate-400">System configuration and data management</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 bg-slate-800/30 p-2 rounded-xl border border-slate-700/50 max-w-3xl mx-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card
              icon={DatabaseIcon}
              title="Mapbox Configuration"
              color="from-blue-500 to-blue-600"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Mapbox Token
                  </label>
                  <input
                    type="text"
                    value={mapboxToken}
                    onChange={(e) => setMapboxToken(e.target.value)}
                    placeholder="pk.eyJ1..."
                    className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
                <button
                  onClick={saveMapboxToken}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-blue-600 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Token'}
                </button>
              </div>
            </Card>

            <Card icon={ShieldIcon} title="Home Location" color="from-green-500 to-green-600">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Latitude
                    </label>
                    <input
                      type="number"
                      value={homeLocation.lat}
                      onChange={(e) => setHomeLocation({ ...homeLocation, lat: e.target.value })}
                      placeholder="39.1031"
                      className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Longitude
                    </label>
                    <input
                      type="number"
                      value={homeLocation.lng}
                      onChange={(e) => setHomeLocation({ ...homeLocation, lng: e.target.value })}
                      placeholder="-84.5120"
                      className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                    />
                  </div>
                </div>
                <button
                  onClick={saveHomeLocation}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-semibold hover:from-green-500 hover:to-green-600 transition-all disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Location'}
                </button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* API Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card icon={DatabaseIcon} title="API Status" color="from-cyan-500 to-cyan-600">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-300 text-sm">Status:</span>
                    <span
                      className={`text-sm font-semibold ${apiHealth?.status === 'Online' ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {apiHealth?.status || 'Checking...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300 text-sm">Version:</span>
                    <span className="text-sm font-semibold text-blue-400">
                      {apiHealth?.version || 'N/A'}
                    </span>
                  </div>
                </div>
              </Card>
              <div className="md:col-span-2">
                <Card icon={ApiIcon} title="Quick Presets" color="from-blue-500 to-blue-600">
                  <div className="flex flex-wrap gap-2">
                    {API_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          setEndpoint(preset.path);
                          setMethod(preset.method);
                          setBody('');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:border-blue-500 text-xs text-white transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {/* Request/Response */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card icon={UploadIcon} title="Request" color="from-purple-500 to-purple-600">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Endpoint</label>
                    <input
                      type="text"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Method</label>
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as HttpMethod)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Body (JSON)</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={4}
                      placeholder='{"key":"value"}'
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={runApiRequest}
                    disabled={apiLoading}
                    className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-500 hover:to-blue-600 disabled:opacity-50"
                  >
                    {apiLoading ? 'Sending...' : 'Send Request'}
                  </button>
                  {apiError && <div className="text-red-400 text-sm">{apiError}</div>}
                </div>
              </Card>

              <Card icon={DownloadIcon} title="Response" color="from-emerald-500 to-emerald-600">
                <div className="space-y-3">
                  <div className="flex gap-4 text-sm text-slate-300 pb-2 border-b border-slate-700">
                    <span>
                      Status:{' '}
                      <strong className={apiResult?.ok ? 'text-green-400' : 'text-red-400'}>
                        {apiResult?.status || '—'}
                      </strong>
                    </span>
                    <span>
                      Duration:{' '}
                      <strong className="text-blue-400">
                        {apiResult ? `${apiResult.durationMs} ms` : '—'}
                      </strong>
                    </span>
                  </div>
                  <pre className="text-xs text-slate-200 whitespace-pre-wrap break-all max-h-[200px] overflow-auto bg-slate-800/50 p-3 rounded-lg">
                    {apiResult?.body || 'No response yet.'}
                  </pre>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'ml' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card icon={BrainIcon} title="Train Model" color="from-pink-500 to-pink-600">
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Train machine learning model for threat detection
                </p>
                <button
                  onClick={trainModel}
                  disabled={mlLoading}
                  className="w-full p-3 rounded-lg bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-500 hover:to-pink-600 disabled:opacity-50 text-white font-medium"
                >
                  {mlLoading ? '🔄 Training...' : '🧠 Train Model'}
                </button>
                {mlResult && (
                  <div
                    className={`p-3 rounded-lg text-sm ${mlResult.type === 'success' ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}
                  >
                    {mlResult.message}
                  </div>
                )}
                <div className="text-xs text-slate-500 space-y-1">
                  <p>• Requires 10+ tagged networks</p>
                  <p>• Uses logistic regression</p>
                  <p>• Training takes 5-30 seconds</p>
                </div>
              </div>
            </Card>

            <Card icon={BarChartIcon} title="Training Data" color="from-purple-500 to-purple-600">
              <div className="space-y-3">
                {mlStatus?.taggedNetworks?.length > 0 ? (
                  <>
                    {mlStatus.taggedNetworks.map((tag: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-2 bg-slate-800/50 rounded-lg"
                      >
                        <span className="text-sm text-white capitalize">
                          {tag.tag_type.replace('_', ' ')}
                        </span>
                        <span className="text-sm font-medium text-blue-400">{tag.count}</span>
                      </div>
                    ))}
                    <div className="p-2 bg-slate-700/50 rounded-lg">
                      <span className="text-xs text-slate-300">
                        Total:{' '}
                        {mlStatus.taggedNetworks.reduce((s: number, t: any) => s + t.count, 0)}{' '}
                        tagged
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-slate-500 py-6">
                    <p className="text-sm">No tagged networks</p>
                    <p className="text-xs mt-1">Tag networks to enable training</p>
                  </div>
                )}
              </div>
            </Card>

            <Card icon={TargetIcon} title="Model Status" color="from-cyan-500 to-cyan-600">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-300">Status:</span>
                  <span
                    className={`text-sm font-medium ${mlStatus?.modelTrained ? 'text-green-400' : 'text-yellow-400'}`}
                  >
                    {mlStatus?.modelTrained ? 'Trained' : 'Not Trained'}
                  </span>
                </div>
                {mlStatus?.modelInfo?.updated_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-300">Updated:</span>
                    <span className="text-sm text-slate-400">
                      {new Date(mlStatus.modelInfo.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-slate-300">Algorithm:</span>
                  <span className="text-sm text-slate-400">Logistic Regression</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-300">Features:</span>
                  <span className="text-sm text-slate-400">7 behavioral</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'imports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card icon={UploadIcon} title="SQLite Import" color="from-orange-500 to-orange-600">
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Import networks from SQLite database files</p>
                <input
                  id="sqlite-upload"
                  type="file"
                  accept=".sqlite,.db,.sqlite3"
                  onChange={handleFileImport}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-orange-600 file:text-white hover:file:bg-orange-700 text-sm"
                />
                {importStatus && (
                  <div
                    className={`p-3 rounded-lg text-sm ${importStatus.includes('Imported') ? 'bg-green-900/50 text-green-300 border border-green-700' : 'bg-red-900/50 text-red-300 border border-red-700'}`}
                  >
                    {importStatus}
                  </div>
                )}
              </div>
            </Card>

            <Card icon={UploadIcon} title="CSV Import" color="from-green-500 to-green-600">
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Import networks from CSV files</p>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-green-600 file:text-white hover:file:bg-green-700 text-sm"
                />
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'exports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card icon={DownloadIcon} title="Network Exports" color="from-blue-500 to-blue-600">
              <div className="space-y-3">
                <button
                  onClick={() => window.open('/api/export/csv', '_blank')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-500 hover:to-blue-600 transition-all"
                >
                  Export Networks (CSV)
                </button>
                <button
                  onClick={() => window.open('/api/export/json', '_blank')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-medium hover:from-red-500 hover:to-red-600 transition-all"
                >
                  Export Data (JSON)
                </button>
              </div>
            </Card>

            <Card icon={DownloadIcon} title="Geospatial Export" color="from-green-500 to-green-600">
              <div className="space-y-3">
                <button
                  onClick={() => window.open('/api/export/geojson', '_blank')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-500 hover:to-green-600 transition-all"
                >
                  Export GeoJSON
                </button>
                <p className="text-sm text-slate-400">
                  Export observation data in GeoJSON format for GIS tools
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
