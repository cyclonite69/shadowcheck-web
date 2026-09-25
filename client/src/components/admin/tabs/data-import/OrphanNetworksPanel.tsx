import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../../../../api/adminApi';
import type { OrphanNetworkRow } from './types';
import { formatShortDate } from '../../../../utils/formatDate';

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef {
  id: string;
  label: string;
  sortKey: string | null;
  defaultVisible: boolean;
}

const COLUMNS: ColDef[] = [
  { id: 'bssid', label: 'BSSID', sortKey: 'bssid', defaultVisible: true },
  { id: 'ssid', label: 'SSID', sortKey: 'ssid', defaultVisible: true },
  { id: 'type', label: 'Type', sortKey: null, defaultVisible: false },
  { id: 'backfill_status', label: 'Status', sortKey: 'backfill_status', defaultVisible: true },
  {
    id: 'observations',
    label: 'WiGLE Obs',
    sortKey: 'observations_imported',
    defaultVisible: true,
  },
  { id: 'moved_at', label: 'Orphaned', sortKey: 'moved_at', defaultVisible: true },
  { id: 'move_reason', label: 'Reason', sortKey: 'move_reason', defaultVisible: true },
  {
    id: 'last_attempted_at',
    label: 'Last Attempt',
    sortKey: 'last_attempted_at',
    defaultVisible: true,
  },
  { id: 'lasttime_ms', label: 'Last Seen', sortKey: 'lasttime_ms', defaultVisible: false },
  { id: 'bestlevel', label: 'Signal', sortKey: 'bestlevel', defaultVisible: false },
  { id: 'unique_days', label: 'Unique Days', sortKey: 'unique_days', defaultVisible: false },
  {
    id: 'unique_locations',
    label: 'Unique Locs',
    sortKey: 'unique_locations',
    defaultVisible: false,
  },
];

type SortEntry = { key: string; dir: 'asc' | 'desc' };

const PAGE_SIZE = 100;

export function OrphanNetworksPanel({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<OrphanNetworkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [activeBssid, setActiveBssid] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const rowsRef = useRef<OrphanNetworkRow[]>([]);

  // Sort state
  const [sortCols, setSortCols] = useState<SortEntry[]>([]);

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('orphan_columns');
      if (saved) {
        return new Set(JSON.parse(saved) as string[]);
      }
    } catch {
      // Ignore localStorage read/parse errors and fall back to defaults
    }
    return new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id));
  });
  useEffect(() => {
    localStorage.setItem('orphan_columns', JSON.stringify([...visibleCols]));
  }, [visibleCols]);

  // Column chooser popover
  const [chooserOpen, setChooserOpen] = useState(false);
  const chooserRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Sort header click
  const handleSortClick = (col: ColDef, e: React.MouseEvent) => {
    if (!col.sortKey) {
      return;
    }
    const key = col.sortKey;
    setSortCols((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (e.shiftKey) {
        if (idx === -1) {
          return [...prev, { key, dir: 'asc' }];
        }
        if (prev[idx].dir === 'asc') {
          const next = [...prev];
          next[idx] = { key, dir: 'desc' };
          return next;
        }
        return prev.filter((_, i) => i !== idx);
      } else {
        if (idx === -1 || prev.length > 1) {
          return [{ key, dir: 'asc' }];
        }
        if (prev[0].dir === 'asc') {
          return [{ key, dir: 'desc' }];
        }
        return [];
      }
    });
  };

  const loadRows = useCallback(
    async ({ reset }: { reset: boolean }) => {
      const requestId = ++requestIdRef.current;
      const nextOffset = reset ? 0 : rowsRef.current.length;

      if (reset) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const sortBy = sortCols.map((s) => s.key).join(',');
        const sortDir = sortCols.map((s) => s.dir).join(',');
        const data: any = await adminApi.getOrphanNetworks(
          PAGE_SIZE,
          search,
          nextOffset,
          sortBy,
          sortDir
        );
        if (requestId !== requestIdRef.current) {
          return;
        }

        const nextRows = Array.isArray(data?.rows) ? data.rows : [];
        const nextTotal = Number(data?.total ?? 0);

        setRows((prev) => (reset ? nextRows : [...prev, ...nextRows]));
        setTotal(nextTotal);
        setHasMore(Boolean(data?.pagination?.hasMore));
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setRows(reset ? [] : rowsRef.current);
        setTotal(0);
        setHasMore(false);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [search, sortCols]
  );

  useEffect(() => {
    setRows([]);
    setHasMore(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    loadRows({ reset: true });
  }, [refreshKey, search, sortCols, loadRows]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      if (loading || isLoadingMore || !hasMore) {
        return;
      }
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop <= clientHeight + 200) {
          loadRows({ reset: false });
        }
      }, 100);
    };
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [hasMore, isLoadingMore, loadRows, loading]);

  const handleCheckWigle = async (bssid: string) => {
    try {
      setActiveBssid(bssid);
      const result = await adminApi.checkOrphanNetworkWigle(bssid);
      if (result.status === 'error' && result.message) {
        alert(`WiGLE Error: ${result.message}`);
      }
      setRows((prev) =>
        prev.map((row) => {
          if (row.bssid !== bssid) {
            return row;
          }
          return {
            ...row,
            backfill_status: result.status,
            matched_netid: result.matchedNetid,
            observations_imported: result.totalObservations ?? row.observations_imported,
            last_attempted_at: new Date().toISOString(),
            last_error: result.status === 'error' ? result.message : null,
          };
        })
      );
    } catch (err: any) {
      console.error('Failed to check WiGLE for orphan:', err);
      alert(`Request failed: ${err.message || 'Unknown error'}`);
    } finally {
      setActiveBssid(null);
    }
  };

  const renderStatus = (row: OrphanNetworkRow) => {
    switch (row.backfill_status) {
      case 'wigle_match_imported_v3':
        return (
          <span className="text-green-400" title={row.matched_netid || undefined}>
            matched
          </span>
        );
      case 'no_wigle_match':
        return <span className="text-slate-400">no match</span>;
      case 'error':
        return (
          <span className="text-red-400" title={row.last_error || undefined}>
            error
          </span>
        );
      default:
        return <span className="text-amber-300">not checked</span>;
    }
  };

  const visibleColDefs = COLUMNS.filter((c) => visibleCols.has(c.id));

  return (
    <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-300">Orphan Networks</h3>
          <p className="text-xs text-slate-500 mt-1">
            Preserved parent-only rows awaiting reconciliation or WiGLE backfill. Showing{' '}
            <span className="font-mono text-slate-400">{rows.length}</span> of{' '}
            <span className="font-mono text-slate-400">{total}</span>.
            {hasMore && !loading ? <> Scroll to load more.</> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Column chooser */}
          <div className="relative" ref={chooserRef}>
            <button
              onClick={() => setChooserOpen((o) => !o)}
              title="Choose columns"
              className={`text-[10px] font-black uppercase tracking-tighter transition-colors ${
                chooserOpen ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
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

          {/* Search */}
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
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 py-2">Loading orphan networks...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-2">No orphan networks found.</p>
      ) : (
        <div
          ref={scrollRef}
          data-testid="orphan-networks-scroll-container"
          className="max-h-[36rem] overflow-auto"
        >
          <table className="w-full text-xs text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-900 text-slate-500 border-b border-slate-700/50">
              <tr>
                {visibleColDefs.map((col) => {
                  const sortIdx = sortCols.findIndex((s) => s.key === col.sortKey);
                  const sortEntry = sortIdx !== -1 ? sortCols[sortIdx] : null;
                  return (
                    <th
                      key={col.id}
                      className={`text-left py-1.5 pr-3 whitespace-nowrap select-none ${col.sortKey ? 'cursor-pointer hover:text-slate-300 transition-colors' : ''}`}
                      onClick={col.sortKey ? (e) => handleSortClick(col, e) : undefined}
                      title={col.sortKey ? 'Click to sort · Shift+click for multi-sort' : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
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
                <th className="text-left py-1.5">Check</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                return (
                  <React.Fragment key={`${row.bssid}-${idx}`}>
                    <tr className="border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-700/30">
                      {visibleColDefs.map((col) => {
                        switch (col.id) {
                          case 'bssid':
                            return (
                              <td
                                key={col.id}
                                className="py-1.5 pr-3 font-mono text-slate-200 whitespace-nowrap"
                              >
                                {row.bssid}
                              </td>
                            );
                          case 'ssid':
                            return (
                              <td
                                key={col.id}
                                className="py-1.5 pr-3 max-w-[16rem] truncate"
                                title={row.ssid || '(hidden)'}
                              >
                                {row.ssid || '(hidden)'}
                              </td>
                            );
                          case 'type':
                            return (
                              <td key={col.id} className="py-1.5 pr-3">
                                {row.type || '—'}
                              </td>
                            );
                          case 'backfill_status':
                            return (
                              <td key={col.id} className="py-1.5 pr-3 whitespace-nowrap">
                                {renderStatus(row)}
                              </td>
                            );
                          case 'observations':
                            return (
                              <td key={col.id} className="py-1.5 pr-3 text-right tabular-nums">
                                {row.observations_imported ?? row.wigle_v3_observation_count ?? 0}
                              </td>
                            );
                          case 'moved_at':
                            return (
                              <td
                                key={col.id}
                                className="py-1.5 pr-3 text-slate-400 whitespace-nowrap"
                              >
                                {formatShortDate(row.moved_at)}
                              </td>
                            );
                          case 'move_reason':
                            return (
                              <td key={col.id} className="py-1.5 pr-3 text-slate-400">
                                {row.move_reason}
                              </td>
                            );
                          case 'last_attempted_at':
                            return (
                              <td
                                key={col.id}
                                className="py-1.5 pr-3 text-slate-400 whitespace-nowrap"
                              >
                                {row.last_attempted_at
                                  ? formatShortDate(row.last_attempted_at)
                                  : '—'}
                              </td>
                            );
                          case 'lasttime_ms':
                            return (
                              <td
                                key={col.id}
                                className="py-1.5 pr-3 text-slate-400 whitespace-nowrap font-mono text-[10px]"
                              >
                                {row.lasttime_ms
                                  ? formatShortDate(new Date(row.lasttime_ms).toISOString())
                                  : '—'}
                              </td>
                            );
                          case 'bestlevel':
                            return (
                              <td key={col.id} className="py-1.5 pr-3 text-right tabular-nums">
                                {row.bestlevel !== null && row.bestlevel !== undefined
                                  ? `${row.bestlevel} dBm`
                                  : '—'}
                              </td>
                            );
                          case 'unique_days':
                            return (
                              <td key={col.id} className="py-1.5 pr-3 text-right tabular-nums">
                                {row.unique_days ?? '—'}
                              </td>
                            );
                          case 'unique_locations':
                            return (
                              <td key={col.id} className="py-1.5 pr-3 text-right tabular-nums">
                                {row.unique_locations ?? '—'}
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                      <td className="py-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCheckWigle(row.bssid);
                          }}
                          disabled={activeBssid === row.bssid}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                          title={row.last_attempted_at || undefined}
                        >
                          {activeBssid === row.bssid ? 'Checking...' : 'Check WiGLE'}
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {isLoadingMore ? (
            <p className="px-2 py-3 text-xs text-slate-500">Loading more orphan networks...</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
