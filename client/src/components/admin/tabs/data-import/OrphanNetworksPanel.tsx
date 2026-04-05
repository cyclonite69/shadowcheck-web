import React, { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../../../../api/adminApi';
import type { OrphanNetworkRow } from './types';
import { formatShortDate } from '../../../../utils/formatDate';

const PAGE_SIZE = 100;

const formatCoords = (lat: number | null, lon: number | null) => {
  if (lat == null || lon == null) return '—';
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
};

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

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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
        const data: any = await adminApi.getOrphanNetworks(PAGE_SIZE, search, nextOffset);
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
        if (requestId !== requestIdRef.current) {
          return;
        }

        setLoading(false);
        setIsLoadingMore(false);
      }
    },
    [search]
  );

  useEffect(() => {
    setRows([]);
    setHasMore(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    loadRows({ reset: true });
  }, [refreshKey, search, loadRows]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      if (loading || isLoadingMore || !hasMore) return;

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

  const reloadRows = () => {
    setRows([]);
    setHasMore(false);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    loadRows({ reset: true });
  };

  const handleCheckWigle = async (bssid: string) => {
    try {
      setActiveBssid(bssid);
      await adminApi.checkOrphanNetworkWigle(bssid);
      reloadRows();
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
        <div
          ref={scrollRef}
          data-testid="orphan-networks-scroll-container"
          className="max-h-[36rem] overflow-auto"
        >
          <table className="w-full text-xs text-slate-300">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/50 sticky top-0 bg-slate-950/95 backdrop-blur">
                <th className="text-left py-1.5 pr-3">Moved</th>
                <th className="text-left py-1.5 pr-3">BSSID</th>
                <th className="text-left py-1.5 pr-3">SSID</th>
                <th className="text-left py-1.5 pr-3">Type</th>
                <th className="text-right py-1.5 pr-3">Freq</th>
                <th className="text-left py-1.5 pr-3">Best Coords</th>
                <th className="text-left py-1.5 pr-3">Source</th>
                <th className="text-right py-1.5 pr-3">WiGLE Obs</th>
                <th className="text-left py-1.5 pr-3">Backfill</th>
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
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {renderStatus(row)}
                      <button
                        type="button"
                        onClick={() => handleCheckWigle(row.bssid)}
                        disabled={activeBssid === row.bssid}
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                        title={row.last_attempted_at || undefined}
                      >
                        {activeBssid === row.bssid ? 'Checking...' : 'Check WiGLE'}
                      </button>
                    </div>
                  </td>
                  <td className="py-1.5 text-slate-400">{row.move_reason}</td>
                </tr>
              ))}
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
