import React, { useEffect, useState } from 'react';
import { AdminCard } from './AdminCard';
import { networkApi } from '../../../api/networkApi';
import { formatShortDate } from '../../../utils/formatDate';
import { renderNetworkTooltip } from '../../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../../utils/geospatial/tooltipDataNormalizer';

const TimelineIcon = ({ size = 24, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

interface ObservationsCardProps {
  selectedNetwork: any | null;
}

export const ObservationsCard: React.FC<ObservationsCardProps> = ({ selectedNetwork }) => {
  const [observations, setObservations] = useState<any[]>([]);
  const [_mvData, setMvData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tooltipHtml, setTooltipHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNetwork) {
      setObservations([]);
      setMvData(null);
      setTooltipHtml(null);
      setError(null);
      return;
    }

    const bssid = selectedNetwork.netid || selectedNetwork.bssid;
    if (!bssid) return;

    setLoading(true);
    setError(null);
    setObservations([]);
    setMvData(null);
    setTooltipHtml(null);

    Promise.all([
      networkApi.getNetworkObservations(bssid).catch(() => null),
      networkApi.getNetworkByBssid(bssid).catch(() => null),
    ])
      .then(([obsResult, mv]) => {
        const obs = Array.isArray(obsResult)
          ? obsResult
          : Array.isArray(obsResult?.observations)
            ? obsResult.observations
            : [];
        setObservations(obs);
        setMvData(mv ?? null);

        const source = mv ?? {
          ...selectedNetwork,
          bssid: selectedNetwork.netid || selectedNetwork.bssid,
        };
        const normalized = normalizeTooltipData(source);
        setTooltipHtml(renderNetworkTooltip(normalized) ?? null);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load observations');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedNetwork]);

  if (!selectedNetwork) return null;

  const bssid = selectedNetwork.netid || selectedNetwork.bssid;
  const label = selectedNetwork.ssid || bssid || 'Unknown';

  return (
    <AdminCard
      icon={TimelineIcon}
      title={`Observations — ${label}`}
      color="from-violet-500 to-violet-600"
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Forensic tooltip preview */}
        <div className="flex-shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
            Forensic Preview
          </div>
          <div className="bg-slate-950/50 rounded-lg border border-slate-800 p-3 flex justify-center">
            {loading ? (
              <div className="text-xs text-slate-500 italic py-8 px-4">Loading…</div>
            ) : tooltipHtml ? (
              <div
                className="scale-[0.85] origin-top-left"
                dangerouslySetInnerHTML={{ __html: tooltipHtml }}
              />
            ) : (
              <div className="text-xs text-slate-500 italic py-4">No preview available</div>
            )}
          </div>
        </div>

        {/* Observations timeline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Local Observation Timeline
            </div>
            {observations.length > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                {observations.length.toLocaleString()} total
              </span>
            )}
          </div>

          {error ? (
            <div className="text-xs text-red-400 p-3 bg-red-900/20 rounded border border-red-700/40">
              {error}
            </div>
          ) : loading ? (
            <div className="text-xs text-slate-500 italic py-4">Loading observations…</div>
          ) : observations.length === 0 ? (
            <div className="text-xs text-slate-500 italic py-4">
              No local observations found for this network.
            </div>
          ) : (
            <div className="max-h-[20rem] overflow-y-auto rounded border border-slate-800/60 bg-slate-900/30">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="sticky top-0 bg-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="px-3 py-2 whitespace-nowrap">Timestamp</th>
                    <th className="px-3 py-2 text-right">Signal</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Lat / Lon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {observations.map((obs: any, i: number) => {
                    const ts = obs.observed_at || obs.timestamp || obs.time;
                    const sig = obs.signal ?? obs.level ?? obs.rssi;
                    const sigColor =
                      sig > -70
                        ? 'text-emerald-400'
                        : sig > -85
                          ? 'text-amber-400'
                          : 'text-red-400';
                    return (
                      <tr key={obs.id ?? i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-2 font-mono whitespace-nowrap tabular-nums">
                          {ts ? formatShortDate(ts) : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono tabular-nums ${sigColor}`}>
                          {sig != null ? `${sig} dBm` : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">
                          {obs.source_tag || obs.source || obs.device_id || '—'}
                        </td>
                        <td className="px-3 py-2 font-mono text-cyan-500/70">
                          {obs.lat != null && obs.lon != null
                            ? `${Number(obs.lat).toFixed(5)}, ${Number(obs.lon).toFixed(5)}`
                            : obs.latitude != null
                              ? `${Number(obs.latitude).toFixed(5)}, ${Number(obs.longitude).toFixed(5)}`
                              : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminCard>
  );
};
