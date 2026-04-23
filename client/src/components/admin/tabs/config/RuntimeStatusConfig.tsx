import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { ServerIcon } from './ConfigIcons';

interface RuntimeStatusConfigProps {
  runtime?: {
    nodeEnv?: string;
    logLevel?: string;
    mlModelVersion?: string;
    mlScoreLimit?: number;
    mlAutoScoreLimit?: number;
  };
}

export const RuntimeStatusConfig: React.FC<RuntimeStatusConfigProps> = ({ runtime }) => (
  <AdminCard icon={ServerIcon} title="Runtime Status" color="from-violet-500 to-fuchsia-600">
    <div className="space-y-3 text-sm">
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Environment</span>
        <span className="text-white">{runtime?.nodeEnv || 'unknown'}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Log level</span>
        <span className="text-white">{runtime?.logLevel || 'unknown'}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">ML model version</span>
        <span className="font-mono text-slate-200">{runtime?.mlModelVersion || 'n/a'}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">ML score limit</span>
        <span className="text-slate-200">{runtime?.mlScoreLimit ?? 'n/a'}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">ML auto-score limit</span>
        <span className="text-slate-200">{runtime?.mlAutoScoreLimit ?? 'n/a'}</span>
      </div>
      <div className="rounded-lg border border-amber-700/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
        Read-only items shown here still come from frontend build-time config or API environment
        variables.
      </div>
    </div>
  </AdminCard>
);
