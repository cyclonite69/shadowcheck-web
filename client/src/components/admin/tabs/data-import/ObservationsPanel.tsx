import React, { useEffect, useState } from 'react';
import { networkApi } from '../../../../api/networkApi';
import { formatShortDate } from '../../../../utils/formatDate';

interface ObservationsPanelProps {
  selectedBssid: string | null;
  selectedSsid?: string | null;
  onObservationSelect?: (obs: any | null) => void;
}

export const ObservationsPanel: React.FC<ObservationsPanelProps> = ({
  selectedBssid,
  selectedSsid,
  onObservationSelect,
}) => {
  const [observations, setObservations] = useState<any[]>([]);
  const [selectedObs, setSelectedObs] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedBssid) {
      setObservations([]);
      setSelectedObs(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setObservations([]);
    setSelectedObs(null);

    networkApi
      .getNetworkObservations(selectedBssid)
      .then((result: any) => {
        const obs = Array.isArray(result)
          ? result
          : Array.isArray(result?.observations)
            ? result.observations
            : [];
        setObservations(obs);
      })
      .catch((err: any) => {
        setError(err?.message || 'Failed to load observations');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedBssid]);

  const handleObsClick = (obs: any) => {
    const isDeselect = selectedObs?.id === obs.id;
    const next = isDeselect ? null : obs;
    setSelectedObs(next);
    if (onObservationSelect) {
      onObservationSelect(next);
    }
  };

  if (!selectedBssid) {
    return (
      <div className="h-full flex items-center justify-center text-[11px] text-slate-600 italic p-4">
        Select a network to view observations
      </div>
    );
  }

  const label = selectedSsid || selectedBssid;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 flex-shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Observations
        </span>
        <span className="text-[10px] font-mono text-slate-500 truncate max-w-[160px]">{label}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-[11px] text-slate-500 italic text-center">Loading…</div>
        ) : error ? (
          <div className="p-3 text-[11px] text-red-400">{error}</div>
        ) : observations.length === 0 ? (
          <div className="p-4 text-[11px] text-slate-600 italic text-center">
            No local observations found
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {observations.map((obs: any, i: number) => {
              const ts = obs.observed_at || obs.timestamp || obs.time;
              const sig = obs.signal ?? obs.level ?? obs.rssi;
              const sigColor =
                sig > -70 ? 'text-emerald-400' : sig > -85 ? 'text-amber-400' : 'text-red-400';
              const isActive = selectedObs?.id === obs.id;
              return (
                <div
                  key={obs.id ?? i}
                  onClick={() => handleObsClick(obs)}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    isActive ? 'bg-blue-500/20 border-l-2 border-blue-500' : 'hover:bg-slate-800/30'
                  }`}
                >
                  <div className="font-mono text-[10px] text-slate-300 tabular-nums">
                    {ts ? formatShortDate(ts) : '—'}
                  </div>
                  {/* Per-observation SSID — may differ from network default */}
                  {obs.ssid && obs.ssid !== '(hidden)' ? (
                    <div className="text-[10px] text-slate-200 font-medium truncate mt-0.5">
                      {obs.ssid}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-600 italic mt-0.5">(hidden)</div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    {sig !== null && sig !== undefined && (
                      <span className={`text-[10px] font-mono tabular-nums ${sigColor}`}>
                        {sig} dBm
                      </span>
                    )}
                    {((obs.lat !== null && obs.lat !== undefined) ||
                      (obs.latitude !== null && obs.latitude !== undefined)) && (
                      <span className="text-[9px] font-mono text-cyan-600/70">
                        {Number(obs.lat ?? obs.latitude).toFixed(4)},{' '}
                        {Number(obs.lon ?? obs.longitude).toFixed(4)}
                      </span>
                    )}
                  </div>
                  {(obs.source_tag || obs.source) && (
                    <div className="text-[9px] text-slate-600 truncate mt-0.5">
                      {obs.source_tag || obs.source}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {observations.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-800/60 flex-shrink-0">
          <span className="text-[9px] text-slate-600 font-mono">
            {observations.length.toLocaleString()} observation{observations.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
};
