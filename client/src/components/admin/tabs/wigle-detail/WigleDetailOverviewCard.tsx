import React from 'react';
import type { SsidDisplaySummary } from '../../../../utils/wigleDetailUtils';
import type { WigleDetailData } from '../../hooks/useWigleDetail';

export interface WigleDetailOverviewCardProps {
  data: WigleDetailData;
  ssidSummary: SsidDisplaySummary | null;
  totalObservations: number;
  newObservations: number;
}

export const WigleDetailOverviewCard: React.FC<WigleDetailOverviewCardProps> = ({
  data,
  ssidSummary,
  totalObservations,
  newObservations,
}) => {
  return (
    <>
      {/* Header Info */}
      <div className="flex justify-between items-start pb-4 border-b border-slate-700/50">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">
            {ssidSummary?.displayTitle ?? data.ssid ?? data.name ?? '(hidden)'}
          </h3>
          {ssidSummary?.isHiddenCanonical && ssidSummary.observedSsid && (
            <div className="text-xs text-slate-400 mt-0.5">
              <span className="text-slate-500">Observed SSID: </span>
              <span className="text-amber-300 font-medium">{ssidSummary.observedSsid}</span>
            </div>
          )}
          {ssidSummary &&
            !ssidSummary.isHiddenCanonical &&
            ssidSummary.observedSsid &&
            ssidSummary.observedSsid !== ssidSummary.canonicalSsid && (
              <div className="text-xs text-slate-400 mt-0.5">
                <span className="text-slate-500">Also seen as: </span>
                <span className="text-amber-300 font-medium">{ssidSummary.observedSsid}</span>
              </div>
            )}
          <div className="font-mono text-cyan-400 text-sm">{data.networkId}</div>
        </div>
        <div className="text-right space-y-1">
          <div className="text-xs text-slate-400">Encryption</div>
          <div className="text-sm font-medium text-white px-2 py-0.5 bg-slate-700 rounded inline-block">
            {data.encryption || 'N/A'}
          </div>
        </div>
      </div>

      {/* Forensic Snapshot Card */}
      <div className="bg-slate-900/40 p-4 rounded border border-slate-700/50">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Forensic Snapshot</h4>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold">
              WiGLE Observations
            </span>
            <span className="text-lg font-black text-cyan-400 font-mono">
              {totalObservations.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Local Matches</span>
            <span className="text-lg font-black text-emerald-400 font-mono">
              {(totalObservations - newObservations).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold">New Records</span>
            <span className="text-lg font-black text-amber-400 font-mono">
              {newObservations.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Quality Score</span>
            <span className="text-lg font-black text-white font-mono">
              {data.bestClusterWiGLEQoS !== null && data.bestClusterWiGLEQoS !== undefined
                ? `${((data.bestClusterWiGLEQoS / 7) * 100).toFixed(0)}%`
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
