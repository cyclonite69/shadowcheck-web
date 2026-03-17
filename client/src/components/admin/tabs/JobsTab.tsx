import React, { useEffect, useState } from 'react';
import { AdminCard } from '../components/AdminCard';
import { apiClient } from '../../../api/client';

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
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const RefreshIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

interface JobConfig {
  enabled: boolean;
  cron: string;
  [key: string]: any;
}

export const JobsTab: React.FC = () => {
  const [configs, setConfigs] = useState<Record<string, JobConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConfigs = async () => {
    try {
      const response = await apiClient.get('/admin/settings');
      if (response.data?.success) {
        const settings = response.data.settings;
        setConfigs({
          backup: settings.backup_job_config?.value || { enabled: false, cron: '0 3 * * *' },
          mlScoring: settings.ml_scoring_job_config?.value || {
            enabled: true,
            cron: '0 */4 * * *',
          },
          mvRefresh: settings.mv_refresh_job_config?.value || { enabled: true, cron: '30 4 * * *' },
        });
      }
    } catch (err) {
      console.error('Failed to fetch job configs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleUpdate = async (key: string, jobKey: string) => {
    setSaving(key);
    try {
      const settingKey = `${key}_job_config`;
      await apiClient.put(`/admin/settings/${settingKey}`, { value: configs[key] });
      alert(`${key.charAt(0).toUpperCase() + key.slice(1)} job updated successfully.`);
    } catch (err: any) {
      alert(`Failed to update job: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const updateLocalConfig = (key: string, field: string, value: any) => {
    setConfigs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  if (loading) {
    return <div className="text-slate-400 p-8 text-center">Loading job configurations...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Backup Job */}
      <AdminCard icon={ClockIcon} title="Automated Backups" color="from-emerald-500 to-emerald-600">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <span className="text-sm font-medium text-slate-200">Enable Schedule</span>
            <button
              onClick={() => updateLocalConfig('backup', 'enabled', !configs.backup.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configs.backup.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configs.backup.enabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cron Schedule
            </label>
            <input
              type="text"
              value={configs.backup.cron}
              onChange={(e) => updateLocalConfig('backup', 'cron', e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              placeholder="0 3 * * *"
            />
            <p className="text-[10px] text-slate-500 italic">Default: 3:00 AM daily (0 3 * * *)</p>
          </div>

          <button
            onClick={() => handleUpdate('backup', 'backup_job_config')}
            disabled={saving === 'backup'}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving === 'backup' ? 'Saving...' : 'Save Backup Config'}
          </button>
        </div>
      </AdminCard>

      {/* ML Scoring Job */}
      <AdminCard icon={ActivityIcon} title="Behavioral Scoring" color="from-blue-500 to-blue-600">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <span className="text-sm font-medium text-slate-200">Enable ML Scoring</span>
            <button
              onClick={() => updateLocalConfig('mlScoring', 'enabled', !configs.mlScoring.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configs.mlScoring.enabled ? 'bg-blue-500' : 'bg-slate-700'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configs.mlScoring.enabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cron Schedule
            </label>
            <input
              type="text"
              value={configs.mlScoring.cron}
              onChange={(e) => updateLocalConfig('mlScoring', 'cron', e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder="0 */4 * * *"
            />
            <p className="text-[10px] text-slate-500 italic">
              Default: Every 4 hours (0 */4 * * *)
            </p>
          </div>

          <button
            onClick={() => handleUpdate('mlScoring', 'ml_scoring_job_config')}
            disabled={saving === 'mlScoring'}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving === 'mlScoring' ? 'Saving...' : 'Save Scoring Config'}
          </button>
        </div>
      </AdminCard>

      {/* MV Refresh Job */}
      <AdminCard icon={RefreshIcon} title="View Refreshes" color="from-purple-500 to-purple-600">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/50">
            <span className="text-sm font-medium text-slate-200">Enable Refresh</span>
            <button
              onClick={() => updateLocalConfig('mvRefresh', 'enabled', !configs.mvRefresh.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${configs.mvRefresh.enabled ? 'bg-purple-500' : 'bg-slate-700'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${configs.mvRefresh.enabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cron Schedule
            </label>
            <input
              type="text"
              value={configs.mvRefresh.cron}
              onChange={(e) => updateLocalConfig('mvRefresh', 'cron', e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              placeholder="30 4 * * *"
            />
            <p className="text-[10px] text-slate-500 italic">Default: 4:30 AM daily (30 4 * * *)</p>
          </div>

          <button
            onClick={() => handleUpdate('mvRefresh', 'mv_refresh_job_config')}
            disabled={saving === 'mvRefresh'}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving === 'mvRefresh' ? 'Saving...' : 'Save Refresh Config'}
          </button>
        </div>
      </AdminCard>
    </div>
  );
};
