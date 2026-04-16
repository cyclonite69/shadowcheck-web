import React, { useEffect, useState, useCallback, useRef } from 'react';
import { wigleApi } from '../../../../api/wigleApi';
import { networkApi } from '../../../../api/networkApi';
import { formatShortDate } from '../../../../utils/formatDate';
import { renderNetworkTooltip } from '../../../../utils/geospatial/renderNetworkTooltip';
import { normalizeTooltipData } from '../../../../utils/geospatial/tooltipDataNormalizer';
import { US_STATES } from '../../../../constants/network';
import { ObservationsPanel } from './ObservationsPanel';

interface EnrichmentRow {
  bssid: string;
  ssid: string;
  region: string;
  city: string;
  type: string;
  firsttime: string | null;
  lasttime: string | null;
  last_v3_import: string | null;
  v3_obs_count: number;
}

interface V3EnrichmentManagerTableProps {
  onEnrich: (bssids: string[]) => Promise<void>;
  onSelect: (bssid: string) => void;
  isLoading: boolean;
}

export const V3EnrichmentManagerTable: React.FC<V3EnrichmentManagerTableProps> = ({
  onEnrich,
  onSelect: _onSelect,
  isLoading: actionLoading,
}) => {
  const [allRows, setAllRows] = useState<EnrichmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processingBssids, setProcessingBssids] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);

  // Filters
  const [ssidFilter, setSsidFilter] = useState('');
  const [bssidFilter, setBssidFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');

  const [activePanel, setActivePanel] = useState<{
    bssid: string;
    html: string;
    loading: boolean;
  } | null>(null);
  // Cache the network-level MV data and tooltip so observation selection can layer over it
  const [mvData, setMvData] = useState<any | null>(null);
  const [activeRow, setActiveRow] = useState<EnrichmentRow | null>(null);
  const [basePanelHtml, setBasePanelHtml] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePanel(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRowClick = (row: EnrichmentRow) => {
    if (activePanel?.bssid === row.bssid) {
      setActivePanel(null);
      setActiveRow(null);
      setMvData(null);
      setBasePanelHtml('');
      return;
    }

    setActiveRow(row);
    setMvData(null);

    // Show placeholder immediately
    const placeholderNormalized = normalizeTooltipData({
      ...row,
      wigle_v3_observation_count: row.v3_obs_count,
    });
    const placeholderHtml =
      renderNetworkTooltip({ ...placeholderNormalized, triggerElement: tableRef.current }) ?? '';
    setBasePanelHtml(placeholderHtml);
    setActivePanel({ bssid: row.bssid, html: placeholderHtml, loading: true });

    // Fetch full MV record
    networkApi.getNetworkByBssid(row.bssid).then((mv) => {
      setMvData(mv ?? null);
      const source = mv ?? { ...row, wigle_v3_observation_count: row.v3_obs_count };
      const normalized = normalizeTooltipData(source);
      const fullHtml =
        renderNetworkTooltip({ ...normalized, triggerElement: tableRef.current }) ?? placeholderHtml;
      setBasePanelHtml(fullHtml);
      setActivePanel((current) => {
        if (!current || current.bssid !== row.bssid) return current;
        return { bssid: row.bssid, html: fullHtml, loading: false };
      });
    });
  };

  // Called by ObservationsPanel when the user clicks an observation row.
  // obs === null means the observation was deselected → restore network-level tooltip.
  const handleObservationSelect = (obs: any | null) => {
    if (!activePanel) return;

    if (obs === null) {
      setActivePanel((prev) => (prev ? { ...prev, html: basePanelHtml } : prev));
      return;
    }

    const base =
      mvData ??
      (activeRow ? { ...activeRow, wigle_v3_observation_count: activeRow.v3_obs_count } : {});
    const normalized = normalizeTooltipData({
      ...base,
      // Use this observation's SSID (may differ from network default)
      ssid: obs.ssid || activeRow?.ssid || '',
      lat: obs.lat,
      lon: obs.lon,
      signal: obs.signal ?? obs.level,
      altitude: obs.alt ?? obs.altitude,
      // Pin first_seen / last_seen to this observation's timestamp
      first_seen: obs.time,
      last_seen: obs.time,
    });
    const html = renderNetworkTooltip({ ...normalized, triggerElement: tableRef.current }) ?? basePanelHtml;
    setActivePanel((prev) => (prev ? { ...prev, html } : prev));
  };

  const loadPage = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: '50',
          ssid: ssidFilter,
          bssid: bssidFilter,
          city: cityFilter,
          region: regionFilter,
        });
        const response = await wigleApi.getEnrichmentCatalog(params);
        if (response.ok) {
          const rows: EnrichmentRow[] = response.data || [];
          if (append) {
            setAllRows((prev) => [...prev, ...rows]);
          } else {
            setAllRows(rows);
            setSelected(new Set());
          }
          setTotal(response.total);
          const totalPages = Math.ceil((response.total || 0) / 50);
          setHasMore(pageNum < totalPages);
          setNextPage(pageNum + 1);
        }
      } catch (e) {
        console.error('Failed to fetch enrichment catalog', e);
      } finally {
        setLoading(false);
      }
    },
    [ssidFilter, bssidFilter, cityFilter, regionFilter]
  );

  // Reset and reload from page 1 when filters change (debounced)
  useEffect(() => {
    setAllRows([]);
    setNextPage(1);
    setHasMore(true);
    const timeout = setTimeout(() => loadPage(1, false), 300);
    return () => clearTimeout(timeout);
  }, [ssidFilter, bssidFilter, cityFilter, regionFilter, loadPage]);

  // Infinite scroll: append next page when near bottom
  useEffect(() => {
    const container = tableRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (loading || !hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop <= clientHeight + 200) {
        loadPage(nextPage, true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, nextPage, loadPage]);

  const toggleSelect = (bssid: string) => {
    if (processingBssids.has(bssid)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bssid)) next.delete(bssid);
      else next.add(bssid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === allRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allRows.map((r) => r.bssid)));
    }
  };

  const handleEnrichSelected = async () => {
    const toProcess = Array.from(selected);
    if (toProcess.length === 0) return;

    setProcessingBssids((prev) => new Set([...Array.from(prev), ...toProcess]));
    setSelected(new Set());
    setStatusMessage(null);

    try {
      const response: any = await onEnrich(toProcess);

      // If the run started but immediately hit a 429, the response run status will be 'paused'
      if (response?.run?.status === 'paused') {
        setStatusMessage({
          type: 'error',
          text: 'WiGLE Daily Quota Exhausted. Run has been paused and will need to be resumed later.',
        });
      }

      // Wait a bit then refresh to see updated counts
      setTimeout(() => loadPage(1, false), 2000);
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to start enrichment' });
    } finally {
      // Keep them marked as processing for a bit to show status
      setTimeout(() => {
        setProcessingBssids((prev) => {
          const next = new Set(prev);
          toProcess.forEach((b) => next.delete(b));
          return next;
        });
      }, 5000);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-start">
        {/* Left: table + filters + action bar */}
        <div className="flex-1 min-w-0 space-y-4">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
                statusMessage.type === 'error'
                  ? 'bg-red-900/20 border-red-700/50 text-red-400'
                  : 'bg-blue-900/20 border-blue-700/50 text-blue-400'
              }`}
            >
              <span>{statusMessage.text}</span>
              <button
                onClick={() => setStatusMessage(null)}
                className="opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Filters Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="Filter SSID..."
              value={ssidFilter}
              onChange={(e) => {
                setSsidFilter(e.target.value);
              }}
              className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none transition-all"
            />
            <input
              type="text"
              placeholder="Filter BSSID..."
              value={bssidFilter}
              onChange={(e) => {
                setBssidFilter(e.target.value);
              }}
              className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none transition-all"
            />
            <input
              type="text"
              placeholder="Filter City..."
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
              }}
              className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none transition-all"
            />
            <select
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
              }}
              className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white focus:border-blue-500/50 outline-none transition-all"
            >
              <option value="">All States</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Bar */}
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {total.toLocaleString()} Networks Found
              </div>
              <button
                onClick={() => loadPage(1, false)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-black uppercase tracking-tighter"
              >
                Refresh List
              </button>
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
          <div
            ref={tableRef}
            className="overflow-x-auto overflow-y-auto max-h-[36rem] rounded border border-slate-800/60 bg-slate-900/20"
          >
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-800/40 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allRows.length > 0 && selected.size === allRows.length}
                      onChange={toggleSelectAll}
                      className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-600"
                    />
                  </th>
                  <th className="px-3 py-2">Network (SSID/BSSID)</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 whitespace-nowrap">First Seen</th>
                  <th className="px-3 py-2 whitespace-nowrap">Last Seen</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Last v3 Import</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500 italic">
                      Loading catalog...
                    </td>
                  </tr>
                )}
                {!loading && allRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500 italic">
                      No networks found matching filters.
                    </td>
                  </tr>
                )}
                {allRows.map((row) => (
                  <tr
                    key={row.bssid}
                    className={`hover:bg-blue-500/5 transition-colors cursor-pointer ${
                      activePanel?.bssid === row.bssid
                        ? 'bg-blue-500/10'
                        : selected.has(row.bssid)
                          ? 'bg-blue-500/10'
                          : ''
                    } ${processingBssids.has(row.bssid) ? 'opacity-60 cursor-wait' : ''}`}
                    onClick={() => handleRowClick(row)}
                  >
                    <td
                      className="px-3 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(row.bssid);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(row.bssid)}
                        onChange={() => {}}
                        disabled={processingBssids.has(row.bssid)}
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
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono text-[10px]">
                      {row.firsttime ? formatShortDate(row.firsttime) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono text-[10px]">
                      {row.lasttime ? formatShortDate(row.lasttime) : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {processingBssids.has(row.bssid) ? (
                        <span className="text-blue-400 animate-pulse font-bold uppercase text-[9px]">
                          Queuing...
                        </span>
                      ) : row.v3_obs_count > 0 ? (
                        <div className="flex flex-col items-center">
                          <span className="text-cyan-400 font-bold tabular-nums">
                            {row.v3_obs_count}
                          </span>
                          <span className="text-[8px] text-slate-600 uppercase">Forensics</span>
                        </div>
                      ) : (
                        <span className="text-slate-600 uppercase text-[9px]">Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                      {row.last_v3_import ? formatShortDate(row.last_v3_import) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Infinite scroll indicators */}
            {loading && allRows.length > 0 && (
              <div className="px-3 py-3 text-center text-[11px] text-slate-500 bg-slate-900/40">
                Loading more records…
              </div>
            )}
            {!hasMore && allRows.length > 0 && (
              <div className="px-3 py-3 text-center text-[11px] text-slate-600">
                All {allRows.length.toLocaleString()} records loaded
              </div>
            )}
          </div>
        </div>
        {/* end left column */}

        {/* Right: Observations Panel */}
        <div
          className="w-[280px] flex-shrink-0 rounded border border-slate-800/60 bg-slate-900/20 overflow-hidden"
          style={{ height: '36rem' }}
        >
          <ObservationsPanel
            selectedBssid={activePanel?.bssid ?? null}
            selectedSsid={allRows.find((r) => r.bssid === activePanel?.bssid)?.ssid ?? null}
            onObservationSelect={handleObservationSelect}
          />
        </div>
      </div>
      {/* end flex container */}

      {/* Forensic card — full-width below the table when a row is clicked */}
      {activePanel && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/60">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {activePanel.loading ? 'Loading forensic data…' : 'Forensic Preview'}
            </span>
            <button
              onClick={() => setActivePanel(null)}
              className="text-slate-500 hover:text-slate-200 transition-colors text-sm leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex justify-center p-6 bg-slate-950/30">
            <div
              className="scale-[0.92] origin-top"
              dangerouslySetInnerHTML={{ __html: activePanel.html }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
