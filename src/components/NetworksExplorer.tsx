import React, { useEffect, useMemo, useState } from 'react';

type NetworkRow = {
  bssid: string;
  ssid: string;
  device_id: string;
  source_tag: string;
  observed_at: string;
  signal: number | null;
  lat: number | null;
  lon: number | null;
  external: boolean;
  observations: number;
  first_seen: string | null;
  last_seen: string | null;
  is_5ghz: boolean | null;
  is_6ghz: boolean | null;
  is_hidden: boolean | null;
  type: string | null;
  frequency: number | null;
  capabilities: string | null;
};

type Props = {
  networks?: NetworkRow[];
  onSelect?: (bssid: string) => void;
  selectedBssid?: string | null;
  title?: string;
  compact?: boolean;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function NetworksExplorer({
  networks: networksProp,
  onSelect,
  selectedBssid,
  title = 'Networks Explorer',
  compact = false,
}: Props) {
  const [networks, setNetworks] = useState<NetworkRow[]>(networksProp || []);
  const [loading, setLoading] = useState(!networksProp);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'observed_at' | 'signal' | 'observations'>(
    'observed_at'
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
        setError('Failed to load networks');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [networksProp]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const base = term
      ? networks.filter(
          (n) =>
            n.ssid?.toLowerCase().includes(term) ||
            n.bssid?.toLowerCase().includes(term) ||
            n.device_id?.toLowerCase().includes(term)
        )
      : networks;

    const sorted = [...base].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === 'observed_at') {
        aVal = new Date(a.observed_at || 0).getTime();
        bVal = new Date(b.observed_at || 0).getTime();
      }
      if (aVal === bVal) {
        return 0;
      }
      const dir = sortDirection === 'asc' ? 1 : -1;
      return aVal > bVal ? dir : -dir;
    });
    return sorted;
  }, [networks, search, sortField, sortDirection]);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-slate-400 text-sm">
            Latest snapshot from mv_network_latest with observations.
          </p>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SSID/BSSID/device…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <select
            value={`${sortField}:${sortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(':');
              setSortField(field as any);
              setSortDirection(dir as any);
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="observed_at:desc">Sort: Newest</option>
            <option value="observed_at:asc">Sort: Oldest</option>
            <option value="signal:desc">Signal: Strong</option>
            <option value="signal:asc">Signal: Weak</option>
            <option value="observations:desc">Obs: High → Low</option>
            <option value="observations:asc">Obs: Low → High</option>
          </select>
        </div>
      </div>
      <div
        className={`overflow-auto ${compact ? 'max-h-[360px]' : 'max-h-[520px]'} rounded-lg border border-slate-800`}
      >
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-slate-300">
            <tr>
              <th className="p-3 text-left">SSID</th>
              <th className="p-3 text-left">BSSID</th>
              <th className="p-3 text-left">Signal</th>
              <th className="p-3 text-left">Obs</th>
              <th className="p-3 text-left">Freq</th>
              <th className="p-3 text-left">Seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 text-center text-slate-400" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={6}>
                  No networks
                </td>
              </tr>
            ) : (
              filtered.map((net) => (
                <tr
                  key={net.bssid}
                  className={`border-b border-slate-800/80 cursor-pointer hover:bg-slate-800/60 ${selectedBssid === net.bssid ? 'bg-slate-800/80' : ''}`}
                  onClick={() => onSelect && onSelect(net.bssid)}
                >
                  <td className="p-3">
                    <div className="text-white font-semibold">{net.ssid || '(hidden)'}</div>
                    <div className="text-slate-400 text-xs">{net.device_id}</div>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-300">{net.bssid}</td>
                  <td className="p-3 text-slate-200">
                    {net.signal != null ? `${net.signal} dBm` : '—'}
                    <div className="text-xs text-slate-500">
                      {net.is_5ghz ? '5GHz' : net.is_6ghz ? '6GHz' : '2.4GHz'}
                    </div>
                  </td>
                  <td className="p-3 text-slate-200">{net.observations ?? 0}</td>
                  <td className="p-3 text-slate-200">
                    {net.frequency ? `${net.frequency} MHz` : '—'}
                  </td>
                  <td className="p-3 text-slate-200">{formatDate(net.observed_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
