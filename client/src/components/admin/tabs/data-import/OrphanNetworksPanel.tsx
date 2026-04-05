import React, { useEffect, useState } from 'react';
import { adminApi } from '../../../../api/adminApi';
import type { OrphanNetworkRow } from './types';
import { formatShortDate } from '../../../../utils/formatDate';

const formatCoords = (lat: number | null, lon: number | null) => {
  if (lat == null || lon == null) return '—';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
};

export function OrphanNetworksPanel({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<OrphanNetworkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi
      .getOrphanNetworks(50, search)
      .then((data: any) => {
        setRows(data?.rows ?? []);
        setTotal(Number(data?.total ?? 0));
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [refreshKey, search]);

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Orphan Networks</h3>
          <p className="text-xs text-slate-500 mt-1">
            Preserved parent-only rows awaiting reconciliation or WiGLE backfill. Showing{' '}
            <span className="font-mono text-slate-400">{rows.length}</span> of{' '}
            <span className="font-mono text-slate-400">{total}</span>.
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draftSearch);
          }}
        >
          <input
            type="text"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search BSSID or SSID"
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 w-56"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
          >
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-2">Loading orphan networks...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">No orphan networks found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50">
                <th className="text-left py-1.5 pr-3">Moved</th>
                <th className="text-left py-1.5 pr-3">BSSID</th>
                <th className="text-left py-1.5 pr-3">SSID</th>
                <th className="text-left py-1.5 pr-3">Type</th>
                <th className="text-right py-1.5 pr-3">Freq</th>
                <th className="text-left py-1.5 pr-3">Best Coords</th>
                <th className="text-left py-1.5 pr-3">Source</th>
                <th className="text-right py-1.5 pr-3">WiGLE Obs</th>
                <th className="text-left py-1.5">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.bssid} className="border-b border-slate-800/50">
                  <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                    {formatShortDate(row.moved_at)}
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-slate-200 whitespace-nowrap">
                    {row.bssid}
                  </td>
                  <td className="py-1.5 pr-3 max-w-[16rem] truncate" title={row.ssid || '(hidden)'}>
                    {row.ssid || '(hidden)'}
                  </td>
                  <td className="py-1.5 pr-3">{row.type || '—'}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{row.frequency ?? '—'}</td>
                  <td
                    className="py-1.5 pr-3 text-slate-400 whitespace-nowrap"
                    title={`best=${formatCoords(row.bestlat, row.bestlon)} last=${formatCoords(row.lastlat, row.lastlon)}`}
                  >
                    {formatCoords(row.bestlat, row.bestlon)}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">
                    {row.source_device || '—'}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {row.wigle_v3_observation_count ?? 0}
                  </td>
                  <td className="py-1.5 text-slate-400">{row.move_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
