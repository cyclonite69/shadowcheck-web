import React from 'react';
import { formatShortDate } from '../../../../utils/formatDate';
import type { ObservationTemporalSummary } from '../../../../utils/wigleDetailUtils';
import type { WigleObservation } from '../../hooks/useWigleDetectionEvidence';

export interface WigleDetailObservationsTableProps {
  temporal: ObservationTemporalSummary | null;
  channel: number | null | undefined;
  selectedObs: WigleObservation | null;
  setSelectedObs: React.Dispatch<React.SetStateAction<WigleObservation | null>>;
  observations: WigleObservation[];
}

export const WigleDetailObservationsTable: React.FC<WigleDetailObservationsTableProps> = ({
  temporal,
  channel,
  selectedObs,
  setSelectedObs,
  observations,
}) => {
  return (
    <>
      {/* Timestamps */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-slate-800/30 p-3 rounded">
          <div className="text-xs text-slate-500 mb-1">First Seen</div>
          <div className="text-sm text-white">{formatShortDate(temporal?.firstSeen ?? null)}</div>
        </div>
        <div className="bg-slate-800/30 p-3 rounded">
          <div className="text-xs text-slate-500 mb-1">Last Seen</div>
          <div className="text-sm text-white">{formatShortDate(temporal?.lastSeen ?? null)}</div>
        </div>
        <div className="bg-slate-800/30 p-3 rounded">
          <div className="text-xs text-slate-500 mb-1">Channel</div>
          <div className="text-sm text-white">{channel ?? 'N/A'}</div>
        </div>
      </div>
      {selectedObs && temporal?.selectedSeen && (
        <div className="bg-violet-500/10 border border-violet-500/20 p-2 rounded text-center">
          <span className="text-xs text-violet-400 font-mono">
            Viewing observation: {formatShortDate(temporal.selectedSeen)}
          </span>
        </div>
      )}

      {/* Observations Table */}
      {observations && observations.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-400 uppercase">
              Individual Observation Points ({observations.length})
            </h4>
            <div className="flex items-center gap-2">
              {selectedObs && (
                <button
                  type="button"
                  onClick={() => setSelectedObs(null)}
                  className="text-[10px] text-violet-400 hover:text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded transition-colors"
                >
                  Clear selection
                </button>
              )}
              <div className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                Deep Forensic Data
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded border border-slate-700/50 overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-slate-800 text-slate-400 font-semibold border-b border-slate-700">
                  <tr>
                    <th className="px-3 py-2">Timestamp</th>
                    <th className="px-3 py-2 text-right">Signal</th>
                    <th className="px-3 py-2 text-right">Altitude</th>
                    <th className="px-3 py-2">Lat/Lon</th>
                    <th className="px-3 py-2">SSID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {observations.map((obs) => {
                    const isActive = selectedObs?.id === obs.id;
                    return (
                      <tr
                        key={obs.id}
                        className={`cursor-pointer text-slate-300 transition-colors ${
                          isActive
                            ? 'bg-violet-500/15 border-l-2 border-violet-400'
                            : 'hover:bg-slate-800/30'
                        }`}
                        onClick={() => setSelectedObs((prev) => (prev?.id === obs.id ? null : obs))}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatShortDate(obs.observed_at)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`${
                              obs.signal > -70
                                ? 'text-green-400'
                                : obs.signal > -85
                                  ? 'text-yellow-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {obs.signal} dBm
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400 font-mono">
                          {obs.altitude ? `${obs.altitude}m` : '-'}
                        </td>
                        <td className="px-3 py-2 font-mono text-cyan-500/80">
                          {obs.latitude.toFixed(5)}, {obs.longitude.toFixed(5)}
                        </td>
                        <td className="px-3 py-2 italic text-slate-400">{obs.ssid || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
