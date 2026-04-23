import React from 'react';

export interface FlagItem {
  label: string;
  enabled: boolean;
  detail: string;
  source: string;
  impact: 'Live' | 'Restart' | 'Rebuild';
  editable?: boolean;
  recommendedAction?: string;
}

const impactClassName = (impact: string) => {
  switch (impact) {
    case 'Live':
      return 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300';
    case 'Restart':
      return 'border-amber-700/50 bg-amber-900/20 text-amber-200';
    case 'Rebuild':
      return 'border-fuchsia-700/50 bg-fuchsia-900/20 text-fuchsia-200';
    default:
      return 'border-slate-700/50 bg-slate-800/60 text-slate-300';
  }
};

interface FlagRowProps {
  item: FlagItem;
  isLoading: boolean;
  onToggle: (key: string, next: boolean) => void;
}

export const ConfigFlagRow: React.FC<FlagRowProps> = ({ item, isLoading, onToggle }) => (
  <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2">
    <div>
      <div className="text-sm font-medium text-white">{item.label}</div>
      <div className="text-xs text-slate-500">{item.detail}</div>
    </div>
    <div className="shrink-0 text-right">
      <div className="flex flex-wrap justify-end gap-2">
        <div
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${
            item.enabled
              ? 'border-emerald-700/50 bg-emerald-900/30 text-emerald-300'
              : 'border-slate-700/50 bg-slate-800/60 text-slate-300'
          }`}
        >
          {item.enabled ? 'Enabled' : 'Disabled'}
        </div>
        <div
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${impactClassName(item.impact)}`}
        >
          {item.impact}
        </div>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{item.source}</div>
      {item.editable ? (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onToggle(item.detail, !item.enabled)}
          className="mt-2 rounded-md border border-blue-600/50 bg-blue-600/10 px-2 py-1 text-[11px] text-blue-200 transition hover:bg-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {item.enabled ? 'Disable live' : 'Enable live'}
        </button>
      ) : (
        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
          <div>
            {item.impact === 'Restart'
              ? 'Change env/secret, then recreate the container.'
              : 'Change build config, then rebuild the frontend.'}
          </div>
          {item.recommendedAction && (
            <div className="text-slate-400">Recommended: {item.recommendedAction}</div>
          )}
        </div>
      )}
    </div>
  </div>
);
