import React, { useEffect, useState, useCallback } from 'react';
import { wigleApi } from '../../../../api/wigleApi';
import { formatShortDate } from '../../../../utils/formatDate';

interface EnrichmentRow {
  bssid: string;
  ssid: string;
  region: string;
  city: string;
  type: string;
  last_v3_import: string | null;
  v3_obs_count: number;
}

interface V3EnrichmentManagerTableProps {
  onEnrich: (bssids: string[]) => void;
  isLoading: boolean;
}

export const V3EnrichmentManagerTable: React.FC<V3EnrichmentManagerTableProps> = ({
  onEnrich,
  isLoading: actionLoading,
}) => {
  const [data, setData] = useState<EnrichmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [ssidFilter, setSsidFilter] = useState('');
  const [bssidFilter, setBssidFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ssid: ssidFilter,
        bssid: bssidFilter,
        city: cityFilter,
        region: regionFilter,
      });
      const response = await wigleApi.getEnrichmentCatalog(params);
      if (response.ok) {
        setData(response.data);
        setTotal(response.total);
      }
    } catch (e) {
      console.error('Failed to fetch enrichment catalog', e);
    } finally {
      setLoading(false);
    }
  }, [page, ssidFilter, bssidFilter, cityFilter, regionFilter]);

  useEffect(() => {
    const timeout = setTimeout(fetchCatalog, 300);
    return () => clearTimeout(timeout);
  }, [fetchCatalog]);

  const toggleSelect = (bssid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bssid)) next.delete(bssid);
      else next.add(bssid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === data.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.map((r) => r.bssid)));
    }
  };

  const handleEnrichSelected = () => {
    if (selected.size === 0) return;
    onEnrich(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <input
          type="text"
          placeholder="Filter SSID..."
          value={ssidFilter}
          onChange={(e) => {
            setSsidFilter(e.target.value);
            setPage(1);
          }}
          className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none"
        />
        <input
          type="text"
          placeholder="Filter BSSID..."
          value={bssidFilter}
          onChange={(e) => {
            setBssidFilter(e.target.value);
            setPage(1);
          }}
          className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none"
        />
        <input
          type="text"
          placeholder="Filter City..."
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
          className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none"
        />
        <input
          type="text"
          placeholder="Filter Region/State..."
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value);
            setPage(1);
          }}
          className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none"
        />
      </div>

      {/* Action Bar */}
      <div className="flex justify-between items-center py-1">
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          {total.toLocaleString()} Networks Found
        </div>
        <button
          onClick={handleEnrichSelected}
          disabled={selected.size === 0 || actionLoading}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded text-[10px] font-black uppercase tracking-tighter transition-all active:scale-95 shadow-lg shadow-blue-500/20"
        >
          Enrich Selected ({selected.size})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-slate-800/60 bg-slate-900/20">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-800/40 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={data.length > 0 && selected.size === data.length}
                  onChange={toggleSelectAll}
                  className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-600"
                />
              </th>
              <th className="px-3 py-2">Network (SSID/BSSID)</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2 text-center">v3 Obs</th>
              <th className="px-3 py-2 text-right">Last v3 Import</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500 italic">
                  Loading catalog...
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500 italic">
                  No networks found matching filters.
                </td>
              </tr>
            )}
            {!loading &&
              data.map((row) => (
                <tr
                  key={row.bssid}
                  className={`hover:bg-blue-500/5 transition-colors cursor-pointer ${selected.has(row.bssid) ? 'bg-blue-500/10' : ''}`}
                  onClick={() => toggleSelect(row.bssid)}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.bssid)}
                      onChange={() => toggleSelect(row.bssid)}
                      className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-bold text-slate-200 truncate max-w-[180px]">
                      {row.ssid || row.bssid}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">{row.bssid}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    <div className="truncate max-w-[140px]">
                      {row.city || 'Unknown'}
                      {row.region ? `, ${row.region}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`font-mono font-bold ${row.v3_obs_count > 0 ? 'text-cyan-400' : 'text-slate-600'}`}
                    >
                      {row.v3_obs_count}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                    {row.last_v3_import ? formatShortDate(row.last_v3_import) : 'Never'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center px-1">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
          className="text-[10px] text-slate-400 hover:text-white disabled:opacity-30 uppercase font-bold"
        >
          Previous
        </button>
        <span className="text-[10px] text-slate-500">
          Page <span className="text-slate-200">{page}</span> of {Math.ceil(total / 50) || 1}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= Math.ceil(total / 50) || loading}
          className="text-[10px] text-slate-400 hover:text-white disabled:opacity-30 uppercase font-bold"
        >
          Next
        </button>
      </div>
    </div>
  );
};
