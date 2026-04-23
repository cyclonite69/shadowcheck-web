import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { ToggleIcon, ChevronIcon } from './ConfigIcons';
import { ConfigFlagRow, type FlagItem } from './ConfigFlagRow';

interface DeployFlagsConfigProps {
  deployFlags: FlagItem[];
  isLoading: boolean;
  updateFeatureFlag: (key: string, next: boolean) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const DeployFlagsConfig: React.FC<DeployFlagsConfigProps> = ({
  deployFlags,
  isLoading,
  updateFeatureFlag,
  isOpen,
  onToggle,
}) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      className="group mb-4 flex w-full items-center justify-between"
    >
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors group-hover:text-slate-300">
          Deploy &amp; Build Flags
        </h3>
        <p className="mt-0.5 text-[11px] text-slate-600">
          Environment and build-time flags — require container recreate or frontend rebuild.
        </p>
      </div>
      <ChevronIcon open={isOpen} />
    </button>

    {isOpen && (
      <AdminCard icon={ToggleIcon} title="Deploy & Build Flags" color="from-slate-500 to-slate-600">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-950/40">
            <div className="border-b border-slate-800/80 px-4 py-3">
              <div className="text-sm font-semibold text-white">Deploy-Time Settings</div>
              <div className="mt-1 text-xs text-slate-400">
                Environment-backed values require container recreate or restart to change.
              </div>
            </div>
            <div className="space-y-3 p-3">
              {deployFlags.map((item) => (
                <ConfigFlagRow
                  key={item.label}
                  item={item}
                  isLoading={isLoading}
                  onToggle={updateFeatureFlag}
                />
              ))}
            </div>
          </div>
        </div>
      </AdminCard>
    )}
  </div>
);
