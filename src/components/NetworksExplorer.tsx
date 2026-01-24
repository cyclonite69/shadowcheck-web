import React from 'react';

type NetworkRow = {
  bssid: string;
  ssid: string | null;
  observed_at: string | null;
  signal: number | null;
  observations: number;
  is_5ghz: boolean | null;
  is_6ghz: boolean | null;
  is_hidden: boolean | null;
  frequency: number | null;
  manufacturer?: string | null;
  network_id?: string | null;
};

type Props = {
  networks: NetworkRow[];
  loading?: boolean;
  error?: string;
  onSelect?: (bssid: string) => void;
  selectedBssid?: string | null;
  title?: string;
  compact?: boolean;
  sortField?: 'observed_at' | 'signal' | 'observations';
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: 'observed_at' | 'signal' | 'observations', dir: 'asc' | 'desc') => void;
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

export default function NetworksExplorer({
  networks,
  loading = false,
  error = '',
  onSelect,
  selectedBssid,
  title = 'Networks Explorer',
  compact = false,
  sortField = 'observed_at',
  sortDirection = 'desc',
  onSortChange,
}: Props) {
  const showSort = typeof onSortChange === 'function';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-slate-400 text-sm">
            Filtered via the unified filter system (no implicit search or defaults).
          </p>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>
        {showSort && (
          <div className="flex items-center gap-2">
            <select
              value={`${sortField}:${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split(':');
                onSortChange?.(field as any, dir as any);
              }}
              aria-label="Sort networks"
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
        )}
      </div>
      <div
        className={`overflow-auto ${compact ? 'max-h-[360px]' : 'max-h-[520px]'} rounded-lg border border-slate-800`}
      >
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-800/60 text-slate-300">
            <tr>
              <th className="p-3 text-left w-[25%]">SSID</th>
              <th className="p-3 text-left w-[20%]">BSSID</th>
              <th className="p-3 text-left w-[15%]">Signal</th>
              <th className="p-3 text-left w-[10%]">Obs</th>
              <th className="p-3 text-left w-[12%]">Freq</th>
              <th className="p-3 text-left w-[18%]">Seen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3 text-center text-slate-400" colSpan={6}>
                  Loading…
                </td>
              </tr>
            ) : networks.length === 0 ? (
              <tr>
                <td className="p-3 text-center text-slate-500" colSpan={6}>
                  No networks
                </td>
              </tr>
            ) : (
              networks.map((net) => (
                <tr
                  key={net.bssid}
                  className={`border-b border-slate-800/80 cursor-pointer hover:bg-slate-800/60 ${selectedBssid === net.bssid ? 'bg-slate-800/80' : ''}`}
                  onClick={() => onSelect && onSelect(net.bssid)}
                >
                  <td className="p-3 w-[25%]">
                    <div className="text-white font-semibold truncate">
                      {net.ssid || '(hidden)'}
                    </div>
                    <div className="text-slate-400 text-xs truncate">
                      {net.network_id || net.manufacturer || '—'}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-300 w-[20%] truncate">
                    {net.bssid}
                  </td>
                  <td className="p-3 text-slate-200 w-[15%]">
                    {net.signal != null ? `${net.signal} dBm` : '—'}
                    <div className="text-xs text-slate-500">
                      {net.is_5ghz ? '5GHz' : net.is_6ghz ? '6GHz' : '2.4GHz'}
                    </div>
                  </td>
                  <td className="p-3 text-slate-200 w-[10%]">{net.observations ?? 0}</td>
                  <td className="p-3 text-slate-200 w-[12%]">
                    {net.frequency ? `${net.frequency} MHz` : '—'}
                  </td>
                  <td className="p-3 text-slate-200 w-[18%] truncate">
                    {formatDate(net.observed_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
