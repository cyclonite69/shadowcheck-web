import React from 'react';
import { AdminCard } from '../../components/AdminCard';
import { DetailIcon } from './WigleDetailIcons';
import { V3EnrichmentManagerTable } from '../data-import/V3EnrichmentManagerTable';

export interface WigleDetailBatchSectionProps {
  activeEnrichmentRun: { id: number; searchTerm?: string } | null;
  stopEnrichment: () => Promise<void>;
  actionLoading: boolean;
  pendingEnrichment: number | null;
  isManualMode: boolean;
  setIsManualMode: (val: boolean) => void;
  runsLoading: boolean;
  handleStartEnrichment: () => Promise<void>;
  handleManualEnrich: (bssids: string[]) => Promise<void | {
    ok?: boolean;
    run?: { id?: number; status?: string; lastError?: string | null };
  }>;
  handleManualSelect: (netid: string) => void;
}

export const WigleDetailBatchSection: React.FC<WigleDetailBatchSectionProps> = ({
  activeEnrichmentRun,
  stopEnrichment,
  actionLoading,
  pendingEnrichment,
  isManualMode,
  setIsManualMode,
  runsLoading,
  handleStartEnrichment,
  handleManualEnrich,
  handleManualSelect,
}) => {
  return (
    <AdminCard icon={DetailIcon} title="Batch v3 Enrichment" color="from-blue-500 to-indigo-600">
      <div className="space-y-4">
        {/* Active run banner — always visible when a run is looping */}
        {activeEnrichmentRun && (
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Enrichment Running
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                run #{activeEnrichmentRun.id}
                {activeEnrichmentRun.searchTerm ? ` · ${activeEnrichmentRun.searchTerm}` : ''}
              </span>
            </div>
            <button
              onClick={stopEnrichment}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded text-[11px] font-black uppercase tracking-tighter transition-all active:scale-95"
            >
              Stop
            </button>
          </div>
        )}
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-slate-300 font-bold">Enrich v2 Records</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Automatically fetch deep forensics and observation clusters for networks discovered
              via v2 search that don't have v3 details yet.
            </p>
          </div>
          {pendingEnrichment !== null && (
            <div className="text-right px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="text-xl font-black text-blue-400">
                {pendingEnrichment.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                Pending
              </div>
            </div>
          )}
        </div>

        <div className="pt-2">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="manual-enrich-toggle"
              checked={isManualMode}
              onChange={(e) => setIsManualMode(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20"
            />
            <label htmlFor="manual-enrich-toggle" className="text-xs text-slate-300 font-medium">
              Targeted Selection Mode (Select from Catalog)
            </label>
          </div>

          {isManualMode ? (
            <V3EnrichmentManagerTable
              onEnrich={handleManualEnrich}
              onSelect={handleManualSelect}
              isLoading={actionLoading}
            />
          ) : (
            <button
              onClick={handleStartEnrichment}
              disabled={runsLoading || actionLoading || (pendingEnrichment || 0) === 0}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-xs shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              Start Batch Enrichment (Full Backlog)
            </button>
          )}
        </div>
      </div>
    </AdminCard>
  );
};
