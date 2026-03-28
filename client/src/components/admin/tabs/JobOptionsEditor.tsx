import React from 'react';
import { JobConfig, JobKey } from './jobTypes';

export function JobOptionsEditor({
  config,
  jobKey,
  onUpdate,
  accentClass,
}: {
  config: JobConfig;
  jobKey: JobKey;
  onUpdate: (field: string, value: any) => void;
  accentClass: string;
}) {
  if (jobKey === 'backup') {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Upload to S3
        </span>
        <button
          onClick={() => onUpdate('uploadToS3', !config.uploadToS3)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.uploadToS3 ? 'bg-emerald-500' : 'bg-slate-700'}`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${config.uploadToS3 ? 'translate-x-5' : 'translate-x-1'}`}
          />
        </button>
      </div>
    );
  }

  if (jobKey === 'siblingDetection') {
    return (
      <div className="space-y-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          Discovery Tuning
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase font-medium">Octet Delta</label>
            <input
              type="number"
              value={config.max_octet_delta || 6}
              onChange={(e) => onUpdate('max_octet_delta', parseInt(e.target.value))}
              className={`w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 ${accentClass}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase font-medium">Max Dist (m)</label>
            <input
              type="number"
              value={config.max_distance_m || 5000}
              onChange={(e) => onUpdate('max_distance_m', parseInt(e.target.value))}
              className={`w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 ${accentClass}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase font-medium">Min Conf</label>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={config.min_candidate_conf || 0.7}
              onChange={(e) => onUpdate('min_candidate_conf', parseFloat(e.target.value))}
              className={`w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 ${accentClass}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase font-medium">Seed Limit</label>
            <input
              type="number"
              value={config.seed_limit || 1000}
              onChange={(e) => onUpdate('seed_limit', parseInt(e.target.value))}
              className={`w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 ${accentClass}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-400 uppercase font-medium">Incremental Mode</span>
          <button
            onClick={() => onUpdate('incremental', !config.incremental)}
            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${config.incremental ? 'bg-orange-500' : 'bg-slate-700'}`}
          >
            <span
              className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${config.incremental ? 'translate-x-4.5' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
