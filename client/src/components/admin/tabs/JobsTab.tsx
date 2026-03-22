import React, { useEffect, useState } from 'react';
import { apiClient } from '../../../api/client';
import { DEFAULT_CONFIGS, JOB_SETTING_KEYS, JobConfig, JobKey, JobRuntimeStatus } from './jobTypes';
import { normalizeJobConfig } from './jobUtils';
import { JobCard } from './JobCard';
import { ClockIcon, ActivityIcon, RefreshIcon } from './JobIcons';

const JOB_CARDS = [
  {
    jobKey: 'backup' as const,
    icon: ClockIcon,
    title: 'Automated Backups',
    color: 'from-emerald-500 to-emerald-600',
    accentClass: 'focus:ring-emerald-500/40',
  },
  {
    jobKey: 'mlScoring' as const,
    icon: ActivityIcon,
    title: 'Behavioral Scoring',
    color: 'from-blue-500 to-blue-600',
    accentClass: 'focus:ring-blue-500/40',
  },
  {
    jobKey: 'mvRefresh' as const,
    icon: RefreshIcon,
    title: 'View Refreshes',
    color: 'from-purple-500 to-purple-600',
    accentClass: 'focus:ring-purple-500/40',
  },
];

export const JobsTab: React.FC = () => {
  const [configs, setConfigs] = useState<Record<JobKey, JobConfig>>(DEFAULT_CONFIGS);
  const [jobStatus, setJobStatus] = useState<Partial<Record<JobKey, JobRuntimeStatus>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchJobStatus = async () => {
    try {
      const response = await apiClient.get('/admin/settings/jobs/status');
      if (response?.success) {
        setJobStatus(response.jobs || {});
      }
    } catch (err) {
      console.error('Failed to fetch job status', err);
    }
  };

  const fetchConfigs = async () => {
    try {
      const response = await apiClient.get('/admin/settings');
      if (response?.success) {
        const settings = response.settings;
        const findValue = (key: string) => {
          if (Array.isArray(settings)) return settings.find((s) => s.key === key)?.value;
          return settings[key]?.value || settings[key];
        };
        setConfigs({
          backup: normalizeJobConfig(findValue('backup_job_config'), DEFAULT_CONFIGS.backup),
          mlScoring: normalizeJobConfig(
            findValue('ml_scoring_job_config'),
            DEFAULT_CONFIGS.mlScoring
          ),
          mvRefresh: normalizeJobConfig(
            findValue('mv_refresh_job_config'),
            DEFAULT_CONFIGS.mvRefresh
          ),
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
    fetchJobStatus();
  }, []);

  const handleUpdate = async (key: JobKey) => {
    setSaving(key);
    try {
      const settingKey = JOB_SETTING_KEYS[key];
      const configToSave = configs[key];
      if (!configToSave) throw new Error('Configuration not found');
      await apiClient.put(`/admin/settings/${settingKey}`, { value: configToSave });
      await fetchJobStatus();
      alert(`${key.charAt(0).toUpperCase() + key.slice(1)} job updated successfully.`);
    } catch (err: any) {
      alert(`Failed to update job: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const updateLocalConfig = (key: JobKey, field: string, value: any) => {
    setConfigs((prev) => {
      const current = prev[key] || DEFAULT_CONFIGS[key];
      return {
        ...prev,
        [key]: { ...current, [field]: value },
      };
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const resolvedConfigs = {
    backup: configs.backup || DEFAULT_CONFIGS.backup,
    mlScoring: configs.mlScoring || DEFAULT_CONFIGS.mlScoring,
    mvRefresh: configs.mvRefresh || DEFAULT_CONFIGS.mvRefresh,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {JOB_CARDS.map(({ jobKey, icon, title, color, accentClass }) => (
        <JobCard
          key={jobKey}
          jobKey={jobKey}
          config={resolvedConfigs[jobKey]}
          status={jobStatus[jobKey]}
          icon={icon}
          title={title}
          color={color}
          accentClass={accentClass}
          saving={saving}
          onToggle={() => updateLocalConfig(jobKey, 'enabled', !resolvedConfigs[jobKey].enabled)}
          onUpdate={(field, value) => updateLocalConfig(jobKey, field, value)}
          onSave={() => handleUpdate(jobKey)}
          onRefresh={fetchJobStatus}
        />
      ))}
    </div>
  );
};
