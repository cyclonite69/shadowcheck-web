import React from 'react';
import { AdminCard } from '../components/AdminCard';
import { JobConfig, JobKey, JobRuntimeStatus } from './jobTypes';
import { JobScheduleEditor } from './JobScheduleEditor';
import { JobRunHistory } from './JobRunHistory';

const TOGGLE_LABELS: Record<JobKey, string> = {
  backup: 'Enable Schedule',
  mlScoring: 'Enable ML Scoring',
  mvRefresh: 'Enable Refresh',
};

const SAVE_LABELS: Record<JobKey, string> = {
  backup: 'Save Backup Config',
  mlScoring: 'Save Scoring Config',
  mvRefresh: 'Save Refresh Config',
};

const TOGGLE_CLASSES: Record<JobKey, string> = {
  backup: 'bg-emerald-500',
  mlScoring: 'bg-blue-500',
  mvRefresh: 'bg-purple-500',
};

const SAVE_CLASSES: Record<JobKey, string> = {
  backup: 'bg-emerald-600 hover:bg-emerald-500',
  mlScoring: 'bg-blue-600 hover:bg-blue-500',
  mvRefresh: 'bg-purple-600 hover:bg-purple-500',
};

export function JobCard({
  jobKey,
  config,
  status,
  icon,
  title,
  color,
  accentClass,
  saving,
  onToggle,
  onUpdate,
  onSave,
  onRefresh,
}: {
  jobKey: JobKey;
  config: JobConfig;
  status: JobRuntimeStatus | undefined;
  icon: React.FC<{ size?: number; className?: string }>;
  title: string;
  color: string;
  accentClass: string;
  saving: string | null;
  onToggle: () => void;
  onUpdate: (field: string, value: any) => void;
  onSave: () => void;
  onRefresh: () => void;
}) {
  return (
    <AdminCard icon={icon} title={title} color={color}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-800/40 p-3">
          <span className="text-sm font-medium text-slate-200">{TOGGLE_LABELS[jobKey]}</span>
          <button
            onClick={onToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? TOGGLE_CLASSES[jobKey] : 'bg-slate-700'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        <JobScheduleEditor
          accentClass={accentClass}
          config={config}
          jobKey={jobKey}
          onUpdate={onUpdate}
        />

        <JobRunHistory status={status} onRefresh={onRefresh} />

        <button
          onClick={onSave}
          disabled={saving === jobKey}
          className={`w-full rounded-lg py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 ${SAVE_CLASSES[jobKey]}`}
        >
          {saving === jobKey ? 'Saving...' : SAVE_LABELS[jobKey]}
        </button>
      </div>
    </AdminCard>
  );
}
