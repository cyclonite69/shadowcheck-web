import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { ToggleIcon } from './ConfigIcons';
import { ConfigFlagRow, type FlagItem } from './ConfigFlagRow';

interface ConfigMutabilityCardProps {
  operationalFlags: FlagItem[];
  isLoading: boolean;
  onToggle: (key: string, next: boolean) => void;
}

export const ConfigMutabilityCard: React.FC<ConfigMutabilityCardProps> = ({
  operationalFlags,
  isLoading,
  onToggle,
}) => (
  <AdminCard icon={ToggleIcon} title="Configuration Mutability" color="from-cyan-500 to-blue-600">
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-700/50 bg-slate-950/40">
        <div className="border-b border-slate-800/80 px-4 py-3">
          <div className="text-sm font-semibold text-white">Runtime Toggles</div>
          <div className="mt-1 text-xs text-slate-400">
            Database-backed flags apply live from the admin UI.
          </div>
        </div>
        <div className="space-y-3 p-3">
          {operationalFlags.map((item) => (
            <ConfigFlagRow key={item.label} item={item} isLoading={isLoading} onToggle={onToggle} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-700/50 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
        Scoring controls and deploy-time flags have their own dedicated sections below.
      </div>
    </div>
  </AdminCard>
);
