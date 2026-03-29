import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { WigleSearchTab } from './admin/tabs/WigleSearchTab';
import { WigleDetailTab } from './admin/tabs/WigleDetailTab';
import { BackupsTab } from './admin/tabs/BackupsTab';
import { ApiTestingTab } from './admin/tabs/ApiTestingTab';
import { DataImportTab } from './admin/tabs/DataImportTab';
import { DataExportTab } from './admin/tabs/DataExportTab';
import { PgAdminTab } from './admin/tabs/PgAdminTab';
import { GeocodingTab } from './admin/tabs/GeocodingTab';
import { AwsTab } from './admin/tabs/AwsTab';
import { UsersTab } from './admin/tabs/UsersTab';
import { JobsTab } from './admin/tabs/JobsTab';
import { WigleStatsTab } from './admin/tabs/WigleStatsTab';
import { DbStatsTab } from './admin/tabs/DbStatsTab';
import { adminApi } from '../api/adminApi';
import type { AdminRuntimeConfig } from './admin/types/admin.types';

const ConfigurationTab = lazy(() => import('./admin/tabs/ConfigurationTab'));
const MLTrainingTab = lazy(() => import('./admin/tabs/MLTrainingTab'));

const TabLoadingFallback = () => (
  <div className="px-6 py-8 text-sm text-slate-500 text-center">Loading tab...</div>
);

// SVG Icons
const ClockIcon = ({ size = 24, className = '' }) => (
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

const TrophyIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
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

const UsersIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <path d="M20 8v6" />
    <path d="M23 11h-6" />
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
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
    <path d="M9 4v14" />
    <path d="M15 6v14" />
  </svg>
);

const CloudIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.5A4 4 0 0 0 6 19h11.5z" />
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

const SearchIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const DetailIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const AdminPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('config');
  const [runtimeConfig, setRuntimeConfig] = useState<AdminRuntimeConfig | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] w-full">
        <div className="text-center p-12 bg-slate-900/50 rounded-2xl border border-red-500/20 backdrop-blur-sm max-w-md mx-auto">
          <div className="inline-flex items-center justify-center p-4 bg-red-500/10 rounded-full mb-6">
            <ShieldIcon size={48} className="text-red-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Access Denied</h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Administrative privileges are required to access this system. Please contact your system
            administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;
    const loadRuntimeConfig = async () => {
      try {
        const data = await adminApi.getRuntimeConfig();
        if (!cancelled) {
          setRuntimeConfig(data);
        }
      } catch {
        if (!cancelled) {
          setRuntimeConfig(null);
        }
      }
    };
    void loadRuntimeConfig();

    const handleRuntimeConfigChange = (event: Event) => {
      const customEvent = event as CustomEvent<AdminRuntimeConfig>;
      if (!cancelled && customEvent.detail) {
        setRuntimeConfig(customEvent.detail);
      }
    };

    window.addEventListener('admin-runtime-config-changed', handleRuntimeConfigChange);
    return () => {
      cancelled = true;
      window.removeEventListener('admin-runtime-config-changed', handleRuntimeConfigChange);
    };
  }, []);

  const showMlTab =
    runtimeConfig?.featureFlags.adminAllowMlTraining === true ||
    runtimeConfig?.featureFlags.adminAllowMlScoring === true;
  const showPgAdminTab = runtimeConfig?.featureFlags.adminAllowDocker === true;

  const tabs = [
    { id: 'config', label: 'Configuration', icon: SettingsIcon },
    { id: 'jobs', label: 'Automation', icon: ClockIcon },
    { id: 'db-stats', label: 'DB Stats', icon: DatabaseIcon },
    { id: 'wigle-stats', label: 'WiGLE Stats', icon: TrophyIcon },
    { id: 'api', label: 'API Testing', icon: ApiIcon },
    ...(showMlTab ? [{ id: 'ml', label: 'ML Training', icon: BrainIcon }] : []),
    { id: 'wigle', label: 'WiGLE Search (v2)', icon: SearchIcon },
    { id: 'wigle-detail', label: 'WiGLE Detail (v3)', icon: DetailIcon },
    { id: 'imports', label: 'Data Import', icon: UploadIcon },
    { id: 'backups', label: 'Backups', icon: DatabaseIcon },
    { id: 'exports', label: 'Data Export', icon: DownloadIcon },
    { id: 'geocoding', label: 'Geocoding', icon: MapIcon },
    { id: 'aws', label: 'AWS', icon: CloudIcon },
    ...(showPgAdminTab ? [{ id: 'pgadmin', label: 'PgAdmin', icon: DatabaseIcon }] : []),
    { id: 'users', label: 'Users', icon: UsersIcon },
  ];

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('config');
    }
  }, [activeTab, tabs]);
  const tabButtonClass = (tabId: string) =>
    `flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-center font-medium transition-all text-sm ${
      activeTab === tabId
        ? 'bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 text-white shadow-[0_8px_16px_rgba(59,130,246,0.4),0_4px_8px_rgba(147,51,234,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-blue-400/50 translate-y-[-2px] scale-[1.03]'
        : 'text-slate-300 bg-slate-800/50 shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:text-white hover:bg-slate-700/60 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] hover:translate-y-[-1px]'
    }`;

  return (
    <div className="relative w-full h-screen overflow-y-auto bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Fixed background accents */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Centered Container */}
      <div className="relative w-full max-w-7xl mx-auto px-6 py-4">
        {/* Compact Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg shadow-blue-500/20">
            <SettingsIcon size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Admin Panel</h1>
            <p className="text-xs text-slate-400">System configuration and data management</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 rounded-xl border border-slate-700/40 bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={tabButtonClass(tab.id)}
              >
                <tab.icon size={16} />
                <span className="leading-tight">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="pb-8">
          {activeTab === 'config' && (
            <Suspense fallback={<TabLoadingFallback />}>
              <ConfigurationTab />
            </Suspense>
          )}
          {activeTab === 'jobs' && <JobsTab />}
          {activeTab === 'db-stats' && <DbStatsTab />}
          {activeTab === 'wigle-stats' && <WigleStatsTab />}
          {activeTab === 'api' && <ApiTestingTab />}
          {activeTab === 'ml' && (
            <Suspense fallback={<TabLoadingFallback />}>
              <MLTrainingTab />
            </Suspense>
          )}
          {activeTab === 'wigle' && <WigleSearchTab />}
          {activeTab === 'wigle-detail' && <WigleDetailTab />}
          {activeTab === 'imports' && <DataImportTab />}
          {activeTab === 'backups' && <BackupsTab />}
          {activeTab === 'exports' && <DataExportTab />}
          {activeTab === 'geocoding' && <GeocodingTab />}
          {activeTab === 'aws' && <AwsTab />}
          {activeTab === 'pgadmin' && <PgAdminTab />}
          {activeTab === 'users' && <UsersTab />}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
