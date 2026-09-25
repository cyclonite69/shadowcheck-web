import React, { useEffect, useState, useCallback, useRef } from 'react';
import { wigleApi } from '../../../../api/wigleApi';
import { formatShortDate } from '../../../../utils/formatDate';
import { US_STATES } from '../../../../constants/network';

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef {
  id: string;
  label: string;
  sortKey: string;
  defaultVisible: boolean;
}

const COLUMNS: ColDef[] = [
  { id: 'network', label: 'Network', sortKey: 'ssid', defaultVisible: true },
  { id: 'location', label: 'Location', sortKey: 'location', defaultVisible: true },
  { id: 'first', label: 'First (v2)', sortKey: 'firsttime', defaultVisible: true },
  { id: 'last', label: 'Last (v2)', sortKey: 'lasttime', defaultVisible: true },
  { id: 'status', label: 'Status', sortKey: 'status', defaultVisible: true },
  { id: 'lastImport', label: 'Last v3 Import', sortKey: 'last_v3_import', defaultVisible: true },
  { id: 'signal', label: 'Signal (dBm)', sortKey: 'signal', defaultVisible: false },
  { id: 'channel', label: 'Channel', sortKey: 'channel', defaultVisible: false },
  { id: 'encryption', label: 'Encryption', sortKey: 'encryption', defaultVisible: false },
];

// ─── Types ────────────────────────────────────────────────────────────────────

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
  // optional fields that may come from MV enrichment
  signal?: number | null;
  channel?: number | null;
  encryption?: string | null;
}

type EnrichmentStartResponse = {
  ok?: boolean;
  run?: { id?: number; status?: string; lastError?: string | null };
};

interface V3EnrichmentManagerTableProps {
  onEnrich: (bssids: string[]) => Promise<EnrichmentStartResponse | void>;
  onSelect?: (bssid: string) => void;
  isLoading: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Matches server MAX_TARGETED_ENRICHMENT_BATCH */
const MAX_TARGETED_SELECTION = 100;
const ENRICHMENT_MS_PER_BSSID = 25_000;

const enrichmentWaitMs = (count: number) => 60_000 + count * ENRICHMENT_MS_PER_BSSID;

/** Poll import run until it leaves `running` or times out. */
async function waitForEnrichmentRunOutcome(
  runId: number,
  maxWaitMs = 90_000
): Promise<{ status: string; lastError?: string | null } | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const data = await wigleApi.getImportRun(runId);
    const run = (data as { run?: { status?: string; lastError?: string | null } })?.run;
    if (!run?.status || run.status === 'running') {
      await sleep(2000);
      continue;
    }
    return { status: run.status, lastError: run.lastError ?? null };
  }
  return null;
}

function enrichmentOutcomeMessage(outcome: {
  status: string;
  lastError?: string | null;
}): { type: 'error' | 'info'; text: string } | null {
  if (outcome.status === 'paused') {
    return {
      type: 'error',
      text:
        outcome.lastError ||
        'WiGLE daily quota exhausted or detail limit reached. Resume the run when quota resets.',
    };
  }
  if (outcome.status === 'failed') {
    return {
      type: 'error',
      text: outcome.lastError || 'Enrichment run failed. Check server logs or import runs.',
    };
  }
  if (outcome.status === 'completed') {
    return {
      type: 'info',
      text: 'Enrichment run completed. Refresh the catalog to see updated forensics.',
    };
  }
  return null;
}

type SortEntry = { key: string; dir: 'asc' | 'desc' };

/*
function getSortValue(row: EnrichmentRow, key: string): string | number {
  switch (key) {
    case 'ssid':
      return (row.ssid || row.bssid).toLowerCase();
    case 'location':
      return `${row.city || ''},${row.region || ''}`.toLowerCase();
    case 'firsttime':
      return row.firsttime ?? '';
    case 'lasttime':
      return row.lasttime ?? '';
    case 'status':
      return row.v3_obs_count;
    case 'last_v3_import':
      return row.last_v3_import ?? '';
    case 'signal':
      return row.signal ?? -999;
    case 'channel':
      return row.channel ?? 0;
    case 'encryption':
      return (row.encryption ?? '').toLowerCase();
    default:
      return '';
  }
}
*/

/*
function applySortCols(rows: EnrichmentRow[], sortCols: SortEntry[]): EnrichmentRow[] {
  if (sortCols.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const { key, dir } of sortCols) {
      const av = getSortValue(a, key);
      const bv = getSortValue(b, key);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}
*/

// ─── Component ────────────────────────────────────────────────────────────────

export const V3EnrichmentManagerTable: React.FC<V3EnrichmentManagerTableProps> = ({
  onEnrich,
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

  // Multi-column sort
  const [sortCols, setSortCols] = useState<SortEntry[]>([]);

  // Column visibility — persisted to localStorage
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('v3enrichment_columns');
      if (saved) {
        return new Set(JSON.parse(saved) as string[]);
      }
    } catch {
      // Ignore localStorage read/parse errors and fall back to defaults
    }
    return new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id));
  });

  useEffect(() => {
    localStorage.setItem('v3enrichment_columns', JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  // Column chooser popover open state
  const [chooserOpen, setChooserOpen] = useState(false);
  const chooserRef = useRef<HTMLDivElement | null>(null);

  // Close chooser on outside click
  useEffect(() => {
    if (!chooserOpen) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (chooserRef.current && !chooserRef.current.contains(e.target as Node)) {
        setChooserOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chooserOpen]);

  // ── Sort header click ──────────────────────────────────────────────────────

  const handleSortClick = (col: ColDef, e: React.MouseEvent) => {
    const key = col.sortKey;
    setSortCols((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (e.shiftKey) {
        // Shift-click: add/toggle as secondary key
        if (idx === -1) {
          return [...prev, { key, dir: 'asc' }];
        }
        if (prev[idx].dir === 'asc') {
          const next = [...prev];
          next[idx] = { key, dir: 'desc' };
          return next;
        }
        // desc → remove
        return prev.filter((_, i) => i !== idx);
      } else {
        // Plain click: sole sort key
        if (idx === -1 || prev.length > 1) {
          return [{ key, dir: 'asc' }];
        }
        if (prev[0].dir === 'asc') {
          return [{ key, dir: 'desc' }];
        }
        return []; // desc → clear
      }
    });
  };

  // ── Data loading ───────────────────────────────────────────────────────────

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
        if (sortCols.length > 0) {
          params.set('sortBy', sortCols.map((s) => s.key).join(','));
          params.set('sortDir', sortCols.map((s) => s.dir).join(','));
        }
        const response = await wigleApi.getEnrichmentCatalog(params);
        if (response.ok) {
          const rows: EnrichmentRow[] = response.data || [];
          if (append) {
            setAllRows((prev) => [...prev, ...rows]);
          } else {
            setAllRows(rows);
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
    [ssidFilter, bssidFilter, cityFilter, regionFilter, sortCols]
  );

  useEffect(() => {
    setAllRows([]);
    setNextPage(1);
    setHasMore(true);
    const timeout = setTimeout(() => loadPage(1, false), 300);
    return () => clearTimeout(timeout);
  }, [ssidFilter, bssidFilter, cityFilter, regionFilter, sortCols, loadPage]);

  useEffect(() => {
    const container = tableRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      if (loading || !hasMore) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop <= clientHeight + 200) {
        loadPage(nextPage, true);
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, nextPage, loadPage]);

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = (bssid: string) => {
    if (processingBssids.has(bssid)) {
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bssid)) {
        next.delete(bssid);
      } else {
        next.add(bssid);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === allRows.length) {
      setSelected(new Set());
    } else {
      const capped = allRows.slice(0, MAX_TARGETED_SELECTION).map((r) => r.bssid);
      setSelected(new Set(capped));
    }
  };

  const handleEnrichSelected = async () => {
    const toProcess = Array.from(selected);
    if (toProcess.length === 0) {
      return;
    }

    if (toProcess.length > MAX_TARGETED_SELECTION) {
      setStatusMessage({
        type: 'error',
        text: `Select at most ${MAX_TARGETED_SELECTION} networks per run (selected ${toProcess.length}).`,
      });
      return;
    }

    setProcessingBssids((prev) => new Set([...Array.from(prev), ...toProcess]));
    setSelected(new Set());
    setStatusMessage(null);

    try {
      const response = (await onEnrich(toProcess)) as EnrichmentStartResponse | void;
      const runId = response?.run?.id;
      const immediate = response?.run?.status
        ? enrichmentOutcomeMessage({
            status: response.run.status,
            lastError: response.run.lastError,
          })
        : null;
      if (immediate) {
        setStatusMessage(immediate);
      } else if (runId) {
        setStatusMessage({
          type: 'info',
          text: `Enriching ${toProcess.length} network(s) in run #${runId} (~20s between WiGLE detail calls).`,
        });
        const outcome = await waitForEnrichmentRunOutcome(
          runId,
          enrichmentWaitMs(toProcess.length)
        );
        if (outcome) {
          const message = enrichmentOutcomeMessage(outcome);
          if (message) {
            setStatusMessage({
              ...message,
              text:
                outcome.status === 'completed'
                  ? `Finished enriching ${toProcess.length} network(s). ${message.text}`
                  : message.text,
            });
          }
        } else {
          setStatusMessage({
            type: 'info',
            text: `Run #${runId} is still processing ${toProcess.length} network(s). Watch the run banner above.`,
          });
        }
      }
      setTimeout(() => loadPage(1, false), 2000);
    } catch (e: any) {
      if (e?.status !== 409) {
        setStatusMessage({ type: 'error', text: e.message || 'Failed to start enrichment' });
      }
    } finally {
      setProcessingBssids((prev) => {
        const next = new Set(prev);
        toProcess.forEach((b) => next.delete(b));
        return next;
      });
    }
  };

  // ── Derived display rows ───────────────────────────────────────────────────

  const displayRows = allRows;
  const visibleColDefs = COLUMNS.filter((c) => visibleCols.has(c.id));
  // +1 for the checkbox column
  const colSpan = visibleColDefs.length + 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex justify-between items-center ${
            statusMessage.type === 'error'
              ? 'bg-red-900/20 border-red-700/50 text-red-400'
              : 'bg-blue-900/20 border-blue-700/50 text-blue-400'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="opacity-50 hover:opacity-100">
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
          onChange={(e) => setSsidFilter(e.target.value)}
          className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none transition-all"
        />
        <input
          type="text"
          placeholder="Filter BSSID..."
          value={bssidFilter}
          onChange={(e) => setBssidFilter(e.target.value)}
          className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none transition-all"
        />
        <input
          type="text"
          placeholder="Filter City..."
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-2 py-1.5 bg-slate-950/50 border border-slate-800 rounded text-xs text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none transition-all"
        />
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
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
        {/* Left: count */}
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          {total.toLocaleString()} Networks Found
        </span>

        {/* Right: Refresh + Columns + Enrich Selected */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadPage(1, false)}
              className="h-7 px-3 rounded border border-slate-700 bg-slate-900/50 text-slate-300 text-[10px] font-black uppercase tracking-tighter transition-all hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-95"
            >
              Refresh List
            </button>

            {/* Column Chooser */}
            <div className="relative" ref={chooserRef}>
              <button
                type="button"
                onClick={() => setChooserOpen((o) => !o)}
                title="Choose columns"
                className={`h-7 px-3 rounded border text-[10px] font-black uppercase tracking-tighter transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-95 ${
                  chooserOpen
                    ? 'border-cyan-500/60 bg-slate-800 text-cyan-300'
                    : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white'
                }`}
              >
                ⊞ Columns
              </button>
              {chooserOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-slate-700/60 bg-slate-900 shadow-xl py-1">
                  {COLUMNS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800/60 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.id)}
                        onChange={() => {
                          setVisibleCols((prev) => {
                            const next = new Set(prev);
                            if (next.has(col.id)) {
                              next.delete(col.id);
                            } else {
                              next.add(col.id);
                            }
                            return next;
                          });
                        }}
                        className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-600"
                      />
                      <span className="text-[11px] text-slate-300">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleEnrichSelected}
              disabled={selected.size === 0 || actionLoading}
              className="h-7 px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white rounded text-[10px] font-black uppercase tracking-tighter transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 active:scale-95 shadow-lg shadow-blue-500/20"
            >
              Enrich Selected ({selected.size})
            </button>
          </div>
          <span className="w-full text-[9px] text-slate-500 max-w-[220px] text-right leading-tight">
            Check multiple rows, or use the header box to select all loaded (max{' '}
            {MAX_TARGETED_SELECTION} per run).
          </span>
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className="overflow-x-auto overflow-y-auto max-h-[36rem] rounded border border-slate-800/60 bg-slate-900/20"
      >
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 z-10 bg-slate-900 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
            <tr>
              {/* Checkbox — always visible */}
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allRows.length > 0 && selected.size === allRows.length}
                  onChange={toggleSelectAll}
                  className="w-3 h-3 rounded bg-slate-950 border-slate-700 text-blue-600"
                />
              </th>

              {visibleColDefs.map((col) => {
                const sortIdx = sortCols.findIndex((s) => s.key === col.sortKey);
                const sortEntry = sortIdx !== -1 ? sortCols[sortIdx] : null;
                return (
                  <th
                    key={col.id}
                    className="px-3 py-2 whitespace-nowrap cursor-pointer select-none hover:text-slate-300 transition-colors"
                    onClick={(e) => handleSortClick(col, e)}
                    title="Click to sort · Shift+click for multi-sort"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.id === 'first' || col.id === 'last' ? (
                        <>
                          {col.id === 'first' ? 'First' : 'Last'}{' '}
                          <span className="text-[9px] normal-case text-slate-600">(v2)</span>
                        </>
                      ) : (
                        col.label
                      )}
                      {sortEntry && (
                        <span className="text-cyan-400 font-black">
                          {sortEntry.dir === 'asc' ? '↑' : '↓'}
                          {sortCols.length > 1 && (
                            <sup className="text-[8px] ml-px">{sortIdx + 1}</sup>
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/50">
            {loading && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-500 italic">
                  Loading catalog...
                </td>
              </tr>
            )}
            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-3 py-8 text-center text-slate-500 italic">
                  No networks found matching filters.
                </td>
              </tr>
            )}

            {displayRows.map((row, idx) => (
              <tr
                key={`${row.bssid}-${idx}`}
                className={`hover:bg-blue-500/5 transition-colors ${
                  selected.has(row.bssid) ? 'bg-blue-500/10' : ''
                } ${processingBssids.has(row.bssid) ? 'opacity-60 cursor-wait' : ''}`}
              >
                {/* Checkbox cell — always visible */}
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

                {visibleColDefs.map((col) => {
                  switch (col.id) {
                    case 'network':
                      return (
                        <td key={col.id} className="px-3 py-2">
                          <div className="font-bold text-slate-200 truncate max-w-[180px]">
                            {row.ssid || row.bssid}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{row.bssid}</div>
                        </td>
                      );
                    case 'location':
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-400">
                          <div className="truncate max-w-[140px]">
                            {row.city || 'Unknown'}
                            {row.region ? `, ${row.region}` : ''}
                          </div>
                        </td>
                      );
                    case 'first':
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-2 text-slate-500 whitespace-nowrap font-mono text-[10px]"
                        >
                          {row.firsttime ? formatShortDate(row.firsttime) : '—'}
                        </td>
                      );
                    case 'last':
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-2 text-slate-400 whitespace-nowrap font-mono text-[10px]"
                        >
                          {row.lasttime ? formatShortDate(row.lasttime) : '—'}
                        </td>
                      );
                    case 'status':
                      return (
                        <td key={col.id} className="px-3 py-2 text-center">
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
                      );
                    case 'lastImport':
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-2 text-right text-slate-500 whitespace-nowrap"
                        >
                          {row.last_v3_import ? formatShortDate(row.last_v3_import) : 'Never'}
                        </td>
                      );
                    case 'signal':
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-2 text-center font-mono text-[10px] text-slate-400"
                        >
                          {row.signal !== null && row.signal !== undefined
                            ? `${row.signal} dBm`
                            : '—'}
                        </td>
                      );
                    case 'channel':
                      return (
                        <td
                          key={col.id}
                          className="px-3 py-2 text-center font-mono text-[10px] text-slate-400"
                        >
                          {row.channel !== null && row.channel !== undefined ? row.channel : '—'}
                        </td>
                      );
                    case 'encryption':
                      return (
                        <td key={col.id} className="px-3 py-2 text-slate-400 text-[10px]">
                          {row.encryption || '—'}
                        </td>
                      );
                    default:
                      return null;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>

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
  );
};
