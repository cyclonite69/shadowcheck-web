import React, { useState, useEffect } from 'react';
import { logError } from '../logging/clientLogger';

// SVG Icons
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

const KeyIcon = ({ size = 24, className = '' }) => (
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

const HomeIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
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
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82 2 2 0 1 1-3.34 0 1.65 1.65 0 0 0-.33-1.82 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33 2 2 0 1 1 0-3.34 1.65 1.65 0 0 0 1.82-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82 2 2 0 1 1 3.34 0 1.65 1.65 0 0 0 .33 1.82 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.4.3.7.7.9 1.2.2.5.3 1 .3 1.8 0 .8-.1 1.3-.3 1.8-.2.5-.5.9-.9 1.2z" />
  </svg>
);

const ActivityIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 12 7 12 10 5 13 19 16 12 21 12" />
  </svg>
);

const BellIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ClipboardIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="9" y="2" width="6" height="4" rx="1" />
    <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
    <path d="M8 11h8M8 15h6" />
  </svg>
);

const MapIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 20l-5 2V6l5-2 6 2 5-2v16l-5 2-6-2z" />
    <path d="M9 4v16M15 6v16" />
  </svg>
);

const ChevronDownIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const iconTones = {
  primary: {
    text: 'text-blue-200',
    gradient: 'from-blue-500 to-blue-600',
    glow: 'shadow-blue-500/30',
  },
  success: {
    text: 'text-emerald-200',
    gradient: 'from-emerald-500 to-green-600',
    glow: 'shadow-emerald-500/30',
  },
  warning: {
    text: 'text-amber-200',
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/30',
  },
  danger: {
    text: 'text-red-200',
    gradient: 'from-red-500 to-red-600',
    glow: 'shadow-red-500/30',
  },
  info: {
    text: 'text-cyan-200',
    gradient: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/30',
  },
  secondary: {
    text: 'text-purple-200',
    gradient: 'from-purple-500 to-purple-600',
    glow: 'shadow-purple-500/30',
  },
  neutral: {
    text: 'text-slate-200',
    gradient: 'from-slate-500 to-slate-600',
    glow: 'shadow-slate-500/30',
  },
  special: {
    text: 'text-orange-200',
    gradient: 'from-orange-500 to-red-600',
    glow: 'shadow-orange-500/30',
  },
} as const;

type IconTone = keyof typeof iconTones;

const MemoryIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="4" y="6" width="16" height="12" rx="2" />
    <path d="M7 10h2M7 14h2M11 10h2M11 14h2M15 10h2M15 14h2" />
  </svg>
);

// Consistent Button Component
const ActionButton = ({
  onClick,
  disabled = false,
  variant = 'primary',
  children,
  fullWidth = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success' | 'danger';
  children: React.ReactNode;
  fullWidth?: boolean;
}) => {
  const baseStyles = `
    px-6 py-3 rounded-lg font-semibold text-base
    transition-all duration-200 ease-out
    border-2 shadow-lg
    flex items-center justify-center gap-2
    ${fullWidth ? 'w-full' : ''}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'}
  `;

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white shadow-blue-500/25',
    secondary: 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-white shadow-slate-500/25',
    success:
      'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/25',
    danger: 'bg-red-600 hover:bg-red-500 border-red-500 text-white shadow-red-500/25',
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyles} ${variants[variant]}`}>
      {children}
    </button>
  );
};

// Form Input Component
const FormInput = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-slate-300 uppercase tracking-wide">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-3 rounded-lg bg-slate-800/80 border-2 border-slate-600
                 text-white text-base placeholder-slate-500
                 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                 transition-all duration-200"
    />
  </div>
);

// Card Component
const AdminCard = ({
  title,
  icon: Icon,
  tone = 'info',
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: IconTone;
  children: React.ReactNode;
}) => {
  const toneStyles = iconTones[tone];
  return (
    <div className="premium-card p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`icon-container w-12 h-12 bg-gradient-to-br ${toneStyles.gradient} shadow-lg ${toneStyles.glow}`}
        >
          <Icon size={26} className={toneStyles.text} />
        </div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      </div>
      {children}
    </div>
  );
};

const AdminStatCard = ({
  label,
  value,
  icon: Icon,
  tone = 'info',
  status,
  statusTone = 'neutral',
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: IconTone;
  status?: string;
  statusTone?: 'success' | 'warning' | 'danger' | 'neutral';
}) => {
  const toneStyles = iconTones[tone];
  return (
    <div className="premium-card admin-summary-card">
      <div>
        <div className="admin-summary-label">{label}</div>
        <div className="admin-summary-value">{value}</div>
        {status ? <div className={`admin-status admin-status--${statusTone}`}>{status}</div> : null}
      </div>
      <div
        className={`icon-container admin-stat-icon bg-gradient-to-br ${toneStyles.gradient} shadow-lg ${toneStyles.glow}`}
      >
        <Icon size={20} className={toneStyles.text} />
      </div>
    </div>
  );
};

const adminTabs = [
  { id: 'system', label: 'System', icon: ShieldIcon, tone: 'info' },
  { id: 'pipelines', label: 'Pipelines', icon: UploadIcon, tone: 'warning' },
  { id: 'api', label: 'API', icon: ActivityIcon, tone: 'success' },
  { id: 'database', label: 'Database', icon: DatabaseIcon, tone: 'primary' },
  { id: 'monitoring', label: 'Monitoring', icon: MemoryIcon, tone: 'secondary' },
  { id: 'logs', label: 'Logs', icon: ClipboardIcon, tone: 'neutral' },
  { id: 'alerts', label: 'Alerts', icon: BellIcon, tone: 'danger' },
  { id: 'map', label: 'Map', icon: MapIcon, tone: 'special' },
  { id: 'configuration', label: 'Configuration', icon: SettingsIcon, tone: 'primary' },
  { id: 'imports', label: 'Imports', icon: UploadIcon, tone: 'warning' },
  { id: 'exports', label: 'Exports', icon: DownloadIcon, tone: 'success' },
] as const;

type AdminTabId = (typeof adminTabs)[number]['id'];

const AdminPage: React.FC = () => {
  const [mapboxToken, setMapboxToken] = useState('');
  const [homeLocation, setHomeLocation] = useState({ lat: '', lng: '' });
  const [homeRadius, setHomeRadius] = useState(100);
  const [importStatus, setImportStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wigleToken, setWigleToken] = useState('');
  const [wigleApiName, setWigleApiName] = useState('');
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabId>('system');

  useEffect(() => {
    loadSettings();
    loadHealth();
    const interval = setInterval(loadHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const tokenResponse = await fetch('/api/mapbox-token');
      const tokenData = await tokenResponse.json();
      if (tokenData.token && tokenData.token !== 'your-mapbox-token-here') {
        setMapboxToken(tokenData.token);
      }

      try {
        const homeResponse = await fetch('/api/home-location');
        if (homeResponse.ok) {
          const homeData = await homeResponse.json();
          setHomeLocation({
            lat: homeData.latitude?.toString() || '',
            lng: homeData.longitude?.toString() || '',
          });
          setHomeRadius(homeData.radius || 100);
        }
      } catch (error) {
        console.error('Failed to load home location:', error);
      }
    } catch (error) {
      logError('Failed to load settings', error);
    }
  };

  const loadHealth = async () => {
    try {
      setHealthError(null);
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Health check failed (${response.status})`);
      }
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      setHealthError(error?.message || 'Unable to load health status');
      logError('Failed to load health status', error);
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
      alert(response.ok ? 'Mapbox token saved!' : 'Failed to save token');
    } catch {
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
          radius: homeRadius,
        }),
      });
      const result = await response.json();
      alert(
        response.ok
          ? `Saved: ${homeLocation.lat}, ${homeLocation.lng} (${homeRadius}m radius)`
          : `Error: ${result.error}`
      );
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveWigleCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/wigle-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiName: wigleApiName, apiToken: wigleToken }),
      });
      alert(response.ok ? 'WiGLE credentials saved!' : 'Failed to save credentials');
    } catch {
      alert('Error saving WiGLE credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const testWigleConnection = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/wigle/test');
      const data = await response.json();
      alert(response.ok ? `Connected! User: ${data.user || 'OK'}` : 'Connection failed');
    } catch {
      alert('Connection test failed');
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
      const response = await fetch('/api/admin/import-sqlite', {
        method: 'POST',
        body: formData,
      });
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

  const importWigleJson = async () => {
    try {
      setIsLoading(true);
      setImportStatus('Importing...');
      const response = await fetch('/api/import/wigle', { method: 'POST' });
      const result = await response.json();
      setImportStatus(
        result.success ? `Imported ${result.totalImported} networks` : `Error: ${result.error}`
      );
    } catch (error) {
      setImportStatus(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const heapUsedDisplay = healthStatus?.checks?.memory?.heap_used_mb;
  const heapMaxDisplay = healthStatus?.checks?.memory?.heap_max_mb;
  const heapUsed = heapUsedDisplay ?? 0;
  const heapMax = heapMaxDisplay ?? 0;
  const heapPercent =
    healthStatus?.checks?.memory?.percent ?? (heapMax ? Math.round((heapUsed / heapMax) * 100) : 0);
  const apiStatusValue =
    healthStatus?.status === 'ok' ? 'Online' : healthError ? 'Offline' : 'Unknown';
  const databaseStatusValue =
    healthStatus?.checks?.database?.status === 'ok'
      ? 'Connected'
      : healthStatus
        ? 'Disconnected'
        : 'Unknown';
  const postgisEnabled = healthStatus?.checks?.database?.postgis_enabled;
  const postgisValue =
    typeof postgisEnabled === 'boolean' ? (postgisEnabled ? 'Yes' : 'No') : 'Unknown';

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="admin-shell admin-header">
        <div className="icon-container w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30">
          <ShieldIcon size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-100">System Administration</h1>
          <p className="text-sm text-slate-400 cyber-text tracking-wide mt-1">
            Configuration, imports, and operational status
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-shell">
        <div className="premium-card p-2 mb-6">
          <div className="admin-tabs">
            {adminTabs.map(({ id, label, icon: Icon, tone }) => {
              const toneStyles = iconTones[tone as IconTone];
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as typeof activeTab)}
                  className={`admin-tab ${activeTab === id ? 'admin-tab--active' : ''}`}
                >
                  <Icon size={18} className={toneStyles.text} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-8">
          {activeTab === 'system' && (
            <div className="space-y-8">
              <div className="admin-summary-grid">
                <AdminStatCard
                  label="API Health"
                  value={apiStatusValue}
                  status={healthError ? 'No response' : 'Operational'}
                  statusTone={healthError ? 'danger' : 'success'}
                  icon={ActivityIcon}
                  tone={healthError ? 'danger' : 'success'}
                />
                <AdminStatCard
                  label="Database Status"
                  value={databaseStatusValue}
                  status={
                    healthStatus?.checks?.database?.latency_ms
                      ? `${healthStatus.checks.database.latency_ms} ms`
                      : 'Latency unknown'
                  }
                  statusTone={
                    healthStatus?.checks?.database?.status === 'ok' ? 'success' : 'warning'
                  }
                  icon={DatabaseIcon}
                  tone="info"
                />
                <AdminStatCard
                  label="Memory Usage"
                  value={heapUsedDisplay ? `${heapUsedDisplay} MB` : '—'}
                  status={heapMaxDisplay ? `${heapPercent}% used` : 'Awaiting data'}
                  statusTone={heapPercent >= 80 ? 'warning' : 'neutral'}
                  icon={MemoryIcon}
                  tone="secondary"
                />
                <AdminStatCard
                  label="PostGIS Enabled"
                  value={postgisValue}
                  status={
                    postgisValue === 'Yes' ? 'Spatial indexing active' : 'Spatial layer offline'
                  }
                  statusTone={postgisValue === 'Yes' ? 'success' : 'warning'}
                  icon={MapIcon}
                  tone="special"
                />
              </div>

              <div className="admin-grid">
                <AdminCard title="Database Connection" icon={DatabaseIcon} tone="info">
                  <p className="text-slate-400 text-base mb-6">
                    Live database connectivity and latency
                  </p>
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Status</span>
                      <span
                        className={`text-sm font-semibold ${
                          healthStatus?.checks?.database?.status === 'ok'
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}
                      >
                        {healthStatus?.checks?.database?.status === 'ok'
                          ? 'Connected'
                          : 'Disconnected'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Latency</span>
                      <span className="text-sm font-mono text-slate-200">
                        {healthStatus?.checks?.database?.latency_ms ?? '—'} ms
                      </span>
                    </div>
                    {healthError && (
                      <div className="p-3 rounded-lg bg-red-900/50 text-red-300 border-2 border-red-700">
                        {healthError}
                      </div>
                    )}
                  </div>
                </AdminCard>

                <AdminCard title="Memory Usage" icon={MemoryIcon} tone="secondary">
                  <p className="text-slate-400 text-base mb-6">
                    Runtime heap usage from health checks
                  </p>
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Heap Used</span>
                      <span className="text-sm font-mono text-slate-200">
                        {heapUsedDisplay ?? '—'} MB
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Heap Max</span>
                      <span className="text-sm font-mono text-slate-200">
                        {heapMaxDisplay ?? '—'} MB
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Usage</span>
                        <span className="text-slate-300">{heapPercent}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                        <div
                          className={`h-full ${
                            heapPercent >= 80
                              ? 'bg-gradient-to-r from-red-500 to-orange-500'
                              : 'bg-gradient-to-r from-blue-500 to-emerald-500'
                          }`}
                          style={{ width: `${heapPercent}%` }}
                        />
                      </div>
                      {healthStatus?.checks?.memory?.status === 'warning' && (
                        <div className="text-xs text-amber-400">
                          Memory usage is elevated; consider investigating.
                        </div>
                      )}
                    </div>
                  </div>
                </AdminCard>

                <div className="premium-card admin-wide-card">
                  <div className="admin-wide-header">
                    <div className="admin-wide-title">
                      <div className="icon-container admin-stat-icon bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                        <SettingsIcon size={20} className="text-amber-100" />
                      </div>
                      <span className="text-slate-100 font-semibold">API Endpoint Status</span>
                    </div>
                    <ChevronDownIcon size={20} className="text-slate-400" />
                  </div>
                  <div className="admin-wide-body">
                    <div className="admin-wide-row">
                      <span className="text-slate-400">Health endpoint</span>
                      <span
                        className={`text-sm font-semibold ${healthError ? 'text-red-400' : 'text-emerald-400'}`}
                      >
                        {healthError ? 'Degraded' : 'Operational'}
                      </span>
                    </div>
                    <div className="admin-wide-row">
                      <span className="text-slate-400">Last check</span>
                      <span className="text-sm text-slate-300">
                        {healthStatus?.timestamp
                          ? new Date(healthStatus.timestamp).toLocaleTimeString()
                          : 'Just now'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'configuration' && (
            <div className="admin-grid">
              <AdminCard title="Mapbox Configuration" icon={KeyIcon} tone="primary">
                <p className="text-slate-400 text-base mb-6">
                  Configure Mapbox access token for maps
                </p>
                <div className="space-y-6 flex-1">
                  <FormInput
                    label="Access Token"
                    type="password"
                    value={mapboxToken}
                    onChange={setMapboxToken}
                    placeholder="pk.eyJ1..."
                  />
                </div>
                <div className="mt-6">
                  <ActionButton
                    onClick={saveMapboxToken}
                    disabled={isLoading || !mapboxToken}
                    variant="success"
                    fullWidth
                  >
                    Save Token
                  </ActionButton>
                </div>
              </AdminCard>

              <AdminCard title="Home Location" icon={HomeIcon} tone="success">
                <p className="text-slate-400 text-base mb-6">
                  Set home coordinates for threat detection
                </p>
                <div className="space-y-5 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <FormInput
                      label="Latitude"
                      type="number"
                      value={homeLocation.lat}
                      onChange={(val) => setHomeLocation((prev) => ({ ...prev, lat: val }))}
                      placeholder="43.0234"
                    />
                    <FormInput
                      label="Longitude"
                      type="number"
                      value={homeLocation.lng}
                      onChange={(val) => setHomeLocation((prev) => ({ ...prev, lng: val }))}
                      placeholder="-83.6968"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Detection Radius
                    </label>
                    <div className="bg-slate-800/80 rounded-xl p-4 border-2 border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-2xl font-bold text-white">{homeRadius}m</span>
                        <span className="text-sm text-slate-400">
                          {homeRadius < 200 ? 'Small' : homeRadius < 500 ? 'Medium' : 'Large'} area
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="1000"
                        step="50"
                        value={homeRadius}
                        onChange={(e) => setHomeRadius(parseInt(e.target.value))}
                        className="w-full h-3 rounded-full appearance-none cursor-pointer
                                   bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500"
                        style={{
                          background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((homeRadius - 50) / 950) * 100}%, #334155 ${((homeRadius - 50) / 950) * 100}%, #334155 100%)`,
                        }}
                      />
                      <div className="flex justify-between mt-2 text-sm text-slate-500">
                        <span>50m</span>
                        <span>500m</span>
                        <span>1000m</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <ActionButton
                    onClick={saveHomeLocation}
                    disabled={isLoading || !homeLocation.lat || !homeLocation.lng}
                    variant="success"
                    fullWidth
                  >
                    Save Location
                  </ActionButton>
                </div>
              </AdminCard>

              <AdminCard title="WiGLE API" icon={KeyIcon} tone="warning">
                <p className="text-slate-400 text-base mb-6">Configure WiGLE API credentials</p>
                <div className="space-y-4 flex-1">
                  <FormInput
                    label="API Name"
                    value={wigleApiName}
                    onChange={setWigleApiName}
                    placeholder="AIDxxxxxxxx"
                  />
                  <FormInput
                    label="API Token"
                    type="password"
                    value={wigleToken}
                    onChange={setWigleToken}
                    placeholder="Your API token"
                  />
                </div>
                <div className="mt-6 flex gap-3">
                  <ActionButton
                    onClick={saveWigleCredentials}
                    disabled={isLoading || !wigleApiName || !wigleToken}
                    variant="success"
                  >
                    Save
                  </ActionButton>
                  <ActionButton
                    onClick={testWigleConnection}
                    disabled={isLoading}
                    variant="secondary"
                  >
                    Test Connection
                  </ActionButton>
                </div>
              </AdminCard>
            </div>
          )}

          {activeTab === 'pipelines' && (
            <div className="admin-grid">
              <AdminCard title="Pipeline Status" icon={UploadIcon} tone="warning">
                <p className="text-slate-400 text-base">
                  Pipeline controls will appear here once ingestion jobs are configured.
                </p>
              </AdminCard>
              <AdminCard title="Recent Imports" icon={DatabaseIcon} tone="info">
                <p className="text-slate-400 text-base">
                  Import history and schedules are not yet available.
                </p>
              </AdminCard>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="admin-grid">
              <AdminCard title="API Overview" icon={ActivityIcon} tone="success">
                <p className="text-slate-400 text-base">
                  Live endpoint analytics will surface once API telemetry is enabled.
                </p>
              </AdminCard>
              <AdminCard title="Rate Limits" icon={SettingsIcon} tone="primary">
                <p className="text-slate-400 text-base">
                  Configure service policies after telemetry ingestion is configured.
                </p>
              </AdminCard>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="admin-grid">
              <AdminCard title="Database Overview" icon={DatabaseIcon} tone="info">
                <p className="text-slate-400 text-base">
                  Database diagnostics and maintenance tools appear here.
                </p>
              </AdminCard>
              <AdminCard title="Storage Health" icon={MemoryIcon} tone="secondary">
                <p className="text-slate-400 text-base">
                  Storage metrics will populate once scheduled checks are enabled.
                </p>
              </AdminCard>
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="admin-grid">
              <AdminCard title="Monitoring Signals" icon={MemoryIcon} tone="secondary">
                <p className="text-slate-400 text-base">
                  Configure health monitors and alert thresholds here.
                </p>
              </AdminCard>
              <AdminCard title="Uptime" icon={ShieldIcon} tone="success">
                <p className="text-slate-400 text-base">
                  Uptime history will appear once monitoring is configured.
                </p>
              </AdminCard>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="admin-grid">
              <AdminCard title="System Logs" icon={ClipboardIcon} tone="neutral">
                <p className="text-slate-400 text-base">
                  Logs will populate as services stream diagnostics.
                </p>
              </AdminCard>
              <AdminCard title="Audit Trails" icon={ShieldIcon} tone="info">
                <p className="text-slate-400 text-base">
                  Audit trails are pending initial configuration.
                </p>
              </AdminCard>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="admin-grid">
              <AdminCard title="Alert Rules" icon={BellIcon} tone="danger">
                <p className="text-slate-400 text-base">
                  Create alert policies once monitoring rules are defined.
                </p>
              </AdminCard>
              <AdminCard title="Recent Alerts" icon={BellIcon} tone="warning">
                <p className="text-slate-400 text-base">No alerts have fired yet.</p>
              </AdminCard>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="admin-grid">
              <AdminCard title="Map Services" icon={MapIcon} tone="special">
                <p className="text-slate-400 text-base">
                  Map overlays and geospatial layers will appear here.
                </p>
              </AdminCard>
              <AdminCard title="Tile Cache" icon={DatabaseIcon} tone="info">
                <p className="text-slate-400 text-base">
                  Tile cache status will populate after map services are enabled.
                </p>
              </AdminCard>
            </div>
          )}

          {activeTab === 'imports' && (
            <div className="admin-grid">
              <AdminCard title="SQLite Import" icon={DatabaseIcon} tone="info">
                <p className="text-slate-400 text-base mb-6">Import WiGLE SQLite database files</p>
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Select Database File
                    </label>
                    <input
                      type="file"
                      accept=".sqlite,.db,.sqlite3"
                      onChange={handleFileImport}
                      disabled={isLoading}
                      className="w-full px-4 py-3 rounded-lg bg-slate-800/80 border-2 border-slate-600
                                 text-white text-base file:mr-4 file:py-2 file:px-4 file:rounded-lg
                                 file:border-0 file:bg-blue-600 file:text-white file:font-semibold
                                 file:cursor-pointer hover:file:bg-blue-500"
                    />
                  </div>
                  {importStatus && (
                    <div
                      className={`p-4 rounded-lg text-base font-medium ${
                        importStatus.includes('Imported')
                          ? 'bg-emerald-900/50 text-emerald-300 border-2 border-emerald-700'
                          : importStatus.includes('failed') || importStatus.includes('Error')
                            ? 'bg-red-900/50 text-red-300 border-2 border-red-700'
                            : 'bg-blue-900/50 text-blue-300 border-2 border-blue-700'
                      }`}
                    >
                      {importStatus}
                    </div>
                  )}
                </div>
              </AdminCard>

              <AdminCard title="WiGLE Import" icon={UploadIcon} tone="warning">
                <p className="text-slate-400 text-base mb-6">Import WiGLE JSON export files</p>
                <div className="space-y-4 flex-1">
                  <div className="bg-slate-800/60 rounded-lg p-4 border-2 border-slate-700">
                    <p className="text-slate-300 text-base">
                      Place JSON files in:{' '}
                      <code className="bg-slate-700 px-2 py-1 rounded text-blue-300">
                        imports/wigle/
                      </code>
                    </p>
                  </div>
                  {importStatus && (
                    <div
                      className={`p-4 rounded-lg text-base font-medium ${
                        importStatus.includes('Imported')
                          ? 'bg-emerald-900/50 text-emerald-300 border-2 border-emerald-700'
                          : 'bg-red-900/50 text-red-300 border-2 border-red-700'
                      }`}
                    >
                      {importStatus}
                    </div>
                  )}
                </div>
                <div className="mt-6">
                  <ActionButton
                    onClick={importWigleJson}
                    disabled={isLoading}
                    variant="primary"
                    fullWidth
                  >
                    {isLoading ? 'Importing...' : 'Import JSON Files'}
                  </ActionButton>
                </div>
              </AdminCard>
            </div>
          )}

          {activeTab === 'exports' && (
            <div className="admin-grid">
              <AdminCard title="Data Export" icon={DownloadIcon} tone="success">
                <p className="text-slate-400 text-base mb-6">Export data and generate reports</p>
                <div className="space-y-4 flex-1">
                  <ActionButton
                    onClick={() => window.open('/api/export/networks/csv', '_blank')}
                    variant="primary"
                    fullWidth
                  >
                    Export Networks (CSV)
                  </ActionButton>
                  <ActionButton
                    onClick={() => window.open('/api/export/threats/json', '_blank')}
                    variant="danger"
                    fullWidth
                  >
                    Export Threats (JSON)
                  </ActionButton>
                  <ActionButton
                    onClick={() => window.open('/api/export/observations/geojson', '_blank')}
                    variant="secondary"
                    fullWidth
                  >
                    Export GeoJSON
                  </ActionButton>
                </div>
              </AdminCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
