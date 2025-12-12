import React, { useEffect, useMemo, useState } from 'react';

type NetworkRow = {
  bssid: string;
  ssid: string;
  device_id: string;
  observed_at: string;
  signal: number | null;
};

type Props = {
  networks?: NetworkRow[];
  threshold?: number;
  title?: string;
  onSelect?: (bssid: string) => void;
  selectedBssid?: string | null;
};

export default function ThreatsExplorer({
  networks: networksProp,
  threshold = -60,
  title = 'Threats Explorer',
  onSelect,
  selectedBssid,
}: Props) {
  const [networks, setNetworks] = useState<NetworkRow[]>(networksProp || []);
  const [loading, setLoading] = useState(!networksProp);
  const [error, setError] = useState('');

  useEffect(() => {
    if (networksProp) {
      setNetworks(networksProp);
      return;
    }
    const load = async () => {
      try {
        setError('');
        setLoading(true);
        const res = await fetch('/api/explorer/networks?limit=2000&order=desc&sort=observed_at');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        setNetworks(data.rows || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load threats data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [networksProp]);

  const threats = useMemo(() => {
    return networks
      .filter((n) => n.signal != null && n.signal > threshold)
      .sort((a, b) => (b.signal || -999) - (a.signal || -999));
  }, [networks, threshold]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-slate-400 text-sm">Signal stronger than {threshold} dBm.</p>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
        <span
          className="px-2 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: '#f8717122', color: '#f87171' }}
        >
          {threats.length} candidates
        </span>
      </div>
      <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading…</p>
        ) : threats.length === 0 ? (
          <p className="text-slate-500 text-sm">No strong-signal candidates.</p>
        ) : (
          threats.map((net) => (
            <div
              key={net.bssid}
              className={`p-2 rounded bg-slate-800/70 border border-slate-800 cursor-pointer ${selectedBssid === net.bssid ? 'ring-1 ring-blue-400' : ''}`}
              onClick={() => onSelect && onSelect(net.bssid)}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{net.ssid || '(hidden)'}</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#f8717122', color: '#f87171' }}
                >
                  {net.signal != null ? `${net.signal} dBm` : '—'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono">{net.bssid}</div>
              <div className="text-xs text-slate-500 mt-1">{net.device_id}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
